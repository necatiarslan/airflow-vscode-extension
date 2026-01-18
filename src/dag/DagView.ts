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
import { Telemetry } from '../common/Telemetry';

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
        Telemetry.Current.send('dagView.constructor.called');

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
        Telemetry.Current.send('dagView.loadAllDagData.called');

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
        Telemetry.Current.send('dagView.loadDagInfoOnly.called');

        await this.getDagInfo();
        await this.renderHmtl();
    }

    private async renderHmtl() {
        ui.logToOutput('DagView.renderHmtl Started');
        Telemetry.Current.send('dagView.renderHmtl.called');

        this._panel.webview.html = this._getWebviewContent(this._panel.webview, Session.Current.ExtensionUri!);
        //ui.showOutputMessage(this._panel.webview.html);
        ui.logToOutput('DagView.renderHmtl Completed');
    }

    public static render(dagId: string, dagRunId?: string) {
        ui.logToOutput('DagView.render Started');
        Telemetry.Current.send('dagView.render.called');

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
        Telemetry.Current.send('dagView.getLastRun.called');

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
        Telemetry.Current.send('dagView.getDagRun.called');

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
        Telemetry.Current.send('dagView.getRunHistory.called');

		if (!Session.Current.Api) { return; }

        const result = await Session.Current.Api.getDagRunHistory(this.dagId, date);
        if (result.isSuccessful) {
            this.dagRunHistoryJson = result.result;
        }

    }

    private async getTaskInstances() {
        ui.logToOutput('DagView.getTaskInstances Started');
        Telemetry.Current.send('dagView.getTaskInstances.called');

        if (!Session.Current.Api) { return; }

        const result = await Session.Current.Api.getTaskInstances(this.dagId, this.dagRunId);

        if (result.isSuccessful) {
            this.dagTaskInstancesJson = result.result;
        }

    }

    private async getDagInfo() {
        ui.logToOutput('DagView.getDagInfo Started');
        Telemetry.Current.send('dagView.getDagInfo.called');

        if (!Session.Current.Api) { return; }

        const result = await Session.Current.Api.getDagInfo(this.dagId);
        if (result.isSuccessful) {
            this.dagJson = result.result;
        }
    }

    private async getDagTasks() {
        ui.logToOutput('DagView.getDagTasks Started');
        Telemetry.Current.send('dagView.getDagTasks.called');

        if (!Session.Current.Api) { return; }

        const result = await Session.Current.Api.getDagTasks(this.dagId);
        if (result.isSuccessful) {
            this.dagTasksJson = result.result;
        }
    }

    private dispose() {
        ui.logToOutput('DagView.dispose Started');
        Telemetry.Current.send('dagView.dispose.called');

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
        Telemetry.Current.send('dagView.getWebviewContent.called');

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
                    runningOrFailedTasks += `<span class="task-tag state-${t.state}">${t.task_id}</span> `;
                }
            }
        }

        //INFO TAB
        let owners = (this.dagJson && Array.isArray(this.dagJson["owners"])) ? this.dagJson["owners"].join(", ") : "";
        let tags: string = "";
        if (this.dagJson && Array.isArray(this.dagJson["tags"])) {
            this.dagJson["tags"].forEach((item: any) => { tags += `<span class="tag">${item.name}</span> `; });
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
                <tr class="table-row">
                    <td>
                        <div style="display: flex; align-items: center;">
                            <div class="state-indicator state-${t.state}" title="${t.state}" ></div>
                            <span class="task-name">${t.task_id}</span> <span class="try-number">(${t.try_number})</span>
                        </div>
                    </td>
                    <td>
                        <div class="action-links">
                            <a href="#" class="link-button" id="task-log-link-${t.task_id}">Logs</a>
                            <a href="#" class="link-button" id="task-xcom-link-${t.task_id}">XComs</a>
                        </div>
                    </td>
                    <td><span class="duration-badge">${ui.getDuration(new Date(t.start_date), new Date(t.end_date))}</span></td>
                    <td class="operator-type">${t.operator}</td>
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
                <tr class="table-row">
                    <td>
                        <div style="display: flex; align-items: center;">
                            <div class="state-indicator state-${t.state}" title="${t.state}"></div>
                            <span class="state-text">${t.state}</span>
                        </div>
                    </td>
                    <td><a href="#" class="history-link" id="history-dag-run-id-${t.dag_run_id}">${ui.toISODateTimeString(new Date(t.start_date))}</a></td>
                    <td><span class="duration-badge">${ui.getDuration(new Date(t.start_date), new Date(t.end_date))}</span></td>
                    <td><span class="note-text">${t.note || ''}</span></td>
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
            :root {
                --font-size-sm: 12px;
                --font-size-md: 13px;
                --font-size-lg: 15px;
                --border-radius: 4px;
                --spacing-xs: 4px;
                --spacing-sm: 8px;
                --spacing-md: 16px;
                --spacing-lg: 24px;
            }

            body {
                padding: var(--spacing-md);
                font-family: var(--vscode-font-family);
                color: var(--vscode-foreground);
                background-color: var(--vscode-editor-background);
            }

            h2 {
                margin: 0;
                font-size: 18px;
                font-weight: 600;
                color: var(--vscode-editor-foreground);
            }

            a {
                color: var(--vscode-textLink-foreground);
                text-decoration: none;
            }
            a:hover {
                text-decoration: underline;
                color: var(--vscode-textLink-activeForeground);
            }

            /* Header Section */
            .header-container {
                display: flex;
                align-items: center;
                gap: var(--spacing-md);
                margin-bottom: var(--spacing-lg);
                padding-bottom: var(--spacing-md);
                border-bottom: 1px solid var(--vscode-widget-border);
            }

            .dag-paused-indicator {
                width: 12px;
                height: 12px;
                border-radius: 50%;
            }
            .dag-paused-true { background-color: var(--vscode-disabledForeground); }
            .dag-paused-false { background-color: var(--vscode-testing-iconPassed); }

            /* Tabs */
            vscode-tabs {
                border-radius: var(--border-radius);
            }

            section {
                padding: 20px 0;
            }

            /* Tables */
            table {
                width: 100%;
                border-collapse: separate;
                border-spacing: 0;
                margin-bottom: var(--spacing-lg);
                font-size: var(--font-size-md);
            }

            th, td {
                padding: 5px 8px;
                text-align: left;
                border-bottom: 1px solid var(--vscode-widget-border);
            }

            th {
                font-weight: 600;
                color: var(--vscode-descriptionForeground);
                text-transform: uppercase;
                font-size: 11px;
                letter-spacing: 0.5px;
                background-color: var(--vscode-editor-inactiveSelectionBackground);
            }
            
            th.section-header {
                font-size: 13px;
                color: var(--vscode-editor-foreground);
                background-color: transparent;
                border-bottom: 2px solid var(--vscode-button-background);
                padding-bottom: 8px;
                padding-left: 0;
            }

            tr:last-child td {
                border-bottom: none;
            }

            .table-row:hover td {
                background-color: var(--vscode-list-hoverBackground);
            }

            /* Detail Layouts */
            .detail-row td:first-child {
                width: 120px;
                font-weight: 600;
                color: var(--vscode-descriptionForeground);
            }
            .detail-row td:nth-child(2) {
                width: 20px;
                text-align: center;
                color: var(--vscode-descriptionForeground);
            }

            /* States & Badges */
            .state-indicator {
                width: 10px;
                height: 10px;
                border-radius: 50%;
                margin-right: 8px;
                display: inline-block;
            }
            /* Map existing state classes to colors if possible, or assume external CSS handles it */
            
            .task-tag {
                display: inline-block;
                padding: 2px 8px;
                background-color: var(--vscode-badge-background);
                color: var(--vscode-badge-foreground);
                border-radius: 12px;
                font-size: 11px;
                margin-right: 4px;
                margin-bottom: 4px;
            }

            .tag {
                background-color: var(--vscode-textBlockQuote-background);
                color: var(--vscode-textBlockQuote-border);
                padding: 2px 6px;
                border-radius: 4px;
                font-size: 12px;
                border: 1px solid var(--vscode-widget-border);
            }

            .duration-badge {
                font-family: 'Courier New', monospace;
                font-size: 12px;
                opacity: 0.8;
            }

            .operator-type {
                font-style: italic;
                color: var(--vscode-descriptionForeground);
            }

            .try-number {
                font-size: 11px;
                color: var(--vscode-descriptionForeground);
                margin-left: 4px;
            }

            .action-links {
                display: flex;
                gap: 12px;
            }

            .link-button {
                font-size: 12px;
            }

            /* Inputs */
            input[type="date"], vscode-textfield, vscode-textarea {
                width: 100%;
                box-sizing: border-box;
                font-family: inherit;
            }
            input[type="date"] {
                padding: 6px;
                border: 1px solid var(--vscode-input-border);
                background-color: var(--vscode-input-background);
                color: var(--vscode-input-foreground);
                border-radius: 2px;
            }

            vscode-button {
                margin-right: 8px;
            }
            
            /* Utils */
            .mt-md { margin-top: var(--spacing-md); }
            .mb-md { margin-bottom: var(--spacing-md); }

            /* Code block for JSON/Config */
            .code-block {
                font-family: var(--vscode-editor-font-family);
                background-color: var(--vscode-textBlockQuote-background);
                padding: 8px;
                border-radius: 4px;
                white-space: pre-wrap;
                font-size: 12px;
                max-height: 200px;
                overflow-y: auto;
            }

        </style>
        <title>DAG</title>
      </head>
      <body>  

        <div class="header-container">
            <div class="dag-paused-indicator dag-paused-${isPausedText}"></div>
            <h2>${this.dagId}</h2>
            <div style="visibility: ${isDagRunning ? "visible" : "hidden"}; display: flex; align-items: center;">
                <vscode-progress-ring></vscode-progress-ring>
            </div>
        </div>
                    
        <vscode-tabs id="tab-control" selected-index="${this.activetabid === 'tab-1' ? 0 : this.activetabid === 'tab-2' ? 1 : this.activetabid === 'tab-3' ? 2 : 3}">
            <vscode-tab-header slot="header">RUN</vscode-tab-header>
            <vscode-tab-header slot="header">TASKS</vscode-tab-header>
            <vscode-tab-header slot="header">INFO</vscode-tab-header>
            <vscode-tab-header slot="header">HISTORY</vscode-tab-header>
            
            <vscode-tab-panel>
                <section>
                    <table>
                        <tr>
                            <th colspan="3" class="section-header">Dag Run Details</th>
                        </tr>
                        <tr class="detail-row">
                            <td>State</td>
                            <td>:</td>
                            <td>
                                <div style="display: flex; align-items: center;">
                                    <div class="state-indicator state-${state}"></div> <span>${state}</span>
                                </div>
                            </td>
                        </tr>
                        <tr class="detail-row">
                            <td>Tasks</td>
                            <td>:</td>
                            <td>${runningOrFailedTasks || '<span style="opacity:0.5">None active</span>'}</td>
                        </tr>
                        <tr class="detail-row">
                            <td>Logical Date</td>
                            <td>:</td>
                            <td>${logical_date_string}</td>
                        </tr>
                        <tr class="detail-row">
                            <td>StartDate</td>
                            <td>:</td>
                            <td>${start_date_string}</td>
                        </tr>
                        <tr class="detail-row">
                            <td>Duration</td>
                            <td>:</td>
                            <td>${duration}</td>
                        </tr>
                        <tr class="detail-row">
                            <td>Note</td>
                            <td>:</td>
                            <td><a href="#" id="run-update-note-link" title="Click to update note">${this.dagRunJson?.note || '<span style="opacity:0.5; font-style:italic;">Add a note...</span>'}</a></td>
                        </tr>
                        <tr class="detail-row">
                            <td>Config</td>
                            <td>:</td>
                            <td><div class="code-block">${this.dagRunJson?.conf ? JSON.stringify(this.dagRunJson.conf, null, 2) : '{}'}</div></td>
                        </tr>
                    </table>
                    
                    <div class="mb-md">
                        <vscode-button appearance="secondary" id="run-ask-ai" ${!hasDagRun ? "disabled" : ""}>Ask AI</vscode-button>    
                        <vscode-button appearance="secondary" id="run-view-log" ${!hasDagRun ? "disabled" : ""}>Log</vscode-button> 
                        <vscode-button appearance="secondary" id="run-lastrun-check" ${isPaused ? "disabled" : ""}>Refresh</vscode-button>  
                        <vscode-button appearance="secondary" id="run-more-dagrun-detail" ${!hasDagRun ? "disabled" : ""}>More</vscode-button>
                    </div>
            
                    <br>
            
                    <table>
                        <tr>
                            <th colspan="3" class="section-header">Trigger Run</th>
                        </tr>
                        <tr class="detail-row">
                            <td>Logical Date</td>
                            <td>:</td>
                            <td><vscode-textfield id="run_date" placeholder="YYYY-MM-DD (Optional)" maxlength="10"></vscode-textfield></td>
                        </tr>
                        <tr class="detail-row">
                            <td>Config</td>
                            <td>:</td>
                            <td><vscode-textarea id="run_config" rows="3" placeholder='{"key": "value"}'></vscode-textarea></td>
                        </tr>
                    </table>
                    
                    <div class="mb-md">
                        <vscode-button appearance="primary" id="run-trigger-dag" ${isPaused ? "disabled" : ""}>Run</vscode-button>
                        <vscode-button appearance="secondary" id="run-lastrun-cancel" ${isPaused || !isDagRunning ? "disabled" : ""}>Cancel</vscode-button>  
                    </div>

                    <br>

                    <table>
                        <tr>
                            <th colspan="3" class="section-header">Control</th>
                        </tr>
                    </table>
                    <div class="mb-md">
                         <vscode-button appearance="secondary" id="run-pause-dag" ${isPaused ? "disabled" : ""}>Pause</vscode-button>
                         <vscode-button appearance="secondary" id="run-unpause-dag" ${!isPaused ? "disabled" : ""}>Unpause</vscode-button>
                    </div>

                    <br><br>
                    
                    <div style="opacity: 0.7; font-size: 12px; margin-top: 40px; border-top: 1px solid var(--vscode-widget-border); padding-top: 20px;">
                        <div style="margin-bottom: 8px;"><a href="https://github.com/necatiarslan/airflow-vscode-extension/issues/new">Report Bug / Request Feature</a></div>
                        <div style="margin-bottom: 8px;"><a href="https://bit.ly/airflow-extension-survey">New Feature Survey</a></div>
                        <div><a href="https://github.com/sponsors/necatiarslan">Support this extension</a></div>
                    </div>
                </section>
            </vscode-tab-panel>


            <vscode-tab-panel>
                <section>
                    ${taskDependencyTree ? `
                    <div style="margin-bottom: 20px; border: 1px solid var(--vscode-widget-border); border-radius: 4px; padding: 10px;">
                        <vscode-tree>
                        ${taskDependencyTree}
                        </vscode-tree>
                    </div>
                    ` : ''}

                    <table>
                        <tr>
                            <th>Task</th>
                            <th>Actions</th>
                            <th>Duration</th>            
                            <th>Operator</th>
                        </tr>
                        ${taskRows}
                    </table>
                    
                    <div>
                        <vscode-button appearance="secondary" id="tasks-refresh">Refresh</vscode-button>
                        <vscode-button appearance="secondary" id="tasks-more-detail" ${!this.dagTaskInstancesJson ? "disabled" : ""}>Raw JSON</vscode-button>
                    </div>

                </section>
            </vscode-tab-panel>
            
            <vscode-tab-panel>
                <section>
                    <table>
                        <tr class="detail-row">
                            <td>Owners</td>
                            <td>:</td>
                            <td>${owners}</td>
                        </tr>
                        <tr class="detail-row">
                            <td>Tags</td>
                            <td>:</td>
                            <td>${tags}</td>
                        </tr>
                        <tr class="detail-row">
                            <td>Schedule</td>
                            <td>:</td>
                            <td>${schedule}</td>
                        </tr>
                        <tr class="detail-row">
                            <td>Next Run</td>
                            <td>:</td>
                            <td>${next_run}</td>
                        </tr>
                    </table>
                    
                    <div>
                        <vscode-button appearance="secondary" id="info-source-code">Source Code</vscode-button> 
                        <vscode-button appearance="secondary" id="other-dag-detail">Raw JSON</vscode-button>
                    </div>
                </section>
            </vscode-tab-panel>

            <vscode-tab-panel>
                <section>                    
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 20px; background: var(--vscode-editor-inactiveSelectionBackground); padding: 10px; border-radius: 4px;">
                        <label for="history_date" style="font-weight: 600;">Filter Date:</label>
                        <input type="date" id="history_date" value="${this.dagHistorySelectedDate}" style="width: 150px;">
                        <vscode-button appearance="secondary" id="history-load-runs">Load Runs</vscode-button>
                    </div>

                    <table>
                        <thead>
                            <tr>
                                <th>State</th>
                                <th>Start Time</th>            
                                <th>Duration</th>
                                <th>Notes</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${runHistoryRows}
                        </tbody>
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
        Telemetry.Current.send('dagView.setWebviewMessageListener.called');

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
        Telemetry.Current.send('dagView.cancelDagRun.called');

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
        Telemetry.Current.send('dagView.updateDagRunNote.called');
        
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
        Telemetry.Current.send('dagView.pauseDAG.called');

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
        Telemetry.Current.send('dagView.askAI.called');

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
        Telemetry.Current.send('dagView.showSourceCode.called');

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
        Telemetry.Current.send('dagView.getRunHistoryAndRenderHtml.called');

        this.dagHistorySelectedDate = date;
        await this.getRunHistory(date);
        await this.renderHmtl();
    }

    private async showDAGRunLog() {
        ui.logToOutput('DagView.showDAGRunLog Started');
        Telemetry.Current.send('dagView.showDAGRunLog.called');

        if (!Session.Current.Api) { return; }

        // const result = await Session.Current.Api.getDagRunLogText(this.dagId, this.dagRunId);
        // if (result.isSuccessful) {
        //     this.createAndOpenTempFile(result.result, this.dagId, '.log');
        // }
        DagLogView.render(this.dagId, this.dagRunId);
    }

    private async showTaskInstanceLog(dagId: string, dagRunId:string, taskId:string) {
        ui.logToOutput('DagView.showTaskInstanceLog Started');
        Telemetry.Current.send('dagView.showTaskInstanceLog.called');

        if (!Session.Current.Api) { return; }

        // const result = await Session.Current.Api.getTaskInstanceLogText(dagId, dagRunId, taskId);
        // if (result.isSuccessful) {
        //     this.createAndOpenTempFile(result.result, dagId + '-' + taskId, '.log');
        // }
        DagLogView.render(dagId, dagRunId, taskId);
    }

    private async showTaskXComs(dagId: string, dagRunId:string, taskId:string) {
        ui.logToOutput('DagView.showTaskXComs Started');
        Telemetry.Current.send('dagView.showTaskXComs.called');

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
        Telemetry.Current.send('dagView.triggerDagWConfig.called');

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
        Telemetry.Current.send('dagView.startCheckingDagRunStatus.called');

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
        Telemetry.Current.send('dagView.stopCheckingDagRunStatus.called');

        if (this.dagStatusInterval) {
            clearInterval(this.dagStatusInterval);//stop prev checking
        }
    }

    private async refreshRunningDagState(dagView: DagView) {
        ui.logToOutput('DagView.refreshRunningDagState Started');
        Telemetry.Current.send('dagView.refreshRunningDagState.called');

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
        Telemetry.Current.send('dagView.buildTaskDependencyTree.called');
        
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