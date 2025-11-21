"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConnectionsView = void 0;
/* eslint-disable @typescript-eslint/naming-convention */
const vscode = require("vscode");
const ui = require("./ui");
const api_1 = require("./api");
class ConnectionsView {
    constructor(panel, extensionUri) {
        this._disposables = [];
        ui.logToOutput('ConnectionsView.constructor Started');
        this.extensionUri = extensionUri;
        this._panel = panel;
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        this._setWebviewMessageListener(this._panel.webview);
        this.loadData();
        ui.logToOutput('ConnectionsView.constructor Completed');
    }
    async loadData() {
        ui.logToOutput('ConnectionsView.loadData Started');
        if (!api_1.Api.isApiParamsSet()) {
            return;
        }
        const result = await api_1.Api.getConnections();
        if (result.isSuccessful) {
            this.connectionsJson = result.result;
        }
        await this.renderHtml();
    }
    async renderHtml() {
        ui.logToOutput('ConnectionsView.renderHtml Started');
        this._panel.webview.html = this._getWebviewContent(this._panel.webview, this.extensionUri);
        ui.logToOutput('ConnectionsView.renderHtml Completed');
    }
    static render(extensionUri) {
        ui.logToOutput('ConnectionsView.render Started');
        if (ConnectionsView.Current) {
            ConnectionsView.Current._panel.reveal(vscode.ViewColumn.Two);
            ConnectionsView.Current.loadData();
        }
        else {
            const panel = vscode.window.createWebviewPanel("connectionsView", "Connections", vscode.ViewColumn.Two, {
                enableScripts: true,
            });
            ConnectionsView.Current = new ConnectionsView(panel, extensionUri);
        }
    }
    dispose() {
        ui.logToOutput('ConnectionsView.dispose Started');
        ConnectionsView.Current = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }
    _getWebviewContent(webview, extensionUri) {
        ui.logToOutput('ConnectionsView._getWebviewContent Started');
        const toolkitUri = ui.getUri(webview, extensionUri, [
            "node_modules",
            "@vscode",
            "webview-ui-toolkit",
            "dist",
            "toolkit.js",
        ]);
        const mainUri = ui.getUri(webview, extensionUri, ["media", "main.js"]);
        const styleUri = ui.getUri(webview, extensionUri, ["media", "style.css"]);
        const connectionsData = this.connectionsJson ? JSON.stringify(this.connectionsJson, null, 4) : "No connections found";
        const result = /*html*/ `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width,initial-scale=1.0">
        <script type="module" src="${toolkitUri}"></script>
        <script type="module" src="${mainUri}"></script>
        <link rel="stylesheet" href="${styleUri}">
        <title>Connections</title>
      </head>
      <body>  
        <h2>Airflow Connections</h2>
        <vscode-button appearance="secondary" id="refresh-connections">Refresh</vscode-button>
        <br><br>
        <pre>${connectionsData}</pre>
      </body>
    </html>
    `;
        return result;
    }
    _setWebviewMessageListener(webview) {
        ui.logToOutput('ConnectionsView._setWebviewMessageListener Started');
        webview.onDidReceiveMessage((message) => {
            ui.logToOutput('ConnectionsView._setWebviewMessageListener Message Received ' + message.command);
            switch (message.command) {
                case "refresh-connections":
                    this.loadData();
                    return;
            }
        }, undefined, this._disposables);
    }
}
exports.ConnectionsView = ConnectionsView;
//# sourceMappingURL=connectionsView.js.map