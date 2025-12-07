/* eslint-disable @typescript-eslint/naming-convention */
import * as vscode from "vscode";
import * as ui from '../common/UI';
import { Session } from '../common/Session';

export class ConfigsView {
    public static Current: ConfigsView;
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];
    private configJson: any;

    private constructor(panel: vscode.WebviewPanel) {
        ui.logToOutput('ConfigsView.constructor Started');
        this._panel = panel;
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        this._setWebviewMessageListener(this._panel.webview);
        this.loadData();
        ui.logToOutput('ConfigsView.constructor Completed');
    }

    public async loadData() {
        ui.logToOutput('ConfigsView.loadData Started');

        const result = await Session.Current.Api!.getConfig();
        if (result.isSuccessful) {
            this.configJson = result.result;
        }
        await this.renderHtml();
    }

    public async renderHtml() {
        ui.logToOutput('ConfigsView.renderHtml Started');
        this._panel.webview.html = this._getWebviewContent(this._panel.webview, Session.Current.ExtensionUri!);
        ui.logToOutput('ConfigsView.renderHtml Completed');
    }

    public static render() {
        ui.logToOutput('ConfigsView.render Started');
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
                        <vscode-table-row>
                            <vscode-table-cell>${this._escapeHtml(sectionName)}</vscode-table-cell>
                            <vscode-table-cell>${this._escapeHtml(key)}</vscode-table-cell>
                            <vscode-table-cell><code>${this._escapeHtml(String(value))}</code></vscode-table-cell>
                        </vscode-table-row>`;
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
        <title>Configs</title>
      </head>
      <body>  
        <h2>Airflow Configuration</h2>
        <div class="controls">
            <vscode-button appearance="secondary" id="refresh-configs">Refresh</vscode-button>
        </div>
        
        <vscode-table zebra bordered-columns resizable>
            <vscode-table-header slot="header">
                <vscode-table-header-cell>Section</vscode-table-header-cell>
                <vscode-table-header-cell>Key</vscode-table-header-cell>
                <vscode-table-header-cell>Value</vscode-table-header-cell>
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
        ui.logToOutput('ConfigsView._setWebviewMessageListener Started');
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
