/* eslint-disable @typescript-eslint/naming-convention */
import * as vscode from "vscode";
import * as ui from '../common/UI';
import { Session } from '../common/Session';
import { Telemetry } from '../common/Telemetry';

export class PluginsView {
    public static Current: PluginsView;
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];
    private pluginsJson: any;

    private constructor(panel: vscode.WebviewPanel) {
        ui.logToOutput('PluginsView.constructor Started');
        Telemetry.Current.send('PluginsView.constructor.called');

        this._panel = panel;
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        this._setWebviewMessageListener(this._panel.webview);
        this.loadData();
        ui.logToOutput('PluginsView.constructor Completed');
    }

    public async loadData() {
        ui.logToOutput('PluginsView.loadData Started');
        Telemetry.Current.send('PluginsView.loadData.called');

        const result = await Session.Current.Api.getPlugins();
        if (result.isSuccessful) {
            this.pluginsJson = result.result;
        }
        await this.renderHtml();
    }

    public async renderHtml() {
        ui.logToOutput('PluginsView.renderHtml Started');
        Telemetry.Current.send('PluginsView.renderHtml.called');

        this._panel.webview.html = this._getWebviewContent(this._panel.webview, Session.Current.ExtensionUri!);
        ui.logToOutput('PluginsView.renderHtml Completed');
    }

    public static render() {
        ui.logToOutput('PluginsView.render Started');
        Telemetry.Current.send('PluginsView.render.called');

        if (PluginsView.Current) {
            PluginsView.Current._panel.reveal(vscode.ViewColumn.One);
            PluginsView.Current.loadData();
        } else {
            const panel = vscode.window.createWebviewPanel("pluginsView", "Plugins", vscode.ViewColumn.One, {
                enableScripts: true,
            });

            PluginsView.Current = new PluginsView(panel);
        }
    }

    public dispose() {
        ui.logToOutput('PluginsView.dispose Started');
        Telemetry.Current.send('PluginsView.dispose.called');

        PluginsView.Current = undefined;

        this._panel.dispose();

        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }

    private _getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri) {
        ui.logToOutput('PluginsView._getWebviewContent Started');
        Telemetry.Current.send('PluginsView._getWebviewContent.called');

        const elementsUri = ui.getUri(webview, extensionUri, [
            "node_modules",
            "@vscode-elements",
            "elements",
            "dist",
            "bundled.js",
        ]);

        const mainUri = ui.getUri(webview, extensionUri, ["media", "main.js"]);
        const styleUri = ui.getUri(webview, extensionUri, ["media", "style.css"]);

        // Build table rows from plugins data
        let tableRows = '';
        if (this.pluginsJson && this.pluginsJson.plugins) {
            for (const plugin of this.pluginsJson.plugins) {
                const name = plugin.name || 'N/A';
                const hooks = plugin.hooks && plugin.hooks.length > 0 ? plugin.hooks.join(', ') : 'None';
                const executors = plugin.executors && plugin.executors.length > 0 ? plugin.executors.join(', ') : 'None';
                const macros = plugin.macros && plugin.macros.length > 0 ? plugin.macros.map((m: any) => m.name).join(', ') : 'None';
                
                tableRows += `
                <tr class="table-row">
                    <td>${this._escapeHtml(name)}</td>
                    <td>${this._escapeHtml(hooks)}</td>
                    <td>${this._escapeHtml(executors)}</td>
                    <td>${this._escapeHtml(macros)}</td>
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
        <title>Plugins</title>
      </head>
      <body>  
        <h2>Airflow Plugins</h2>
        <div class="controls">
            <vscode-button appearance="secondary" id="refresh-plugins">Refresh</vscode-button>
        </div>
        
        <table>
            <thead>
                <tr>
                    <th>Name</th>
                    <th>Hooks</th>
                    <th>Executors</th>
                    <th>Macros</th>
                </tr>
            </thead>
            <tbody>
            ${tableRows || '<tr><td colspan="4" style="text-align:center; padding: 20px; opacity: 0.7;">No plugins found</td></tr>'}
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
        ui.logToOutput('PluginsView._setWebviewMessageListener Started');
        Telemetry.Current.send('PluginsView._setWebviewMessageListener.called');
        
        webview.onDidReceiveMessage(
            (message: any) => {
                ui.logToOutput('PluginsView._setWebviewMessageListener Message Received ' + message.command);
                switch (message.command) {
                    case "refresh-plugins":
                        this.loadData();
                        return;
                }
            },
            undefined,
            this._disposables
        );
    }
}
