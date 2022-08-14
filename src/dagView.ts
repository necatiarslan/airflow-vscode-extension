/* eslint-disable @typescript-eslint/naming-convention */
import * as vscode from "vscode";
import { getUri } from "./getUri";
import fetch from 'node-fetch';
import { encode } from 'base-64';
import { showInfoMessage, showWarningMessage, showErrorMessage } from './ui';
import { Api } from './api';

export class DagView {
    public static currentPanel: DagView | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];
    private extensionUri: vscode.Uri;
    public dagId: string;
    public dagJson: any;

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, dagId:string) {
        this.dagId = dagId;
        this.extensionUri = extensionUri;
        
        this._panel = panel;
        this._panel.onDidDispose(this.dispose, null, this._disposables);
        this._setWebviewMessageListener(this._panel.webview);

        this.getDagInfo();
    }


    public renderHmtl(){
        this._panel.webview.html = this._getWebviewContent(this._panel.webview, this.extensionUri);
    }

    public async getDagInfo(){
        if(!Api.isApiParamsSet()) { return; }

        let result = await Api.getDagInfo(this.dagId);
        if(result.isSuccessful)
        {
            this.dagJson = result.result;
            this.renderHmtl();
        }

    }

    public static render(extensionUri: vscode.Uri, dagId:string) {
        if (DagView.currentPanel) {
            this.currentPanel.dagId = dagId;
            DagView.currentPanel._panel.reveal(vscode.ViewColumn.One);
            DagView.currentPanel.renderHmtl();
        } else {
            const panel = vscode.window.createWebviewPanel("dagView", "Dag View", vscode.ViewColumn.Two, {
                enableScripts: true,
              });

            DagView.currentPanel = new DagView(panel, extensionUri, dagId);
        }
    }

    public dispose() {
        DagView.currentPanel = undefined;

        this._panel.dispose();

        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }

    private _getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri) {
        // Tip: Install the es6-string-html VS Code extension to enable code highlighting below
        const toolkitUri = getUri(webview, extensionUri, [
            "node_modules",
            "@vscode",
            "webview-ui-toolkit",
            "dist",
            "toolkit.js", // A toolkit.min.js file is also available
        ]);

        const mainUri = getUri(webview, extensionUri, ["src", "main.js"]);
        const styleUri = getUri(webview, extensionUri, ["src", "style.css"]);

        return /*html*/ `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width,initial-scale=1.0">
        <script type="module" src="${toolkitUri}"></script>
        <script type="module" src="${mainUri}"></script>
        <link rel="stylesheet" href="${styleUri}">
        <title>DAG</title>
      </head>
      <body>
        <h3>${this.dagId}</h3>

        <section class="dag-detail">
        <h4>Last Run</h4>
        <vscode-divider role="separator"></vscode-divider>
        <p>Failed !!!</p>
        </section>

        <section class="dag-detail">
        <h4>Trigger</h4>
        <vscode-divider role="separator"></vscode-divider>
        <vscode-text-area placeholder="config here"></vscode-text-area>
        <vscode-button appearance="primary">Run</vscode-button>
        </section>

        <section class="dag-detail">
        <h4>Other</h4>
        <vscode-divider role="separator"></vscode-divider>
        <p>Owners:${this.dagJson["tags"][0].name}</p>
        <p>Tags:</p>
        <p>Schedule:${this.dagJson["schedule_interval"].value}</p>
        <p>Next Run:TODO</p>
        </section>
      </body>
    </html>
    `;
    }


    /*
    
    "is_paused": true,
    "dag_id": "string",
    "owners": ["string"],

    "schedule_interval": {
    "__type": "string",
    "days": 0,
    "seconds": 0,
    "microseconds": 0
    },
    "timetable_description": "string",
    "tags": [
    {
    "name": "string"
    }
    ],
    "next_dagrun": "2019-08-24T14:15:22Z",

    */ 


    private _setWebviewMessageListener(webview: vscode.Webview) {
        webview.onDidReceiveMessage(
            (message: any) => {
                const command = message.command;
                const text = message.text;

                switch (command) {
                    case "hello":
                        vscode.window.showInformationMessage(text);
                        return;
                }
            },
            undefined,
            this._disposables
        );
    }
}