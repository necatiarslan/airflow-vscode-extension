import * as vscode from 'vscode';
import * as net from 'net';
import { McpDispatcher } from './McpDispatcher';
import * as ui from '../common/UI';

export class McpBridgeServer implements vscode.Disposable {
    private server?: net.Server;
    private running = false;
    private readonly port: number;
    private readonly host: string;
    private active = 0;
    private queued: net.Socket[] = [];

    constructor(
        private readonly getEnabledTools: () => Set<string>,
        private readonly getCap: () => number,
        private readonly getActiveSessionCount: () => number,
        options?: { host?: string; port?: number },
    ) {
        this.port = options?.port ?? (parseInt(process.env.AIRFLOW_MCP_PORT || '37115', 10) || 37115);
        this.host = options?.host || process.env.AIRFLOW_MCP_HOST || '127.0.0.1';
    }

    start(): void {
        if (this.running) { return; }
        this.server = net.createServer((socket) => this.handleConnection(socket));
        this.server.listen(this.port, this.host, () => {
            ui.showInfoMessage(`MCP bridge listening on ${this.host}:${this.port}`);
        });
        this.running = true;
    }

    stop(): void {
        if (!this.running) { return; }
        try {
            this.server?.close();
            for (const s of this.queued) {
                try { s.destroy(); } catch {}
            }
            this.queued = [];
            this.active = 0;
        } finally {
            this.server = undefined;
            this.running = false;
        }
    }

    public isRunning(): boolean {
        return this.running;
    }

    public getAddress(): { host: string; port: number } {
        return { host: this.host, port: this.port };
    }

    public getMetrics(): { active: number; queued: number; cap: number } {
        return { active: this.active, queued: this.queued.length, cap: Math.max(1, this.getCap()) };
    }

    notifyCapacityChange(): void {
        this.tryPromoteQueued();
    }

    dispose(): void {
        this.stop();
    }

    private totalActive(): number {
        return this.getActiveSessionCount() + this.active;
    }

    private handleConnection(socket: net.Socket) {
        const cap = Math.max(1, this.getCap());
        if (this.totalActive() >= cap) {
            this.queued.push(socket);
            ui.logToOutput(`MCP bridge: capacity reached (${cap}). Queuing connection.`);
            socket.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/status', params: { status: 'queued', cap, message: 'Queued until capacity frees' } }) + '\n');
            socket.on('close', () => this.removeQueued(socket));
            socket.on('end', () => this.removeQueued(socket));
            return;
        }
        this.beginSession(socket);
    }

    private removeQueued(socket: net.Socket) {
        this.queued = this.queued.filter(s => s !== socket);
    }

    private tryPromoteQueued(): void {
        const cap = Math.max(1, this.getCap());
        while (this.queued.length > 0 && this.totalActive() < cap) {
            const s = this.queued.shift();
            if (s) {
                this.beginSession(s);
            }
        }
    }

    private beginSession(socket: net.Socket): void {
        this.active++;
        ui.logToOutput(`MCP bridge: session started. Total active: ${this.totalActive()}`);
        const dispatcher = new McpDispatcher(this.getEnabledTools());
        let buffer = '';

        const writeLine = (obj: any) => {
            socket.write(JSON.stringify(obj) + '\n');
        };

        socket.on('data', async (chunk) => {
            buffer += chunk.toString('utf-8');
            const lines = buffer.split(/\r?\n/);
            buffer = lines.pop() || '';
            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed) { continue; }
                let req: any;
                try {
                    req = JSON.parse(trimmed);
                } catch (e: any) {
                    writeLine({ jsonrpc: '2.0', error: { message: 'Invalid JSON', data: e?.message } });
                    continue;
                }
                try {
                    const res = await dispatcher.handle(req);
                    if (res) {
                        writeLine(res);
                    }
                } catch (e: any) {
                    writeLine({ jsonrpc: '2.0', id: req?.id || null, error: { message: e?.message || 'Internal error', code: -32603 } });
                }
            }
        });

        const close = () => {
            this.active = Math.max(0, this.active - 1);
            try { socket.destroy(); } catch {}
            this.tryPromoteQueued();
        };
        socket.on('error', close);
        socket.on('close', close);
        socket.on('end', close);
    }
}
