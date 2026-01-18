/* eslint-disable @typescript-eslint/naming-convention */
import * as vscode from "vscode";
import * as ui from '../common/UI';
import { Session } from '../common/Session';
import { Telemetry } from '../common/Telemetry';

export class ConnectionsView {
    public static Current: ConnectionsView;
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];
    private connectionsJson: any;

    private constructor(panel: vscode.WebviewPanel) {
        ui.logToOutput('ConnectionsView.constructor Started');
        Telemetry.Current.send('ConnectionsView.constructor.called');

        this._panel = panel;
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        this._setWebviewMessageListener(this._panel.webview);
        this.loadData();
        ui.logToOutput('ConnectionsView.constructor Completed');
    }

    public async loadData() {
        ui.logToOutput('ConnectionsView.loadData Started');
        Telemetry.Current.send('ConnectionsView.loadData.called');

        const result = await Session.Current.Api.getConnections();
        if (result.isSuccessful) {
            this.connectionsJson = result.result;
        }
        await this.renderHtml();
    }

    public async renderHtml() {
        ui.logToOutput('ConnectionsView.renderHtml Started');
        Telemetry.Current.send('ConnectionsView.renderHtml.called');

        this._panel.webview.html = this._getWebviewContent(this._panel.webview, Session.Current.ExtensionUri!);
        ui.logToOutput('ConnectionsView.renderHtml Completed');
    }

    public static render() {
        ui.logToOutput('ConnectionsView.render Started');
        Telemetry.Current.send('ConnectionsView.render.called');

        if (ConnectionsView.Current) {
            ConnectionsView.Current._panel.reveal(vscode.ViewColumn.One);
            ConnectionsView.Current.loadData();
        } else {
            const panel = vscode.window.createWebviewPanel("connectionsView", "Connections", vscode.ViewColumn.One, {
                enableScripts: true,
            });

            ConnectionsView.Current = new ConnectionsView(panel);
        }
    }

    public dispose() {
        ui.logToOutput('ConnectionsView.dispose Started');
        Telemetry.Current.send('ConnectionsView.dispose.called');

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
        Telemetry.Current.send('ConnectionsView._getWebviewContent.called');

        const toolkitUri = ui.getUri(webview, extensionUri, [
            "node_modules",
            "@vscode",
            "webview-ui-toolkit",
            "dist",
            "toolkit.js",
        ]);

        const mainUri = ui.getUri(webview, extensionUri, ["media", "main.js"]);
        const styleUri = ui.getUri(webview, extensionUri, ["media", "style.css"]);

        let tableRows = '';
        if (this.connectionsJson && this.connectionsJson.connections && Array.isArray(this.connectionsJson.connections)) {
            for (const conn of this.connectionsJson.connections) {
                const connId = conn.conn_id || 'N/A';
                const connType = conn.conn_type || 'N/A';
                const host = conn.host || '';
                const port = conn.port || '';
                const schema = conn.schema || '';
                
                tableRows += `
                <tr class="table-row">
                    <td>${this._escapeHtml(connId)}</td>
                    <td><span class="tag">${this._escapeHtml(connType)}</span></td>
                    <td>${this._escapeHtml(host)}</td>
                    <td>${this._escapeHtml(String(port))}</td>
                    <td>${this._escapeHtml(schema)}</td>
                </tr>`;
            }
        } else if (this.connectionsJson) {
             // Fallback if structure is different
             tableRows = `<tr><td colspan="5"><pre>${JSON.stringify(this.connectionsJson, null, 2)}</pre></td></tr>`;
        }

        const result = /*html*/ `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width,initial-scale=1.0">
        <script type="module" src="${toolkitUri}"></script>
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

            .tag {
                background-color: var(--vscode-textBlockQuote-background);
                color: var(--vscode-textBlockQuote-border);
                padding: 2px 6px;
                border-radius: 4px;
                font-size: 11px;
                border: 1px solid var(--vscode-widget-border);
            }
        </style>
        <title>Connections</title>
      </head>
      <body>  
        <h2>Airflow Connections</h2>
        <div class="controls">
            <vscode-button appearance="secondary" id="refresh-connections">Refresh</vscode-button>
        </div>
        
        <table>
            <thead>
                <tr>
                    <th>Conn ID</th>
                    <th>Type</th>
                    <th>Host</th>
                    <th>Port</th>
                    <th>Schema</th>
                </tr>
            </thead>
            <tbody>
                ${tableRows || '<tr><td colspan="5" style="text-align:center; padding: 20px; opacity: 0.7;">No connections found</td></tr>'}
            </tbody>
        </table>
      </body>
    </html>
    `;

        return result;
    }

    private _escapeHtml(text: string): string {
        if (!text) return '';
        const map: { [key: string]: string } = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return String(text).replace(/[&<>"']/g, m => map[m]);
    }

    private _setWebviewMessageListener(webview: vscode.Webview) {
        ui.logToOutput('ConnectionsView._setWebviewMessageListener Started');
        Telemetry.Current.send('ConnectionsView._setWebviewMessageListener.called');
        
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
