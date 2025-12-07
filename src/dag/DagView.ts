/* eslint-disable @typescript-eslint/naming-convention */
import * as vscode from "vscode";
import * as tmp from 'tmp';
import * as fs from 'fs';
import * as ui from '../common/UI';
import { DagTreeView } from "./DagTreeView";
import * as MessageHub from '../common/MessageHub';
import { Session } from '../common/Session';
import { AIHandler } from '../language_tools/AIHandler';
import { DagLogView } from '../report/DagLogView';

export class DagView {
    public static Current: DagView;
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];



    public dagId: string;
    public dagRunId: string | undefined;

    private dagJson: any;
    private dagRunJson: any;
    private dagRunHistoryJson: any;
    private dagTaskInstancesJson: any;
    private dagTasksJson: any;
    private dagHistorySelectedDate: string | undefined = ui.toISODateString(new Date());

    private dagStatusInterval: NodeJS.Timeout | undefined;
    private activetabid: string = "tab-1";

    private constructor(panel: vscode.WebviewPanel, dagId: string, dagRunId?: string) {
        ui.logToOutput('DagView.constructor Started');
        this.dagId = dagId;
        this.dagRunId = dagRunId;
        this._panel = panel;
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        this._setWebviewMessageListener(this._panel.webview);
        this.loadAllDagData();
        ui.logToOutput('DagView.constructor Completed');
    }

    private resetDagData(){
        this.activetabid = "tab-1";
        this.dagJson = undefined;
        this.dagRunJson = undefined;
        this.dagRunHistoryJson = undefined;
        this.dagTaskInstancesJson = undefined;
        this.dagTasksJson = undefined;
        this.stopCheckingDagRunStatus();
    }

    private async loadAllDagData() {
        ui.logToOutput('DagView.loadAllDagData Started');
        await this.getDagInfo();
        if (this.dagRunId) {
            await this.getDagRun();
        }
        else {
            await this.getLastRun();
        }
        await this.getDagTasks();
        //await this.getRunHistory();
        await this.renderHmtl();
    }

    public async loadDagInfoOnly() {
        ui.logToOutput('DagView.loadDagInfoOnly Started');
        await this.getDagInfo();
        await this.renderHmtl();
    }

    private async renderHmtl() {
        ui.logToOutput('DagView.renderHmtl Started');
        this._panel.webview.html = this._getWebviewContent(this._panel.webview, Session.Current.ExtensionUri!);
        //ui.showOutputMessage(this._panel.webview.html);
        ui.logToOutput('DagView.renderHmtl Completed');
    }

    public static render(dagId: string, dagRunId?: string) {
        ui.logToOutput('DagView.render Started');
        if (DagView.Current) {
            DagView.Current.dagId = dagId;
            DagView.Current.dagRunId = dagRunId;
            DagView.Current._panel.reveal(vscode.ViewColumn.Two);
            DagView.Current.resetDagData();
            DagView.Current.loadAllDagData();
        } else {
            const panel = vscode.window.createWebviewPanel("dagView", "Dag View", vscode.ViewColumn.Two, {
                enableScripts: true,
            });


            DagView.Current = new DagView(panel, dagId, dagRunId);
        }
    }

    /**
     * Helper method to create a temp file and open it
     */
    private createAndOpenTempFile(content: string, prefix: string, extension: string): void {
        const tmpFile = tmp.fileSync({ mode: 0o644, prefix, postfix: extension });
        fs.appendFileSync(tmpFile.name, content);
        ui.openFile(tmpFile.name);
    }

    private async getLastRun() {
        ui.logToOutput('DagView.getLastRun Started');
		if (!Session.Current.Api) { return; }

        const result = await Session.Current.Api.getLastDagRun(this.dagId);
        if (result.isSuccessful) {
            this.dagRunJson = result.result;
            this.dagRunId = this.dagRunJson.dag_run_id;
            this.getTaskInstances();

            if(this.dagRunJson && this.dagRunJson.state === "running" )
            {
                this.startCheckingDagRunStatus();
            }
        }

    }

    public goToDagRun(dagId: string, dagRunId: string) {
        this.dagId = dagId;
        this.dagRunId = dagRunId;
        this.getDagRun();
    }

    public goToDag(dagId: string) {
        this.dagId = dagId;
        this.dagRunId = undefined;
        this.getLastRun();
    }
    private async getDagRun() {
        ui.logToOutput('DagView.getDagRun Started');
		if (!Session.Current.Api) { return; }
        
        const result = await Session.Current.Api.getDagRun(this.dagId, this.dagRunId);
        if (result.isSuccessful) {
            this.dagRunJson = result.result;
            this.dagRunId = this.dagRunJson.dag_run_id;
            this.getTaskInstances();
        }
        await this.renderHmtl();
    }

    private async getRunHistory(date?: string) {
        ui.logToOutput('DagView.getRunHistory Started');
		if (!Session.Current.Api) { return; }

        const result = await Session.Current.Api.getDagRunHistory(this.dagId, date);
        if (result.isSuccessful) {
            this.dagRunHistoryJson = result.result;
        }

    }

    private async getTaskInstances() {
        ui.logToOutput('DagView.getTaskInstances Started');
        if (!Session.Current.Api) { return; }

        const result = await Session.Current.Api.getTaskInstances(this.dagId, this.dagRunId);

        if (result.isSuccessful) {
            this.dagTaskInstancesJson = result.result;
        }

    }

    private async getDagInfo() {
        ui.logToOutput('DagView.getDagInfo Started');
        if (!Session.Current.Api) { return; }

        const result = await Session.Current.Api.getDagInfo(this.dagId);
        if (result.isSuccessful) {
            this.dagJson = result.result;
        }
    }

    private async getDagTasks() {
        ui.logToOutput('DagView.getDagTasks Started');
        if (!Session.Current.Api) { return; }

        const result = await Session.Current.Api.getDagTasks(this.dagId);
        if (result.isSuccessful) {
            this.dagTasksJson = result.result;
        }
    }

    private dispose() {
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
            "@vscode-elements",
            "elements",
            "dist",
            "bundled.js", 
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
        let hasDagRun:boolean = false;

        if(this.dagRunJson){
            state = this.dagRunJson.state;
            logical_date = this.dagRunJson.logical_date;
            start_date = this.dagRunJson.start_date;
            end_date = this.dagRunJson.end_date;
            logical_date_string = logical_date ? ui.toISODateTimeString(new Date(logical_date)) : "";
            start_date_string = start_date ? ui.toISODateTimeString(new Date(start_date)) : "";
            duration = start_date ? ui.getDuration(new Date(start_date), end_date ? new Date(end_date) : new Date()) : "";
            isDagRunning = (state === "queued" || state === "running") ? true : false;
            hasDagRun = true;
        }

        let runningOrFailedTasks: string = "";
        if (this.dagTaskInstancesJson) {
            for (const t of this.dagTaskInstancesJson["task_instances"]) {
                if(t.state === "running" || t.state === "failed" || t.state === "up_for_retry" || t.state === "up_for_reschedule" || t.state === "deferred")
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
        let schedule = (this.dagJson && this.dagJson["timetable_description"]) ? this.dagJson["timetable_description"] + " - " + this.dagJson["timetable_summary"]: "";
        let next_run = (this.dagJson && this.dagJson["next_dagrun_data_interval_start"]) ? ui.toISODateTimeString(new Date(this.dagJson["next_dagrun_data_interval_start"])) : "None";
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
                        <a href="#" id="task-log-link-${t.task_id}">Logs</a> | 
                        <a href="#" id="task-xcom-link-${t.task_id}">XComs</a>
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
                    <td><a href="#" id="history-dag-run-id-${t.dag_run_id}">${ui.toISODateTimeString(new Date(t.start_date))}</a></td>
                    <td>${ui.getDuration(new Date(t.start_date), new Date(t.end_date))}</td>
                    <td>${t.note}</td>
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
        <style>
            input[type="date"] {
                padding: 6px 8px;
                border: 1px solid var(--vscode-input-border);
                background-color: var(--vscode-input-background);
                color: var(--vscode-input-foreground);
                border-radius: 4px;
                font-size: 13px;
            }
        </style>
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
                    

        <vscode-tabs id="tab-control" selected-index="${this.activetabid === 'tab-1' ? 0 : this.activetabid === 'tab-2' ? 1 : this.activetabid === 'tab-3' ? 2 : 3}">
            <vscode-tab-header slot="header">RUN</vscode-tab-header>
            <vscode-tab-header slot="header">TASKS</vscode-tab-header>
            <vscode-tab-header slot="header">INFO</vscode-tab-header>
            <vscode-tab-header slot="header">HISTORY</vscode-tab-header>
            
            <vscode-tab-panel>
                
            <section>

                    <table class="dag-run-details-table">
                        <tr>
                            <th colspan=3>Dag Run Details</th>
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
                            <td>Logical Date</td>
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
                            <td><a href="#" id="run-update-note-link" title="Update Note">${this.dagRunJson?.note || '(No note)'}</a></td>
                        </tr>
                        <tr>
                            <td>Config</td>
                            <td>:</td>
                            <td>${this.dagRunJson?.conf ? JSON.stringify(this.dagRunJson.conf, null, 2) : '(No config)'}</td>
                        </tr>
                        <tr>
                            <td colspan="3">
                                <vscode-button appearance="secondary" id="run-ask-ai" ${!hasDagRun ? "disabled" : ""}>Ask AI</vscode-button>    
                                <vscode-button appearance="secondary" id="run-view-log" ${!hasDagRun ? "disabled" : ""}>Log</vscode-button> 
                                <vscode-button appearance="secondary" id="run-lastrun-check" ${isPaused ? "disabled" : ""}>Refresh</vscode-button>  
                                <vscode-button appearance="secondary" id="run-more-dagrun-detail" ${!hasDagRun ? "disabled" : ""}>More</vscode-button>
                            </td>
                        </tr>
                    </table>
            
                    <br>
            
                    <table>
                        <tr>
                            <th colspan="3">Trigger</th>
                        </tr>
                        <tr>
                            <td>Logical Date</td>
                            <td>:</td>
                            <td><vscode-textfield id="run_date" placeholder="YYYY-MM-DD (Optional)" maxlength="10" pattern="\d{4}-\d{2}-\d{2}"></vscode-textfield></td>
                        </tr>
                        <tr>
                            <td>Config</td>
                            <td>:</td>
                            <td><vscode-textarea id="run_config" cols="50" placeholder="Config in JSON Format (Optional)"></vscode-textarea></td>
                        </tr>
                        <tr>           
                            <td colspan="3">
                            <vscode-button appearance="secondary" id="run-trigger-dag" ${isPaused ? "disabled" : ""}>Run</vscode-button>
                            <vscode-button appearance="secondary" id="run-lastrun-cancel" ${isPaused || !isDagRunning ? "disabled" : ""}>Cancel</vscode-button>  
                            </td>
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
                                <a href="https://github.com/necatiarslan/airflow-vscode-extension/issues/new">Bug Report & Feature Request</a>
                            </td>
                        </tr>
                    </table>
                    <table>
                        <tr>
                            <td colspan="3">
                                <a href="https://bit.ly/airflow-extension-survey">New Feature Survey</a>
                            </td>
                        </tr>
                    </table>
                    <table>
                        <tr>
                            <td colspan="3">
                                <a href="https://github.com/sponsors/necatiarslan">Donate to support this extension</a>
                            </td>
                        </tr>
                    </table>
            </section>
            </vscode-tab-panel>


            <vscode-tab-panel>

            <section>

                    ${taskDependencyTree ? `
                    <table>
                        <tr>
                            <th>Task Dependencies</th>
                        </tr>
                        <tr>
                            <td>
                                <vscode-tree>
                                ${taskDependencyTree}
                                </vscode-tree>
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
            </vscode-tab-panel>
            
            <vscode-tab-panel>
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
                        <td>${schedule}</td>
                    </tr>
                    <tr>
                        <td>Next Run</td>
                        <td>:</td>
                        <td>${next_run}</td>
                    </tr>
                    <tr>           
                        <td colspan="3"><vscode-button appearance="secondary" id="info-source-code">Source Code</vscode-button> <vscode-button appearance="secondary" id="other-dag-detail">More</vscode-button></td>
                    </tr>
                    </table>

            </section>
            </vscode-tab-panel>

            <vscode-tab-panel>

            <section>
    
                    <table>
                        <tr>
                            <th colspan=4>HISTORY</th>
                        </tr>
                        <tr>
                            <td>Date</td>
                            <td>:</td>
                            <td>
                            <input type="date" id="history_date" value="${this.dagHistorySelectedDate}">
                            </td>
                            <td><vscode-button appearance="secondary" id="history-load-runs">Load Runs</vscode-button></td>
                        </tr>
                    </table>

                    <table>
                        <tr>
                            <th colspan=4>DAG RUNS</th>
                        </tr>
                        <tr>
                            <td></td>
                            <td>Start Time</td>            
                            <td>Duration</td>
                            <td>Notes</td>
                        </tr>
                        ${runHistoryRows}
                    </table>   
    
            </section>
            </vscode-tab-panel>

        </vscode-tabs>
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
                        this.showDAGRunLog();
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
                    case "history-load-runs":
                        this.getRunHistoryAndRenderHtml(message.date);
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

                    case "run-ask-ai":
                        this.askAI();
                        return;

                    case "run-lastrun-check":
                        this.getLastRun();
                        if(this.dagRunJson)
                        {
                            this.startCheckingDagRunStatus();
                        }
                        
                        return;

                    case "run-lastrun-cancel":
                        if(this.dagRunJson)
                        {
                            this.cancelDagRun();
                        }
                        
                        return;

                    case "run-update-note":
                        if(this.dagRunJson)
                        {
                            this.updateDagRunNote();
                        }
                        return;

                    case "history-dag-run-id":
                        let dagRunId:string = message.id;
                        dagRunId = dagRunId.replace("history-dag-run-id-", "");
                        this.activetabid = "tab-1";
                        this.dagRunId = dagRunId;
                        this.getDagRun();
                        return;

                    case "task-log-link":
                        let taskId:string = message.id;
                        taskId = taskId.replace("task-log-link-", "");
                        this.showTaskInstanceLog(this.dagId, this.dagRunId, taskId);
                        return;

                    case "task-xcom-link":
                        let xcomTaskId:string = message.id;
                        xcomTaskId = xcomTaskId.replace("task-xcom-link-", "");
                        this.showTaskXComs(this.dagId, this.dagRunId, xcomTaskId);
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

    private async cancelDagRun(){
        ui.logToOutput('DagView.cancelDagRun Started');
        if (!Session.Current.Api) { return; }

        const result = await Session.Current.Api.cancelDagRun(this.dagId, this.dagRunId);
        if (result.isSuccessful) {
            //ui.showInfoMessage(`Dag ${this.dagId} Run ${this.dagRunId} cancelled successfully.`);
            ui.logToOutput(`Dag ${this.dagId} Run ${this.dagRunId} cancelled successfully.`);
            await this.getDagRun();
            MessageHub.DagRunCancelled(this, this.dagId, this.dagRunId);
        }
    }

    private async updateDagRunNote() {
        ui.logToOutput('DagView.updateDagRunNote Started');
        
        if (!Session.Current.Api || !this.dagRunJson) { return; }
        
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
        
        const result = await Session.Current.Api.updateDagRunNote(this.dagId, this.dagRunId, newNote);
        if (result.isSuccessful) {
            // Refresh the DAG run to get the updated note
            await this.getDagRun();
        }
    }

    private async pauseDAG(is_paused: boolean) {
        ui.logToOutput('DagView.pauseDAG Started');
		if (!Session.Current.Api) { return; }

        if (is_paused && this.dagJson.is_paused) { ui.showWarningMessage(this.dagId + 'Dag is already PAUSED'); return; }
        if (!is_paused && !this.dagJson.is_paused) { ui.showWarningMessage(this.dagId + 'Dag is already ACTIVE'); return; }

        const result = await Session.Current.Api.pauseDag(this.dagId, is_paused);
        if (result.isSuccessful) {
            this.loadDagInfoOnly();
            is_paused ? MessageHub.DagPaused(this, this.dagId) : MessageHub.DagUnPaused(this, this.dagId);
        }

    }

    private async askAI() {
        ui.logToOutput('DagView.askAI Started');

        if (!Session.Current.Api) { return; }

        if (!DagTreeView.Current) {
            ui.showErrorMessage('DagTreeView is not available');
            return;
        }

        if (!this.dagJson) {
            ui.showErrorMessage('DAG information is not available');
            return;
        }
        
        const code = await Session.Current.Api.getSourceCode(this.dagId, this.dagJson.file_token);
        if (!code.isSuccessful) {
            ui.showErrorMessage('Failed to retrieve DAG source code for AI context');
            return;
        }

        const logs = await Session.Current.Api.getDagRunLogText(this.dagId, this.dagRunId);
        if (!logs.isSuccessful) {
            ui.showErrorMessage('Failed to retrieve DAG logs for AI context');
            return;
        }

        // Call the askAI function from DagTreeView
        await AIHandler.Current.askAIWithContext({ code: code.result, logs: logs.result, dag: this.dagJson, dagRun: this.dagRunJson, tasks: this.dagTasksJson, taskInstances: this.dagTaskInstancesJson });
    }

    private async showSourceCode() {
        ui.logToOutput('DagView.showSourceCode Started');

        if (!Session.Current.Api) { return; }

        const result = await Session.Current.Api.getSourceCode(this.dagId, this.dagJson.file_token);

        if (result.isSuccessful) {
            this.createAndOpenTempFile(result.result, this.dagId, '.py');
        }
        else
        {
            ui.logToOutput(result.result);
            ui.showErrorMessage(result.result);
        }
    }

    private async getRunHistoryAndRenderHtml(date?: string) {
        ui.logToOutput('DagView.getRunHistoryAndRenderHtml Started');
        this.dagHistorySelectedDate = date;
        await this.getRunHistory(date);
        await this.renderHmtl();
    }

    private async showDAGRunLog() {
        ui.logToOutput('DagView.showDAGRunLog Started');

        if (!Session.Current.Api) { return; }

        // const result = await Session.Current.Api.getDagRunLogText(this.dagId, this.dagRunId);
        // if (result.isSuccessful) {
        //     this.createAndOpenTempFile(result.result, this.dagId, '.log');
        // }
        DagLogView.render(this.dagId, this.dagRunId);
    }

    private async showTaskInstanceLog(dagId: string, dagRunId:string, taskId:string) {
        ui.logToOutput('DagView.showTaskInstanceLog Started');

        if (!Session.Current.Api) { return; }

        // const result = await Session.Current.Api.getTaskInstanceLogText(dagId, dagRunId, taskId);
        // if (result.isSuccessful) {
        //     this.createAndOpenTempFile(result.result, dagId + '-' + taskId, '.log');
        // }
        DagLogView.render(dagId, dagRunId, taskId);
    }

    private async showTaskXComs(dagId: string, dagRunId:string, taskId:string) {
        ui.logToOutput('DagView.showTaskXComs Started');
		if (!Session.Current.Api) { return; }

        const result = await Session.Current.Api.getTaskXComs(dagId, dagRunId, taskId);
        if (result.isSuccessful) {
            this.createAndOpenTempFile(JSON.stringify(result.result, null, 2), dagId + '-' + taskId + '_xcom', '.json');
        } else {
            ui.showInfoMessage(`No XCom entries found for task: ${taskId}`);
        }
    }

    private async triggerDagWConfig(config: string = "", date: string = "") {
        ui.logToOutput('DagView.triggerDagWConfig Started');

        if (!Session.Current.Api) { return; }

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

            const result = await Session.Current.Api.triggerDag(this.dagId, config, date);

            if (result.isSuccessful) {
                this.dagRunId = result.result["dag_run_id"];
                this.startCheckingDagRunStatus();
                MessageHub.DagTriggered(this, this.dagId, this.dagRunId);
            }
        }
    }

    private async startCheckingDagRunStatus() {
        ui.logToOutput('DagView.startCheckingDagRunStatus Started');
        await this.refreshRunningDagState(this);
        if (this.dagStatusInterval) {
            clearInterval(this.dagStatusInterval);//stop prev checking
        }
        this.dagStatusInterval = setInterval(() => {
            void this.refreshRunningDagState(this).catch((err: any) => ui.logToOutput('refreshRunningDagState Error', err));
        }, 5 * 1000);
    }

    private async stopCheckingDagRunStatus() {
        ui.logToOutput('DagView.stopCheckingDagRunStatus Started');
        if (this.dagStatusInterval) {
            clearInterval(this.dagStatusInterval);//stop prev checking
        }
    }

    private async refreshRunningDagState(dagView: DagView) {
        ui.logToOutput('DagView.refreshRunningDagState Started');
        if (!Session.Current.Api) { return; }
        
        if (!dagView.dagId || !dagView.dagRunId)
        {
            dagView.stopCheckingDagRunStatus();
            return;
        }

        const result = await Session.Current.Api.getDagRun(dagView.dagId, dagView.dagRunId);
        if (result.isSuccessful) {
            dagView.dagRunJson = result.result;

            const resultTasks = await Session.Current.Api.getTaskInstances(dagView.dagId, dagView.dagRunId);
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

        const buildTree = (taskId: string): string => {
            if (visited.has(taskId)) {
                return ""; // Prevent infinite loops and duplicates in this spanning tree view
            }
            visited.add(taskId);

            const task = taskMap.get(taskId);
            if (!task) {
                return "";
            }

            let itemHtml = `<vscode-tree-item>\n`;
            itemHtml += `${task.task_id}\n`;

            // Get downstream tasks
            const downstreamIds = task.downstream_task_ids || [];
            
            if (downstreamIds.length > 0) {
                downstreamIds.forEach((downstreamId: string) => {
                    itemHtml += buildTree(downstreamId);
                });
            }
            
            itemHtml += `</vscode-tree-item>\n`;

            return itemHtml;
        };

        // Build tree for each root task
        rootTasks.forEach((rootTask) => {
            treeHtml += buildTree(rootTask.task_id);
        });

        return treeHtml || "No tasks to display.";
    }

}