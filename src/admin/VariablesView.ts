import * as vscode from "vscode";
import * as ui from '../common/UI';
import { Session } from '../common/Session';

export class VariablesView {
    public static Current: VariablesView;
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];
    private variablesJson: any;

    private constructor(panel: vscode.WebviewPanel) {
        ui.logToOutput('VariablesView.constructor Started');

        this._panel = panel;
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        this._setWebviewMessageListener(this._panel.webview);
        this.loadData();
        ui.logToOutput('VariablesView.constructor Completed');
    }

    public async loadData() {
        ui.logToOutput('VariablesView.loadData Started');

        if (!Session.Current.Api) { return; }

        const result = await Session.Current.Api!.getVariables();
        if (result.isSuccessful) {
            this.variablesJson = result.result;
        }
        await this.renderHtml();
    }

    public async renderHtml() {
        ui.logToOutput('VariablesView.renderHtml Started');
        this._panel.webview.html = this._getWebviewContent(this._panel.webview, Session.Current.ExtensionUri!);
    }

    public static render() {
        ui.logToOutput('VariablesView.render Started');

        if (VariablesView.Current) {
            VariablesView.Current._panel.reveal(vscode.ViewColumn.One);
            VariablesView.Current.loadData();
        } else {
            const panel = vscode.window.createWebviewPanel("variablesView", "Variables", vscode.ViewColumn.One, {
                enableScripts: true,
            });
            VariablesView.Current = new VariablesView(panel);
        }
    }

    public dispose() {
        ui.logToOutput('VariablesView.dispose Started');
        VariablesView.Current = undefined as unknown as VariablesView;
        this._panel.dispose();
        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) { disposable.dispose(); }
        }
    }

    private _getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri) {
        const elementsUri = ui.getUri(webview, extensionUri, [
            "node_modules", "@vscode-elements", "elements", "dist", "bundled.js",
        ]);
        const mainUri = ui.getUri(webview, extensionUri, ["media", "main.js"]);
        const styleUri = ui.getUri(webview, extensionUri, ["media", "style.css"]);

        let tableRows = '';
        if (this.variablesJson && this.variablesJson.variables) {
            for (const variable of this.variablesJson.variables) {
                const key = variable.key || '';
                const value = variable.value !== undefined && variable.value !== null ? String(variable.value) : '';
                const description = variable.description || '';

                const escapedKey = this._escapeHtml(key);
                const escapedValue = this._escapeHtml(value);
                const escapedDescription = this._escapeHtml(description);
                tableRows += `
                <tr class="table-row" data-key="${escapedKey}">
                    <td>${escapedKey}</td>
                    <td><code>${escapedValue}</code></td>
                    <td>${escapedDescription}</td>
                    <td class="action-cell">
                        <vscode-button appearance="secondary" class="edit-btn" data-key="${escapedKey}" data-value="${escapedValue}" data-description="${escapedDescription}" title="Edit variable">✏️</vscode-button>
                        <vscode-button appearance="secondary" class="delete-btn" data-key="${escapedKey}" title="Delete variable">🗑️</vscode-button>
                    </td>
                </tr>`;
            }
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
        :root {
            --font-size-sm: 12px;
            --font-size-md: 13px;
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
        .header-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: var(--spacing-lg);
            border-bottom: 1px solid var(--vscode-widget-border);
            padding-bottom: var(--spacing-md);
        }
        h2 { margin: 0; font-size: 18px; font-weight: 600; }
        .controls { display: flex; gap: var(--spacing-sm); }
        table {
            width: 100%;
            border-collapse: separate;
            border-spacing: 0;
            font-size: var(--font-size-md);
        }
        th, td {
            padding: 6px 10px;
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
        tr:last-child td { border-bottom: none; }
        .table-row:hover td { background-color: var(--vscode-list-hoverBackground); }
        code {
            background-color: var(--vscode-textBlockQuote-background);
            color: var(--vscode-editor-foreground);
            padding: 2px 4px;
            border-radius: 3px;
            font-family: monospace;
            font-size: 11px;
            word-break: break-all;
        }
        .action-cell { white-space: nowrap; width: 80px; }
        .action-cell vscode-button { margin-right: 4px; }
        .count-badge {
            background: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            padding: 2px 8px;
            border-radius: 10px;
            font-size: 11px;
            margin-left: 8px;
        }
    </style>
    <title>Variables</title>
  </head>
  <body>
    <div class="header-row">
        <h2>Airflow Variables <span class="count-badge">${this.variablesJson?.total_entries ?? 0}</span></h2>
        <div class="controls">
            <vscode-button appearance="primary" id="create-variable">＋ New Variable</vscode-button>
            <vscode-button appearance="secondary" id="refresh-variables">↻ Refresh</vscode-button>
        </div>
    </div>

    <table>
        <thead>
            <tr>
                <th>Key</th>
                <th>Value</th>
                <th>Description</th>
                <th>Actions</th>
            </tr>
        </thead>
        <tbody>
        ${tableRows || '<tr><td colspan="4" style="text-align:center; padding: 20px; opacity: 0.7;">No variables found</td></tr>'}
        </tbody>
    </table>

    <script>
        const vscode = acquireVsCodeApi();

        document.getElementById('refresh-variables').addEventListener('click', () => {
            vscode.postMessage({ command: 'refresh-variables' });
        });

        document.getElementById('create-variable').addEventListener('click', () => {
            vscode.postMessage({ command: 'create-variable' });
        });

        document.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const b = e.currentTarget;
                vscode.postMessage({
                    command: 'edit-variable',
                    key: b.getAttribute('data-key'),
                    value: b.getAttribute('data-value'),
                    description: b.getAttribute('data-description')
                });
            });
        });

        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const b = e.currentTarget;
                vscode.postMessage({ command: 'delete-variable', key: b.getAttribute('data-key') });
            });
        });
    </script>
  </body>
