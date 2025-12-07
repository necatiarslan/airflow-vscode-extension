/* eslint-disable @typescript-eslint/naming-convention */
import * as vscode from "vscode";
import * as ui from '../common/UI';
import { Session } from '../common/Session';

export class ProvidersView {
    public static Current: ProvidersView;
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];
    private providersJson: any;


    private constructor(panel: vscode.WebviewPanel) {
        ui.logToOutput('ProvidersView.constructor Started');
        this._panel = panel;
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        this._setWebviewMessageListener(this._panel.webview);
        this.loadData();
        ui.logToOutput('ProvidersView.constructor Completed');
    }

    public async loadData() {
        ui.logToOutput('ProvidersView.loadData Started');

        const result = await Session.Current.Api.getProviders();
        if (result.isSuccessful) {
            this.providersJson = result.result;
        }
        await this.renderHtml();
    }

    public async renderHtml() {
        ui.logToOutput('ProvidersView.renderHtml Started');
        this._panel.webview.html = this._getWebviewContent(this._panel.webview, Session.Current.ExtensionUri!);
        ui.logToOutput('ProvidersView.renderHtml Completed');
    }

    public static render() {
        ui.logToOutput('ProvidersView.render Started');
        if (ProvidersView.Current) {
            ProvidersView.Current._panel.reveal(vscode.ViewColumn.One);
            ProvidersView.Current.loadData();
        } else {
            const panel = vscode.window.createWebviewPanel("providersView", "Providers", vscode.ViewColumn.One, {
                enableScripts: true,
            });

            ProvidersView.Current = new ProvidersView(panel);
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

        const elementsUri = ui.getUri(webview, extensionUri, [
            "node_modules",
            "@vscode-elements",
            "elements",
            "dist",
            "bundled.js",
        ]);

        const mainUri = ui.getUri(webview, extensionUri, ["media", "main.js"]);
        const styleUri = ui.getUri(webview, extensionUri, ["media", "style.css"]);

        // Build table rows from providers data
        let tableRows = '';
        if (this.providersJson) {
            // tableRows = this.providersJson.map((provider: any) => {
            //     const packageName = provider.package_name || 'N/A';
            //     const version = provider.version || 'N/A';
            //     const description = provider.description || 'N/A';
            //     return `
            //     <vscode-table-row>
            //         <vscode-table-cell>${this._escapeHtml(packageName)}</vscode-table-cell>
            //         <vscode-table-cell>${this._escapeHtml(version)}</vscode-table-cell>
            //         <vscode-table-cell>${this._escapeHtml(description)}</vscode-table-cell>
            //     </vscode-table-row>`;
            // }).join('');
            for (const provider of this.providersJson.providers) {
                const packageName = provider.package_name || 'N/A';
                const version = provider.version || 'N/A';
                const description = provider.description || 'N/A';
                tableRows += `
                <vscode-table-row>
                    <vscode-table-cell>${this._escapeHtml(packageName)}</vscode-table-cell>
                    <vscode-table-cell>${this._escapeHtml(version)}</vscode-table-cell>
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
        </style>
        <title>Providers</title>
      </head>
      <body>  
        <h2>Airflow Providers</h2>
        <div class="controls">
            <vscode-button appearance="secondary" id="refresh-providers">Refresh</vscode-button>
        </div>
        
        <vscode-table zebra bordered-columns resizable>
            <vscode-table-header slot="header">
                <vscode-table-header-cell>Package Name</vscode-table-header-cell>
                <vscode-table-header-cell>Version</vscode-table-header-cell>
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
