/* eslint-disable @typescript-eslint/naming-convention */
import * as vscode from "vscode";
import * as ui from '../common/UI';
import { Session } from '../common/Session';

export class DagLogView {
    public static Current: DagLogView | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];

    private dagId: string;
    private dagRunId: string | undefined;
    private taskId: string | undefined;
    private tryNumber: number | undefined;

    private dagRunJson: any;
    private taskInstancesJson: any;
    private logs: Map<string, any> = new Map(); // taskId -> logJson

    private constructor(panel: vscode.WebviewPanel, dagId: string, dagRunId?: string, taskId?: string, tryNumber?: number) {
        ui.logToOutput('DagLogView.constructor Started');
        this._panel = panel;
        this.dagId = dagId;
        this.dagRunId = dagRunId;
        this.taskId = taskId;
        this.tryNumber = tryNumber;

        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        this._setWebviewMessageListener(this._panel.webview);
        this.loadData();
        ui.logToOutput('DagLogView.constructor Completed');
    }

    public static render(dagId: string, dagRunId?: string, taskId?: string, tryNumber?: number) {
        ui.logToOutput('DagLogView.render Started');
        if (DagLogView.Current) {
            DagLogView.Current.dagId = dagId;
            DagLogView.Current.dagRunId = dagRunId;
            DagLogView.Current.taskId = taskId;
            DagLogView.Current.tryNumber = tryNumber;
            DagLogView.Current._panel.reveal(vscode.ViewColumn.One);
            DagLogView.Current.loadData();
        } else {
            const panel = vscode.window.createWebviewPanel("dagLogView", "DAG Logs", vscode.ViewColumn.One, {
                enableScripts: true,
                retainContextWhenHidden: true
            });

            DagLogView.Current = new DagLogView(panel, dagId, dagRunId, taskId, tryNumber);
        }
    }

    public async loadData() {
        ui.logToOutput('DagLogView.loadData Started');
        if (!Session.Current.Api) { return; }

        // 1. Resolve dagRunId if missing
        if (!this.dagRunId) {
            const lastRunResult = await Session.Current.Api.getLastDagRun(this.dagId);
            if (lastRunResult.isSuccessful && lastRunResult.result) {
                this.dagRunJson = lastRunResult.result;
                this.dagRunId = this.dagRunJson.dag_run_id;
            } else {
                ui.showErrorMessage("Could not fetch latest DAG run.");
                return;
            }
        } else {
            // Fetch specific dag run details
            const runResult = await Session.Current.Api.getDagRun(this.dagId, this.dagRunId);
            if (runResult.isSuccessful) {
                this.dagRunJson = runResult.result;
            }
        }

        // 2. Fetch Task Instances
        if (this.dagRunId) {
            const tasksResult = await Session.Current.Api.getTaskInstances(this.dagId, this.dagRunId);
            if (tasksResult.isSuccessful && tasksResult.result) {
                this.taskInstancesJson = tasksResult.result;
            }
        }

        // 3. Clear logs cache on reload
        this.logs.clear();

        // 4. Fetch logs for tasks
        const tasks = this._getTasks();
        
        // Use Promise.all to fetch concurrently
        await Promise.all(tasks.map(t => {
            let tryNum = t.try_number;
            // If specific task requested AND specific try requested, use that.
            if (this.taskId && t.task_id === this.taskId && this.tryNumber !== undefined) {
                tryNum = this.tryNumber;
            }
            return this.fetchLogForTask(t.task_id, tryNum);
        }));

        await this.renderHtml();
    }

    private _getTasks(): any[] {
        if (!this.taskInstancesJson || !this.taskInstancesJson.task_instances) {
            return [];
        }
        let tasks = [...this.taskInstancesJson.task_instances];

        // Filter by taskId if provided
        if (this.taskId) {
            tasks = tasks.filter((t: any) => t.task_id === this.taskId);
        }

        return tasks.sort((a: any, b: any) => {
             const dateA = a.start_date ? new Date(a.start_date).getTime() : 0;
             const dateB = b.start_date ? new Date(b.start_date).getTime() : 0;
             return dateA - dateB;
        });
    }

    private async fetchLogForTask(taskId: string, tryNum?: number) {
        if (!this.dagRunId) { return; }
        
        let targetTryNumber = tryNum;
        if (targetTryNumber === undefined) {
             const task = this.taskInstancesJson.task_instances.find((t: any) => t.task_id === taskId);
             if (task) {
                 targetTryNumber = task.try_number;
             } else {
                 targetTryNumber = 1; 
             }
        }
        
        if (this.logs.has(taskId)) { return; }

        const result = await Session.Current.Api?.getTaskInstanceLog(this.dagId, this.dagRunId, taskId, targetTryNumber!);
        if (result?.isSuccessful) {
            this.logs.set(taskId, result.result);
        }
    }

    public async renderHtml() {
        ui.logToOutput('DagLogView.renderHtml Started');
        this._panel.webview.html = this._getWebviewContent(this._panel.webview, Session.Current.ExtensionUri!);
    }

    public dispose() {
        DagLogView.Current = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }

    private _getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri) {
        const elementsUri = ui.getUri(webview, extensionUri, [
            "node_modules",
            "@vscode-elements",
            "elements",
            "dist",
            "bundled.js",
        ]);

        const mainUri = ui.getUri(webview, extensionUri, ["media", "main.js"]);
        const styleUri = ui.getUri(webview, extensionUri, ["media", "style.css"]);

        const tasks = this._getTasks();
        
        // Metadata
        const dagRun = this.dagRunJson || {};
        const startDate = dagRun.start_date ? ui.toISODateTimeString(new Date(dagRun.start_date)) : 'N/A';
        const endDate = dagRun.end_date ? ui.toISODateTimeString(new Date(dagRun.end_date)) : 'Running';
        const duration = dagRun.start_date ? ui.getDuration(new Date(dagRun.start_date), dagRun.end_date ? new Date(dagRun.end_date) : new Date()) : 'N/A';
        const status = dagRun.state || 'N/A';

        const taskSections = tasks.map(t => {
            const logData = this.logs.get(t.task_id);
            let contentHtml = '';

            const isSuccess = t.state === 'success';
            const isError = ['failed', 'upstream_failed', 'shutdown', 'restart'].includes(t.state);
            let statusClass = 'status-other';
            if (isSuccess) statusClass = 'status-success';
            if (isError) statusClass = 'status-error';

            let displayTry = t.try_number;
            if (this.taskId && t.task_id === this.taskId && this.tryNumber !== undefined) {
                displayTry = this.tryNumber;
            }

            if (logData) {
                if (logData.content && Array.isArray(logData.content)) {
                    contentHtml = logData.content.map((entry: any) => {
                         const ts = entry.timestamp ? `[${entry.timestamp}]` : '';
                         const lvl = entry.level ? `[${entry.level}]` : '';
                         const logger = entry.logger ? `[${entry.logger}]` : '';
                         const evt = entry.event || '';
                         let extra = '';
                         // Error detail
                         if (entry.error_detail) {
                             extra = `<pre class="error-detail">${JSON.stringify(entry.error_detail, null, 2)}</pre>`;
                         }
                         
                         let lineClass = 'log-line';
                         if (lvl.toLowerCase().includes('error')) { lineClass += ' log-error'; }
                         if (lvl.toLowerCase().includes('warn')) { lineClass += ' log-warn'; }

                         return `<div class="${lineClass}"><span class="log-ts">${ts}</span> <span class="log-lvl">${lvl}</span> <span class="log-logger">${logger}</span> <span class="log-msg">${this._escapeHtml(evt)}</span>${extra}</div>`;
                    }).join('');
                } else if (logData.detail) {
                     contentHtml = `<div class="log-error">${this._escapeHtml(logData.detail)}</div>`;
                } else {
                     contentHtml = `<pre>${this._escapeHtml(JSON.stringify(logData, null, 2))}</pre>`;
                }
            } else {
                contentHtml = '<div class="loading-logs">Loading logs...</div>'; 
            }

            return `
            <div class="task-section ${statusClass}">
                <div class="task-header">
                    <div class="header-left">
                        <span class="status-indicator"></span>
                        <span class="task-title">${this._escapeHtml(t.task_id)}</span>
                        <span class="status-pill">${this._escapeHtml(t.state)}</span>
                    </div>
                    <div class="header-right">
                        <span class="task-try">Try: ${displayTry}</span>
                    </div>
                </div>
                <div class="log-container" id="log-${t.task_id}">
                    ${contentHtml}
                </div>
            </div>`;
        }).join('\n');


        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width,initial-scale=1.0">
    <script type="module" src="${elementsUri}"></script>
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
            display: flex; 
            flex-direction: column; 
            height: 100vh; 
            box-sizing: border-box; 
            background: var(--vscode-editor-background); 
            color: var(--vscode-editor-foreground);
            font-family: var(--vscode-font-family);
        }

        .metadata { 
            margin-bottom: var(--spacing-lg); 
            padding: var(--spacing-md); 
            background: var(--vscode-editor-inactiveSelectionBackground); 
            border-radius: var(--border-radius); 
        }
        .metadata-row { display: flex; gap: 32px; font-size: 13px; margin-bottom: 4px; }
        .label { font-weight: 600; color: var(--vscode-descriptionForeground); width: 70px; display: inline-block; text-transform: uppercase; font-size: 11px; }
        
        .task-container { display: flex; flex-direction: column; gap: 16px; padding-bottom: 20px; }
        
        .task-section { 
            border: 1px solid var(--vscode-widget-border); 
            border-radius: var(--border-radius); 
            overflow: hidden; 
            background: var(--vscode-editor-background);
        }
        
        .task-header { 
            padding: 8px 16px; 
            display: flex; 
            justify-content: space-between;
            align-items: center; 
            border-bottom: 1px solid var(--vscode-widget-border);
        }

        .header-left { display: flex; align-items: center; gap: 12px; }
        .header-right { display: flex; align-items: center; gap: 12px; }

        .task-title { font-weight: 600; font-size: 14px; }
        .task-try { font-size: 11px; color: var(--vscode-descriptionForeground); }
        
        .status-indicator {
            width: 8px; height: 8px; border-radius: 50%;
            display: inline-block;
        }

        .status-pill {
            padding: 2px 8px;
            border-radius: 10px;
            font-size: 10px;
            font-weight: 600;
            text-transform: uppercase;
        }

        /* Status Colors */
        .task-section.status-success .task-header {
            background-color: var(--vscode-notebook-cellEditorBackground); 
        }
        .task-section.status-success .status-indicator {
            background-color: var(--vscode-testing-iconPassed);
        }
        .task-section.status-success .status-pill {
            background-color: var(--vscode-testing-iconPassed);
            color: var(--vscode-editor-background);
        }

        .task-section.status-error .task-header {
            background-color: rgba(255, 0, 0, 0.1); 
        }
        .task-section.status-error .status-indicator {
            background-color: var(--vscode-errorForeground);
        }
        .task-section.status-error .status-pill {
            background-color: var(--vscode-errorForeground);
            color: white;
        }

        .task-section.status-other .task-header {
            background-color: var(--vscode-sideBarSectionHeader-background);
        }
        .task-section.status-other .status-indicator {
            background-color: var(--vscode-descriptionForeground);
        }
        .task-section.status-other .status-pill {
            background-color: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
        }

        .log-container { 
            padding: 16px;
            max-height: 500px;
            overflow-y: auto; 
            font-family: var(--vscode-editor-font-family);
            font-size: 12px;
            white-space: pre-wrap;
            line-height: 1.5;
        }
        
        .log-line { margin-bottom: 2px; }
        .log-ts { color: var(--vscode-debugConsole-infoForeground); margin-right: 8px; opacity: 0.8; font-size: 0.9em; }
        .log-lvl { font-weight: bold; margin-right: 8px; }
        .log-logger { color: var(--vscode-textLink-foreground); margin-right: 8px; }
        
        .log-error { color: var(--vscode-errorForeground); }
        .log-warn { color: var(--vscode-editorWarning-foreground); }
        
        .error-detail { 
            color: var(--vscode-textPreformat-foreground); 
            background-color: var(--vscode-textBlockQuote-background);
            padding: 12px;
            margin: 8px 0 8px 16px;
            border-left: 3px solid var(--vscode-errorForeground);
            border-radius: 3px;
        }
        .loading-logs { font-style: italic; color: var(--vscode-descriptionForeground); padding: 20px; text-align: center; }

    </style>
    <title>DAG Logs</title>
</head>
<body>
    <div class="metadata">
        <div class="metadata-row">
            <div><span class="label">DAG ID:</span> <span>${this.dagId}</span></div>
            <div><span class="label">Run ID:</span> <span>${this.dagRunId}</span></div>
            <div><span class="label">Status:</span> <span>${status}</span></div>
        </div>
        <div class="metadata-row">
            <div><span class="label">Start:</span> <span>${startDate}</span></div>
            <div><span class="label">End:</span> <span>${endDate}</span></div>
            <div><span class="label">Duration:</span> <span>${duration}</span></div>
        </div>
    </div>

    <div class="task-container">
        ${taskSections}
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        // Just listener for now if we want to add interactivity later e.g. collapse/expand
    </script>
</body>
</html>`;
    }

    private _escapeHtml(text: string): string {
        if (!text) return '';
        const map: { [key: string]: string } = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return String(text).replace(/[&<>"']/g, m => map[m]);
    }

    private _setWebviewMessageListener(webview: vscode.Webview) {
        webview.onDidReceiveMessage(
            async (message: any) => {
                // No messages expected for now
            },
            undefined,
            this._disposables
        );
    }
}
