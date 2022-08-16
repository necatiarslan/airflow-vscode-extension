/* eslint-disable @typescript-eslint/naming-convention */
import * as vscode from "vscode";
import { getUri } from "./getUri";
import { showInfoMessage, showWarningMessage, showErrorMessage, showFile } from './ui';
import { Api } from './api';

export class DagView {
    public static currentPanel: DagView | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];
    private extensionUri: vscode.Uri;
    public dagId: string;
    public dagJson: any;
    public dagLastRunJson: any;
    private dagStatusInterval: NodeJS.Timer;

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, dagId: string) {
        this.dagId = dagId;
        this.extensionUri = extensionUri;

        this._panel = panel;
        this._panel.onDidDispose(this.dispose, null, this._disposables);
        this._setWebviewMessageListener(this._panel.webview);

        this.getDagInfo();
        this.getLastRun();
    }

    public renderHmtl() {
        this._panel.webview.html = this._getWebviewContent(this._panel.webview, this.extensionUri);
    }

    public async getLastRun() {
        if (!Api.isApiParamsSet()) { return; }

        let result = await Api.getLastDagRun(this.dagId);
        if (result.isSuccessful) {
            this.dagLastRunJson = result.result;
            this.renderHmtl();
        }

    }

    public async getDagInfo() {
        if (!Api.isApiParamsSet()) { return; }

        let result = await Api.getDagInfo(this.dagId);
        if (result.isSuccessful) {
            this.dagJson = result.result;
            this.renderHmtl();
        }

    }

    public static render(extensionUri: vscode.Uri, dagId: string) {
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

        let dagId = this.dagId;
        let state = (this.dagLastRunJson) ? this.dagLastRunJson.dag_runs[0]["state"] : "";
        let logical_date = (this.dagLastRunJson) ? this.dagLastRunJson.dag_runs[0]["logical_date"] : "";
        let start_date = (this.dagLastRunJson) ? this.dagLastRunJson.dag_runs[0]["start_date"] : "";
        let owners = (this.dagJson) ? this.dagJson["owners"].join(", ") : "";
        let tags:string = "";
        this.dagJson["tags"].forEach(item => {tags += item.name + ", ";});
        tags = tags.slice(0, -3);
        let schedule_interval = (this.dagJson) ? this.dagJson["schedule_interval"].value : "";
        let next_dagrun = '';//(this.dagJson) ? this.dagJson["next_dagrun"] : "";

        let logical_date_string = new Date(logical_date).toLocaleDateString();
        let start_date_string = new Date(start_date).toLocaleDateString();


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
        <h3>${dagId}</h3>

        <vscode-panels activeid="tab-4">
            <vscode-panel-tab id="tab-1">RUN</vscode-panel-tab>
            <vscode-panel-tab id="tab-2">TRACE</vscode-panel-tab>
            <vscode-panel-tab id="tab-3">INFO</vscode-panel-tab>
            <vscode-panel-view id="view-1">
                
            <section>

            <table>
            <tr>
                <th colspan=3>Last Run</th>
            </tr>
            <tr>
                <td>State</td>
                <td>:</td>
                <td>${state}</td>
            </tr>
            <tr>
                <td>Date</td>
                <td>:</td>
                <td>${logical_date_string}</td>
             </tr>
            <tr>
                <td>StartDate</td>
                <td>:</td>
                <td>${start_date_string}</td>
            </tr>
            <tr>
                <td></td>
                <td></td>
                <td text-align:right><vscode-button appearance="primary" id="view_log">View Log</vscode-button></td>
            </tr>
            </table>
    
            <br>
    
            <table>
            <tr>
                <th colspan=3>Trigger</th>
            </tr>
            <tr>
                <td>Config</td>
                <td>:</td>
                <td><vscode-text-area id="run_config" cols="50" placeholder="Config in JSON Format (Optional)"></vscode-text-area></td>
            </tr>
            <tr>
                <td>Date</td>
                <td>:</td>
                <td><vscode-text-field id="run_date" placeholder="YYYY-MM-DD" maxlength="10"></vscode-text-field></td>
            </tr>
            <tr>
                <td></td>
                <td></td>            
                <td><vscode-button appearance="primary" id="trigger_dag">
                Run
                </vscode-button></td>
             </tr>
            </table>

            </section>

            </vscode-panel-view>
            <vscode-panel-view id="view-2">

            <section>

                TRACE CONTENT

            </section>
            </vscode-panel-view>
            <vscode-panel-view id="view-3">
                
            <section>

            <table>
            <tr>
                <th colspan=3>Other</th>
            </tr>
            <tr>
                <td>Owners</td>
                <td>:</td>
                <td>${owners}</td>
            </tr>
            <tr>
                <td>Tags</td>
                <td>:</td>
                <td>${tags}</td>
            </tr>
            <tr>
                <td>Schedule</td>
                <td>:</td>
                <td>${schedule_interval}</td>
            </tr>
            <tr>
                <td>Next Run</td>
                <td>:</td>
                <td>${next_dagrun}</td>
            </tr>
            </table>

            </section>

            </vscode-panel-view>
        </vscode-panels>

      </body>
    </html>
    `;
    }

    private _setWebviewMessageListener(webview: vscode.Webview) {
        webview.onDidReceiveMessage(
            (message: any) => {
                const command = message.command;
                const text = message.text;

                switch (command) {
                    case "trigger_dag":
                        this.triggerDagWConfig();
                        return;
                    case "view_log":
                        this.lastDAGRunLog();
                        return;
                }
            },
            undefined,
            this._disposables
        );
    }

    async lastDAGRunLog() {
        if (!Api.isApiParamsSet()) { return; }

        let result = await Api.getLastDagRunLog(this.dagId);
        if (result.isSuccessful) {
            const tmp = require('tmp');
            var fs = require('fs');
            const tmpFile = tmp.fileSync({ mode: 0o644, prefix: this.dagId, postfix: '.log' });
            fs.appendFileSync(tmpFile.name, result.result);
            showFile(tmpFile.name);
        }
    }

    async triggerDagWConfig() {
        if (!Api.isApiParamsSet()) { return; }

        let triggerDagConfig = "";

        if (!triggerDagConfig) {
            triggerDagConfig = "{}";
        }

        if (triggerDagConfig !== undefined) {

            let result = await Api.triggerDag(this.dagId, triggerDagConfig);

            if (result.isSuccessful) {
                showInfoMessage("Dag Triggered");
                // var responseTrigger = result.result;
                // if (this.dagStatusInterval) {
                //     this.dagStatusInterval.refresh();
                // }
                // else {
                //     this.dagStatusInterval = setInterval(this.refreshRunningDagState, 10 * 1000);
                // }
            }
            else
            {
                showErrorMessage("Dag Trigger Error !!!", result.error);
            }

        }
    }

    async refreshRunningDagState() {
        if (!Api.isApiParamsSet()) { return; }

        let state = (this.dagLastRunJson) ? this.dagLastRunJson.dag_runs[0]["state"] : "";
        let latestDagRunId = (this.dagLastRunJson) ? this.dagLastRunJson.dag_runs[0]["dag_run_id"] : "";

        //"queued" "running" "success" "failed"
        if (state === "queued" || state === "running") {

            let result = await Api.getDagRun(this.dagId, latestDagRunId);

            if (result.isSuccessful) {
                this.dagLastRunJson = result.result;
                this.renderHmtl();
            }
            else {
                this.dagLastRunJson = undefined;
            }

        }
        this.renderHmtl();

        if (!(state === "queued" || state === "running") && this.dagStatusInterval) {
            clearInterval(this.dagStatusInterval);
        }
    }

}