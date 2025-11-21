"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DagView = void 0;
/* eslint-disable @typescript-eslint/naming-convention */
const vscode = require("vscode");
const ui = require("./ui");
const api_1 = require("./api");
const dagTreeView_1 = require("./dagTreeView");
const methodResult_1 = require("./methodResult");
class DagView {
    constructor(panel, extensionUri, dagId) {
        this._disposables = [];
        this.activetabid = "tab-1";
        ui.logToOutput('DagView.constructor Started');
        this.dagId = dagId;
        this.extensionUri = extensionUri;
        this._panel = panel;
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        this._setWebviewMessageListener(this._panel.webview);
        this.loadAllDagData();
        ui.logToOutput('DagView.constructor Completed');
    }
    resetDagData() {
        this.activetabid = "tab-1";
        this.triggeredDagRunId = undefined;
        this.dagJson = undefined;
        this.dagRunJson = undefined;
        this.dagRunHistoryJson = undefined;
        this.dagTaskInstancesJson = undefined;
        this.dagTasksJson = undefined;
        this.stopCheckingDagRunStatus();
    }
    async loadAllDagData() {
        ui.logToOutput('DagView.loadAllDagData Started');
        await this.getDagInfo();
        await this.getLastRun();
        await this.getDagTasks();
        //await this.getRunHistory();
        await this.renderHmtl();
    }
    async loadDagDataOnly() {
        ui.logToOutput('DagView.loadDagDataOnly Started');
        await this.getDagInfo();
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
        if (DagView.Current) {
            this.Current.dagId = dagId;
            DagView.Current._panel.reveal(vscode.ViewColumn.Two);
            DagView.Current.resetDagData();
            DagView.Current.loadAllDagData();
        }
        else {
            const panel = vscode.window.createWebviewPanel("dagView", "Dag View", vscode.ViewColumn.Two, {
                enableScripts: true,
            });
            DagView.Current = new DagView(panel, extensionUri, dagId);
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
            if (this.dagRunJson && this.dagRunJson.state === "running") {
                this.startCheckingDagRunStatus(this.dagRunJson.dag_run_id);
            }
        }
    }
    async getDagRun(dagId, dagRunId) {
        ui.logToOutput('DagView.getDagRun Started');
        if (!api_1.Api.isApiParamsSet()) {
            return;
        }
        let result = await api_1.Api.getDagRun(dagId, dagRunId);
        if (result.isSuccessful) {
            this.dagRunJson = result.result;
            this.getTaskInstances(this.dagRunJson.dag_run_id);
        }
        await this.renderHmtl();
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
        DagView.Current = undefined;
        // stop any running interval checks
        this.stopCheckingDagRunStatus();
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
        //file URIs
        const toolkitUri = ui.getUri(webview, extensionUri, [
            "node_modules",
            "@vscode",
            "webview-ui-toolkit",
            "dist",
            "toolkit.js", // A toolkit.min.js file is also available
        ]);
        const mainUri = ui.getUri(webview, extensionUri, ["media", "main.js"]);
        const styleUri = ui.getUri(webview, extensionUri, ["media", "style.css"]);
        //LATEST DAG RUN
        let state = "";
        let logical_date = undefined;
        let start_date = undefined;
        let end_date = undefined;
        let logical_date_string = "";
        let start_date_string = "";
        let duration = "";
        let isDagRunning = false;
        let hasDagLatestRun = false;
        if (this.dagRunJson) {
            state = this.dagRunJson.state;
            logical_date = this.dagRunJson.logical_date;
            start_date = this.dagRunJson.start_date;
            end_date = this.dagRunJson.end_date;
            logical_date_string = new Date(logical_date).toLocaleDateString();
            start_date_string = new Date(start_date).toLocaleString();
            duration = ui.getDuration(new Date(start_date), new Date(end_date));
            isDagRunning = (state === "queued" || state === "running") ? true : false;
            hasDagLatestRun = true;
        }
        let runningOrFailedTasks = "";
        if (this.dagTaskInstancesJson) {
            for (var t of this.dagTaskInstancesJson["task_instances"]) {
                if (t.state === "running" || t.state === "failed") {
                    runningOrFailedTasks += t.task_id + ", ";
                }
            }
        }
        //INFO TAB
        let owners = (this.dagJson && Array.isArray(this.dagJson["owners"])) ? this.dagJson["owners"].join(", ") : "";
        let tags = "";
        if (this.dagJson && Array.isArray(this.dagJson["tags"])) {
            this.dagJson["tags"].forEach(item => { tags += item.name + ", "; });
        }
        let schedule_interval = (this.dagJson && this.dagJson["schedule_interval"] && this.dagJson["schedule_interval"].value) ? this.dagJson["schedule_interval"].value : "";
        let isPausedText = (this.dagJson) ? this.dagJson.is_paused ? "true" : "false" : "unknown";
        let isPaused = isPausedText === "true";
        //TASKS TAB
        let taskRows = "";
        if (this.dagTaskInstancesJson) {
            for (var t of this.dagTaskInstancesJson["task_instances"].sort((a, b) => (a.start_date > b.start_date) ? 1 : -1)) {
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
        //HISTORY TAB
        let runHistoryRows = "";
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
            <div class="dag-paused-${isPausedText}"></div>
            &nbsp; &nbsp; <h2>${this.dagId}</h2>
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
                            <td>Tasks</td>
                            <td>:</td>
                            <td>${runningOrFailedTasks}</td>
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
                                <vscode-button appearance="secondary" id="run-lastrun-check" ${isPaused ? "disabled" : ""}>Check</vscode-button>  
                                <vscode-button appearance="secondary" id="run-lastrun-cancel" ${isPaused || !isDagRunning ? "disabled" : ""}>Cancel</vscode-button>     
                                <vscode-button appearance="secondary" id="run-view-log" ${!hasDagLatestRun ? "disabled" : ""}>View Log</vscode-button>  
                                <vscode-button appearance="secondary" id="run-more-dagrun-detail" ${!hasDagLatestRun ? "disabled" : ""}>More</vscode-button>
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
                            <td colspan="3"><vscode-button appearance="secondary" id="run-trigger-dag" ${isPaused ? "disabled" : ""}>
                            Run
                            </vscode-button></td>
                        </tr>
                    </table>

                    <br>

                    <table>
                        <tr>
                            <th colspan="3">
                            <vscode-button appearance="secondary" id="run-pause-dag" ${isPaused ? "disabled" : ""}>
                            Pause
                            </vscode-button>
                            <vscode-button appearance="secondary" id="run-unpause-dag" ${!isPaused ? "disabled" : ""}>
                            Un Pause
                            </vscode-button>
                            </th>
                        </tr>
                    </table>

                    <br>
                    <br>
                    <br>
                    
                    <table>
                        <tr>
                            <td colspan="3">
                                <vscode-link href="https://github.com/necatiarslan/airflow-vscode-extension/issues/new">Bug Report & Feature Request</vscode-link>
                            </td>
                        </tr>
                    </table>
                    <table>
                        <tr>
                            <td colspan="3">
                                <vscode-link href="https://bit.ly/airflow-extension-survey">New Feature Survey</vscode-link>
                            </td>
                        </tr>
                    </table>
                    <table>
                        <tr>
                            <td colspan="3">
                                <vscode-link href="https://github.com/sponsors/necatiarslan">Donate to support this extension</vscode-link>
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
                                <vscode-button appearance="secondary" id="tasks-refresh">Refresh</vscode-button>
                                <vscode-button appearance="secondary" id="tasks-more-detail" ${!this.dagTaskInstancesJson ? "disabled" : ""}>More</vscode-button>
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
                        <td colspan="3"><vscode-button appearance="secondary" id="info-source-code">Source Code</vscode-button> <vscode-button appearance="secondary" id="other-dag-detail">More</vscode-button></td>
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
                            <td colspan="3"><vscode-button appearance="secondary" id="rev-runs-refresh">Refresh</vscode-button></td>
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
                    this.showLastDAGRunLog();
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
                    this.getLastRun();
                    if (this.dagRunJson) {
                        this.startCheckingDagRunStatus(this.dagRunJson.dag_run_id);
                    }
                    return;
                case "run-lastrun-cancel":
                    if (this.dagRunJson) {
                        this.cancelDagRun(this.dagRunJson.dag_run_id);
                    }
                    return;
                case "history-dag-run-id":
                    let dagRunId = message.id;
                    dagRunId = dagRunId.replace("history-dag-run-id-", "");
                    this.activetabid = "tab-1";
                    this.getDagRun(this.dagId, dagRunId);
                    return;
                case "task-log-link":
                    let taskId = message.id;
                    taskId = taskId.replace("task-log-link-", "");
                    this.showLastTaskInstanceLog(this.dagId, this.dagRunJson.dag_run_id, taskId);
                    return;
                case "tasks-refresh":
                    this.getTasksAndRenderHtml();
                    return;
                case "tabControlChanged":
                    this.activetabid = message.activeid;
                    ui.logToOutput("tab changed to " + message.activeid);
                    return;
            }
        }, undefined, this._disposables);
    }
    async getTasksAndRenderHtml() {
        await this.getDagTasks();
        await this.renderHmtl();
    }
    async cancelDagRun(dagRunId) {
        ui.logToOutput('DagView.cancelDagRun Started');
        if (!api_1.Api.isApiParamsSet()) {
            return;
        }
        let result = await api_1.Api.cancelDagRun(this.dagId, dagRunId);
        if (result.isSuccessful) {
        }
    }
    async pauseDAG(is_paused) {
        ui.logToOutput('DagTreeView.pauseDAG Started');
        if (!api_1.Api.isApiParamsSet()) {
            return;
        }
        if (is_paused && this.dagJson.is_paused) {
            ui.showWarningMessage(this.dagId + 'Dag is already PAUSED');
            return;
        }
        if (!is_paused && !this.dagJson.is_paused) {
            ui.showWarningMessage(this.dagId + 'Dag is already ACTIVE');
            return;
        }
        let result = await api_1.Api.pauseDag(this.dagId, is_paused);
        if (result.isSuccessful) {
            this.loadDagDataOnly();
            is_paused ? dagTreeView_1.DagTreeView.Current.notifyDagPaused(this.dagId) : dagTreeView_1.DagTreeView.Current.notifyDagUnPaused(this.dagId);
        }
    }
    async showSourceCode() {
        ui.logToOutput('DagView.showSourceCode Started');
        if (!api_1.Api.isApiParamsSet()) {
            return;
        }
        var result;
        if (api_1.Api.getAirflowVersion() === "v1") {
            result = await api_1.Api.getSourceCodeV1(this.dagId, this.dagJson.file_token);
        }
        else if (api_1.Api.getAirflowVersion() === "v2") {
            result = await api_1.Api.getSourceCodeV2(this.dagId);
        }
        else {
            result = new methodResult_1.MethodResult();
            result.isSuccessful = false;
            result.result = "Unknown Airflow Version";
        }
        if (result.isSuccessful) {
            const tmp = require('tmp');
            var fs = require('fs');
            const tmpFile = tmp.fileSync({ mode: 0o644, prefix: this.dagId, postfix: '.py' });
            fs.appendFileSync(tmpFile.name, result.result);
            ui.openFile(tmpFile.name);
        }
        else {
            ui.logToOutput(result.result);
            ui.showErrorMessage(result.result);
        }
    }
    async getRunHistoryAndRenderHtml() {
        ui.logToOutput('DagView.getRunHistoryAndRenderHtml Started');
        await this.getRunHistory();
        await this.renderHmtl();
    }
    async showLastDAGRunLog() {
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
            ui.openFile(tmpFile.name);
        }
    }
    async showLastTaskInstanceLog(dagId, dagRunId, taskId) {
        ui.logToOutput('DagView.showLastTaskInstanceLog Started');
        if (!api_1.Api.isApiParamsSet()) {
            return;
        }
        let result = await api_1.Api.getTaskInstanceLog(dagId, dagRunId, taskId);
        if (result.isSuccessful) {
            const tmp = require('tmp');
            var fs = require('fs');
            const tmpFile = tmp.fileSync({ mode: 0o644, prefix: dagId + '-' + taskId, postfix: '.log' });
            fs.appendFileSync(tmpFile.name, result.result);
            ui.openFile(tmpFile.name);
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
            let result = await api_1.Api.triggerDag(this.dagId, config, date);
            if (result.isSuccessful) {
                this.startCheckingDagRunStatus(result.result["dag_run_id"]);
                dagTreeView_1.DagTreeView.Current.notifyDagStateWithDagId(this.dagId);
            }
        }
    }
    async startCheckingDagRunStatus(dagRunId) {
        ui.logToOutput('DagView.startCheckingDagRunStatus Started');
        this.triggeredDagRunId = dagRunId;
        await this.refreshRunningDagState(this);
        if (this.dagStatusInterval) {
            clearInterval(this.dagStatusInterval); //stop prev checking
        }
        this.dagStatusInterval = setInterval(() => {
            void this.refreshRunningDagState(this).catch((err) => ui.logToOutput('refreshRunningDagState Error', err));
        }, 5 * 1000);
    }
    async stopCheckingDagRunStatus() {
        ui.logToOutput('DagView.stopCheckingDagRunStatus Started');
        if (this.dagStatusInterval) {
            clearInterval(this.dagStatusInterval); //stop prev checking
        }
    }
    async refreshRunningDagState(dagView) {
        ui.logToOutput('DagView.refreshRunningDagState Started');
        if (!api_1.Api.isApiParamsSet()) {
            return;
        }
        if (!dagView.dagId || !dagView.triggeredDagRunId) {
            dagView.stopCheckingDagRunStatus();
            return;
        }
        let result = await api_1.Api.getDagRun(dagView.dagId, dagView.triggeredDagRunId);
        if (result.isSuccessful) {
            dagView.dagRunJson = result.result;
            let resultTasks = await api_1.Api.getTaskInstances(dagView.dagId, dagView.triggeredDagRunId);
            if (resultTasks.isSuccessful) {
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
exports.DagView = DagView;
//# sourceMappingURL=dagView.js.map