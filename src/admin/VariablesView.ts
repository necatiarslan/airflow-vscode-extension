/* eslint-disable @typescript-eslint/naming-convention */
import * as vscode from "vscode";
import * as ui from '../common/UI';
import { AirflowApi } from '../common/Api';

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
            VariablesView.Current._panel.reveal(vscode.ViewColumn.One);
            VariablesView.Current.loadData();
        } else {
            const panel = vscode.window.createWebviewPanel("variablesView", "Variables", vscode.ViewColumn.One, {
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

        const elementsUri = ui.getUri(webview, extensionUri, [
            "node_modules",
            "@vscode-elements",
            "elements",
            "dist",
            "bundled.js",
        ]);

        const mainUri = ui.getUri(webview, extensionUri, ["media", "main.js"]);
        const styleUri = ui.getUri(webview, extensionUri, ["media", "style.css"]);

        // Build table rows from variables data
        let tableRows = '';
        if (this.variablesJson) {
            // tableRows = this.variablesJson.map((variable: any) => {
            //     const key = variable.key || 'N/A';
            //     const value = variable.val || 'N/A';
            //     const description = variable.description || '';
            //     return `
            //     <vscode-table-row>
            //         <vscode-table-cell>${this._escapeHtml(key)}</vscode-table-cell>
            //         <vscode-table-cell><code>${this._escapeHtml(value)}</code></vscode-table-cell>
            //         <vscode-table-cell>${this._escapeHtml(description)}</vscode-table-cell>
            //     </vscode-table-row>`;
            // }).join('');
            for (const variable of this.variablesJson.variables) {
                const key = variable.key || 'N/A';
                const value = variable.val || 'N/A';
                const description = variable.description || '';
                tableRows += `
                <vscode-table-row>
                    <vscode-table-cell>${this._escapeHtml(key)}</vscode-table-cell>
                    <vscode-table-cell><code>${this._escapeHtml(value)}</code></vscode-table-cell>
                    <vscode-table-cell>${this._escapeHtml(description)}</vscode-table-cell>
                </vscode-table-row>`;
            }
        }

        const result = /*html*/ `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width,initial-scale=1.0">
        <script type="module" src="${elementsUri}"></script>
        <script type="module" src="${mainUri}"></script>
        <link rel="stylesheet" href="${styleUri}">
        <style>
            body {
                padding: 16px;
            }
            h2 {
                margin-top: 0;
            }
            .controls {
                margin-bottom: 16px;
            }
            vscode-table {
                width: 100%;
                max-height: 600px;
                overflow-y: auto;
            }
            vscode-table-cell {
                word-wrap: break-word;
                white-space: normal;
            }
            code {
                background-color: var(--vscode-editor-background);
                color: var(--vscode-editor-foreground);
                padding: 2px 4px;
                border-radius: 3px;
                font-family: monospace;
            }
        </style>
        <title>Variables</title>
      </head>
      <body>  
        <h2>Airflow Variables</h2>
        <div class="controls">
            <vscode-button appearance="secondary" id="refresh-variables">Refresh</vscode-button>
        </div>
        
        <vscode-table zebra bordered-columns resizable>
            <vscode-table-header slot="header">
                <vscode-table-header-cell>Key</vscode-table-header-cell>
                <vscode-table-header-cell>Value</vscode-table-header-cell>
                <vscode-table-header-cell>Description</vscode-table-header-cell>
            </vscode-table-header>
            <vscode-table-body slot="body">
            ${tableRows}
            </vscode-table-body>
        </vscode-table>
      </body>
    </html>
    `;

        return result;
    }

    private _escapeHtml(text: string): string {
        const map: { [key: string]: string } = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
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
