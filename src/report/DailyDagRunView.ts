/* eslint-disable @typescript-eslint/naming-convention */
import * as vscode from "vscode";
import * as ui from '../common/UI';
import { AirflowApi } from '../common/Api';
import { DagView } from '../dag/DagView';

export class DailyDagRunView {
    public static Current: DailyDagRunView | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];
    private extensionUri: vscode.Uri;
    private dagRunsJson: any;
    private api: AirflowApi;
    
    // Filters
    private selectedDate: string = ui.toISODateString(new Date());
    private selectedStatus: string = '';
    private selectedDagId: string = '';
    private allDagIds: string[] = [];

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, api: AirflowApi) {
        ui.logToOutput('DailyDagRunView.constructor Started');
        this.extensionUri = extensionUri;
        this._panel = panel;
        this.api = api;
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        this._setWebviewMessageListener(this._panel.webview);
        this.loadData();
        ui.logToOutput('DailyDagRunView.constructor Completed');
    }

    public async loadData() {
        ui.logToOutput('DailyDagRunView.loadData Started');

        // Fetch all DAGs to populate dag_id filter
        const dagsResult = await this.api.getDagList();
        if (dagsResult.isSuccessful && Array.isArray(dagsResult.result)) {
            this.allDagIds = dagsResult.result.map((dag: any) => dag.dag_id).sort();
        }

        // Fetch DAG runs for the selected date
        // If a specific DAG is selected, query that DAG, otherwise query all
        if (this.selectedDagId) {
            const result = await this.api.getDagRunHistory(this.selectedDagId, this.selectedDate);
            if (result.isSuccessful && result.result && result.result.dag_runs) {
                this.dagRunsJson = result.result.dag_runs;
            }
        } else {
            // Query all DAGs for runs on the selected date
            const allRuns: any[] = [];
            for (const dagId of this.allDagIds) {
                const result = await this.api.getDagRunHistory(dagId, this.selectedDate);
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
        this._panel.webview.html = this._getWebviewContent(this._panel.webview, this.extensionUri);
        ui.logToOutput('DailyDagRunView.renderHtml Completed');
    }

    public static render(extensionUri: vscode.Uri, api: AirflowApi) {
        ui.logToOutput('DailyDagRunView.render Started');
        if (DailyDagRunView.Current) {
            DailyDagRunView.Current.api = api;
            DailyDagRunView.Current._panel.reveal(vscode.ViewColumn.One);
            DailyDagRunView.Current.loadData();
        } else {
            const panel = vscode.window.createWebviewPanel("dailyDagRunView", "Daily DAG Runs", vscode.ViewColumn.One, {
                enableScripts: true,
            });

            DailyDagRunView.Current = new DailyDagRunView(panel, extensionUri, api);
        }
    }

    public dispose() {
        ui.logToOutput('DailyDagRunView.dispose Started');
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

        const elementsUri = ui.getUri(webview, extensionUri, [
            "node_modules",
            "@vscode-elements",
            "elements",
            "dist",
            "bundled.js",
        ]);

        const mainUri = ui.getUri(webview, extensionUri, ["media", "main.js"]);
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

            const statusEmoji = this._getStatusEmoji(status);

            tableRows += `
            <vscode-table-row>
                <vscode-table-cell><a href="#" data-dag-id="${this._escapeHtml(dagId)}" data-dag-run-id="${this._escapeHtml(dagRunId)}" class="dag-link">${this._escapeHtml(dagId)}</a></vscode-table-cell>
                <vscode-table-cell>${statusEmoji} ${this._escapeHtml(status)}</vscode-table-cell>
                <vscode-table-cell>${this._escapeHtml(startDate)}</vscode-table-cell>
                <vscode-table-cell>${this._escapeHtml(duration)}</vscode-table-cell>
                <vscode-table-cell><code>${this._escapeHtml(config.substring(0, 50))}${config.length > 50 ? '...' : ''}</code></vscode-table-cell>
                <vscode-table-cell>${this._escapeHtml(note)}</vscode-table-cell>
            </vscode-table-row>`;
        });

        // Build dag_id filter options
        const dagIdOptions = this.allDagIds.map(id => `<option value="${this._escapeHtml(id)}">${this._escapeHtml(id)}</option>`).join('');

        const result = /*html*/ `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width,initial-scale=1.0">
        <script type="module" src="${elementsUri}"></script>
        <script type="module" src="${mainUri}"></script>
        <link rel="stylesheet" href="${styleUri}">
        <style>
            body {
                padding: 16px;
            }
            h2 {
                margin-top: 0;
            }
            .filters {
                display: flex;
                gap: 12px;
                margin-bottom: 16px;
                flex-wrap: wrap;
                align-items: center;
            }
            .filter-group {
                display: flex;
                flex-direction: column;
                gap: 4px;
            }
            .filter-group label {
                font-size: 12px;
                font-weight: 600;
                text-transform: uppercase;
                opacity: 0.8;
            }
            .filter-group select,
            .filter-group input {
                padding: 6px 8px;
                border: 1px solid var(--vscode-input-border);
                background-color: var(--vscode-input-background);
                color: var(--vscode-input-foreground);
                border-radius: 4px;
                font-size: 13px;
            }
            vscode-table {
                width: 100%;
                max-height: 600px;
                overflow-y: auto;
            }
            vscode-table-cell {
                word-wrap: break-word;
                white-space: normal;
            }
            vscode-table-cell:first-child {
                white-space: nowrap;
            }
            code {
                background-color: var(--vscode-editor-background);
                color: var(--vscode-editor-foreground);
                padding: 2px 4px;
                border-radius: 3px;
                font-family: monospace;
                font-size: 11px;
            }
            a {
                color: var(--vscode-textLink-foreground);
                text-decoration: none;
                cursor: pointer;
            }
            a:hover {
                text-decoration: underline;
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
        
        <vscode-table zebra bordered-columns resizable>
            <vscode-table-header  slot="header">
                <vscode-table-header-cell>DAG ID</vscode-table-header-cell>
                <vscode-table-header-cell>Status</vscode-table-header-cell>
                <vscode-table-header-cell>Start Date</vscode-table-header-cell>
                <vscode-table-header-cell>Duration</vscode-table-header-cell>
                <vscode-table-header-cell>Config</vscode-table-header-cell>
                <vscode-table-header-cell>Note</vscode-table-header-cell>
            </vscode-table-header>
            <vscode-table-body slot="body">
            ${tableRows || '<vscode-table-row><vscode-table-cell colspan="6">No runs found for the selected filters</vscode-table-cell></vscode-table-row>'}        
            </vscode-table-body>
        </vscode-table>

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
                    const dagId = e.target.getAttribute('data-dag-id');
                    const dagRunId = e.target.getAttribute('data-dag-run-id');
                    vscode.postMessage({ command: 'open-dag-view', dagId, dagRunId });
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
                        if (this.api && message.dagId) {
                            DagView.render(this.extensionUri, message.dagId, this.api, message.dagRunId);
                        }
                        return;
                }
            },
            undefined,
            this._disposables
        );
    }
}
