/* eslint-disable @typescript-eslint/naming-convention */
import * as vscode from "vscode";
import * as ui from '../common/UI';
import { DagView } from '../dag/DagView';
import { Session } from '../common/Session';
import { DagLogView } from './DagLogView';
import { Telemetry } from "../common/Telemetry";

export class DailyDagRunView {
    public static Current: DailyDagRunView;
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];

    private dagRunsJson: any;
    
    // Filters
    private selectedDate: string = ui.toISODateString(new Date());
    private selectedStatus: string = '';
    private selectedDagId: string = '';
    private allDagIds: string[] = [];

    private constructor(panel: vscode.WebviewPanel) {
        ui.logToOutput('DailyDagRunView.constructor Started');
        Telemetry.Current.send('DailyDagRunView.constructor.called');
        this._panel = panel;
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        this._setWebviewMessageListener(this._panel.webview);
        this.loadData();
        ui.logToOutput('DailyDagRunView.constructor Completed');
    }

    public async loadData() {
        ui.logToOutput('DailyDagRunView.loadData Started');
        Telemetry.Current.send('DailyDagRunView.loadData.called');
		if (!Session.Current.Api) { return; }
        // Fetch all DAGs to populate dag_id filter
        const dagsResult = await Session.Current.Api.getDagList();
        if (dagsResult.isSuccessful && Array.isArray(dagsResult.result)) {
            this.allDagIds = dagsResult.result.map((dag: any) => dag.dag_id).sort();
        }

        // Fetch DAG runs for the selected date
        // If a specific DAG is selected, query that DAG, otherwise query all
        if (this.selectedDagId) {
            const result = await Session.Current.Api.getDagRunHistory(this.selectedDagId, this.selectedDate);
            if (result.isSuccessful && result.result && result.result.dag_runs) {
                this.dagRunsJson = result.result.dag_runs;
            }
        } else {
            // Query all DAGs for runs on the selected date
            const allRuns: any[] = [];
            for (const dagId of this.allDagIds) {
                const result = await Session.Current.Api.getDagRunHistory(dagId, this.selectedDate);
                if (result.isSuccessful && result.result && result.result.dag_runs) {
                    allRuns.push(...result.result.dag_runs);
                }
            }
            this.dagRunsJson = allRuns;
        }

        await this.renderHtml();
    }

    public async renderHtml() {
        ui.logToOutput('DailyDagRunView.renderHtml Started');
        Telemetry.Current.send('DailyDagRunView.renderHtml.called');
        this._panel.webview.html = this._getWebviewContent(this._panel.webview, Session.Current.ExtensionUri!);
        ui.logToOutput('DailyDagRunView.renderHtml Completed');
    }

    public static render() {
        ui.logToOutput('DailyDagRunView.render Started');
        Telemetry.Current.send('DailyDagRunView.render.called');
        if (DailyDagRunView.Current) {
            DailyDagRunView.Current._panel.reveal(vscode.ViewColumn.One);
            DailyDagRunView.Current.loadData();
        } else {
            const panel = vscode.window.createWebviewPanel("dailyDagRunView", "Daily DAG Runs", vscode.ViewColumn.One, {
                enableScripts: true,
            });

            DailyDagRunView.Current = new DailyDagRunView(panel);
        }
    }

    public dispose() {
        ui.logToOutput('DailyDagRunView.dispose Started');
        Telemetry.Current.send('DailyDagRunView.dispose.called');
        DailyDagRunView.Current = undefined;

        this._panel.dispose();

        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }

    private _getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri) {
        ui.logToOutput('DailyDagRunView._getWebviewContent Started');
        Telemetry.Current.send('DailyDagRunView._getWebviewContent.called');

        const styleUri = ui.getUri(webview, extensionUri, ["media", "style.css"]);

        // Filter DAG runs based on selected filters
        let filteredRuns: any[] = [];
        if (this.dagRunsJson && Array.isArray(this.dagRunsJson)) {
            filteredRuns = this.dagRunsJson.filter((run: any) => {
                // Filter by status
                if (this.selectedStatus && run.state !== this.selectedStatus) {
                    return false;
                }

                return true;
            });
        }

        // Build table rows
        let tableRows = '';
        filteredRuns.forEach((run: any) => {
            const dagId = run.dag_id || 'N/A';
            const status = run.state || 'N/A';
            const startDate = run.start_date ? ui.toISODateTimeString(new Date(run.start_date)) : 'N/A';
            const duration = run.start_date && run.end_date ? ui.getDuration(new Date(run.start_date), new Date(run.end_date)) : 'Running';
            const config = run.conf ? JSON.stringify(run.conf) : '{}';
            const note = run.note || '';
            const dagRunId = run.dag_run_id || '';

            tableRows += `
            <tr class="table-row">
                <td><a href="#" data-dag-id="${this._escapeHtml(dagId)}" data-dag-run-id="${this._escapeHtml(dagRunId)}" class="dag-link">${this._escapeHtml(dagId)}</a></td>
                <td>
                    <div style="display: flex; align-items: center;">
                        <div class="state-indicator state-${status}" title="${this._escapeHtml(status)}"></div>
                        <span>${this._escapeHtml(status)}</span>
                    </div>
                </td>
                <td>
                    <div class="action-links">
                        <a href="#" data-dag-id="${this._escapeHtml(dagId)}" data-dag-run-id="${this._escapeHtml(dagRunId)}" class="dag-log-link link-button">Logs</a>
                    </div>
                </td>
                <td>${this._escapeHtml(startDate)}</td>
                <td><span class="duration-badge">${this._escapeHtml(duration)}</span></td>
                <td><div class="code-block" style="max-height: 50px; overflow: hidden; font-size: 11px;">${this._escapeHtml(config)}</div></td>
                <td>${this._escapeHtml(note)}</td>
            </tr>`;
        });

        // Build dag_id filter options
        const dagIdOptions = this.allDagIds.map(id => `<option value="${this._escapeHtml(id)}">${this._escapeHtml(id)}</option>`).join('');

        const result = /*html*/ `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width,initial-scale=1.0">
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
                margin: 0 0 var(--spacing-lg) 0;
                font-size: 18px;
                font-weight: 600;
                color: var(--vscode-editor-foreground);
                border-bottom: 1px solid var(--vscode-widget-border);
                padding-bottom: var(--spacing-md);
            }

            /* Filters */
            .filters {
                display: flex;
                gap: var(--spacing-md);
                margin-bottom: var(--spacing-lg);
                flex-wrap: wrap;
                align-items: flex-end;
                background-color: var(--vscode-editor-inactiveSelectionBackground);
                padding: var(--spacing-md);
                border-radius: var(--border-radius);
            }
            .filter-group {
                display: flex;
                flex-direction: column;
                gap: 4px;
            }
            .filter-group label {
                font-size: 11px;
                font-weight: 600;
                text-transform: uppercase;
                color: var(--vscode-descriptionForeground);
            }
            .filter-group select,
            .filter-group input {
                padding: 6px 8px;
                border: 1px solid var(--vscode-input-border);
                background-color: var(--vscode-input-background);
                color: var(--vscode-input-foreground);
                border-radius: 4px;
                font-size: 13px;
                min-width: 150px;
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
                position: sticky;
                top: 0;
            }

            tr:last-child td {
                border-bottom: none;
            }

            .table-row:hover td {
                background-color: var(--vscode-list-hoverBackground);
            }

            /* States */
            .state-indicator {
                width: 10px;
                height: 10px;
                border-radius: 50%;
                margin-right: 8px;
                display: inline-block;
            }
            
            .state-success { background-color: var(--vscode-testing-iconPassed); }
            .state-failed { background-color: var(--vscode-errorForeground); }
            .state-running { background-color: var(--vscode-charts-blue); }
            .state-queued { background-color: var(--vscode-charts-yellow); }
            .state-upstream_failed { background-color: var(--vscode-charts-orange); }
            .state-skipped { background-color: var(--vscode-disabledForeground); }
            .state-deferred { background-color: var(--vscode-charts-purple); }

            a {
                color: var(--vscode-textLink-foreground);
                text-decoration: none;
                cursor: pointer;
            }
            a:hover {
                text-decoration: underline;
                color: var(--vscode-textLink-activeForeground);
            }

            .duration-badge {
                font-family: 'Courier New', monospace;
                font-size: 12px;
                opacity: 0.8;
            }

            .code-block {
                font-family: var(--vscode-editor-font-family);
                background-color: var(--vscode-textBlockQuote-background);
                padding: 4px;
                border-radius: 4px;
            }
        </style>
        <title>Daily DAG Runs</title>
      </head>
      <body>  
        <h2>Daily DAG Runs</h2>
        
        <div class="filters">
            <div class="filter-group">
                <label>Date</label>
                <input type="date" id="filter-date" value="${this.selectedDate}">
            </div>
            <div class="filter-group">
                <label>Status</label>
                <select id="filter-status">
                    <option value="">All</option>
                    <option value="success">Success</option>
                    <option value="failed">Failed</option>
                    <option value="running">Running</option>
                    <option value="queued">Queued</option>
                    <option value="upstream_failed">Upstream Failed</option>
                </select>
            </div>
            <div class="filter-group">
                <label>DAG ID</label>
                <select id="filter-dag-id">
                    <option value="">All DAGs</option>
                    ${dagIdOptions}
                </select>
            </div>
        </div>
        
        <table>
            <thead>
                <tr>
                    <th>DAG ID</th>
                    <th>Status</th>
                    <th>Actions</th>
                    <th>Start Date</th>
                    <th>Duration</th>
                    <th>Config</th>
                    <th>Note</th>
                </tr>
            </thead>
            <tbody>
            ${tableRows || '<tr><td colspan="7" style="text-align:center; padding: 20px; opacity: 0.7;">No runs found for the selected filters</td></tr>'}        
            </tbody>
        </table>

        <script>
            const vscode = acquireVsCodeApi();

            document.getElementById('filter-date').addEventListener('change', (e) => {
                vscode.postMessage({ command: 'filter-date', date: e.target.value });
            });

            document.getElementById('filter-status').addEventListener('change', (e) => {
                vscode.postMessage({ command: 'filter-status', status: e.target.value });
            });

            document.getElementById('filter-dag-id').addEventListener('change', (e) => {
                vscode.postMessage({ command: 'filter-dag-id', dagId: e.target.value });
            });

            // Handle dag-link clicks
            document.querySelectorAll('.dag-link').forEach(link => {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    // Handle clicks on child elements
                    const target = e.target.closest('a') || e.target;
                    const dagId = target.getAttribute('data-dag-id');
                    const dagRunId = target.getAttribute('data-dag-run-id');
                    vscode.postMessage({ command: 'open-dag-view', dagId, dagRunId });
                });
            });

            // Handle dag-log-link clicks
            document.querySelectorAll('.dag-log-link').forEach(link => {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    const target = e.target.closest('a') || e.target;
                    const dagId = target.getAttribute('data-dag-id');
                    const dagRunId = target.getAttribute('data-dag-run-id');
                    vscode.postMessage({ command: 'view-dag-log', dagId, dagRunId });
                });
            });
        </script>
      </body>
    </html>
    `;

        return result;
    }

    private _escapeHtml(text: string): string {
        const map: { [key: string]: string } = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return String(text).replace(/[&<>"']/g, m => map[m]);
    }

    private _getStatusEmoji(status: string): string {
        const statusMap: { [key: string]: string } = {
            'success': '✅',
            'failed': '❌',
            'running': '▶️',
            'queued': '⏳',
            'upstream_failed': '⚠️',
            'skipped': '⏭️',
            'deferred': '🔄'
        };
        return statusMap[status.toLowerCase()] || '📅';
    }

    private _setWebviewMessageListener(webview: vscode.Webview) {
        ui.logToOutput('DailyDagRunView._setWebviewMessageListener Started');
        Telemetry.Current.send('DailyDagRunView._setWebviewMessageListener.called');
        webview.onDidReceiveMessage(
            (message: any) => {
                ui.logToOutput('DailyDagRunView._setWebviewMessageListener Message Received ' + message.command);
                switch (message.command) {
                    case "filter-date":
                        this.selectedDate = message.date;
                        this.loadData();
                        return;
                    case "filter-status":
                        this.selectedStatus = message.status;
                        this.renderHtml();
                        return;
                    case "filter-dag-id":
                        this.selectedDagId = message.dagId;
                        this.loadData();
                        return;
                    case "open-dag-view":
                        // Open DagView with specific dag and run
                        if (Session.Current.Api && message.dagId) {
                            DagView.render(message.dagId, message.dagRunId);
                        }
                        return;
                    case "view-dag-log":
                        if (message.dagId) {
                            DagLogView.render(message.dagId, message.dagRunId);
                        }
                        return;
                }
            },
            undefined,
            this._disposables
        );
    }
}
