/* eslint-disable @typescript-eslint/naming-convention */
import * as vscode from "vscode";
import * as ui from '../common/UI';
import { Session } from '../common/Session';

export class ServerHealthView {
    public static Current: ServerHealthView;
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];
    private healthJson: any;

    private constructor(panel: vscode.WebviewPanel) {
        ui.logToOutput('ServerHealthView.constructor Started');
        this._panel = panel;
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        this._setWebviewMessageListener(this._panel.webview);
        this.loadData();
        ui.logToOutput('ServerHealthView.constructor Completed');
    }

    public async loadData() {
        ui.logToOutput('ServerHealthView.loadData Started');

        const result = await Session.Current.Api!.getHealth();
        if (result.isSuccessful) {
            this.healthJson = result.result;
        }
        await this.renderHtml();
    }

    public async renderHtml() {
        ui.logToOutput('ServerHealthView.renderHtml Started');
        this._panel.webview.html = this._getWebviewContent(this._panel.webview, Session.Current.ExtensionUri!);
        ui.logToOutput('ServerHealthView.renderHtml Completed');
    }

    public static render() {
        ui.logToOutput('ServerHealthView.render Started');
        if (ServerHealthView.Current) {
            ServerHealthView.Current._panel.reveal(vscode.ViewColumn.One);
            ServerHealthView.Current.loadData();
        } else {
            const panel = vscode.window.createWebviewPanel("serverHealthView", "Server Health", vscode.ViewColumn.One, {
                enableScripts: true,
            });

            ServerHealthView.Current = new ServerHealthView(panel);
        }
    }

    public dispose() {
        ui.logToOutput('ServerHealthView.dispose Started');
        ServerHealthView.Current = undefined;

        this._panel.dispose();

        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }

    private _getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri) {
        ui.logToOutput('ServerHealthView._getWebviewContent Started');

        const elementsUri = ui.getUri(webview, extensionUri, [
            "node_modules",
            "@vscode-elements",
            "elements",
            "dist",
            "bundled.js",
        ]);

        const mainUri = ui.getUri(webview, extensionUri, ["media", "main.js"]);
        const styleUri = ui.getUri(webview, extensionUri, ["media", "style.css"]);

        // Build table rows from health data
        let tableRows = '';
        if (this.healthJson) {
            // Metadatabase status
            if (this.healthJson.metadatabase) {
                const status = this.healthJson.metadatabase.status || 'N/A';
                const emoji = this._getHealthEmoji(status);
                tableRows += `
                <vscode-table-row>
                    <vscode-table-cell>Metadatabase</vscode-table-cell>
                    <vscode-table-cell>${emoji} ${this._escapeHtml(status)}</vscode-table-cell>
                </vscode-table-row>`;
            }

            // Scheduler status
            if (this.healthJson.scheduler) {
                const status = this.healthJson.scheduler.status || 'N/A';
                const latestHeartbeat = ui.toISODateTimeString(new Date(this.healthJson.scheduler.latest_scheduler_heartbeat)) || 'N/A';
                const emoji = this._getHealthEmoji(status);
                tableRows += `
                <vscode-table-row>
                    <vscode-table-cell>Scheduler</vscode-table-cell>
                    <vscode-table-cell>${emoji} ${this._escapeHtml(status)}</vscode-table-cell>
                </vscode-table-row>`;
                if (latestHeartbeat !== 'N/A') {
                    tableRows += `
                    <vscode-table-row>
                        <vscode-table-cell>Latest Scheduler Heartbeat</vscode-table-cell>
                        <vscode-table-cell>${this._escapeHtml(latestHeartbeat)}</vscode-table-cell>
                    </vscode-table-row>`;
                }
            }

            // Triggerer status
            if (this.healthJson.triggerer) {
                const status = this.healthJson.triggerer.status || 'N/A';
                const latestHeartbeat = ui.toISODateTimeString(new Date(this.healthJson.triggerer.latest_triggerer_heartbeat)) || 'N/A';
                const emoji = this._getHealthEmoji(status);
                tableRows += `
                <vscode-table-row>
                    <vscode-table-cell>Triggerer</vscode-table-cell>
                    <vscode-table-cell>${emoji} ${this._escapeHtml(status)}</vscode-table-cell>
                </vscode-table-row>`;
                if (latestHeartbeat !== 'N/A') {
                    tableRows += `
                    <vscode-table-row>
                        <vscode-table-cell>Latest Triggerer Heartbeat</vscode-table-cell>
                        <vscode-table-cell>${this._escapeHtml(latestHeartbeat)}</vscode-table-cell>
                    </vscode-table-row>`;
                }
            }

            // Dag Processor status
            if (this.healthJson.dag_processor) {
                const status = this.healthJson.dag_processor.status || 'N/A';
                const latestHeartbeat = ui.toISODateTimeString(new Date(this.healthJson.dag_processor.latest_dag_processor_heartbeat)) || 'N/A';
                const emoji = this._getHealthEmoji(status);
                tableRows += `
                <vscode-table-row>
                    <vscode-table-cell>DAG Processor</vscode-table-cell>
                    <vscode-table-cell>${emoji} ${this._escapeHtml(status)}</vscode-table-cell>
                </vscode-table-row>`;
                if (latestHeartbeat !== 'N/A') {
                    tableRows += `
                    <vscode-table-row>
                        <vscode-table-cell>Latest DAG Processor Heartbeat</vscode-table-cell>
                        <vscode-table-cell>${this._escapeHtml(latestHeartbeat)}</vscode-table-cell>
                    </vscode-table-row>`;
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
            .refresh-button {
                margin-bottom: 16px;
            }
            vscode-table {
                width: 100%;
            }
            vscode-table-cell {
                word-wrap: break-word;
                white-space: normal;
            }
        </style>
        <title>Server Health</title>
      </head>
      <body>  
        <h2>Server Health</h2>
        <h3>${Session.Current.Server?.apiUrl}</h3>
        <div class="refresh-button">
            <vscode-button id="refresh-btn">Refresh</vscode-button>
        </div>
        
        <vscode-table zebra bordered-columns>
            <vscode-table-header slot="header">
                <vscode-table-header-cell>Component</vscode-table-header-cell>
                <vscode-table-header-cell>Status</vscode-table-header-cell>
            </vscode-table-header>
            <vscode-table-body slot="body">
            ${tableRows || '<vscode-table-row><vscode-table-cell colspan="2">No health data available</vscode-table-cell></vscode-table-row>'}        
            </vscode-table-body>
        </vscode-table>

        <script>
            const vscode = acquireVsCodeApi();

            document.getElementById('refresh-btn').addEventListener('click', () => {
                vscode.postMessage({ command: 'refresh' });
            });
        </script>
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
        return String(text).replace(/[&<>"']/g, m => map[m]);
    }

    private _getHealthEmoji(status: string): string {
        const statusLower = status.toLowerCase();
        if (statusLower === 'healthy') {
            return '✅';
        } else if (statusLower === 'unhealthy') {
            return '❌';
        }
        return '⚠️';
    }

    private _setWebviewMessageListener(webview: vscode.Webview) {
        ui.logToOutput('ServerHealthView._setWebviewMessageListener Started');
        webview.onDidReceiveMessage(
            (message: any) => {
                ui.logToOutput('ServerHealthView._setWebviewMessageListener Message Received ' + message.command);
                switch (message.command) {
                    case "refresh":
                        this.loadData();
                        return;
                }
            },
            undefined,
            this._disposables
        );
    }
}
