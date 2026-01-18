/* eslint-disable @typescript-eslint/naming-convention */
import * as vscode from "vscode";
import * as ui from '../common/UI';
import { Session } from '../common/Session';
import { Telemetry } from '../common/Telemetry';

export class ConfigsView {
    public static Current: ConfigsView;
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];
    private configJson: any;

    private constructor(panel: vscode.WebviewPanel) {
        ui.logToOutput('ConfigsView.constructor Started');
        Telemetry.Current.send('ConfigsView.constructor.called');

        this._panel = panel;
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        this._setWebviewMessageListener(this._panel.webview);
        this.loadData();
        ui.logToOutput('ConfigsView.constructor Completed');
    }

    public async loadData() {
        ui.logToOutput('ConfigsView.loadData Started');
        Telemetry.Current.send('ConfigsView.loadData.called');

        const result = await Session.Current.Api.getConfig();
        if (result.isSuccessful) {
            this.configJson = result.result;
        }
        await this.renderHtml();
    }

    public async renderHtml() {
        ui.logToOutput('ConfigsView.renderHtml Started');
        Telemetry.Current.send('ConfigsView.renderHtml.called');

        this._panel.webview.html = this._getWebviewContent(this._panel.webview, Session.Current.ExtensionUri!);
        ui.logToOutput('ConfigsView.renderHtml Completed');
    }

    public static render() {
        ui.logToOutput('ConfigsView.render Started');
        Telemetry.Current.send('ConfigsView.render.called');

        if (ConfigsView.Current) {
            ConfigsView.Current._panel.reveal(vscode.ViewColumn.One);
            ConfigsView.Current.loadData();
        } else {
            const panel = vscode.window.createWebviewPanel("configsView", "Configs", vscode.ViewColumn.One, {
                enableScripts: true,
            });

            ConfigsView.Current = new ConfigsView(panel);
        }
    }

    public dispose() {
        ui.logToOutput('ConfigsView.dispose Started');
        Telemetry.Current.send('ConfigsView.dispose.called');

        ConfigsView.Current = undefined;

        this._panel.dispose();

        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }

    private _getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri) {
        ui.logToOutput('ConfigsView._getWebviewContent Started');
        Telemetry.Current.send('ConfigsView._getWebviewContent.called');

        const elementsUri = ui.getUri(webview, extensionUri, [
            "node_modules",
            "@vscode-elements",
            "elements",
            "dist",
            "bundled.js",
        ]);

        const mainUri = ui.getUri(webview, extensionUri, ["media", "main.js"]);
        const styleUri = ui.getUri(webview, extensionUri, ["media", "style.css"]);

        // Build table rows from config sections
        let tableRows = '';
        if (this.configJson && this.configJson.sections) {
            for (const section of this.configJson.sections) {
                const sectionName = section.name || 'N/A';
                
                if (section.options && Array.isArray(section.options)) {
                    for (const option of section.options) {
                        const key = option.key || 'N/A';
                        const value = option.value || 'N/A';
                        
                        tableRows += `
                        <tr class="table-row">
                            <td>${this._escapeHtml(sectionName)}</td>
                            <td>${this._escapeHtml(key)}</td>
                            <td><code>${this._escapeHtml(String(value))}</code></td>
                        </tr>`;
                    }
                }
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

            code {
                background-color: var(--vscode-textBlockQuote-background);
                color: var(--vscode-editor-foreground);
                padding: 2px 4px;
                border-radius: 3px;
                font-family: monospace;
                font-size: 11px;
            }
        </style>
        <title>Configs</title>
      </head>
      <body>  
        <h2>Airflow Configuration</h2>
        <div class="controls">
            <vscode-button appearance="secondary" id="refresh-configs">Refresh</vscode-button>
        </div>
        
        <table>
            <thead>
                <tr>
                    <th>Section</th>
                    <th>Key</th>
                    <th>Value</th>
                </tr>
            </thead>
            <tbody>
            ${tableRows}
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
        ui.logToOutput('ConfigsView._setWebviewMessageListener Started');
        Telemetry.Current.send('ConfigsView._setWebviewMessageListener.called');
        
        webview.onDidReceiveMessage(
            (message: any) => {
                ui.logToOutput('ConfigsView._setWebviewMessageListener Message Received ' + message.command);
                switch (message.command) {
                    case "refresh-configs":
                        this.loadData();
                        return;
                }
            },
            undefined,
            this._disposables
        );
    }
}
