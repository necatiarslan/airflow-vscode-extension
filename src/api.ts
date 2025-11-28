/* eslint-disable @typescript-eslint/naming-convention */
import { encode } from 'base-64';
import * as ui from './ui';
import { MethodResult } from './methodResult';
import * as vscode from 'vscode';
import { OAuthCallbackServer } from './oauthServer';
import { ServerConfig, AuthType } from './types';

// Wrapper for fetch to handle ESM node-fetch in CommonJS
const fetch = async (url: string, init?: any) => {
    const module = await import('node-fetch');
    return module.default(url, init);
};

export class AirflowApi {
    private jwtToken: string | undefined;

    constructor(private config: ServerConfig) {}

    private get version(): 'v1' | 'v2' | 'unknown' {
        if (this.config.apiUrl.includes('v1')) { return 'v1'; }
        if (this.config.apiUrl.includes('v2')) { return 'v2'; }
        return 'unknown';
    }

    private async getJwtToken(): Promise<string | undefined> {
        if (this.jwtToken) { return this.jwtToken; }


        try {
            const response = await fetch(this.config.apiUrl.replace("/api/v2", "") + '/auth/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: this.config.apiUserName, password: this.config.apiPassword }),
            });

            const result = await response.json() as any;
            if (response.status === 201 || response.status === 200) {
                this.jwtToken = result['access_token'];
                return this.jwtToken;
            } else {
                ui.logToOutput(`getJwtToken failed: ${response.status} - ${JSON.stringify(result)}`);
            }
        } catch (error) {
            ui.logToOutput("getJwtToken Error", error as Error);
        }
        return undefined;
    }

    private detectAuthType(): AuthType {
        if (this.config.authType) {
            return this.config.authType;
        }
        
        // Auto-detection logic
        if (this.config.customHeaders && Object.keys(this.config.customHeaders).length > 0) {
            return AuthType.CUSTOM_HEADERS;
        }
        
        if (this.version === 'v1') {
            return AuthType.BASIC;
        }
        
        return AuthType.JWT;
    }

    private async getOAuthToken(): Promise<string | undefined> {
        // Check if token exists and is not expired
        if (this.config.oauthAccessToken && this.config.oauthTokenExpiry) {
            const expiry = new Date(this.config.oauthTokenExpiry);
            if (new Date() < expiry) {
                return this.config.oauthAccessToken;
            }
        }
        
        // Refresh token if available
        if (this.config.oauthRefreshToken) {
            return await this.refreshOAuthToken();
        }
        
        // Otherwise, initiate OAuth flow
        return await this.initiateOAuthFlow();
    }

    private async initiateOAuthFlow(): Promise<string | undefined> {
        if (!this.config.oauthClientId || !this.config.oauthAuthUrl || !this.config.oauthTokenUrl) {
            ui.showErrorMessage('Missing OAuth configuration (Client ID, Auth URL, or Token URL)');
            return undefined;
        }

        try {
            const server = new OAuthCallbackServer();
            const redirectUri = this.config.oauthRedirectUri || 'http://localhost:54321/callback';
            
            // Construct authorization URL
            const params = new URLSearchParams({
                client_id: this.config.oauthClientId,
                redirect_uri: redirectUri,
                response_type: 'code',
                scope: (this.config.oauthScopes || []).join(' ')
            });
            
            const authUrl = `${this.config.oauthAuthUrl}?${params.toString()}`;
            
            // Start server and open browser
            const codePromise = server.start();
            await vscode.env.openExternal(vscode.Uri.parse(authUrl));
            
            // Wait for code
            const code = await codePromise;
            
            // Exchange code for token
            const response = await fetch(this.config.oauthTokenUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    grant_type: 'authorization_code',
                    client_id: this.config.oauthClientId,
                    client_secret: this.config.oauthClientSecret,
                    code: code,
                    redirect_uri: redirectUri
                })
            });
            
            const data = await response.json() as any;
            
            if (response.status === 200) {
                this.config.oauthAccessToken = data.access_token;
                this.config.oauthRefreshToken = data.refresh_token;
                
                // Calculate expiry
                if (data.expires_in) {
                    const expiry = new Date();
                    expiry.setSeconds(expiry.getSeconds() + data.expires_in);
                    this.config.oauthTokenExpiry = expiry.toISOString();
                }
                
                return this.config.oauthAccessToken;
            } else {
                ui.showApiErrorMessage('OAuth Token Exchange Error', data);
            }
        } catch (error) {
            ui.showErrorMessage('OAuth Flow Error', error as Error);
        }
        
        return undefined;
    }

    private async refreshOAuthToken(): Promise<string | undefined> {
        if (!this.config.oauthRefreshToken || !this.config.oauthTokenUrl) {
            return undefined;
        }

        try {
            const response = await fetch(this.config.oauthTokenUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    grant_type: 'refresh_token',
                    client_id: this.config.oauthClientId,
                    client_secret: this.config.oauthClientSecret,
                    refresh_token: this.config.oauthRefreshToken
                })
            });
            
            const data = await response.json() as any;
            
            if (response.status === 200) {
                this.config.oauthAccessToken = data.access_token;
                if (data.refresh_token) {
                    this.config.oauthRefreshToken = data.refresh_token;
                }
                
                if (data.expires_in) {
                    const expiry = new Date();
                    expiry.setSeconds(expiry.getSeconds() + data.expires_in);
                    this.config.oauthTokenExpiry = expiry.toISOString();
                }
                
                return this.config.oauthAccessToken;
            } else {
                // If refresh fails, try full flow
                return await this.initiateOAuthFlow();
            }
        } catch (error) {
            ui.logToOutput('OAuth Refresh Error', error as Error);
            return await this.initiateOAuthFlow();
        }
    }

    private async getHeaders(): Promise<Record<string, string>> {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json'
        };

        const authType = this.detectAuthType();

        switch (authType) {
            case AuthType.BASIC:
                headers['Authorization'] = 'Basic ' + encode(`${this.config.apiUserName}:${this.config.apiPassword}`);
                break;
                
            case AuthType.JWT:
                const jwtToken = await this.getJwtToken();
                if (jwtToken) {
                    headers['Authorization'] = 'Bearer ' + jwtToken;
                } else {
                    ui.showWarningMessage('Unable to obtain JWT token for Airflow API v2.');
                }
                break;
                
            case AuthType.CUSTOM_HEADERS:
                if (this.config.customHeaders) {
                    Object.assign(headers, this.config.customHeaders);
                }
                break;
                
            case AuthType.OAUTH2:
                const oauthToken = await this.getOAuthToken();
                if (oauthToken) {
                    headers['Authorization'] = 'Bearer ' + oauthToken;
                } else {
                    ui.showWarningMessage('Unable to obtain OAuth token.');
                }
                break;
        }
        
        return headers;
    }

    public async checkConnection(): Promise<boolean> {
        try {
            const headers = await this.getHeaders();
            const response = await fetch(`${this.config.apiUrl}/dags?limit=1`, { method: 'GET', headers });
            return response.status === 200;
        } catch (e) {
            return false;
        }
    }

    public async getDagList(): Promise<MethodResult<any[]>> {
        const result = new MethodResult<any[]>();
        const allDags: any[] = [];
        let offset = 0;
        const limit = 100;

        try {
            while (true) {
                const headers = await this.getHeaders();
                const response = await fetch(`${this.config.apiUrl}/dags?limit=${limit}&offset=${offset}`, { method: 'GET', headers });
                const data = await response.json() as any;

                if (response.status === 200) {
                    allDags.push(...data["dags"]);
                    if (data["dags"].length < limit) {
                        break;
                    }
                    offset += limit;
                } else {
                    ui.showApiErrorMessage('Api Call Error', data);
                    result.isSuccessful = false;
                    return result;
                }
            }
            result.result = allDags;
            result.isSuccessful = true;
        } catch (error) {
            ui.showErrorMessage('Cannot connect to Airflow.', error as Error);
            result.isSuccessful = false;
            result.error = error as Error;
        }
        return result;
    }

    public async triggerDag(dagId: string, config: string = "{}", date?: string): Promise<MethodResult<any>> {
        const result = new MethodResult<any>();
        try {
            const headers = await this.getHeaders();
            let body: any = { conf: JSON.parse(config) };
            
            if (this.version === 'v1' && date) {
                body.logical_date = date + "T00:00:00Z";
            } else if (this.version === 'v2') {
                body.logical_date = date ? (date + "T00:00:00Z") : new Date().toISOString();
            }

            const response = await fetch(`${this.config.apiUrl}/dags/${dagId}/dagRuns`, {
                method: 'POST',
                headers,
                body: JSON.stringify(body),
            });

            const data = await response.json();
            if (response.status === 200 || response.status === 201) { // 201 Created is typical for POST
                ui.showInfoMessage(`${dagId} Triggered.`);
                result.result = data;
                result.isSuccessful = true;
            } else {
                ui.showApiErrorMessage(`${dagId} Trigger Error`, data);
                result.isSuccessful = false;
            }
        } catch (error) {
            ui.showErrorMessage(`${dagId} Trigger Error`, error as Error);
            result.isSuccessful = false;
            result.error = error as Error;
        }
        return result;
    }

    public async getDagRun(dagId: string, dagRunId: string): Promise<MethodResult<any>> {
        const result = new MethodResult<any>();
        try {
            const headers = await this.getHeaders();
            const response = await fetch(`${this.config.apiUrl}/dags/${dagId}/dagRuns/${dagRunId}`, { method: 'GET', headers });
            const data = await response.json();

            if (response.status === 200) {
                result.result = data;
                result.isSuccessful = true;
            } else {
                result.isSuccessful = false;
            }
        } catch (error) {
            result.isSuccessful = false;
            result.error = error as Error;
        }
        return result;
    }

    public async getLastDagRun(dagId: string): Promise<MethodResult<any>> {
        const history = await this.getDagRunHistory(dagId, 1);
        if (history.isSuccessful && history.result && history.result.dag_runs && history.result.dag_runs.length > 0) {
            return this.getDagRun(dagId, history.result.dag_runs[0].dag_run_id);
        }
        const res = new MethodResult<any>();
        res.isSuccessful = false;
        return res;
    }

    public async getDagRunHistory(dagId: string, limit: number): Promise<MethodResult<any>> {
        const result = new MethodResult<any>();
        try {
            const headers = await this.getHeaders();
            const response = await fetch(`${this.config.apiUrl}/dags/${dagId}/dagRuns?order_by=-start_date&limit=${limit}`, { method: 'GET', headers });
            const data = await response.json();

            if (response.status === 200) {
                result.result = data;
                result.isSuccessful = true;
            } else {
                result.isSuccessful = false;
            }
        } catch (error) {
            result.isSuccessful = false;
            result.error = error as Error;
        }
        return result;
    }

    public async pauseDag(dagId: string, isPaused: boolean): Promise<MethodResult<any>> {
        const result = new MethodResult<any>();
        try {
            const headers = await this.getHeaders();
            const response = await fetch(`${this.config.apiUrl}/dags/${dagId}`, {
                method: 'PATCH',
                headers,
                body: JSON.stringify({ is_paused: isPaused })
            });
            const data = await response.json();

            if (response.status === 200) {
                ui.showInfoMessage(`${dagId} ${isPaused ? "PAUSED" : "UN-PAUSED"}`);
                result.result = data;
                result.isSuccessful = true;
            } else {
                ui.showApiErrorMessage(`${dagId} Pause Error`, data);
                result.isSuccessful = false;
            }
        } catch (error) {
            ui.showErrorMessage(`${dagId} Pause Error`, error as Error);
            result.isSuccessful = false;
            result.error = error as Error;
        }
        return result;
    }

    public async getSourceCode(dagId: string, fileToken?: string): Promise<MethodResult<string>> {
        const result = new MethodResult<string>();
        try {
            const headers = await this.getHeaders();
            let url = "";
            if (this.version === 'v1' && fileToken) {
                url = `${this.config.apiUrl}/dagSources/${fileToken}`;
            } else if (this.version === 'v2') {
                url = `${this.config.apiUrl}/dagSources/${dagId}`;
            } else {
                throw new Error("Unknown Airflow Version or missing file token");
            }

            const response = await fetch(url, { method: 'GET', headers });
            
            if (response.status === 200) {
                if (this.version === 'v2') {
                    const json = await response.json() as any;
                    result.result = json.content;
                } else {
                    result.result = await response.text();
                }
                result.isSuccessful = true;
            } else {
                const data = await response.json();
                ui.showApiErrorMessage(`${dagId} Source Code Error`, data);
                result.isSuccessful = false;
            }
        } catch (error) {
            ui.showErrorMessage(`${dagId} Source Code Error`, error as Error);
            result.isSuccessful = false;
            result.error = error as Error;
        }
        return result;
    }

    public async getImportErrors(): Promise<MethodResult<any>> {
        const result = new MethodResult<any>();
        try {
            const headers = await this.getHeaders();
            const response = await fetch(`${this.config.apiUrl}/importErrors`, { method: 'GET', headers });
            const data = await response.json();

            if (response.status === 200) {
                result.result = data;
                result.isSuccessful = true;
            } else {
                result.isSuccessful = false;
            }
        } catch (error) {
            result.isSuccessful = false;
            result.error = error as Error;
        }
        return result;
    }

    public async getLastDagRunLog(dagId: string): Promise<MethodResult<string>> {
        const result = new MethodResult<string>();
        try {
            ui.showInfoMessage('Fetching Latest DAG Run Logs...');
            const history = await this.getDagRunHistory(dagId, 1);
            if (!history.isSuccessful || !history.result.dag_runs.length) {
                throw new Error("No DAG runs found");
            }

            const dagRunId = history.result.dag_runs[0].dag_run_id;
            const headers = await this.getHeaders();
            
            const tasksResponse = await fetch(`${this.config.apiUrl}/dags/${dagId}/dagRuns/${dagRunId}/taskInstances`, { method: 'GET', headers });
            const tasksData = await tasksResponse.json() as any;

            let logContent = '###################### BEGINNING OF DAG RUN ######################\n\n';
            
            for (const task of tasksData.task_instances || []) {
                const logRes = await fetch(`${this.config.apiUrl}/dags/${dagId}/dagRuns/${dagRunId}/taskInstances/${task.task_id}/logs/${task.try_number}`, { method: 'GET', headers });
                const logText = await logRes.text();
                
                logContent += `############################################################\n`;
                logContent += `Dag=${dagId}\nDagRun=${dagRunId}\nTaskId=${task.task_id}\nTry=${task.try_number}\n`;
                logContent += `############################################################\n\n`;
                logContent += logText + "\n\n";
            }
            logContent += '###################### END OF DAG RUN ######################\n';
            
            result.result = logContent;
            result.isSuccessful = true;
        } catch (error) {
            ui.showErrorMessage(`${dagId} Log Error`, error as Error);
            result.isSuccessful = false;
            result.error = error as Error;
        }
        return result;
    }
    
    public async getDagInfo(dagId: string): Promise<MethodResult<any>> {
        return this.genericGet(`/dags/${dagId}`);
    }

    public async getDagTasks(dagId: string): Promise<MethodResult<any>> {
        return this.genericGet(`/dags/${dagId}/tasks`);
    }

    public async getTaskInstances(dagId: string, dagRunId: string): Promise<MethodResult<any>> {
        return this.genericGet(`/dags/${dagId}/dagRuns/${dagRunId}/taskInstances`);
    }

    public async cancelDagRun(dagId: string, dagRunId: string): Promise<MethodResult<any>> {
        const result = new MethodResult<any>();
        try {
            const headers = await this.getHeaders();
            const response = await fetch(`${this.config.apiUrl}/dags/${dagId}/dagRuns/${dagRunId}`, {
                method: 'PATCH',
                headers,
                body: JSON.stringify({ state: 'failed' })
            });
            const data = await response.json();
            if (response.status === 200) {
                result.result = data;
                result.isSuccessful = true;
            } else {
                ui.showApiErrorMessage(`${dagId} Cancel Error`, data);
                result.isSuccessful = false;
            }
        } catch (error) {
            result.isSuccessful = false;
            result.error = error as Error;
        }
        return result;
    }

    public async getTaskInstanceLog(dagId: string, dagRunId: string, taskId: string): Promise<MethodResult<string>> {
        const result = new MethodResult<string>();
        try {
            ui.showInfoMessage('Fetching Task Logs...');
            const headers = await this.getHeaders();
            
            // First get the try number from task instance details
            // Or just try fetching logs for try 1, 2, etc?
            // The original code fetched all task instances to find the try number.
            
            const tasksResponse = await fetch(`${this.config.apiUrl}/dags/${dagId}/dagRuns/${dagRunId}/taskInstances`, { method: 'GET', headers });
            const tasksData = await tasksResponse.json() as any;
            
            const taskInstance = tasksData.task_instances?.find((t: any) => t.task_id === taskId);
            if (!taskInstance) {
                throw new Error("Task instance not found");
            }

            const logRes = await fetch(`${this.config.apiUrl}/dags/${dagId}/dagRuns/${dagRunId}/taskInstances/${taskId}/logs/${taskInstance.try_number}`, { method: 'GET', headers });
            const logText = await logRes.text();
            
            let logContent = `############################################################\n`;
            logContent += `Dag=${dagId}\nDagRun=${dagRunId}\nTaskId=${taskId}\nTry=${taskInstance.try_number}\n`;
            logContent += `############################################################\n\n`;
            logContent += logText;
            
            result.result = logContent;
            result.isSuccessful = true;
        } catch (error) {
            ui.showErrorMessage(`${dagId} Log Error`, error as Error);
            result.isSuccessful = false;
            result.error = error as Error;
        }
        return result;
    }

    public async getTaskXComs(dagId: string, dagRunId: string, taskId: string): Promise<MethodResult<any>> {
        const result = new MethodResult<any>();
        try {
            const headers = await this.getHeaders();
            const response = await fetch(`${this.config.apiUrl}/dags/${dagId}/dagRuns/${dagRunId}/taskInstances/${taskId}/xcomEntries`, { method: 'GET', headers });
            
            if (response.status === 200) {
                const data = await response.json();
                result.result = data;
                result.isSuccessful = true;
            } else {
                const data = await response.json();
                ui.showApiErrorMessage(`XCom fetch error for ${taskId}`, data);
                result.isSuccessful = false;
            }
        } catch (error) {
            ui.showErrorMessage(`XCom fetch error for ${taskId}`, error as Error);
            result.isSuccessful = false;
            result.error = error as Error;
        }
        return result;
    }

    public async updateDagRunNote(dagId: string, dagRunId: string, note: string): Promise<MethodResult<any>> {
        const result = new MethodResult<any>();
        try {
            const headers = await this.getHeaders();
            const response = await fetch(`${this.config.apiUrl}/dags/${dagId}/dagRuns/${dagRunId}`, {
                method: 'PATCH',
                headers,
                body: JSON.stringify({ note: note })
            });
            const data = await response.json();
            
            if (response.status === 200) {
                ui.showInfoMessage('DAG run note updated successfully');
                result.result = data;
                result.isSuccessful = true;
            } else {
                ui.showApiErrorMessage(`Failed to update note`, data);
                result.isSuccessful = false;
            }
        } catch (error) {
            ui.showErrorMessage(`Failed to update note`, error as Error);
            result.isSuccessful = false;
            result.error = error as Error;
        }
        return result;
    }

    // Add other methods as needed (getConnections, getVariables, getProviders)
    public async getConnections(): Promise<MethodResult<any>> {
        return this.genericGet('/connections');
    }

    public async getVariables(): Promise<MethodResult<any>> {
        return this.genericGet('/variables');
    }

    public async getProviders(): Promise<MethodResult<any>> {
        return this.genericGet('/providers');
    }

    private async genericGet(endpoint: string): Promise<MethodResult<any>> {
        const result = new MethodResult<any>();
        try {
            const headers = await this.getHeaders();
            const response = await fetch(`${this.config.apiUrl}${endpoint}`, { method: 'GET', headers });
            const data = await response.json();
            if (response.status === 200) {
                result.result = data;
                result.isSuccessful = true;
            } else {
                ui.showApiErrorMessage(`Error fetching ${endpoint}`, data);
                result.isSuccessful = false;
            }
        } catch (error) {
            ui.showErrorMessage(`Error fetching ${endpoint}`, error as Error);
            result.isSuccessful = false;
            result.error = error as Error;
        }
        return result;
    }
}