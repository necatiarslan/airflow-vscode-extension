"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DagView = void 0;
/* eslint-disable @typescript-eslint/naming-convention */
const vscode = require("vscode");
const getUri_1 = require("./getUri");
const ui = require("./ui");
const api_1 = require("./api");
class DagView {
    constructor(panel, extensionUri, dagId) {
        this._disposables = [];
        ui.logToOutput('DagView.constructor Started');
        this.dagId = dagId;
        this.extensionUri = extensionUri;
        this._panel = panel;
        this._panel.onDidDispose(this.dispose, null, this._disposables);
        this._setWebviewMessageListener(this._panel.webview);
        this.loadDagData();
        ui.logToOutput('DagView.constructor Completed');
    }
    async loadDagData() {
        ui.logToOutput('DagView.loadDagData Started');
        await this.getDagInfo();
        await this.getLastRun();
        await this.getDagTasks();
        await this.getRunHistory();
        await this.renderHmtl();
    }
    async renderHmtl() {
        ui.logToOutput('DagView.renderHmtl Started');
        this._panel.webview.html = this._getWebviewContent(this._panel.webview, this.extensionUri);
        //ui.showOutputMessage(this._panel.webview.html);
        ui.logToOutput('DagView.renderHmtl Completed');
    }
    static render(extensionUri, dagId) {
        ui.logToOutput('DagView.render Started');
        if (DagView.currentPanel) {
            this.currentPanel.dagId = dagId;
            DagView.currentPanel._panel.reveal(vscode.ViewColumn.Two);
            DagView.currentPanel.loadDagData();
        }
        else {
            const panel = vscode.window.createWebviewPanel("dagView", "Dag View", vscode.ViewColumn.Two, {
                enableScripts: true,
            });
            DagView.currentPanel = new DagView(panel, extensionUri, dagId);
        }
    }
    async getLastRun() {
        ui.logToOutput('DagView.getLastRun Started');
        if (!api_1.Api.isApiParamsSet()) {
            return;
        }
        let result = await api_1.Api.getLastDagRun(this.dagId);
        if (result.isSuccessful) {
            this.dagRunJson = result.result;
            this.getTaskInstances(this.dagRunJson.dag_run_id);
        }
    }
    async getRunHistory() {
        ui.logToOutput('DagView.getRunHistory Started');
        if (!api_1.Api.isApiParamsSet()) {
            return;
        }
        let result = await api_1.Api.getDagRunHistory(this.dagId, 10);
        if (result.isSuccessful) {
            this.dagRunHistoryJson = result.result;
        }
    }
    async getTaskInstances(dagRunId) {
        ui.logToOutput('DagView.getTaskInstances Started');
        if (!api_1.Api.isApiParamsSet()) {
            return;
        }
        let result = await api_1.Api.getTaskInstances(this.dagId, dagRunId);
        if (result.isSuccessful) {
            this.dagTaskInstancesJson = result.result;
        }
    }
    async getDagInfo() {
        ui.logToOutput('DagView.getDagInfo Started');
        if (!api_1.Api.isApiParamsSet()) {
            return;
        }
        let result = await api_1.Api.getDagInfo(this.dagId);
        if (result.isSuccessful) {
            this.dagJson = result.result;
        }
    }
    async getDagTasks() {
        ui.logToOutput('DagView.getDagTasks Started');
        if (!api_1.Api.isApiParamsSet()) {
            return;
        }
        let result = await api_1.Api.getDagTasks(this.dagId);
        if (result.isSuccessful) {
            this.dagTasksJson = result.result;
        }
    }
    dispose() {
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
    _getWebviewContent(webview, extensionUri) {
        ui.logToOutput('DagView._getWebviewContent Started');
        const toolkitUri = (0, getUri_1.getUri)(webview, extensionUri, [
            "node_modules",
            "@vscode",
            "webview-ui-toolkit",
            "dist",
            "toolkit.js", // A toolkit.min.js file is also available
        ]);
        const mainUri = (0, getUri_1.getUri)(webview, extensionUri, ["media", "main.js"]);
        const styleUri = (0, getUri_1.getUri)(webview, extensionUri, ["media", "style.css"]);
        let dagId = this.dagId;
        let state = (this.dagRunJson) ? this.dagRunJson.state : "";
        let logical_date = (this.dagRunJson) ? this.dagRunJson.logical_date : "";
        let start_date = (this.dagRunJson) ? this.dagRunJson.start_date : "";
        let end_date = (this.dagRunJson) ? this.dagRunJson.end_date : "";
        let owners = (this.dagJson) ? this.dagJson["owners"].join(", ") : "";
        let tags = "";
        this.dagJson["tags"].forEach(item => { tags += item.name + ", "; });
        tags = tags.slice(0, -3);
        let schedule_interval = (this.dagJson) ? this.dagJson["schedule_interval"].value : "";
        let isPaused = (this.dagJson) ? this.dagJson.is_paused ? "true" : "false" : "unknown";
        let next_dagrun = ''; //(this.dagJson) ? this.dagJson["next_dagrun"] : "";
        let logical_date_string = new Date(logical_date).toLocaleDateString();
        let start_date_string = new Date(start_date).toLocaleString();
        let duration = ui.getDuration(new Date(start_date), new Date(end_date));
        let taskRows = "";
        for (var t of this.dagTaskInstancesJson["task_instances"]) {
            taskRows += `
            <tr>
                <td>
                    <div style="display: flex; align-items: center;">
                        <div class="state-${t.state}"></div>
                        &nbsp; ${t.task_id} &nbsp;&nbsp;&nbsp; (${t.try_number + '-' + t.state})
                    </div>
                </td>
                <td>${ui.getDuration(new Date(t.start_date), new Date(t.end_date))}</td>
                <td>${t.operator}</td>
            </tr>
            `;
        }
        let runHistoryRows = "";
        for (var t of this.dagRunHistoryJson["dag_runs"]) {
            runHistoryRows += `
            <tr>
                <td>
                    <div style="display: flex; align-items: center;">
                        <div class="state-${t.state}"></div>
                        &nbsp; ${t.state}
                    </div>
                </td>
                <td>${new Date(t.start_date).toLocaleString()}</td>
                <td>${ui.getDuration(new Date(t.start_date), new Date(t.end_date))}</td>
            </tr>
            `;
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
            <div class="dag-paused-${isPaused}"></div> &nbsp; <h3>${dagId}</h3>
        </div>

        <vscode-panels activeid="tab-1">
            <vscode-panel-tab id="tab-1">RUN</vscode-panel-tab>
            <vscode-panel-tab id="tab-2">TRACE</vscode-panel-tab>
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
                            <td></td>
                            <td></td>
                            <td text-align:right><vscode-button appearance="primary" id="run-view-log">View Log</vscode-button>  <vscode-button appearance="primary" id="run-more-dagrun-detail">More</vscode-button></td>
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
                            <td><vscode-button appearance="primary" id="run-trigger-dag">
                            Run
                            </vscode-button></td>
                        </tr>
                    </table>

            </section>
            </vscode-panel-view>


            <vscode-panel-view id="view-2">

            <section>

                    <table>
                        <tr>
                            <th colspan=3>Tasks</th>
                        </tr>
                        <tr>
                            <td>Task</td>
                            <td>Duration</td>            
                            <td>Operator</td>
                        </tr>

                        ${taskRows}

                        <tr>
                            <td></td>
                            <td></td>            
                            <td><vscode-button appearance="primary" id="tasks-more-detail">More</vscode-button></td>
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
                        <td></td>
                        <td></td>            
                        <td><vscode-button appearance="primary" id="other-dag-detail">More</vscode-button></td>
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
                            <td><vscode-button appearance="primary" id="rev-runs-refresh">Refresh</vscode-button></td>
                            <td></td>            
                            <td></td>
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
    _setWebviewMessageListener(webview) {
        ui.logToOutput('DagView._setWebviewMessageListener Started');
        webview.onDidReceiveMessage((message) => {
            const command = message.command;
            const text = message.text;
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
            }
        }, undefined, this._disposables);
    }
    async getRunHistoryAndRenderHtml() {
        ui.logToOutput('DagView.getRunHistoryAndRenderHtml Started');
        await this.getRunHistory();
        await this.renderHmtl();
    }
    async lastDAGRunLog() {
        ui.logToOutput('DagView.lastDAGRunLog Started');
        if (!api_1.Api.isApiParamsSet()) {
            return;
        }
        let result = await api_1.Api.getLastDagRunLog(this.dagId);
        if (result.isSuccessful) {
            const tmp = require('tmp');
            var fs = require('fs');
            const tmpFile = tmp.fileSync({ mode: 0o644, prefix: this.dagId, postfix: '.log' });
            fs.appendFileSync(tmpFile.name, result.result);
            ui.showFile(tmpFile.name);
        }
    }
    async triggerDagWConfig(config = "", date = "") {
        ui.logToOutput('DagView.triggerDagWConfig Started');
        if (!api_1.Api.isApiParamsSet()) {
            return;
        }
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
            let result = await api_1.Api.triggerDag(this.dagId, config);
            if (result.isSuccessful) {
                this.triggeredDagRunId = result.result["dag_run_id"];
                await this.refreshRunningDagState(this);
                if (this.dagStatusInterval) {
                    clearInterval(this.dagStatusInterval); //stop prev checking
                }
                this.dagStatusInterval = setInterval(this.refreshRunningDagState, 5 * 1000, this);
            }
        }
    }
    async refreshRunningDagState(dagView) {
        ui.logToOutput('DagView.refreshRunningDagState Started');
        if (!api_1.Api.isApiParamsSet()) {
            return;
        }
        let result = await api_1.Api.getDagRun(dagView.dagId, dagView.triggeredDagRunId);
        if (result.isSuccessful) {
            dagView.dagRunJson = result.result;
            let resultTasks = await api_1.Api.getTaskInstances(dagView.dagId, dagView.triggeredDagRunId);
            if (result.isSuccessful) {
                dagView.dagTaskInstancesJson = resultTasks.result;
            }
        }
        else {
            if (dagView.dagStatusInterval) {
                clearInterval(dagView.dagStatusInterval); //stop checking
            }
            return;
        }
        let state = (dagView.dagRunJson) ? dagView.dagRunJson.state : "";
        //"queued" "running" "success" "failed"
        if (state === "queued" || state === "running") {
        }
        else {
            if (dagView.dagStatusInterval) {
                clearInterval(dagView.dagStatusInterval); //stop checking
            }
        }
        dagView.renderHmtl();
    }
}
exports.DagView = DagView;
//# sourceMappingURL=dagView.js.map