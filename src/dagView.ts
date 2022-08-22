/* eslint-disable @typescript-eslint/naming-convention */
import * as vscode from "vscode";
import { getUri } from "./getUri";
import * as ui from './ui';
import { Api } from './api';

export class DagView {
    public static currentPanel: DagView | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];
    private extensionUri: vscode.Uri;

    public dagId: string;
    public triggeredDagRunId: string;

    public dagJson: any;
    public dagRunJson: any;
    public dagRunHistoryJson: any;
    public dagTaskInstancesJson: any;
    public dagTasksJson: any;

    private dagStatusInterval: NodeJS.Timer;
    private activetabid: string = "tab-1";

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, dagId: string) {
        ui.logToOutput('DagView.constructor Started');
        this.dagId = dagId;
        this.extensionUri = extensionUri;

        this._panel = panel;
        this._panel.onDidDispose(this.dispose, null, this._disposables);
        this._setWebviewMessageListener(this._panel.webview);
        this.loadAllDagData();
        ui.logToOutput('DagView.constructor Completed');
    }

    public async loadAllDagData() {
        ui.logToOutput('DagView.loadAllDagData Started');
        await this.getDagInfo();
        await this.getLastRun();
        //await this.getDagTasks();
        //await this.getRunHistory();
        await this.renderHmtl();
    }

    public async loadDagDataOnly() {
        ui.logToOutput('DagView.loadDagDataOnly Started');
        await this.getDagInfo();
        await this.renderHmtl();
    }

    public async renderHmtl() {
        ui.logToOutput('DagView.renderHmtl Started');
        this._panel.webview.html = this._getWebviewContent(this._panel.webview, this.extensionUri);
        //ui.showOutputMessage(this._panel.webview.html);
        ui.logToOutput('DagView.renderHmtl Completed');
    }

    public static render(extensionUri: vscode.Uri, dagId: string) {
        ui.logToOutput('DagView.render Started');
        if (DagView.currentPanel) {
            this.currentPanel.dagId = dagId;
            DagView.currentPanel._panel.reveal(vscode.ViewColumn.Two);
            DagView.currentPanel.loadAllDagData();
        } else {
            const panel = vscode.window.createWebviewPanel("dagView", "Dag View", vscode.ViewColumn.Two, {
                enableScripts: true,
            });

            DagView.currentPanel = new DagView(panel, extensionUri, dagId);
        }
    }

    public async getLastRun() {
        ui.logToOutput('DagView.getLastRun Started');
        if (!Api.isApiParamsSet()) { return; }

        let result = await Api.getLastDagRun(this.dagId);
        if (result.isSuccessful) {
            this.dagRunJson = result.result;
            this.getTaskInstances(this.dagRunJson.dag_run_id);
        }

    }

    public async getRunHistory() {
        ui.logToOutput('DagView.getRunHistory Started');
        if (!Api.isApiParamsSet()) { return; }

        let result = await Api.getDagRunHistory(this.dagId, 10);
        if (result.isSuccessful) {
            this.dagRunHistoryJson = result.result;
        }

    }

    public async getTaskInstances(dagRunId: string) {
        ui.logToOutput('DagView.getTaskInstances Started');
        if (!Api.isApiParamsSet()) { return; }

        let result = await Api.getTaskInstances(this.dagId, dagRunId);
        if (result.isSuccessful) {
            this.dagTaskInstancesJson = result.result;
        }

    }

    public async getDagInfo() {
        ui.logToOutput('DagView.getDagInfo Started');
        if (!Api.isApiParamsSet()) { return; }

        let result = await Api.getDagInfo(this.dagId);
        if (result.isSuccessful) {
            this.dagJson = result.result;
        }
    }

    public async getDagTasks() {
        ui.logToOutput('DagView.getDagTasks Started');
        if (!Api.isApiParamsSet()) { return; }

        let result = await Api.getDagTasks(this.dagId);
        if (result.isSuccessful) {
            this.dagTasksJson = result.result;
        }
    }

    public dispose() {
        ui.logToOutput('DagView.dispose Started');
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
        ui.logToOutput('DagView._getWebviewContent Started');
        const toolkitUri = getUri(webview, extensionUri, [
            "node_modules",
            "@vscode",
            "webview-ui-toolkit",
            "dist",
            "toolkit.js", // A toolkit.min.js file is also available
        ]);

        const mainUri = getUri(webview, extensionUri, ["media", "main.js"]);
        const styleUri = getUri(webview, extensionUri, ["media", "style.css"]);

        let dagId = this.dagId;
        let state = (this.dagRunJson) ? this.dagRunJson.state : "";
        let logical_date = (this.dagRunJson) ? this.dagRunJson.logical_date : "";
        let start_date = (this.dagRunJson) ? this.dagRunJson.start_date : "";
        let end_date = (this.dagRunJson) ? this.dagRunJson.end_date : "";
        let owners = (this.dagJson) ? this.dagJson["owners"].join(", ") : "";
        let tags: string = "";
        this.dagJson["tags"].forEach(item => { tags += item.name + ", "; });
        tags = tags.slice(0, -3);
        let schedule_interval = (this.dagJson) ? this.dagJson["schedule_interval"].value : "";
        let isPaused = (this.dagJson) ? this.dagJson.is_paused ? "true" : "false" : "unknown";
        let next_dagrun = '';//(this.dagJson) ? this.dagJson["next_dagrun"] : "";

        let logical_date_string = new Date(logical_date).toLocaleDateString();
        let start_date_string = new Date(start_date).toLocaleString();
        let duration = ui.getDuration(new Date(start_date), new Date(end_date));

        let isDagRunning: boolean = (state === "queued" || state === "running") ? true : false;

        let taskRows: string = "";
        if (this.dagTaskInstancesJson) {
            for (var t of this.dagTaskInstancesJson["task_instances"]) {
                taskRows += `
                <tr>
                    <td>
                        <div style="display: flex; align-items: center;">
                            <div class="state-${t.state}" title="${t.state}" ></div>
                            &nbsp; ${t.task_id} (${t.try_number})
                        </div>
                    </td>
                    <td><vscode-link id="task-log-link-${t.task_id}">Log</vscode-link></td>
                    <td>${ui.getDuration(new Date(t.start_date), new Date(t.end_date))}</td>
                    <td>${t.operator}</td>
                </tr>
                `;
            }
        }

        let runHistoryRows: string = "";
        if (this.dagRunHistoryJson) {
            for (var t of this.dagRunHistoryJson["dag_runs"]) {
                runHistoryRows += `
                <tr>
                    <td>
                        <div style="display: flex; align-items: center;">
                            <div class="state-${t.state}" title="${t.state}"></div>
                            &nbsp; ${t.state}
                        </div>
                    </td>
                    <td><vscode-link id="history-dag-run-id-${t.dag_run_id}">${new Date(t.start_date).toLocaleString()}</vscode-link></td>
                    <td>${ui.getDuration(new Date(t.start_date), new Date(t.end_date))}</td>
                </tr>
                `;
            }
        }


        let result = /*html*/ `
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


        <div style="display: flex; align-items: center;">
            <div class="dag-paused-${isPaused}"></div>
            &nbsp; &nbsp; <h2>${dagId}</h2>
            <div style="visibility: ${isDagRunning ? "visible" : "hidden"}; display: flex; align-items: center;">
            &nbsp; &nbsp; <vscode-progress-ring></vscode-progress-ring>
            </div>
        </div>
                    

        <vscode-panels id="tab-control" activeid="${this.activetabid}">
            <vscode-panel-tab id="tab-1">RUN</vscode-panel-tab>
            <vscode-panel-tab id="tab-2">TASKS</vscode-panel-tab>
            <vscode-panel-tab id="tab-3">INFO</vscode-panel-tab>
            <vscode-panel-tab id="tab-4">PREV RUNS</vscode-panel-tab>
            
            <vscode-panel-view id="view-1">
                
            <section>

                    <table>
                        <tr>
                            <th colspan=3>Last Run</th>
                        </tr>
                        <tr>
                            <td>State</td>
                            <td>:</td>
                            <td>
                                <div style="display: flex; align-items: center;">
                                    <div class="state-${state}"></div> &nbsp; ${state}
                                </div>
                            </td>
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
                            <td>Duration</td>
                            <td>:</td>
                            <td>${duration}</td>
                        </tr>
                        <tr>
                            <td colspan="3">
                                <vscode-button appearance="primary" id="run-lastrun-check">Check</vscode-button>      
                                <vscode-button appearance="primary" id="run-view-log">View Log</vscode-button>  
                                <vscode-button appearance="primary" id="run-more-dagrun-detail">More</vscode-button>
                            </td>
                        </tr>
                    </table>
            
                    <br>
            
                    <table>
                        <tr>
                            <th colspan="3">Trigger</th>
                        </tr>
                        <tr>
                            <td>Date</td>
                            <td>:</td>
                            <td><vscode-text-field size="30" id="run_date" placeholder="YYYY-MM-DD (Optional)" maxlength="10"></vscode-text-field></td>
                        </tr>
                        <tr>
                            <td>Config</td>
                            <td>:</td>
                            <td><vscode-text-area id="run_config" cols="50" placeholder="Config in JSON Format (Optional)"></vscode-text-area></td>
                        </tr>
                        <tr>           
                            <td colspan="3"><vscode-button appearance="primary" id="run-trigger-dag" ${isPaused === "true" ? "disabled" : ""}>
                            Run
                            </vscode-button></td>
                        </tr>
                    </table>

                    <br>

                    <table>
                        <tr>
                            <th colspan="3">
                            <vscode-button appearance="primary" id="run-pause-dag" ${isPaused === "true" ? "disabled" : ""}>
                            Pause
                            </vscode-button>
                            <vscode-button appearance="primary" id="run-unpause-dag" ${isPaused === "false" ? "disabled" : ""}>
                            Un Pause
                            </vscode-button>
                            </th>
                        </tr>
                    </table>

                    <br>
                    
                    <table>
                        <tr>
                            <td colspan="3">
                                <vscode-link href="https://github.com/necatiarslan/airflow-vscode-extension/issues/new">Bug Report & Feature Request</vscode-link>
                            </td>
                        </tr>
                    </table>
            </section>
            </vscode-panel-view>


            <vscode-panel-view id="view-2">

            <section>

                    <table>
                        <tr>
                            <th colspan="4">Tasks</th>
                        </tr>
                        <tr>
                            <td>Task</td>
                            <td></td>
                            <td>Duration</td>            
                            <td>Operator</td>
                        </tr>

                        ${taskRows}

                        <tr>          
                            <td colspan="4">
                                <vscode-button appearance="primary" id="tasks-refresh">Refresh</vscode-button>
                                <vscode-button appearance="primary" id="tasks-more-detail">More</vscode-button>
                            </td>
                        </tr>
                    </table>

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
                    <tr>           
                        <td colspan="3"><vscode-button appearance="primary" id="info-source-code">Source Code</vscode-button> <vscode-button appearance="primary" id="other-dag-detail">More</vscode-button></td>
                    </tr>
                    </table>

            </section>
            </vscode-panel-view>

            <vscode-panel-view id="view-4">

            <section>
    
                    <table>
                        <tr>
                            <th colspan=3>PREV RUNS</th>
                        </tr>
                        <tr>
                            <td></td>
                            <td>Start Time</td>            
                            <td>Duration</td>
                        </tr>
                        ${runHistoryRows}

                        <tr>
                            <td colspan="3"><vscode-button appearance="primary" id="rev-runs-refresh">Refresh</vscode-button></td>
                        </tr>
                    </table>   
    
            </section>
            </vscode-panel-view>

        </vscode-panels>
      </body>
    </html>
    `;
        ui.logToOutput('DagView._getWebviewContent Completed');
        return result;
    }

    private _setWebviewMessageListener(webview: vscode.Webview) {
        ui.logToOutput('DagView._setWebviewMessageListener Started');
        webview.onDidReceiveMessage(
            (message: any) => {
                const command = message.command;
                let activetabid = message.activetabid;

                if (["tab-1", "tab-2", "tab-3", "tab-4"].includes(activetabid)) {
                    this.activetabid = message.activetabid;
                }

                ui.logToOutput('DagView._setWebviewMessageListener Message Received ' + message.command);
                switch (command) {
                    case "run-trigger-dag":
                        this.triggerDagWConfig(message.config, message.date);
                        return;
                    case "run-view-log":
                        this.lastDAGRunLog();
                        return;
                    case "run-more-dagrun-detail":
                        ui.showOutputMessage(this.dagRunJson);
                        return;
                    case "other-dag-detail":
                        ui.showOutputMessage(this.dagJson);
                        return;
                    case "tasks-more-detail":
                        ui.showOutputMessage(this.dagTaskInstancesJson);
                        return;
                    case "rev-runs-refresh":
                        this.getRunHistoryAndRenderHtml();
                        return;
                    case "info-source-code":
                        this.showSourceCode();
                        return;
                    case "run-pause-dag":
                        this.pauseDAG(true);
                        return;
                    case "run-unpause-dag":
                        this.pauseDAG(false);
                        return;

                    case "run-lastrun-check":
                        this.startCheckingDagRunStatus();
                        return;

                    case "history-dag-run-id":
                        ui.showInfoMessage("Development is in progress...");
                        return;

                    case "task-log-link":
                        ui.showInfoMessage("Development is in progress...");
                        return;

                    case "tab-control":
                        ui.logToOutput("Acive Tab Id = " + message.activeid);
                        return;

                    case "tasks-refresh":
                        this.getTasksAndRenderHtml();
                        return;
                }

            },
            undefined,
            this._disposables
        );
    }

    private async getTasksAndRenderHtml() {
        this.getDagTasks();
        this.renderHmtl();
    }

    async pauseDAG(is_paused: boolean) {
        ui.logToOutput('DagTreeView.pauseDAG Started');
        if (!Api.isApiParamsSet()) { return; }

        if (is_paused && this.dagJson.is_paused) { ui.showWarningMessage(this.dagId + 'Dag is already PAUSED'); return; }
        if (!is_paused && !this.dagJson.is_paused) { ui.showWarningMessage(this.dagId + 'Dag is already ACTIVE'); return; }

        let result = await Api.pauseDag(this.dagId, is_paused);
        if (result.isSuccessful) {
            this.loadDagDataOnly();
        }

    }

    async showSourceCode() {
        ui.logToOutput('DagView.showSourceCode Started');
        if (!Api.isApiParamsSet()) { return; }

        let result = await Api.getSourceCode(this.dagId, this.dagJson.file_token);
        if (result.isSuccessful) {
            const tmp = require('tmp');
            var fs = require('fs');

            const tmpFile = tmp.fileSync({ mode: 0o644, prefix: this.dagId, postfix: '.py' });
            fs.appendFileSync(tmpFile.name, result.result);
            ui.openFile(tmpFile.name);
        }
    }

    async getRunHistoryAndRenderHtml() {
        ui.logToOutput('DagView.getRunHistoryAndRenderHtml Started');
        await this.getRunHistory();
        await this.renderHmtl();
    }

    async lastDAGRunLog() {
        ui.logToOutput('DagView.lastDAGRunLog Started');
        if (!Api.isApiParamsSet()) { return; }

        let result = await Api.getLastDagRunLog(this.dagId);
        if (result.isSuccessful) {
            const tmp = require('tmp');
            var fs = require('fs');
            const tmpFile = tmp.fileSync({ mode: 0o644, prefix: this.dagId, postfix: '.log' });
            fs.appendFileSync(tmpFile.name, result.result);
            ui.openFile(tmpFile.name);
        }
    }

    async triggerDagWConfig(config: string = "", date: string = "") {
        ui.logToOutput('DagView.triggerDagWConfig Started');
        if (!Api.isApiParamsSet()) { return; }

        if (config && !ui.isJsonString(config)) {
            ui.showWarningMessage("Config is not a valid JSON");
            return;
        }

        if (date && !ui.isValidDate(date)) {
            ui.showWarningMessage("Date is not a valid DATE");
            return;
        }

        if (!config) {
            config = "{}";
        }


        if (config !== undefined) {

            let result = await Api.triggerDag(this.dagId, config);

            if (result.isSuccessful) {
                this.triggeredDagRunId = result.result["dag_run_id"];

                this.startCheckingDagRunStatus();
            }
        }
    }

    async startCheckingDagRunStatus() {
        ui.logToOutput('DagView.startCheckingDagRunStatus Started');
        await this.refreshRunningDagState(this);
        if (this.dagStatusInterval) {
            clearInterval(this.dagStatusInterval);//stop prev checking
        }
        this.dagStatusInterval = setInterval(this.refreshRunningDagState, 5 * 1000, this);
    }

    async stopCheckingDagRunStatus() {
        ui.logToOutput('DagView.stopCheckingDagRunStatus Started');
        if (this.dagStatusInterval) {
            clearInterval(this.dagStatusInterval);//stop prev checking
        }
    }

    async refreshRunningDagState(dagView: DagView) {
        ui.logToOutput('DagView.refreshRunningDagState Started');
        if (!Api.isApiParamsSet()) { return; }

        let result = await Api.getDagRun(dagView.dagId, dagView.triggeredDagRunId);
        if (result.isSuccessful) {
            dagView.dagRunJson = result.result;

            let resultTasks = await Api.getTaskInstances(dagView.dagId, dagView.triggeredDagRunId);
            if (result.isSuccessful) {
                dagView.dagTaskInstancesJson = resultTasks.result;
            }
        }
        else {
            dagView.stopCheckingDagRunStatus();
            return;
        }

        let state = (dagView.dagRunJson) ? dagView.dagRunJson.state : "";

        //"queued" "running" "success" "failed"
        if (state === "queued" || state === "running") {
            //go on for the next check
        }
        else {
            dagView.stopCheckingDagRunStatus();
        }

        dagView.renderHmtl();
    }

}