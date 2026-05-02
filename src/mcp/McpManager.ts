import * as vscode from 'vscode';
import * as net from 'net';
import { McpConfig } from './McpConfig';
import { McpDispatcher } from './McpDispatcher';
import { McpSession } from './McpSession';
import { McpBridgeServer } from './McpBridgeServer';
import * as ui from '../common/UI';

interface QueuedRequest {
    resolve: (value: McpSession | undefined) => void;
    reject: (reason?: any) => void;
}

export class McpManager implements vscode.Disposable {
    private readonly config: McpConfig;
    private nextSessionId = 1;
    private activeSessions: Map<number, { terminal: vscode.Terminal; session: McpSession }> = new Map();
    private queue: QueuedRequest[] = [];
    private disposed = false;
    private bridge?: McpBridgeServer;

    constructor(private readonly context: vscode.ExtensionContext) {
        this.config = new McpConfig(context.globalState);
    }

    public dispose(): void {
        this.disposed = true;
        this.stopAll();
    }

    public async startSession(): Promise<McpSession | undefined> {
        if (this.disposed) { return undefined; }

        const state = this.effectiveState();
        if (!state.enabled) {
            await this.config.updateEnabled(true);
        }

        this.ensureBridge(state);

        const cap = Math.max(1, state.sessionCap || 20);

        if (this.activeSessions.size >= cap) {
            return new Promise<McpSession | undefined>((resolve, reject) => {
                this.queue.push({ resolve, reject });
                ui.showInfoMessage(`MCP sessions at capacity (${cap}). Request queued.`);
            });
        }

        const sessionId = this.nextSessionId++;
        const dispatcher = new McpDispatcher(new Set(this.enabledTools()));
        const session = new McpSession(sessionId, dispatcher, (id) => this.onSessionClosed(id));
        const pty: vscode.Pseudoterminal = session;
        const terminal = vscode.window.createTerminal({ name: `Airflow MCP ${sessionId}`, pty });
        this.activeSessions.set(sessionId, { terminal, session });
        terminal.show(false);
        return session;
    }

    public async startBridge(): Promise<void> {
        if (this.disposed) { return; }
        const state = this.effectiveState();
        if (!state.enabled) {
            await this.config.updateEnabled(true);
        }
        this.ensureBridge(state);
    }

    public stopAll(): void {
        for (const entry of this.activeSessions.values()) {
            entry.terminal.dispose();
        }
        this.activeSessions.clear();
        while (this.queue.length) {
            const item = this.queue.shift();
            item?.resolve(undefined);
        }
        this.bridge?.stop();
        this.bridge = undefined;
    }

    public async setEnabled(enabled: boolean): Promise<void> {
        await this.config.updateEnabled(enabled);
    }

    public async setSessionCap(cap: number): Promise<void> {
        await this.config.updateSessionCap(cap);
    }

    public async setDisabledTools(disabledTools: string[]): Promise<void> {
        await this.config.updateDisabledTools(disabledTools);
    }

    public async updateEndpoint(host: string, port: number): Promise<void> {
        await this.config.updateEndpoint(host, port);
        if (this.bridge) {
            this.bridge.stop();
            this.bridge = undefined;
            const state = this.effectiveState();
            this.ensureBridge(state);
        }
    }

    public loadState() {
        return this.config.load();
    }

    public getSettingsSnapshot() {
        return this.effectiveState();
    }

    public getActiveSessionCount(): number {
        return this.activeSessions.size;
    }

    public async checkStatus(): Promise<{ running: boolean; reachable: boolean; host: string; port: number; activeSessions: number; queuedConnections: number; sessionCap: number; message?: string; }> {
        const state = this.effectiveState();
        const host = state.host || '127.0.0.1';
        const port = state.port || 37115;
        const running = !!this.bridge?.isRunning();
        const metrics = this.bridge?.getMetrics() || { active: 0, queued: 0, cap: Math.max(1, state.sessionCap || 20) };
        const activeSessions = this.getActiveSessionCount() + (metrics.active || 0);
        const reachable = await this.tryProbe(host, port);
        let message: string | undefined;
        if (!running) {
            message = 'Bridge is not started yet. Use Start Server to launch it.';
        } else if (running && !reachable) {
            message = 'Bridge is running but not reachable on the configured host/port.';
        }

        return {
            running,
            reachable,
            host,
            port,
            activeSessions,
            queuedConnections: metrics.queued,
            sessionCap: Math.max(1, state.sessionCap || 20),
            message
        };
    }

    private enabledTools(): string[] {
        const state = this.effectiveState();
        const disabled = new Set(state.disabledTools || []);
        const allToolNames = ['AirflowTool'];
        return allToolNames.filter(name => !disabled.has(name));
    }

    private effectiveState() {
        const stored = this.config.load();
        const config = vscode.workspace.getConfiguration('airflow-ext.mcp');
        const enabled = config.get<boolean>('enabled', stored.enabled);
        const sessionCap = config.get<number>('sessionCap', stored.sessionCap);
        const disabledTools = config.get<string[]>('disabledTools', stored.disabledTools);
        const host = config.get<string>('host', stored.host);
        const port = config.get<number>('port', stored.port);
        return { enabled, sessionCap, disabledTools, host, port };
    }

    private onSessionClosed(sessionId: number): void {
        this.activeSessions.delete(sessionId);
        if (this.queue.length > 0) {
            const queued = this.queue.shift();
            if (queued) {
                this.startSession().then(queued.resolve).catch(queued.reject);
            }
        }
        this.bridge?.notifyCapacityChange();
    }

    private ensureBridge(state?: { host?: string; port?: number; sessionCap?: number; enabled?: boolean; disabledTools?: string[] }): void {
        const effective = state ?? this.effectiveState();
        const host = effective.host || '127.0.0.1';
        const port = effective.port || 37115;

        if (this.bridge) {
            const address = this.bridge.getAddress();
            if (address.host === host && address.port === port && this.bridge.isRunning()) {
                return;
            }
            this.bridge.stop();
            this.bridge = undefined;
        }

        this.bridge = new McpBridgeServer(
            () => new Set(this.enabledTools()),
            () => Math.max(1, this.effectiveState().sessionCap || 20),
            () => this.getActiveSessionCount(),
            { host, port }
        );
        this.bridge.start();
    }

    private tryProbe(host: string, port: number): Promise<boolean> {
        return new Promise((resolve) => {
            const socket = net.createConnection({ host, port }, () => {
                socket.destroy();
                resolve(true);
            });
            socket.setTimeout(1200);
            const handleFail = () => {
                try { socket.destroy(); } catch {}
                resolve(false);
            };
            socket.on('error', handleFail);
            socket.on('timeout', handleFail);
        });
    }
}
