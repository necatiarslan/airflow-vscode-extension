import { AirflowApi } from "./Api";
import { ServerConfig } from '../common/Types';
import * as ui from '../common/UI';
import * as vscode from 'vscode';

interface StoredServerConfig {
    apiUrl: string;
    apiUserName: string;
    apiPassword?: string;
}

const API_URL_KEY = 'apiUrl';
const API_USERNAME_KEY = 'apiUserName';
const API_PASSWORD_KEY = 'apiPassword';
const SERVER_LIST_KEY = 'serverList';
const SERVER_PASSWORD_SECRET_PREFIX = 'airflow-ext.server-password';

export class Session {
	public static Current: Session;

    public Api: AirflowApi | undefined;
    public Server: ServerConfig | undefined;
    public Context: vscode.ExtensionContext;
    public ExtensionUri: vscode.Uri;
    public ServerList: ServerConfig[] = [];

	public constructor(context: vscode.ExtensionContext) {
		Session.Current = this;
        this.Context = context;
        this.ExtensionUri = context.extensionUri;
	}

    public static async Create(context: vscode.ExtensionContext): Promise<Session> {
        const session = new Session(context);
        await session.LoadState();
        return session;
    }

    private getServerPasswordSecretKey(apiUrl: string, apiUserName: string): string {
        return `${SERVER_PASSWORD_SECRET_PREFIX}:${encodeURIComponent(apiUrl)}:${encodeURIComponent(apiUserName)}`;
    }

    private getServerIdentity(server: ServerConfig): Omit<ServerConfig, 'apiPassword'> {
        return { apiUrl: server.apiUrl, apiUserName: server.apiUserName };
    }

    public async SaveState(): Promise<void> {
        ui.logToOutput('Saving state...');

        await this.Context.globalState.update(API_URL_KEY, this.Server?.apiUrl);
        await this.Context.globalState.update(API_USERNAME_KEY, this.Server?.apiUserName);
        await this.Context.globalState.update(API_PASSWORD_KEY, undefined);
        await this.Context.globalState.update(SERVER_LIST_KEY, this.ServerList.map((server) => this.getServerIdentity(server)));

        if (this.Server) {
            const selectedServerSecretKey = this.getServerPasswordSecretKey(this.Server.apiUrl, this.Server.apiUserName);
            await this.Context.secrets.store(selectedServerSecretKey, this.Server.apiPassword);
        }

        for (const server of this.ServerList) {
            const serverSecretKey = this.getServerPasswordSecretKey(server.apiUrl, server.apiUserName);
            await this.Context.secrets.store(serverSecretKey, server.apiPassword);
        }
    }

