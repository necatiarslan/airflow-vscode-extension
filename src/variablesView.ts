/* eslint-disable @typescript-eslint/naming-convention */
import * as vscode from "vscode";
import * as ui from './UI';
import { AirflowApi } from './Api';

export class VariablesView {
    public static Current: VariablesView | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];
    private extensionUri: vscode.Uri;
    private variablesJson: any;
    private api: AirflowApi;

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, api: AirflowApi) {
        ui.logToOutput('VariablesView.constructor Started');
        this.extensionUri = extensionUri;
        this._panel = panel;
        this.api = api;
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        this._setWebviewMessageListener(this._panel.webview);
        this.loadData();
        ui.logToOutput('VariablesView.constructor Completed');
    }

    public async loadData() {
        ui.logToOutput('VariablesView.loadData Started');

        const result = await this.api.getVariables();
        if (result.isSuccessful) {
            this.variablesJson = result.result;
        }
        await this.renderHtml();
    }

    public async renderHtml() {
        ui.logToOutput('VariablesView.renderHtml Started');
        this._panel.webview.html = this._getWebviewContent(this._panel.webview, this.extensionUri);
        ui.logToOutput('VariablesView.renderHtml Completed');
    }

    public static render(extensionUri: vscode.Uri, api: AirflowApi) {
        ui.logToOutput('VariablesView.render Started');
        if (VariablesView.Current) {
            VariablesView.Current.api = api;
            VariablesView.Current._panel.reveal(vscode.ViewColumn.Two);
            VariablesView.Current.loadData();
        } else {
            const panel = vscode.window.createWebviewPanel("variablesView", "Variables", vscode.ViewColumn.Two, {
                enableScripts: true,
            });

            VariablesView.Current = new VariablesView(panel, extensionUri, api);
        }
    }

    public dispose() {
        ui.logToOutput('VariablesView.dispose Started');
        VariablesView.Current = undefined;

        this._panel.dispose();

        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }

    private _getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri) {
        ui.logToOutput('VariablesView._getWebviewContent Started');

        const toolkitUri = ui.getUri(webview, extensionUri, [
            "node_modules",
            "@vscode",
            "webview-ui-toolkit",
            "dist",
            "toolkit.js",
        ]);

        const mainUri = ui.getUri(webview, extensionUri, ["media", "main.js"]);
        const styleUri = ui.getUri(webview, extensionUri, ["media", "style.css"]);

        const variablesData = this.variablesJson ? JSON.stringify(this.variablesJson, null, 4) : "No variables found";

        const result = /*html*/ `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width,initial-scale=1.0">
        <script type="module" src="${toolkitUri}"></script>
        <script type="module" src="${mainUri}"></script>
        <link rel="stylesheet" href="${styleUri}">
        <title>Variables</title>
      </head>
      <body>  
        <h2>Airflow Variables</h2>
        <vscode-button appearance="secondary" id="refresh-variables">Refresh</vscode-button>
        <br><br>
        <pre>${variablesData}</pre>
      </body>
    </html>
    `;

        return result;
    }

    private _setWebviewMessageListener(webview: vscode.Webview) {
        ui.logToOutput('VariablesView._setWebviewMessageListener Started');
        webview.onDidReceiveMessage(
            (message: any) => {
                ui.logToOutput('VariablesView._setWebviewMessageListener Message Received ' + message.command);
                switch (message.command) {
                    case "refresh-variables":
                        this.loadData();
                        return;
                }
            },
            undefined,
            this._disposables
        );
    }
}
