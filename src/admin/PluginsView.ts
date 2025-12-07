/* eslint-disable @typescript-eslint/naming-convention */
import * as vscode from "vscode";
import * as ui from '../common/UI';
import { Session } from '../common/Session';

export class PluginsView {
    public static Current: PluginsView;
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];
    private pluginsJson: any;

    private constructor(panel: vscode.WebviewPanel) {
        ui.logToOutput('PluginsView.constructor Started');
        this._panel = panel;
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        this._setWebviewMessageListener(this._panel.webview);
        this.loadData();
        ui.logToOutput('PluginsView.constructor Completed');
    }

    public async loadData() {
        ui.logToOutput('PluginsView.loadData Started');

        const result = await Session.Current.Api.getPlugins();
        if (result.isSuccessful) {
            this.pluginsJson = result.result;
        }
        await this.renderHtml();
    }

    public async renderHtml() {
        ui.logToOutput('PluginsView.renderHtml Started');
        this._panel.webview.html = this._getWebviewContent(this._panel.webview, Session.Current.ExtensionUri!);
        ui.logToOutput('PluginsView.renderHtml Completed');
    }

    public static render() {
        ui.logToOutput('PluginsView.render Started');
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
                <vscode-table-row>
                    <vscode-table-cell>${this._escapeHtml(name)}</vscode-table-cell>
                    <vscode-table-cell>${this._escapeHtml(hooks)}</vscode-table-cell>
                    <vscode-table-cell>${this._escapeHtml(executors)}</vscode-table-cell>
                    <vscode-table-cell>${this._escapeHtml(macros)}</vscode-table-cell>
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
        <title>Plugins</title>
      </head>
      <body>  
        <h2>Airflow Plugins</h2>
        <div class="controls">
            <vscode-button appearance="secondary" id="refresh-plugins">Refresh</vscode-button>
        </div>
        
        <vscode-table zebra bordered-columns resizable>
            <vscode-table-header slot="header">
                <vscode-table-header-cell>Name</vscode-table-header-cell>
                <vscode-table-header-cell>Hooks</vscode-table-header-cell>
                <vscode-table-header-cell>Executors</vscode-table-header-cell>
                <vscode-table-header-cell>Macros</vscode-table-header-cell>
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
        ui.logToOutput('PluginsView._setWebviewMessageListener Started');
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