    public async LoadState() {
        ui.logToOutput('Loading state...');

        const apiUrlTemp: string = this.Context.globalState.get(API_URL_KEY) || '';
        const apiUserNameTemp: string = this.Context.globalState.get(API_USERNAME_KEY) || '';
        const legacyApiPasswordTemp: string = this.Context.globalState.get(API_PASSWORD_KEY) || '';

        const serverListTemp: StoredServerConfig[] = this.Context.globalState.get(SERVER_LIST_KEY) || [];
        const loadedServers: ServerConfig[] = [];
        let selectedServerFromList: ServerConfig | undefined;
        let hasLegacyServerListPasswords = false;
        for (const server of serverListTemp) {
            const serverSecretKey = this.getServerPasswordSecretKey(server.apiUrl, server.apiUserName);
            const secretPassword = await this.Context.secrets.get(serverSecretKey);
            const resolvedPassword = secretPassword !== undefined ? secretPassword : (server.apiPassword || '');

            if (!secretPassword && server.apiPassword) {
                await this.Context.secrets.store(serverSecretKey, server.apiPassword);
            }

            if (server.apiPassword) {
                hasLegacyServerListPasswords = true;
            }

            const loadedServer = {
                apiUrl: server.apiUrl,
                apiUserName: server.apiUserName,
                apiPassword: resolvedPassword
            };
            loadedServers.push(loadedServer);

            if (loadedServer.apiUrl === apiUrlTemp && loadedServer.apiUserName === apiUserNameTemp) {
                selectedServerFromList = loadedServer;
            }
        }
        this.ServerList = loadedServers;

        const selectedServerSecretKey = this.getServerPasswordSecretKey(apiUrlTemp, apiUserNameTemp);
        let selectedServerPassword = (apiUrlTemp && apiUserNameTemp) ? await this.Context.secrets.get(selectedServerSecretKey) : undefined;
        if (!selectedServerPassword && legacyApiPasswordTemp && apiUrlTemp && apiUserNameTemp) {
            selectedServerPassword = legacyApiPasswordTemp;
            await this.Context.secrets.store(selectedServerSecretKey, legacyApiPasswordTemp);
        }

        if (apiUrlTemp && apiUserNameTemp) {
            if (!selectedServerPassword) {
                selectedServerPassword = selectedServerFromList?.apiPassword || '';
            }
            this.Server = { apiUrl: apiUrlTemp, apiUserName: apiUserNameTemp, apiPassword: selectedServerPassword || '' };
            this.Api = new AirflowApi(this.Server);
        }

        if (legacyApiPasswordTemp || hasLegacyServerListPasswords) {
            await this.Context.globalState.update(API_PASSWORD_KEY, undefined);
            await this.Context.globalState.update(SERVER_LIST_KEY, this.ServerList.map((server) => this.getServerIdentity(server)));
        }
    }

    public async SetServer(server: ServerConfig) {
        this.Server = server;
        this.Api = new AirflowApi(this.Server);
        await this.SaveState();
    }

    public async ChangeServer(apiUrl: string, apiUserName: string) {
        this.Server = this.ServerList.find((server) => server.apiUrl === apiUrl && server.apiUserName === apiUserName);   
        if (this.Server) {
            this.Api = new AirflowApi(this.Server);
            await this.SaveState();
        }
    }

    public async RemoveServer(apiUrl: string, apiUserName: string) {
        this.ServerList = this.ServerList.filter((server) => !(server.apiUrl === apiUrl && server.apiUserName === apiUserName));   
        await this.Context.secrets.delete(this.getServerPasswordSecretKey(apiUrl, apiUserName));
        await this.SaveState();
    }

    public async AddServer(server: ServerConfig) {
        const exists = this.ServerList.some((s) => s.apiUrl === server.apiUrl && s.apiUserName === server.apiUserName);
        if (!exists) {
            this.ServerList.push(server);
            await this.SaveState();
        }
    }

    public TestServer(serverConfig: ServerConfig) {
        let api = new AirflowApi(serverConfig);
        let result = api.checkConnection();
        return result;
    }

    public async ClearServers() {
        for (const server of this.ServerList) {
            await this.Context.secrets.delete(this.getServerPasswordSecretKey(server.apiUrl, server.apiUserName));
        }
        this.ServerList = [];
        this.Server = undefined;
        this.Api = undefined;
        await this.SaveState();
    }

    public GetServer(apiUrl: string, apiUserName: string) {
        return this.ServerList.find((server) => server.apiUrl === apiUrl && server.apiUserName === apiUserName);
    }

    public GetWorkspaceFolders(): vscode.WorkspaceFolder[] {
        return [...(vscode.workspace.workspaceFolders || [])];
    }

    public GetWorkspaceFolder(): vscode.WorkspaceFolder | undefined {
        const folders = this.GetWorkspaceFolders();
        if (folders.length > 0) {
            return folders[0];
        }
        return undefined;
    }

    public get HasWorkspaceFolder(): boolean {
        const folders = this.GetWorkspaceFolders();
        return folders.length > 0;
    }

	public dispose() {
        Session.Current = undefined as unknown as Session;
	}
}
