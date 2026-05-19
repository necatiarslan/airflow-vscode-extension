import * as vscode from "vscode";
import * as ui from '../common/UI';
import { Session } from '../common/Session';

const CONN_TYPES = [
    'aws', 'azure', 'gcp', 'google_cloud_platform', 'postgres', 'mysql', 'sqlite',
    'http', 'https', 'ftp', 'sftp', 'ssh', 's3', 'mongo', 'redis', 'docker',
    'kubernetes', 'spark', 'hive', 'hdfs', 'jdbc', 'odbc', 'generic',
];

export class ConnectionsView {
    public static Current: ConnectionsView;
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];
    private connectionsJson: any;

    private constructor(panel: vscode.WebviewPanel) {
        ui.logToOutput('ConnectionsView.constructor Started');
        this._panel = panel;
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        this._setWebviewMessageListener(this._panel.webview);
        this.loadData();
    }

    public async loadData() {
        if (!Session.Current.Api) { return; }
        const result = await Session.Current.Api!.getConnections();
        if (result.isSuccessful) {
            this.connectionsJson = result.result;
        }
        await this.renderHtml();
    }

    public async renderHtml() {
        this._panel.webview.html = this._getWebviewContent(this._panel.webview, Session.Current.ExtensionUri!);
    }

    public static render() {
        if (ConnectionsView.Current) {
            ConnectionsView.Current._panel.reveal(vscode.ViewColumn.One);
            ConnectionsView.Current.loadData();
        } else {
            const panel = vscode.window.createWebviewPanel("connectionsView", "Connections", vscode.ViewColumn.One, {
                enableScripts: true,
            });
            ConnectionsView.Current = new ConnectionsView(panel);
        }
    }

    public dispose() {
        ConnectionsView.Current = undefined as unknown as ConnectionsView;
        this._panel.dispose();
        while (this._disposables.length) {
            const d = this._disposables.pop();
            if (d) { d.dispose(); }
        }
    }

    private _getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri) {
        const elementsUri = ui.getUri(webview, extensionUri, [
            "node_modules", "@vscode-elements", "elements", "dist", "bundled.js",
        ]);
        const mainUri = ui.getUri(webview, extensionUri, ["media", "main.js"]);
        const styleUri = ui.getUri(webview, extensionUri, ["media", "style.css"]);

        let tableRows = '';
        const connections: any[] = (this.connectionsJson?.connections) ?? [];
        for (const conn of connections) {
            const connId = this._escapeHtml(conn.conn_id || '');
            const connType = this._escapeHtml(conn.conn_type || '');
            const host = this._escapeHtml(conn.host || '');
            const port = this._escapeHtml(String(conn.port || ''));
            const schema = this._escapeHtml(conn.schema || '');
            const login = this._escapeHtml(conn.login || '');
            tableRows += `
            <tr class="table-row">
                <td><strong>${connId}</strong></td>
                <td><span class="tag">${connType}</span></td>
                <td>${host}</td>
                <td>${port}</td>
                <td>${schema}</td>
                <td>${login}</td>
                <td class="action-cell">
                    <vscode-button appearance="secondary" class="test-btn"
                        data-connid="${connId}" data-conntype="${connType}"
                        data-host="${host}" data-port="${conn.port || ''}"
                        data-schema="${schema}" data-login="${login}"
                        title="Test connection">🔌</vscode-button>
                    <vscode-button appearance="secondary" class="edit-btn"
                        data-connid="${connId}" data-conntype="${connType}"
                        data-host="${host}" data-port="${conn.port || ''}"
                        data-schema="${schema}" data-login="${login}"
                        title="Edit connection">✏️</vscode-button>
                    <vscode-button appearance="secondary" class="delete-btn"
                        data-connid="${connId}" title="Delete connection">🗑️</vscode-button>
                </td>
            </tr>`;
        }

        return /*html*/ `
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
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
        }
        .header-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 24px;
            border-bottom: 1px solid var(--vscode-widget-border);
            padding-bottom: 16px;
        }
        h2 { margin: 0; font-size: 18px; font-weight: 600; }
        .controls { display: flex; gap: 8px; }
        table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 13px; }
        th, td { padding: 6px 10px; text-align: left; border-bottom: 1px solid var(--vscode-widget-border); }
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
        tr:last-child td { border-bottom: none; }
        .table-row:hover td { background-color: var(--vscode-list-hoverBackground); }
        .tag {
            background-color: var(--vscode-textBlockQuote-background);
            color: var(--vscode-textBlockQuote-border);
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 11px;
            border: 1px solid var(--vscode-widget-border);
        }
        .action-cell { white-space: nowrap; width: 100px; }
        .action-cell vscode-button { margin-right: 2px; }
        .count-badge {
            background: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            padding: 2px 8px;
            border-radius: 10px;
            font-size: 11px;
            margin-left: 8px;
        }
    </style>
    <title>Connections</title>
  </head>
  <body>
    <div class="header-row">
        <h2>Airflow Connections <span class="count-badge">${this.connectionsJson?.total_entries ?? 0}</span></h2>
        <div class="controls">
            <vscode-button appearance="primary" id="create-connection">＋ New Connection</vscode-button>
            <vscode-button appearance="secondary" id="refresh-connections">↻ Refresh</vscode-button>
        </div>
    </div>

    <table>
        <thead>
            <tr>
                <th>Conn ID</th>
                <th>Type</th>
                <th>Host</th>
                <th>Port</th>
                <th>Schema</th>
                <th>Login</th>
                <th>Actions</th>
            </tr>
        </thead>
        <tbody>
            ${tableRows || '<tr><td colspan="7" style="text-align:center;padding:20px;opacity:0.7;">No connections found</td></tr>'}
        </tbody>
    </table>

    <script>
        const vscode = acquireVsCodeApi();

        document.getElementById('refresh-connections').addEventListener('click', () => {
            vscode.postMessage({ command: 'refresh-connections' });
        });

        document.getElementById('create-connection').addEventListener('click', () => {
            vscode.postMessage({ command: 'create-connection' });
        });

        document.querySelectorAll('.test-btn').forEach(btn => {
            btn.addEventListener('click', e => {
                const b = e.currentTarget;
                vscode.postMessage({
                    command: 'test-connection',
                    connId: b.getAttribute('data-connid'),
                    connType: b.getAttribute('data-conntype'),
                    host: b.getAttribute('data-host'),
                    port: b.getAttribute('data-port'),
                    schema: b.getAttribute('data-schema'),
                    login: b.getAttribute('data-login'),
                });
            });
        });

        document.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', e => {
                const b = e.currentTarget;
                vscode.postMessage({
                    command: 'edit-connection',
                    connId: b.getAttribute('data-connid'),
                    connType: b.getAttribute('data-conntype'),
                    host: b.getAttribute('data-host'),
                    port: b.getAttribute('data-port'),
                    schema: b.getAttribute('data-schema'),
                    login: b.getAttribute('data-login'),
                });
            });
        });

        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', e => {
                const b = e.currentTarget;
                vscode.postMessage({ command: 'delete-connection', connId: b.getAttribute('data-connid') });
            });
        });
    </script>
  </body>
</html>`;
    }

    private _escapeHtml(text: string): string {
        if (!text) { return ''; }
        const map: { [k: string]: string } = {
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
        };
        return String(text).replace(/[&<>"']/g, m => map[m]);
    }

    /** Interactive multi-step input to collect all connection fields. */
    private async _promptConnectionFields(defaults?: { connId?: string; connType?: string; host?: string; port?: string; schema?: string; login?: string; description?: string }): Promise<{ conn_id: string; conn_type: string; host?: string; port?: number; schema?: string; login?: string; password?: string; description?: string } | undefined> {
        const connId = await vscode.window.showInputBox({
            title: 'Connection ID',
            prompt: 'Unique identifier for this connection',
            value: defaults?.connId ?? '',
            placeHolder: 'my_postgres_conn',
        });
        if (connId === undefined) { return undefined; }

        const connType = await vscode.window.showQuickPick(CONN_TYPES, {
            title: 'Connection Type',
            placeHolder: 'Select connection type',
        });
        if (!connType) { return undefined; }

        const host = await vscode.window.showInputBox({ title: 'Host', value: defaults?.host ?? '', placeHolder: 'localhost' });
        if (host === undefined) { return undefined; }

        const portStr = await vscode.window.showInputBox({ title: 'Port (optional)', value: defaults?.port ?? '', placeHolder: '5432' });
        if (portStr === undefined) { return undefined; }
        const port = portStr ? parseInt(portStr, 10) : undefined;

        const schema = await vscode.window.showInputBox({ title: 'Schema / Database (optional)', value: defaults?.schema ?? '', placeHolder: 'my_database' });
        if (schema === undefined) { return undefined; }

        const login = await vscode.window.showInputBox({ title: 'Login (optional)', value: defaults?.login ?? '', placeHolder: 'username' });
        if (login === undefined) { return undefined; }

        const password = await vscode.window.showInputBox({ title: 'Password (optional)', password: true, placeHolder: '••••••••' });
        if (password === undefined) { return undefined; }

        const description = await vscode.window.showInputBox({ title: 'Description (optional)', value: defaults?.description ?? '' });
        if (description === undefined) { return undefined; }

        return { conn_id: connId, conn_type: connType, host: host || undefined, port, schema: schema || undefined, login: login || undefined, password: password || undefined, description: description || undefined };
    }

    private _setWebviewMessageListener(webview: vscode.Webview) {
        webview.onDidReceiveMessage(
            async (message: any) => {
                ui.logToOutput('ConnectionsView message: ' + message.command);
                if (!Session.Current.Api) { return; }

                switch (message.command) {
                    case 'refresh-connections':
                        await this.loadData();
                        return;

                    case 'create-connection': {
                        const fields = await this._promptConnectionFields();
                        if (!fields) { return; }
                        const result = await Session.Current.Api!.createConnection(fields as any);
                        if (result.isSuccessful) {
                            ui.showInfoMessage(`Connection "${fields.conn_id}" created.`);
                            await this.loadData();
                        }
                        return;
                    }

                    case 'edit-connection': {
                        const { connId, connType, host, port, schema, login } = message;
                        const fields = await this._promptConnectionFields({ connId, connType, host, port, schema, login });
                        if (!fields) { return; }
                        const result = await Session.Current.Api!.updateConnection(connId, fields as any);
                        if (result.isSuccessful) {
                            ui.showInfoMessage(`Connection "${connId}" updated.`);
                            await this.loadData();
                        }
                        return;
                    }

                    case 'delete-connection': {
                        const { connId } = message;
                        const confirm = await vscode.window.showWarningMessage(
                            `Delete connection "${connId}"?`, { modal: true }, 'Delete'
                        );
                        if (confirm !== 'Delete') { return; }
                        const result = await Session.Current.Api!.deleteConnection(connId);
                        if (result.isSuccessful) {
                            ui.showInfoMessage(`Connection "${connId}" deleted.`);
                            await this.loadData();
                        }
                        return;
                    }

                    case 'test-connection': {
                        const { connId, connType, host, port, schema, login } = message;
                        const password = await vscode.window.showInputBox({
                            title: `Test Connection: ${connId}`,
                            prompt: 'Enter password for testing (not stored)',
                            password: true,
                            placeHolder: '••••••••',
                        });
                        if (password === undefined) { return; }

                        const body: any = { conn_id: connId, conn_type: connType };
                        if (host) { body.host = host; }
                        if (port) { body.port = parseInt(port, 10); }
                        if (schema) { body.schema = schema; }
                        if (login) { body.login = login; }
                        if (password) { body.password = password; }

                        const result = await Session.Current.Api!.testConnection(body);
                        if (result.isSuccessful) {
                            const status = result.result?.status;
                            const msg = result.result?.message || 'OK';
                            if (status === true) {
                                ui.showInfoMessage(`✅ Connection "${connId}" test passed: ${msg}`);
                            } else {
                                ui.showWarningMessage(`❌ Connection "${connId}" test failed: ${msg}`);
                            }
                        }
                        return;
                    }
                }
            },
            undefined,
            this._disposables
        );
    }
}
