/* eslint-disable @typescript-eslint/naming-convention */
import * as vscode from "vscode";
import * as ui from './ui';
import { AirflowApi } from './api';
import { MethodResult } from './methodResult';

export class ProvidersView {
    public static Current: ProvidersView | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];
    private extensionUri: vscode.Uri;
    private providersJson: any;
    private api: AirflowApi;

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, api: AirflowApi) {
        ui.logToOutput('ProvidersView.constructor Started');
        this.extensionUri = extensionUri;
        this._panel = panel;
        this.api = api;
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        this._setWebviewMessageListener(this._panel.webview);
        this.loadData();
        ui.logToOutput('ProvidersView.constructor Completed');
    }

    public async loadData() {
        ui.logToOutput('ProvidersView.loadData Started');

        const result = await this.api.getProviders();
        if (result.isSuccessful) {
            this.providersJson = result.result;
        }
        await this.renderHtml();
    }

    public async renderHtml() {
        ui.logToOutput('ProvidersView.renderHtml Started');
        this._panel.webview.html = this._getWebviewContent(this._panel.webview, this.extensionUri);
        ui.logToOutput('ProvidersView.renderHtml Completed');
    }

    public static render(extensionUri: vscode.Uri, api: AirflowApi) {
        ui.logToOutput('ProvidersView.render Started');
        if (ProvidersView.Current) {
            ProvidersView.Current.api = api;
            ProvidersView.Current._panel.reveal(vscode.ViewColumn.Two);
            ProvidersView.Current.loadData();
        } else {
            const panel = vscode.window.createWebviewPanel("providersView", "Providers", vscode.ViewColumn.Two, {
                enableScripts: true,
            });

            ProvidersView.Current = new ProvidersView(panel, extensionUri, api);
        }
    }

    public dispose() {
        ui.logToOutput('ProvidersView.dispose Started');
        ProvidersView.Current = undefined;

        this._panel.dispose();

        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }

    private _getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri) {
        ui.logToOutput('ProvidersView._getWebviewContent Started');

        const toolkitUri = ui.getUri(webview, extensionUri, [
            "node_modules",
            "@vscode",
            "webview-ui-toolkit",
            "dist",
            "toolkit.js",
        ]);

        const mainUri = ui.getUri(webview, extensionUri, ["media", "main.js"]);
        const styleUri = ui.getUri(webview, extensionUri, ["media", "style.css"]);

        const providersData = this.providersJson ? JSON.stringify(this.providersJson, null, 4) : "No providers found";

        const result = /*html*/ `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width,initial-scale=1.0">
        <script type="module" src="${toolkitUri}"></script>
        <script type="module" src="${mainUri}"></script>
        <link rel="stylesheet" href="${styleUri}">
        <title>Providers</title>
      </head>
      <body>  
        <h2>Airflow Providers</h2>
        <vscode-button appearance="secondary" id="refresh-providers">Refresh</vscode-button>
        <br><br>
        <pre>${providersData}</pre>
      </body>
    </html>
    `;

        return result;
    }

    private _setWebviewMessageListener(webview: vscode.Webview) {
        ui.logToOutput('ProvidersView._setWebviewMessageListener Started');
        webview.onDidReceiveMessage(
            (message: any) => {
                ui.logToOutput('ProvidersView._setWebviewMessageListener Message Received ' + message.command);
                switch (message.command) {
                    case "refresh-providers":
                        this.loadData();
                        return;
                }
            },
            undefined,
            this._disposables
        );
    }
}
