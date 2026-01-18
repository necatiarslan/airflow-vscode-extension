/* eslint-disable @typescript-eslint/naming-convention */
import * as vscode from "vscode";
import * as ui from '../common/UI';
import { Session } from '../common/Session';
import { Telemetry } from '../common/Telemetry';

export class ProvidersView {
    public static Current: ProvidersView;
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];
    private providersJson: any;


    private constructor(panel: vscode.WebviewPanel) {
        ui.logToOutput('ProvidersView.constructor Started');
        Telemetry.Current.send('ProvidersView.constructor.called');

        this._panel = panel;
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        this._setWebviewMessageListener(this._panel.webview);
        this.loadData();
        ui.logToOutput('ProvidersView.constructor Completed');
    }

    public async loadData() {
        ui.logToOutput('ProvidersView.loadData Started');
        Telemetry.Current.send('ProvidersView.loadData.called');

        const result = await Session.Current.Api.getProviders();
        if (result.isSuccessful) {
            this.providersJson = result.result;
        }
        await this.renderHtml();
    }

    public async renderHtml() {
        ui.logToOutput('ProvidersView.renderHtml Started');
        Telemetry.Current.send('ProvidersView.renderHtml.called');

        this._panel.webview.html = this._getWebviewContent(this._panel.webview, Session.Current.ExtensionUri!);
        ui.logToOutput('ProvidersView.renderHtml Completed');
    }

    public static render() {
        ui.logToOutput('ProvidersView.render Started');
        Telemetry.Current.send('ProvidersView.render.called');

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
        Telemetry.Current.send('ProvidersView.dispose.called');

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
        Telemetry.Current.send('ProvidersView._getWebviewContent.called');

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
        if (this.providersJson && this.providersJson.providers) {
            for (const provider of this.providersJson.providers) {
                const packageName = provider.package_name || 'N/A';
                const version = provider.version || 'N/A';
                const description = provider.description || 'N/A';
                tableRows += `
                <tr class="table-row">
                    <td>${this._escapeHtml(packageName)}</td>
                    <td>${this._escapeHtml(version)}</td>
                    <td>${this._escapeHtml(description)}</td>
                </tr>`;
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
            :root {
                --font-size-sm: 12px;
                --font-size-md: 13px;
                --font-size-lg: 15px;
                --border-radius: 4px;
                --spacing-xs: 4px;
                --spacing-sm: 8px;
                --spacing-md: 16px;
                --spacing-lg: 24px;
            }

            body { 
                padding: var(--spacing-md); 
                font-family: var(--vscode-font-family);
                color: var(--vscode-foreground);
                background-color: var(--vscode-editor-background);
            }

            h2 {
                margin: 0 0 var(--spacing-lg) 0;
                font-size: 18px;
                font-weight: 600;
                color: var(--vscode-editor-foreground);
                border-bottom: 1px solid var(--vscode-widget-border);
                padding-bottom: var(--spacing-md);
            }

            .controls {
                margin-bottom: var(--spacing-lg);
            }

            table {
                width: 100%;
                border-collapse: separate;
                border-spacing: 0;
                margin-bottom: var(--spacing-lg);
                font-size: var(--font-size-md);
            }

            th, td {
                padding: 5px 8px;
                text-align: left;
                border-bottom: 1px solid var(--vscode-widget-border);
            }

            th {
                font-weight: 600;
                color: var(--vscode-descriptionForeground);
                text-transform: uppercase;
                font-size: 11px;
                letter-spacing: 0.5px;
                background-color: var(--vscode-editor-inactiveSelectionBackground);
                position: sticky;
                top: 0;
            }

            tr:last-child td {
                border-bottom: none;
            }

            .table-row:hover td {
                background-color: var(--vscode-list-hoverBackground);
            }
        </style>
        <title>Providers</title>
      </head>
      <body>  
        <h2>Airflow Providers</h2>
        <div class="controls">
            <vscode-button appearance="secondary" id="refresh-providers">Refresh</vscode-button>
        </div>
        
        <table>
            <thead>
                <tr>
                    <th>Package Name</th>
                    <th>Version</th>
                    <th>Description</th>
                </tr>
            </thead>
            <tbody>
            ${tableRows || '<tr><td colspan="3" style="text-align:center; padding: 20px; opacity: 0.7;">No providers found</td></tr>'}
            </tbody>
        </table>
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
        Telemetry.Current.send('ProvidersView._setWebviewMessageListener.called');
        
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
