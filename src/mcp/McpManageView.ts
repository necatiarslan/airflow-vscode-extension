import * as vscode from 'vscode';
import * as path from 'path';
import * as ui from '../common/UI';
import { McpManager } from './McpManager';

interface McpManageSnapshot {
    host: string;
    port: number;
}

export class McpManageView {
    public static Current: McpManageView | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private readonly _disposables: vscode.Disposable[] = [];
    private readonly extensionUri: vscode.Uri;
    private readonly manager: McpManager;

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, manager: McpManager) {
        this.extensionUri = extensionUri;
        this.manager = manager;
        this._panel = panel;
        this._panel.onDidDispose(this.dispose, null, this._disposables);
        this._setWebviewMessageListener(this._panel.webview);
        void this.RenderHtml();
    }

    public static Render(extensionUri: vscode.Uri, manager: McpManager) {
        if (McpManageView.Current) {
            McpManageView.Current._panel.reveal(vscode.ViewColumn.One);
            void McpManageView.Current.RenderHtml();
        } else {
            const panel = vscode.window.createWebviewPanel(
                'McpManageView',
                'MCP Server Manager',
                vscode.ViewColumn.One,
                { enableScripts: true }
            );
            McpManageView.Current = new McpManageView(panel, extensionUri, manager);
        }
    }

    public async RenderHtml() {
        const settings = this.getSnapshot();
        const snippet = this.buildConfigSnippet(settings);
        this._panel.webview.html = this._getWebviewContent(this._panel.webview, settings, snippet);
    }

    private getSnapshot(): McpManageSnapshot {
        const snapshot = this.manager.getSettingsSnapshot();
        return {
            host: snapshot.host || '127.0.0.1',
            port: snapshot.port || 37115,
        };
    }

    private buildConfigSnippet(snapshot: McpManageSnapshot): string {
        const cliPath = path.join(this.extensionUri.fsPath, 'out', 'mcp', 'cli.js');
        const normalizedPath = cliPath.replace(/\\/g, '/');
        const config = {
            mcpServers: {
                'airflow': {
                    command: 'node',
                    args: [normalizedPath],
                    env: {
                        AIRFLOW_MCP_PORT: String(snapshot.port),
                        AIRFLOW_MCP_HOST: snapshot.host
                    }
                }
            }
        };
        return JSON.stringify(config, null, 2);
    }

    private _getWebviewContent(webview: vscode.Webview, snapshot: McpManageSnapshot, configSnippet: string) {
        const vscodeElementsUri = ui.getUri(webview, this.extensionUri, ['node_modules', '@vscode-elements', 'elements', 'dist', 'bundled.js']);
        const codiconsUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'node_modules', '@vscode', 'codicons', 'dist', 'codicon.css'));
        const escapedSnippet = this.escapeHtml(configSnippet);
        const hostValue = this.escapeHtml(snapshot.host);
        const portValue = snapshot.port;

        return /*html*/ `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width,initial-scale=1.0">
            <script type="module" src="${vscodeElementsUri}"></script>
            <link href="${codiconsUri}" rel="stylesheet" id="vscode-codicon-stylesheet"/>
            <title>MCP Server Manager</title>
            <style>
                body {
                    margin: 0;
                    padding: 16px 18px 32px 18px;
                    background: radial-gradient(circle at 20% 20%, rgba(76, 164, 255, 0.08), transparent 35%),
                                radial-gradient(circle at 80% 0%, rgba(255, 162, 76, 0.12), transparent 40%),
                                var(--vscode-editor-background);
                    color: var(--vscode-foreground);
                    font-family: 'JetBrains Mono', 'SFMono-Regular', Menlo, Monaco, Consolas, monospace;
                }
                h1 { margin: 4px 0 8px 0; font-size: 22px; letter-spacing: 0.5px; }
                h2 { margin: 0 0 8px 0; font-size: 16px; }
                .eyebrow { text-transform: uppercase; letter-spacing: 1.2px; font-size: 11px; color: var(--vscode-descriptionForeground); }
                .hero {
                    display: flex; align-items: center; justify-content: space-between; gap: 12px;
                    margin-bottom: 14px; padding: 14px 16px; border-radius: 10px;
                    background: linear-gradient(120deg, rgba(76, 164, 255, 0.16), rgba(255, 214, 102, 0.12));
                    border: 1px solid var(--vscode-input-border, rgba(255,255,255,0.08));
                }
                .sub { margin: 0; color: var(--vscode-descriptionForeground); }
                .pill {
                    padding: 6px 10px; border-radius: 999px;
                    background: var(--vscode-editorWidget-background);
                    border: 1px solid var(--vscode-input-border, rgba(255,255,255,0.1));
                    display: inline-flex; align-items: center; gap: 8px; font-size: 12px;
                }
                .pill .dot {
                    width: 10px; height: 10px; border-radius: 50%;
                    background: var(--status-color, var(--vscode-input-border));
                    box-shadow: 0 0 0 4px rgba(0,0,0,0.08);
                }
                .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 14px; }
                .card {
                    padding: 14px 16px; background: var(--vscode-editorWidget-background);
                    border-radius: 10px; border: 1px solid var(--vscode-input-border, rgba(255,255,255,0.08));
                    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.18);
                }
                .row { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
                .inputs { display: grid; grid-template-columns: 1fr 120px auto; gap: 10px; align-items: end; }
                .actions { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
                pre {
                    margin: 10px 0 0 0; padding: 12px;
                    background: rgba(255,255,255,0.02);
                    border: 1px dashed var(--vscode-input-border, rgba(255,255,255,0.1));
                    border-radius: 8px; overflow-x: auto; white-space: pre;
                }
                .muted { color: var(--vscode-descriptionForeground); font-size: 12px; }
                .status-box {
                    margin-top: 10px; padding: 10px; border-radius: 8px;
                    border: 1px solid var(--vscode-input-border, rgba(255,255,255,0.1));
                    background: linear-gradient(90deg, rgba(76, 164, 255, 0.08), transparent);
                }
                .status-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 8px; margin-top: 8px; }
                .status-tile {
                    padding: 10px; border-radius: 8px; background: rgba(255,255,255,0.02);
                    border: 1px solid var(--vscode-input-border, rgba(255,255,255,0.08));
                }
                .badge {
                    display: inline-flex; align-items: center; gap: 6px; padding: 4px 8px;
                    border-radius: 6px; background: rgba(255, 214, 102, 0.15);
                    color: var(--vscode-descriptionForeground); font-size: 12px;
                }
                vscode-text-field::part(input) {
                    font-family: 'JetBrains Mono', 'SFMono-Regular', Menlo, Monaco, Consolas, monospace;
                }
            </style>
        </head>
        <body>
            <div class="hero">
                <div>
                    <div class="eyebrow">Model Context Protocol</div>
                    <h1>MCP Server Manager</h1>
                    <p class="sub">Start, inspect, and share the MCP bridge configuration.</p>
                </div>
                <div class="pill" id="status-pill" style="--status-color: var(--vscode-descriptionForeground);">
                    <span class="dot"></span>
                    <span id="status-label">Status: Unknown</span>
                </div>
            </div>

            <div class="grid">
                <div class="card">
                    <div class="row" style="justify-content: space-between;">
                        <h2>Bridge Endpoint</h2>
                        <div class="badge"><span class="codicon codicon-server-process"></span>TCP bridge</div>
                    </div>
                    <div class="inputs">
                        <vscode-text-field id="host-input" value="${hostValue}" placeholder="127.0.0.1" size="small" label="Host"></vscode-text-field>
                        <vscode-text-field id="port-input" value="${portValue}" type="number" placeholder="37115" size="small" label="Port"></vscode-text-field>
                        <vscode-button appearance="secondary" id="save-endpoint">Save endpoint</vscode-button>
                    </div>
                    <div class="muted" style="margin-top: 6px;">Changes persist in extension settings and take effect immediately.</div>
                </div>

                <div class="card">
                    <div class="row" style="justify-content: space-between;">
                        <h2>Server Controls</h2>
                        <div class="badge"><span class="codicon codicon-gear"></span>Sessions auto-cap aware</div>
                    </div>
                    <div class="actions">
                        <vscode-button appearance="primary" id="start-server"><span class="codicon codicon-play"></span>&nbsp;Start server</vscode-button>
                        <vscode-button appearance="secondary" id="stop-server"><span class="codicon codicon-stop"></span>&nbsp;Stop server</vscode-button>
                        <vscode-button appearance="secondary" id="check-server"><span class="codicon codicon-pulse"></span>&nbsp;Check server</vscode-button>
                    </div>
                    <div class="status-box" id="status-box">
                        <div class="muted">Status updates will appear here.</div>
                        <div class="status-grid">
                            <div class="status-tile"><strong>Host</strong><div id="status-host" class="muted">${hostValue}</div></div>
                            <div class="status-tile"><strong>Port</strong><div id="status-port" class="muted">${portValue}</div></div>
                            <div class="status-tile"><strong>Sessions</strong><div id="status-sessions" class="muted">0 active</div></div>
                            <div class="status-tile"><strong>Queue</strong><div id="status-queue" class="muted">0 waiting</div></div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="card" style="margin-top: 14px;">
                <div class="row" style="justify-content: space-between; align-items: center;">
                    <div>
                        <h2>mcp_config.json</h2>
                        <div class="muted">Share this snippet with MCP clients (Antigravity, Windsurf, etc.).</div>
                    </div>
                    <vscode-button id="copy-config" appearance="secondary"><span class="codicon codicon-clippy"></span>&nbsp;Copy snippet</vscode-button>
                </div>
                <pre id="config-snippet">${escapedSnippet}</pre>
            </div>

            <script>
                const vscode = acquireVsCodeApi();
                const statusLabel = document.getElementById('status-label');
                const statusPill = document.getElementById('status-pill');
                const statusBox = document.getElementById('status-box');
                const statusHost = document.getElementById('status-host');
                const statusPort = document.getElementById('status-port');
                const statusSessions = document.getElementById('status-sessions');
                const statusQueue = document.getElementById('status-queue');
                const configSnippet = document.getElementById('config-snippet');
                const hostInput = document.getElementById('host-input');
                const portInput = document.getElementById('port-input');

                function updateStatus(payload) {
                    const running = !!payload.running;
                    const reachable = !!payload.reachable;
                    const tone = running && reachable ? 'var(--vscode-testing-iconPassed)' : running ? 'var(--vscode-testing-iconQueued)' : 'var(--vscode-errorForeground)';
                    statusPill.style.setProperty('--status-color', tone);
                    statusLabel.textContent = running ? (reachable ? 'Status: Online' : 'Status: Running (unreachable)') : 'Status: Stopped';
                    statusHost.textContent = payload.host;
                    statusPort.textContent = payload.port;
                    statusSessions.textContent = \`\${payload.activeSessions || 0} active\`;
                    statusQueue.textContent = \`\${payload.queuedConnections || 0} waiting\`;
                    if (payload.message) {
                        statusBox.querySelector('.muted').textContent = payload.message;
                    } else {
                        statusBox.querySelector('.muted').textContent = running ? 'Bridge is up. Use the snippet below to connect.' : 'Server is idle.';
                    }
                }

                function requestStatus() {
                    vscode.postMessage({ command: 'check' });
                }

                document.getElementById('start-server').addEventListener('click', () => {
                    vscode.postMessage({ command: 'start' });
                });

                document.getElementById('stop-server').addEventListener('click', () => {
                    vscode.postMessage({ command: 'stop' });
                });

                document.getElementById('check-server').addEventListener('click', () => {
                    requestStatus();
                });

                document.getElementById('save-endpoint').addEventListener('click', () => {
                    const host = hostInput.value.trim();
                    const port = Number(portInput.value);
                    vscode.postMessage({ command: 'saveEndpoint', host, port });
                });

                document.getElementById('copy-config').addEventListener('click', () => {
                    vscode.postMessage({ command: 'copyConfig' });
                });

                window.addEventListener('message', event => {
                    const message = event.data || {};
                    if (message.type === 'status') {
                        updateStatus(message.payload);
                    }
                    if (message.type === 'configSnippet') {
                        configSnippet.textContent = message.payload;
                    }
                });

                requestStatus();
            </script>
        </body>
        </html>
        `;
    }

    private _setWebviewMessageListener(webview: vscode.Webview) {
        webview.onDidReceiveMessage(
            async (message: any) => {
                try {
                    switch (message.command) {
                        case 'start':
                            await this.manager.startBridge();
                            if (this.manager.getActiveSessionCount() === 0) {
                                await this.manager.startSession();
                            }
                            await this.postStatus();
                            return;
                        case 'stop':
                            this.manager.stopAll();
                            await this.postStatus();
                            return;
                        case 'check':
                            await this.postStatus();
                            return;
                        case 'saveEndpoint':
                            await this.handleSaveEndpoint(message.host, message.port);
                            return;
                        case 'copyConfig':
                            await this.handleCopyConfig();
                            return;
                    }
                } catch (error: any) {
                    ui.showErrorMessage('MCP Manager error', error);
                }
            },
            undefined,
            this._disposables
        );
    }

    private async handleSaveEndpoint(host: string, port: number) {
        const sanitizedHost = (host || '').trim() || '127.0.0.1';
        const parsedPort = Number(port);
        if (!Number.isInteger(parsedPort) || parsedPort <= 0 || parsedPort > 65535) {
            ui.showErrorMessage('Port must be an integer between 1 and 65535');
            return;
        }
        await this.manager.updateEndpoint(sanitizedHost, parsedPort);
        const snippet = this.buildConfigSnippet({ host: sanitizedHost, port: parsedPort });
        this._panel.webview.postMessage({ type: 'configSnippet', payload: snippet });
        await this.postStatus();
        ui.showInfoMessage(`MCP endpoint set to ${sanitizedHost}:${parsedPort}`);
    }

    private async handleCopyConfig() {
        const snippet = this.buildConfigSnippet(this.getSnapshot());
        await vscode.env.clipboard.writeText(snippet);
        ui.showInfoMessage('mcp_config.json snippet copied to clipboard');
    }

    private async postStatus() {
        const status = await this.manager.checkStatus();
        this._panel.webview.postMessage({ type: 'status', payload: status });
    }

    private escapeHtml(value: string): string {
        return value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    public dispose() {
        McpManageView.Current = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }
}
