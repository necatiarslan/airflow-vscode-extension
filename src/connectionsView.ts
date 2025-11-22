/* eslint-disable @typescript-eslint/naming-convention */
import * as vscode from "vscode";
import * as ui from './ui';
import { AirflowApi } from './api';
import { MethodResult } from './methodResult';

export class ConnectionsView {
    public static Current: ConnectionsView | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];
    private extensionUri: vscode.Uri;
    private connectionsJson: any;
    private api: AirflowApi;

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, api: AirflowApi) {
        ui.logToOutput('ConnectionsView.constructor Started');
        this.extensionUri = extensionUri;
        this._panel = panel;
        this.api = api;
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        this._setWebviewMessageListener(this._panel.webview);
        this.loadData();
        ui.logToOutput('ConnectionsView.constructor Completed');
    }

    public async loadData() {
        ui.logToOutput('ConnectionsView.loadData Started');

        const result = await this.api.getConnections();
        if (result.isSuccessful) {
            this.connectionsJson = result.result;
        }
        await this.renderHtml();
    }

    public async renderHtml() {
        ui.logToOutput('ConnectionsView.renderHtml Started');
        this._panel.webview.html = this._getWebviewContent(this._panel.webview, this.extensionUri);
        ui.logToOutput('ConnectionsView.renderHtml Completed');
    }

    public static render(extensionUri: vscode.Uri, api: AirflowApi) {
        ui.logToOutput('ConnectionsView.render Started');
        if (ConnectionsView.Current) {
            ConnectionsView.Current.api = api;
            ConnectionsView.Current._panel.reveal(vscode.ViewColumn.Two);
            ConnectionsView.Current.loadData();
        } else {
            const panel = vscode.window.createWebviewPanel("connectionsView", "Connections", vscode.ViewColumn.Two, {
                enableScripts: true,
            });

            ConnectionsView.Current = new ConnectionsView(panel, extensionUri, api);
        }
    }

    public dispose() {
        ui.logToOutput('ConnectionsView.dispose Started');
        ConnectionsView.Current = undefined;

        this._panel.dispose();

        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }

    private _getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri) {
        ui.logToOutput('ConnectionsView._getWebviewContent Started');

        const toolkitUri = ui.getUri(webview, extensionUri, [
            "node_modules",
            "@vscode",
            "webview-ui-toolkit",
            "dist",
            "toolkit.js",
        ]);

        const mainUri = ui.getUri(webview, extensionUri, ["media", "main.js"]);
        const styleUri = ui.getUri(webview, extensionUri, ["media", "style.css"]);

        const connectionsData = this.connectionsJson ? JSON.stringify(this.connectionsJson, null, 4) : "No connections found";

        const result = /*html*/ `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width,initial-scale=1.0">
        <script type="module" src="${toolkitUri}"></script>
        <script type="module" src="${mainUri}"></script>
        <link rel="stylesheet" href="${styleUri}">
        <title>Connections</title>
      </head>
      <body>  
        <h2>Airflow Connections</h2>
        <vscode-button appearance="secondary" id="refresh-connections">Refresh</vscode-button>
        <br><br>
        <pre>${connectionsData}</pre>
      </body>
    </html>
    `;

        return result;
    }

    private _setWebviewMessageListener(webview: vscode.Webview) {
        ui.logToOutput('ConnectionsView._setWebviewMessageListener Started');
        webview.onDidReceiveMessage(
            (message: any) => {
                ui.logToOutput('ConnectionsView._setWebviewMessageListener Message Received ' + message.command);
                switch (message.command) {
                    case "refresh-connections":
                        this.loadData();
                        return;
                }
            },
            undefined,
            this._disposables
        );
    }
}
