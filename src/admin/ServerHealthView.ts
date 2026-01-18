/* eslint-disable @typescript-eslint/naming-convention */
import * as vscode from "vscode";
import * as ui from '../common/UI';
import { Session } from '../common/Session';
import { Telemetry } from '../common/Telemetry';

export class ServerHealthView {
    public static Current: ServerHealthView;
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];
    private healthJson: any;

    private constructor(panel: vscode.WebviewPanel) {
        ui.logToOutput('ServerHealthView.constructor Started');
        Telemetry.Current.send('ServerHealthView.constructor.called');

        this._panel = panel;
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        this._setWebviewMessageListener(this._panel.webview);
        this.loadData();
        ui.logToOutput('ServerHealthView.constructor Completed');
    }

    public async loadData() {
        ui.logToOutput('ServerHealthView.loadData Started');
        Telemetry.Current.send('ServerHealthView.loadData.called');

        if (!Session.Current.Api) { return; }
        
        const result = await Session.Current.Api.getHealth();
        if (result.isSuccessful) {
            this.healthJson = result.result;
        }
        await this.renderHtml();
    }

    public async renderHtml() {
        ui.logToOutput('ServerHealthView.renderHtml Started');
        Telemetry.Current.send('ServerHealthView.renderHtml.called');

        this._panel.webview.html = this._getWebviewContent(this._panel.webview, Session.Current.ExtensionUri!);
        ui.logToOutput('ServerHealthView.renderHtml Completed');
    }

    public static render() {
        ui.logToOutput('ServerHealthView.render Started');
        Telemetry.Current.send('ServerHealthView.render.called');

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
        Telemetry.Current.send('ServerHealthView.dispose.called');

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
        Telemetry.Current.send('ServerHealthView._getWebviewContent.called');

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
                <tr class="table-row">
                    <td>Metadatabase</td>
                    <td>${emoji} ${this._escapeHtml(status)}</td>
                </tr>`;
            }

            // Scheduler status
            if (this.healthJson.scheduler) {
                const status = this.healthJson.scheduler.status || 'N/A';
                const latestHeartbeat = ui.toISODateTimeString(new Date(this.healthJson.scheduler.latest_scheduler_heartbeat)) || 'N/A';
                const emoji = this._getHealthEmoji(status);
                tableRows += `
                <tr class="table-row">
                    <td>Scheduler</td>
                    <td>${emoji} ${this._escapeHtml(status)}</td>
                </tr>`;
                if (latestHeartbeat !== 'N/A') {
                    tableRows += `
                    <tr class="table-row">
                        <td>Latest Scheduler Heartbeat</td>
                        <td>${this._escapeHtml(latestHeartbeat)}</td>
                    </tr>`;
                }
            }

            // Triggerer status
            if (this.healthJson.triggerer) {
                const status = this.healthJson.triggerer.status || 'N/A';
                const latestHeartbeat = ui.toISODateTimeString(new Date(this.healthJson.triggerer.latest_triggerer_heartbeat)) || 'N/A';
                const emoji = this._getHealthEmoji(status);
                tableRows += `
                <tr class="table-row">
                    <td>Triggerer</td>
                    <td>${emoji} ${this._escapeHtml(status)}</td>
                </tr>`;
                if (latestHeartbeat !== 'N/A') {
                    tableRows += `
                    <tr class="table-row">
                        <td>Latest Triggerer Heartbeat</td>
                        <td>${this._escapeHtml(latestHeartbeat)}</td>
                    </tr>`;
                }
            }

            // Dag Processor status
            if (this.healthJson.dag_processor) {
                const status = this.healthJson.dag_processor.status || 'N/A';
                const latestHeartbeat = ui.toISODateTimeString(new Date(this.healthJson.dag_processor.latest_dag_processor_heartbeat)) || 'N/A';
                const emoji = this._getHealthEmoji(status);
                tableRows += `
                <tr class="table-row">
                    <td>DAG Processor</td>
                    <td>${emoji} ${this._escapeHtml(status)}</td>
                </tr>`;
                if (latestHeartbeat !== 'N/A') {
                    tableRows += `
                    <tr class="table-row">
                        <td>Latest DAG Processor Heartbeat</td>
                        <td>${this._escapeHtml(latestHeartbeat)}</td>
                    </tr>`;
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

            h3 {
                font-size: var(--font-size-md);
                color: var(--vscode-descriptionForeground);
                margin-top: -16px;
                margin-bottom: var(--spacing-lg);
                font-weight: normal;
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
        <title>Server Health</title>
      </head>
      <body>  
        <h2>Server Health</h2>
        <h3>${Session.Current.Server?.apiUrl}</h3>
        <div class="controls">
            <vscode-button id="refresh-btn" appearance="secondary">Refresh</vscode-button>
        </div>
        
        <table>
            <thead>
                <tr>
                    <th>Component</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
            ${tableRows || '<tr><td colspan="2" style="text-align:center; padding: 20px; opacity: 0.7;">No health data available</td></tr>'}        
            </tbody>
        </table>

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
        Telemetry.Current.send('ServerHealthView._setWebviewMessageListener.called');
        
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
