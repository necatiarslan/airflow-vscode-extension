import * as vscode from 'vscode';
import { McpDispatcher } from './McpDispatcher';
import { McpRequest, McpResponse } from './types';

export class McpSession implements vscode.Pseudoterminal {
    public static Current: McpSession | undefined;
    private readonly writeEmitter = new vscode.EventEmitter<string>();
    private readonly closeEmitter = new vscode.EventEmitter<void>();
    onDidWrite: vscode.Event<string> = this.writeEmitter.event;
    onDidClose?: vscode.Event<void>;

    private buffer = '';

    constructor(
        private readonly sessionId: number,
        private readonly dispatcher: McpDispatcher,
        private readonly onSessionClosed: (id: number) => void
    ) {
        McpSession.Current = this;
        this.onDidClose = this.closeEmitter.event;
    }

    open(): void {
        this.writeLine(`Airflow MCP session ${this.sessionId} started.`);
        this.writeLine('Type Ctrl+C to close this session.');
    }

    close(): void {
        this.writeLine(`MCP session ${this.sessionId} closed.`);
        this.closeEmitter.fire();
        this.onSessionClosed(this.sessionId);
        McpSession.Current = undefined;
    }

    handleInput(data: string): void {
        if (data === '\u0003') {
            this.close();
            return;
        }

        this.buffer += data;
        const lines = this.buffer.split(/\r?\n/);
        this.buffer = lines.pop() || '';

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) {
                continue;
            }

            let request: McpRequest | undefined;
            try {
                request = JSON.parse(trimmed);
            } catch (error: any) {
                this.writeLine(JSON.stringify({ error: { message: 'Invalid JSON', detail: error?.message } }));
                continue;
            }

            if (request) {
                this.dispatch(request);
            }
        }
    }

    private async dispatch(request: McpRequest): Promise<void> {
        const response = await this.dispatcher.handle(request);
        if (response) {
            this.writeLine(JSON.stringify(response));
        }
    }

    public writeLine(text: string): void {
        this.writeEmitter.fire(text + '\r\n');
    }
}