</html>`;
    }

    private _escapeHtml(text: string): string {
        if (!text) { return ''; }
        const map: { [key: string]: string } = {
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
        };
        return String(text).replace(/[&<>"']/g, m => map[m]);
    }

    private _setWebviewMessageListener(webview: vscode.Webview) {
        webview.onDidReceiveMessage(
            async (message: any) => {
                ui.logToOutput('VariablesView message: ' + message.command);
                if (!Session.Current.Api) { return; }

                switch (message.command) {
                    case 'refresh-variables':
                        await this.loadData();
                        return;

                    case 'create-variable': {
                        const key = await vscode.window.showInputBox({ title: 'New Variable', prompt: 'Enter variable key', placeHolder: 'my_variable_key' });
                        if (!key) { return; }
                        const value = await vscode.window.showInputBox({ title: 'New Variable', prompt: `Enter value for "${key}"`, placeHolder: 'value' }) ?? '';
                        const description = await vscode.window.showInputBox({ title: 'New Variable', prompt: 'Enter description (optional)', placeHolder: 'description' });
                        const result = await Session.Current.Api!.createVariable(key, value, description);
                        if (result.isSuccessful) {
                            ui.showInfoMessage(`Variable "${key}" created.`);
                            await this.loadData();
                        }
                        return;
                    }

                    case 'edit-variable': {
                        const { key, value, description } = message;
                        const newValue = await vscode.window.showInputBox({ title: `Edit: ${key}`, prompt: 'New value', value: value });
                        if (newValue === undefined) { return; }
                        const newDesc = await vscode.window.showInputBox({ title: `Edit: ${key}`, prompt: 'Description (optional)', value: description });
                        const result = await Session.Current.Api!.updateVariable(key, newValue, newDesc);
                        if (result.isSuccessful) {
                            ui.showInfoMessage(`Variable "${key}" updated.`);
                            await this.loadData();
                        }
                        return;
                    }

                    case 'delete-variable': {
                        const { key } = message;
                        const confirm = await vscode.window.showWarningMessage(
                            `Delete variable "${key}"?`, { modal: true }, 'Delete'
                        );
                        if (confirm !== 'Delete') { return; }
                        const result = await Session.Current.Api!.deleteVariable(key);
                        if (result.isSuccessful) {
                            ui.showInfoMessage(`Variable "${key}" deleted.`);
                            await this.loadData();
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
