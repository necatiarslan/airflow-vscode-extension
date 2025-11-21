"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VariablesView = void 0;
/* eslint-disable @typescript-eslint/naming-convention */
const vscode = require("vscode");
const ui = require("./ui");
const api_1 = require("./api");
class VariablesView {
    constructor(panel, extensionUri) {
        this._disposables = [];
        ui.logToOutput('VariablesView.constructor Started');
        this.extensionUri = extensionUri;
        this._panel = panel;
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        this._setWebviewMessageListener(this._panel.webview);
        this.loadData();
        ui.logToOutput('VariablesView.constructor Completed');
    }
    async loadData() {
        ui.logToOutput('VariablesView.loadData Started');
        if (!api_1.Api.isApiParamsSet()) {
            return;
        }
        const result = await api_1.Api.getVariables();
        if (result.isSuccessful) {
            this.variablesJson = result.result;
        }
        await this.renderHtml();
    }
    async renderHtml() {
        ui.logToOutput('VariablesView.renderHtml Started');
        this._panel.webview.html = this._getWebviewContent(this._panel.webview, this.extensionUri);
        ui.logToOutput('VariablesView.renderHtml Completed');
    }
    static render(extensionUri) {
        ui.logToOutput('VariablesView.render Started');
        if (VariablesView.Current) {
            VariablesView.Current._panel.reveal(vscode.ViewColumn.Two);
            VariablesView.Current.loadData();
        }
        else {
            const panel = vscode.window.createWebviewPanel("variablesView", "Variables", vscode.ViewColumn.Two, {
                enableScripts: true,
            });
            VariablesView.Current = new VariablesView(panel, extensionUri);
        }
    }
    dispose() {
        ui.logToOutput('VariablesView.dispose Started');
        VariablesView.Current = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }
    _getWebviewContent(webview, extensionUri) {
        ui.logToOutput('VariablesView._getWebviewContent Started');
        const toolkitUri = ui.getUri(webview, extensionUri, [
            "node_modules",
            "@vscode",
            "webview-ui-toolkit",
            "dist",
            "toolkit.js",
        ]);
        const mainUri = ui.getUri(webview, extensionUri, ["media", "main.js"]);
        const styleUri = ui.getUri(webview, extensionUri, ["media", "style.css"]);
        const variablesData = this.variablesJson ? JSON.stringify(this.variablesJson, null, 4) : "No variables found";
        const result = /*html*/ `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width,initial-scale=1.0">
        <script type="module" src="${toolkitUri}"></script>
        <script type="module" src="${mainUri}"></script>
        <link rel="stylesheet" href="${styleUri}">
        <title>Variables</title>
      </head>
      <body>  
        <h2>Airflow Variables</h2>
        <vscode-button appearance="secondary" id="refresh-variables">Refresh</vscode-button>
        <br><br>
        <pre>${variablesData}</pre>
      </body>
    </html>
    `;
        return result;
    }
    _setWebviewMessageListener(webview) {
        ui.logToOutput('VariablesView._setWebviewMessageListener Started');
        webview.onDidReceiveMessage((message) => {
            ui.logToOutput('VariablesView._setWebviewMessageListener Message Received ' + message.command);
            switch (message.command) {
                case "refresh-variables":
                    this.loadData();
                    return;
            }
        }, undefined, this._disposables);
    }
}
exports.VariablesView = VariablesView;
//# sourceMappingURL=variablesView.js.map