"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProvidersView = void 0;
/* eslint-disable @typescript-eslint/naming-convention */
const vscode = require("vscode");
const ui = require("./ui");
const api_1 = require("./api");
class ProvidersView {
    constructor(panel, extensionUri) {
        this._disposables = [];
        ui.logToOutput('ProvidersView.constructor Started');
        this.extensionUri = extensionUri;
        this._panel = panel;
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        this._setWebviewMessageListener(this._panel.webview);
        this.loadData();
        ui.logToOutput('ProvidersView.constructor Completed');
    }
    async loadData() {
        ui.logToOutput('ProvidersView.loadData Started');
        if (!api_1.Api.isApiParamsSet()) {
            return;
        }
        const result = await api_1.Api.getProviders();
        if (result.isSuccessful) {
            this.providersJson = result.result;
        }
        await this.renderHtml();
    }
    async renderHtml() {
        ui.logToOutput('ProvidersView.renderHtml Started');
        this._panel.webview.html = this._getWebviewContent(this._panel.webview, this.extensionUri);
        ui.logToOutput('ProvidersView.renderHtml Completed');
    }
    static render(extensionUri) {
        ui.logToOutput('ProvidersView.render Started');
        if (ProvidersView.Current) {
            ProvidersView.Current._panel.reveal(vscode.ViewColumn.Two);
            ProvidersView.Current.loadData();
        }
        else {
            const panel = vscode.window.createWebviewPanel("providersView", "Providers", vscode.ViewColumn.Two, {
                enableScripts: true,
            });
            ProvidersView.Current = new ProvidersView(panel, extensionUri);
        }
    }
    dispose() {
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
    _getWebviewContent(webview, extensionUri) {
        ui.logToOutput('ProvidersView._getWebviewContent Started');
        const toolkitUri = ui.getUri(webview, extensionUri, [
            "node_modules",
            "@vscode",
            "webview-ui-toolkit",
            "dist",
            "toolkit.js",
        ]);
        const mainUri = ui.getUri(webview, extensionUri, ["media", "main.js"]);
        const styleUri = ui.getUri(webview, extensionUri, ["media", "style.css"]);
        const providersData = this.providersJson ? JSON.stringify(this.providersJson, null, 4) : "No providers found";
        const result = /*html*/ `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width,initial-scale=1.0">
        <script type="module" src="${toolkitUri}"></script>
        <script type="module" src="${mainUri}"></script>
        <link rel="stylesheet" href="${styleUri}">
        <title>Providers</title>
      </head>
      <body>  
        <h2>Airflow Providers</h2>
        <vscode-button appearance="secondary" id="refresh-providers">Refresh</vscode-button>
        <br><br>
        <pre>${providersData}</pre>
      </body>
    </html>
    `;
        return result;
    }
    _setWebviewMessageListener(webview) {
        ui.logToOutput('ProvidersView._setWebviewMessageListener Started');
        webview.onDidReceiveMessage((message) => {
            ui.logToOutput('ProvidersView._setWebviewMessageListener Message Received ' + message.command);
            switch (message.command) {
                case "refresh-providers":
                    this.loadData();
                    return;
            }
        }, undefined, this._disposables);
    }
}
exports.ProvidersView = ProvidersView;
//# sourceMappingURL=providersView.js.map