import * as vscode from 'vscode';

interface McpState {
    enabled: boolean;
    sessionCap: number;
    disabledTools: string[];
    host: string;
    port: number;
}

const STATE_KEY = 'airflow-ext.mcp.state';
const DEFAULT_HOST = process.env.AIRFLOW_MCP_HOST || '127.0.0.1';
const DEFAULT_PORT = parseInt(process.env.AIRFLOW_MCP_PORT || '37115', 10) || 37115;
const DEFAULT_STATE: McpState = {
    enabled: false,
    sessionCap: 20,
    disabledTools: [],
    host: DEFAULT_HOST,
    port: DEFAULT_PORT
};

export class McpConfig {
    constructor(private readonly memento: vscode.Memento) {}

    public load(): McpState {
        const stored = this.memento.get<McpState>(STATE_KEY);
        if (!stored) {
            return { ...DEFAULT_STATE };
        }
        return {
            enabled: stored.enabled ?? DEFAULT_STATE.enabled,
            sessionCap: stored.sessionCap ?? DEFAULT_STATE.sessionCap,
            disabledTools: stored.disabledTools ?? [],
            host: stored.host || DEFAULT_STATE.host,
            port: this.normalizePort(stored.port) ?? DEFAULT_STATE.port
        };
    }

    public async updateEnabled(enabled: boolean): Promise<void> {
        const current = this.load();
        await this.memento.update(STATE_KEY, { ...current, enabled });
    }

    public async updateSessionCap(sessionCap: number): Promise<void> {
        const current = this.load();
        await this.memento.update(STATE_KEY, { ...current, sessionCap });
    }

    public async updateDisabledTools(disabledTools: string[]): Promise<void> {
        const current = this.load();
        await this.memento.update(STATE_KEY, { ...current, disabledTools });
    }

    public async updateHost(host: string): Promise<void> {
        const current = this.load();
        await this.memento.update(STATE_KEY, { ...current, host: host || DEFAULT_HOST });
    }

    public async updatePort(port: number): Promise<void> {
        const current = this.load();
        await this.memento.update(STATE_KEY, { ...current, port: this.normalizePort(port) ?? DEFAULT_PORT });
    }

    public async updateEndpoint(host: string, port: number): Promise<void> {
        const current = this.load();
        await this.memento.update(STATE_KEY, {
            ...current,
            host: host || DEFAULT_HOST,
            port: this.normalizePort(port) ?? DEFAULT_PORT
        });
    }

    private normalizePort(port: number | undefined): number | undefined {
        if (port === undefined || port === null) {
            return undefined;
        }
        const parsed = Number(port);
        if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65535) {
            return undefined;
        }
        return parsed;
    }
}
