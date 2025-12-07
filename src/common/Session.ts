import { AirflowApi } from "./Api";
import { ServerConfig } from '../common/Types';
import * as ui from '../common/UI';
import * as vscode from 'vscode';

export class Session {
	public static Current: Session | undefined;

    public Api: AirflowApi | undefined;
    public Server: ServerConfig | undefined;
    public Context: vscode.ExtensionContext | undefined;
    public ServerList: ServerConfig[] = [];

	public constructor(context: vscode.ExtensionContext) {
		Session.Current = this;
        this.Context = context;
        this.LoadState();
	}

    public SaveState() {
        ui.logToOutput('Saving state...');
        
        this.Context.globalState.update('apiUrl', this.Server?.apiUrl);
        this.Context.globalState.update('apiUserName', this.Server?.apiUserName);
        this.Context.globalState.update('apiPassword', this.Server?.apiPassword);
        this.Context.globalState.update('serverList', this.ServerList);
    }

    public LoadState() {
        ui.logToOutput('Loading state...');

        const apiUrlTemp: string = this.Context.globalState.get('apiUrl') || '';
        const apiUserNameTemp: string = this.Context.globalState.get('apiUserName') || '';
        const apiPasswordTemp: string = this.Context.globalState.get('apiPassword') || '';

        if (apiUrlTemp && apiUserNameTemp) {
            this.Server = { apiUrl: apiUrlTemp, apiUserName: apiUserNameTemp, apiPassword: apiPasswordTemp };
            this.Api = new AirflowApi(this.Server);
        }

        this.ServerList = this.Context.globalState.get('serverList') || [];
    }

    public SetServer(server: ServerConfig) {
        this.Server = server;
        this.Api = new AirflowApi(this.Server);
    }

    public ChangeServer(apiUrl: string) {
        this.Server = this.ServerList.find((server) => server.apiUrl === apiUrl);   
        this.Api = new AirflowApi(this.Server);
        this.SaveState();
    }

    public RemoveServer(apiUrl: string) {
        this.ServerList = this.ServerList.filter((server) => server.apiUrl !== apiUrl);   
        this.SaveState();
    }

    public AddServer(server: ServerConfig) {
        this.ServerList.push(server);
        this.SaveState();
    }

    public TestServer(serverConfig: ServerConfig) {
        let api = new AirflowApi(serverConfig);
        let result = api.checkConnection();
        return result;
    }

	public dispose() {
		Session.Current = undefined;
	}
}