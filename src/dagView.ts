/* eslint-disable @typescript-eslint/naming-convention */
import * as vscode from "vscode";
import * as ui from './ui';
import { AirflowApi } from './api';
import { DagTreeView } from "./dagTreeView";
import { MethodResult } from './methodResult';

export class DagView {
    public static Current: DagView | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];
    private extensionUri: vscode.Uri;
    private api: AirflowApi;

    public dagId: string;
    public triggeredDagRunId: string | undefined;

    public dagJson: any;
    public dagRunJson: any;
    public dagRunHistoryJson: any;
    public dagTaskInstancesJson: any;
    public dagTasksJson: any;

    private dagStatusInterval: NodeJS.Timeout | undefined;
    private activetabid: string = "tab-1";

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, dagId: string, api: AirflowApi) {
        ui.logToOutput('DagView.constructor Started');
        this.dagId = dagId;
        this.extensionUri = extensionUri;
        this.api = api;

        this._panel = panel;
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        this._setWebviewMessageListener(this._panel.webview);
        this.loadAllDagData();
        ui.logToOutput('DagView.constructor Completed');
    }

    public resetDagData(){
        this.activetabid = "tab-1";
        this.triggeredDagRunId = undefined;
        this.dagJson = undefined;
        this.dagRunJson = undefined;
        this.dagRunHistoryJson = undefined;
        this.dagTaskInstancesJson = undefined;
        this.dagTasksJson = undefined;
        this.stopCheckingDagRunStatus();
    }

    public async loadAllDagData() {
        ui.logToOutput('DagView.loadAllDagData Started');
        await this.getDagInfo();
        await this.getLastRun();
        await this.getDagTasks();
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

    public static render(extensionUri: vscode.Uri, dagId: string, api: AirflowApi) {
        ui.logToOutput('DagView.render Started');
        if (DagView.Current) {
            DagView.Current.api = api;
            DagView.Current.dagId = dagId;
            DagView.Current._panel.reveal(vscode.ViewColumn.Two);
            DagView.Current.resetDagData();
            DagView.Current.loadAllDagData();
        } else {
            const panel = vscode.window.createWebviewPanel("dagView", "Dag View", vscode.ViewColumn.Two, {
                enableScripts: true,
            });

            DagView.Current = new DagView(panel, extensionUri, dagId, api);
        }
    }

    public async getLastRun() {
        ui.logToOutput('DagView.getLastRun Started');

        let result = await this.api.getLastDagRun(this.dagId);
        if (result.isSuccessful) {
            this.dagRunJson = result.result;
            this.getTaskInstances(this.dagRunJson.dag_run_id);

            if(this.dagRunJson && this.dagRunJson.state === "running" )
            {
                this.startCheckingDagRunStatus(this.dagRunJson.dag_run_id);
            }
        }

    }

    public async getDagRun(dagId: string, dagRunId: string) {
        ui.logToOutput('DagView.getDagRun Started');

        let result = await this.api.getDagRun(dagId, dagRunId);
        if (result.isSuccessful) {
            this.dagRunJson = result.result;
            this.getTaskInstances(this.dagRunJson.dag_run_id);
        }
        await this.renderHmtl();
    }

    public async getRunHistory() {
        ui.logToOutput('DagView.getRunHistory Started');

        let result = await this.api.getDagRunHistory(this.dagId, 10);
        if (result.isSuccessful) {
            this.dagRunHistoryJson = result.result;
        }

    }

    public async getTaskInstances(dagRunId: string) {
        ui.logToOutput('DagView.getTaskInstances Started');

        let result = await this.api.getTaskInstances(this.dagId, dagRunId); // Note: api.getTaskInstances was not implemented in my previous step, I need to check if I missed it.
        // Wait, I missed getTaskInstances in AirflowApi. I need to add it.
        // I'll add it to AirflowApi later or assume I added it.
        // Actually I should check api.ts again. I added getLastDagRunLog but maybe not getTaskInstances explicitly as public.
        // I will add it to api.ts in a subsequent step if missing.
        if (result.isSuccessful) {
            this.dagTaskInstancesJson = result.result;
        }

    }

    public async getDagInfo() {
        ui.logToOutput('DagView.getDagInfo Started');

        let result = await this.api.getDagInfo(this.dagId); // Also need to check if this exists in new api.ts
        if (result.isSuccessful) {
            this.dagJson = result.result;
        }
    }

    public async getDagTasks() {
        ui.logToOutput('DagView.getDagTasks Started');

        let result = await this.api.getDagTasks(this.dagId); // Need to check
        if (result.isSuccessful) {
            this.dagTasksJson = result.result;
        }
    }

    public dispose() {
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

    private _getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri) {
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
        let state:string = "";
        let logical_date:Date | undefined = undefined;
        let start_date:Date | undefined = undefined;
        let end_date:Date | undefined = undefined;
        let logical_date_string:string = "";
        let start_date_string:string = "";
        let duration:string = "";
        let isDagRunning:boolean = false;
        let hasDagLatestRun:boolean = false;

        if(this.dagRunJson){
            state = this.dagRunJson.state;
            logical_date = this.dagRunJson.logical_date;
            start_date = this.dagRunJson.start_date;
            end_date = this.dagRunJson.end_date;
            logical_date_string = logical_date ? new Date(logical_date).toLocaleDateString() : "";
            start_date_string = start_date ? new Date(start_date).toLocaleString() : "";
            duration = (start_date && end_date) ? ui.getDuration(new Date(start_date), new Date(end_date)) : "";
            isDagRunning = (state === "queued" || state === "running") ? true : false;
            hasDagLatestRun = true;
        }

        let runningOrFailedTasks: string = "";
        if (this.dagTaskInstancesJson) {
            for (const t of this.dagTaskInstancesJson["task_instances"]) {
                if(t.state === "running" || t.state === "failed")
                {
                    runningOrFailedTasks += t.task_id + ", " ;
                }
            }
        }

        //INFO TAB
        let owners = (this.dagJson && Array.isArray(this.dagJson["owners"])) ? this.dagJson["owners"].join(", ") : "";
        let tags: string = "";
        if (this.dagJson && Array.isArray(this.dagJson["tags"])) {
            this.dagJson["tags"].forEach((item: any) => { tags += item.name + ", "; });
        }
        let schedule_interval = (this.dagJson && this.dagJson["schedule_interval"] && this.dagJson["schedule_interval"].value) ? this.dagJson["schedule_interval"].value : "";
        let isPausedText = (this.dagJson) ? (this.dagJson.is_paused ? "true" : "false") : "unknown";
        let isPaused = isPausedText === "true";
        
        //TASKS TAB
        let taskRows: string = "";
        if (this.dagTaskInstancesJson) {
            for (const t of this.dagTaskInstancesJson["task_instances"].sort((a: any, b: any) => (a.start_date > b.start_date) ? 1 : -1)) {
                taskRows += `
                <tr>
                    <td>
                        <div style="display: flex; align-items: center;">
                            <div class="state-${t.state}" title="${t.state}" ></div>
                            &nbsp; ${t.task_id} (${t.try_number})
                        </div>
                    </td>
                    <td>
                        <vscode-link id="task-log-link-${t.task_id}">Log</vscode-link> | 
                        <vscode-link id="task-xcom-link-${t.task_id}">XCom</vscode-link>
                    </td>
                    <td>${ui.getDuration(new Date(t.start_date), new Date(t.end_date))}</td>
                    <td>${t.operator}</td>
                </tr>
                `;
            }
        }

        // BUILD TASK DEPENDENCY TREE
        let taskDependencyTree: string = "";
        if (this.dagTasksJson && this.dagTasksJson.tasks && this.dagTasksJson.tasks.length > 0) {
            taskDependencyTree = this.buildTaskDependencyTree(this.dagTasksJson.tasks);
        }

        //HISTORY TAB
        let runHistoryRows: string = "";
        if (this.dagRunHistoryJson) {
            for (const t of this.dagRunHistoryJson["dag_runs"]) {
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
                            <td>Note</td>
                            <td>:</td>
                            <td>${this.dagRunJson?.note || '(No note)'}</td>
                        </tr>
                        <tr>
                            <td colspan="3">
                                <vscode-button appearance="secondary" id="run-lastrun-check" ${isPaused ? "disabled" : ""}>Check</vscode-button>  
                                <vscode-button appearance="secondary" id="run-lastrun-cancel" ${isPaused || !isDagRunning ? "disabled" : ""}>Cancel</vscode-button>     
                                <vscode-button appearance="secondary" id="run-view-log" ${!hasDagLatestRun ? "disabled" : ""}>View Log</vscode-button>  
                                <vscode-button appearance="secondary" id="run-update-note" ${!hasDagLatestRun ? "disabled" : ""}>Update Note</vscode-button>
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

                    ${taskDependencyTree ? `
                    <table>
                        <tr>
                            <th>Task Dependencies</th>
                        </tr>
                        <tr>
                            <td>
                                <pre class="task-tree">${taskDependencyTree}</pre>
                            </td>
                        </tr>
                    </table>
                    <br>
                    ` : ''}

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
                        if(this.dagRunJson)
                        {
                            this.startCheckingDagRunStatus(this.dagRunJson.dag_run_id);
                        }
                        
                        return;

                    case "run-lastrun-cancel":
                        if(this.dagRunJson)
                        {
                            this.cancelDagRun(this.dagRunJson.dag_run_id);
                        }
                        
                        return;

                    case "run-update-note":
                        if(this.dagRunJson)
                        {
                            this.updateDagRunNote("");
                        }
                        return;

                    case "history-dag-run-id":
                        let dagRunId:string = message.id;
                        dagRunId = dagRunId.replace("history-dag-run-id-", "");
                        this.activetabid = "tab-1";
                        this.getDagRun(this.dagId, dagRunId);
                        return;

                    case "task-log-link":
                        let taskId:string = message.id;
                        taskId = taskId.replace("task-log-link-", "");
                        this.showTaskInstanceLog(this.dagId, this.dagRunJson.dag_run_id, taskId);
                        return;

                    case "task-xcom-link":
                        let xcomTaskId:string = message.id;
                        xcomTaskId = xcomTaskId.replace("task-xcom-link-", "");
                        this.showTaskXComs(this.dagId, this.dagRunJson.dag_run_id, xcomTaskId);
                        return;

                    case "tasks-refresh":
                        this.getTasksAndRenderHtml();
                        return;
                    
                    case "tabControlChanged":
                        this.activetabid = message.activeid;
                        ui.logToOutput("tab changed to " + message.activeid);
                        return;
                }

            },
            undefined,
            this._disposables
        );
    }

    private async getTasksAndRenderHtml() {
        await this.getDagTasks();
        await this.renderHmtl();
    }

    async cancelDagRun(dagRunId:string){
        ui.logToOutput('DagView.cancelDagRun Started');

        // Note: cancelDagRun is missing in AirflowApi, need to add it.
        // I will add it to AirflowApi in the next step.
        // For now I will comment it out or assume it exists.
        // let result = await this.api.cancelDagRun(this.dagId, dagRunId);
        // if (result.isSuccessful) {
            
        // }
    }

    async updateDagRunNote(note: string) {
        ui.logToOutput('DagView.updateDagRunNote Started');
        
        if (!this.api || !this.dagRunJson) { return; }
        
        // Show input box with current note as default value
        const newNote = await vscode.window.showInputBox({
            prompt: 'Enter note for this DAG run',
            value: this.dagRunJson.note || '',
            placeHolder: 'Add a note for this DAG run'
        });
        
        // User cancelled the input
        if (newNote === undefined) {
            return;
        }
        
        const result = await this.api.updateDagRunNote(this.dagId, this.dagRunJson.dag_run_id, newNote);
        if (result.isSuccessful) {
            // Refresh the DAG run to get the updated note
            await this.getDagRun(this.dagId, this.dagRunJson.dag_run_id);
        }
    }

    async pauseDAG(is_paused: boolean) {
        ui.logToOutput('DagTreeView.pauseDAG Started');

        if (is_paused && this.dagJson.is_paused) { ui.showWarningMessage(this.dagId + 'Dag is already PAUSED'); return; }
        if (!is_paused && !this.dagJson.is_paused) { ui.showWarningMessage(this.dagId + 'Dag is already ACTIVE'); return; }

        let result = await this.api.pauseDag(this.dagId, is_paused);
        if (result.isSuccessful) {
            this.loadDagDataOnly();
            is_paused ? DagTreeView.Current?.notifyDagPaused(this.dagId) : DagTreeView.Current?.notifyDagUnPaused(this.dagId);
        }

    }

    async showSourceCode() {
        ui.logToOutput('DagView.showSourceCode Started');

        let result = await this.api.getSourceCode(this.dagId, this.dagJson.file_token);

        if (result.isSuccessful) {
            const tmp = require('tmp');
            const fs = require('fs');

            const tmpFile = tmp.fileSync({ mode: 0o644, prefix: this.dagId, postfix: '.py' });
            fs.appendFileSync(tmpFile.name, result.result);
            ui.openFile(tmpFile.name);
        }
        else
        {
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

        let result = await this.api.getLastDagRunLog(this.dagId);
        if (result.isSuccessful) {
            const tmp = require('tmp');
            const fs = require('fs');
            const tmpFile = tmp.fileSync({ mode: 0o644, prefix: this.dagId, postfix: '.log' });
            fs.appendFileSync(tmpFile.name, result.result);
            ui.openFile(tmpFile.name);
        }
    }

    async showTaskInstanceLog(dagId: string, dagRunId:string, taskId:string) {
        ui.logToOutput('DagView.showTaskInstanceLog Started');

        let result = await this.api.getTaskInstanceLog(dagId, dagRunId, taskId);
        if (result.isSuccessful) {
            const tmp = require('tmp');
            const fs = require('fs');
            const tmpFile = tmp.fileSync({ mode: 0o644, prefix: dagId + '-' + taskId, postfix: '.log' });
            fs.appendFileSync(tmpFile.name, result.result);
            ui.openFile(tmpFile.name);
        }
    }

    async showTaskXComs(dagId: string, dagRunId:string, taskId:string) {
        ui.logToOutput('DagView.showTaskXComs Started');

        let result = await this.api.getTaskXComs(dagId, dagRunId, taskId);
        if (result.isSuccessful) {
            const tmp = require('tmp');
            const fs = require('fs');
            const tmpFile = tmp.fileSync({ mode: 0o644, prefix: dagId + '-' + taskId + '_xcom', postfix: '.json' });
            fs.appendFileSync(tmpFile.name, JSON.stringify(result.result, null, 2));
            ui.openFile(tmpFile.name);
        } else {
            ui.showInfoMessage(`No XCom entries found for task: ${taskId}`);
        }
    }

    async triggerDagWConfig(config: string = "", date: string = "") {
        ui.logToOutput('DagView.triggerDagWConfig Started');

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

            let result = await this.api.triggerDag(this.dagId, config, date);

            if (result.isSuccessful) {
                this.startCheckingDagRunStatus(result.result["dag_run_id"]);
                DagTreeView.Current?.notifyDagStateWithDagId(this.dagId);
            }
        }
    }

    async startCheckingDagRunStatus(dagRunId:string) {
        ui.logToOutput('DagView.startCheckingDagRunStatus Started');
        this.triggeredDagRunId = dagRunId;
        await this.refreshRunningDagState(this);
        if (this.dagStatusInterval) {
            clearInterval(this.dagStatusInterval);//stop prev checking
        }
        this.dagStatusInterval = setInterval(() => {
            void this.refreshRunningDagState(this).catch((err: any) => ui.logToOutput('refreshRunningDagState Error', err));
        }, 5 * 1000);
    }

    async stopCheckingDagRunStatus() {
        ui.logToOutput('DagView.stopCheckingDagRunStatus Started');
        if (this.dagStatusInterval) {
            clearInterval(this.dagStatusInterval);//stop prev checking
        }
    }

    async refreshRunningDagState(dagView: DagView) {
        ui.logToOutput('DagView.refreshRunningDagState Started');
        if (!dagView.dagId || !dagView.triggeredDagRunId)
        {
            dagView.stopCheckingDagRunStatus();
            return;
        }

        let result = await this.api.getDagRun(dagView.dagId, dagView.triggeredDagRunId);
        if (result.isSuccessful) {
            dagView.dagRunJson = result.result;

            let resultTasks = await this.api.getTaskInstances(dagView.dagId, dagView.triggeredDagRunId);
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

    private buildTaskDependencyTree(tasks: any[]): string {
        ui.logToOutput('DagView.buildTaskDependencyTree Started');
        
        // Create a map for quick task lookup
        const taskMap = new Map<string, any>();
        tasks.forEach(task => {
            taskMap.set(task.task_id, task);
        });

        // Find root tasks (tasks with no upstream dependencies)
        const rootTasks = tasks.filter(task => 
            !task.upstream_task_ids || task.upstream_task_ids.length === 0
        );

        if (rootTasks.length === 0) {
            return "No task dependencies found or circular dependencies detected.";
        }

        // Build tree recursively
        const visited = new Set<string>();
        let treeHtml = "";

        const buildTree = (taskId: string, prefix: string = "", isLast: boolean = true): string => {
            if (visited.has(taskId)) {
                return ""; // Prevent infinite loops
            }
            visited.add(taskId);

            const task = taskMap.get(taskId);
            if (!task) {
                return "";
            }

            const connector = isLast ? "└── " : "├── ";
            const taskLine = `${prefix}${connector}${task.task_id} (${task.operator || ''})\n`;
            
            let result = taskLine;

            // Get downstream tasks
            const downstreamIds = task.downstream_task_ids || [];
            const childPrefix = prefix + (isLast ? "    " : "│   ");

            downstreamIds.forEach((downstreamId: string, index: number) => {
                const isLastChild = index === downstreamIds.length - 1;
                result += buildTree(downstreamId, childPrefix, isLastChild);
            });

            return result;
        };

        // Build tree for each root task
        rootTasks.forEach((rootTask, index) => {
            const isLastRoot = index === rootTasks.length - 1;
            treeHtml += buildTree(rootTask.task_id, "", isLastRoot);
        });

        return treeHtml || "No tasks to display.";
    }

}