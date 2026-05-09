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

    public SaveState() {
        ui.logToOutput('Saving state...');

        void this.Context.globalState.update(API_URL_KEY, this.Server?.apiUrl);
        void this.Context.globalState.update(API_USERNAME_KEY, this.Server?.apiUserName);
        void this.Context.globalState.update(API_PASSWORD_KEY, undefined);
        void this.Context.globalState.update(SERVER_LIST_KEY, this.ServerList.map((server) => this.getServerIdentity(server)));

        if (this.Server) {
            const selectedServerSecretKey = this.getServerPasswordSecretKey(this.Server.apiUrl, this.Server.apiUserName);
            void this.Context.secrets.store(selectedServerSecretKey, this.Server.apiPassword);
        }

        for (const server of this.ServerList) {
            const serverSecretKey = this.getServerPasswordSecretKey(server.apiUrl, server.apiUserName);
            void this.Context.secrets.store(serverSecretKey, server.apiPassword);
        }
    }

    public async LoadState() {
        ui.logToOutput('Loading state...');

        const apiUrlTemp: string = this.Context.globalState.get(API_URL_KEY) || '';
        const apiUserNameTemp: string = this.Context.globalState.get(API_USERNAME_KEY) || '';
        const legacyApiPasswordTemp: string = this.Context.globalState.get(API_PASSWORD_KEY) || '';

        const serverListTemp: StoredServerConfig[] = this.Context.globalState.get(SERVER_LIST_KEY) || [];
        const loadedServers: ServerConfig[] = [];
        let hasLegacyServerListPasswords = false;
        for (const server of serverListTemp) {
            const serverSecretKey = this.getServerPasswordSecretKey(server.apiUrl, server.apiUserName);
            const secretPassword = await this.Context.secrets.get(serverSecretKey);
            const migratedPassword = secretPassword || server.apiPassword || '';

            if (!secretPassword && server.apiPassword) {
                void this.Context.secrets.store(serverSecretKey, server.apiPassword);
            }

            if (server.apiPassword) {
                hasLegacyServerListPasswords = true;
            }

            loadedServers.push({
                apiUrl: server.apiUrl,
                apiUserName: server.apiUserName,
                apiPassword: migratedPassword
            });
        }
        this.ServerList = loadedServers;

        const selectedServerSecretKey = this.getServerPasswordSecretKey(apiUrlTemp, apiUserNameTemp);
        let apiPasswordTemp = (apiUrlTemp && apiUserNameTemp) ? await this.Context.secrets.get(selectedServerSecretKey) : undefined;
        if (!apiPasswordTemp && legacyApiPasswordTemp && apiUrlTemp && apiUserNameTemp) {
            apiPasswordTemp = legacyApiPasswordTemp;
            void this.Context.secrets.store(selectedServerSecretKey, legacyApiPasswordTemp);
        }

        if (apiUrlTemp && apiUserNameTemp) {
            if (!apiPasswordTemp) {
                apiPasswordTemp = this.ServerList.find((server) => server.apiUrl === apiUrlTemp && server.apiUserName === apiUserNameTemp)?.apiPassword || '';
            }
            this.Server = { apiUrl: apiUrlTemp, apiUserName: apiUserNameTemp, apiPassword: apiPasswordTemp || '' };
            this.Api = new AirflowApi(this.Server);
        }

        if (legacyApiPasswordTemp || hasLegacyServerListPasswords) {
            void this.Context.globalState.update(API_PASSWORD_KEY, undefined);
            void this.Context.globalState.update(SERVER_LIST_KEY, this.ServerList.map((server) => this.getServerIdentity(server)));
        }
    }

    public SetServer(server: ServerConfig) {
        this.Server = server;
        this.Api = new AirflowApi(this.Server);
        this.SaveState();
    }

    public ChangeServer(apiUrl: string, apiUserName: string) {
        this.Server = this.ServerList.find((server) => server.apiUrl === apiUrl && server.apiUserName === apiUserName);   
        if (this.Server) {
            this.Api = new AirflowApi(this.Server);
            this.SaveState();
        }
    }

    public RemoveServer(apiUrl: string, apiUserName: string) {
        this.ServerList = this.ServerList.filter((server) => !(server.apiUrl === apiUrl && server.apiUserName === apiUserName));   
        void this.Context.secrets.delete(this.getServerPasswordSecretKey(apiUrl, apiUserName));
        this.SaveState();
    }

    public AddServer(server: ServerConfig) {
        const exists = this.ServerList.some((s) => s.apiUrl === server.apiUrl && s.apiUserName === server.apiUserName);
        if (!exists) {
            this.ServerList.push(server);
            this.SaveState();
        }
    }

    public TestServer(serverConfig: ServerConfig) {
        let api = new AirflowApi(serverConfig);
        let result = api.checkConnection();
        return result;
    }

    public ClearServers() {
        for (const server of this.ServerList) {
            void this.Context.secrets.delete(this.getServerPasswordSecretKey(server.apiUrl, server.apiUserName));
        }
        this.ServerList = [];
        this.Server = undefined;
        this.Api = undefined;
        this.SaveState();
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
