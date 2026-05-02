import * as vscode from 'vscode';

export interface BaseToolInput {
    command: string;
    params: Record<string, any>;
}

export abstract class BaseTool<TInput extends BaseToolInput> implements vscode.LanguageModelTool<TInput> {
    protected abstract readonly toolName: string;
    protected abstract executeCommand(command: string, params: Record<string, any>): Promise<any>;

    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<TInput>,
        token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {
        const { command, params } = options.input;
        try {
            const result = await this.executeCommand(command, params);
            const response = { success: true, command, data: result };
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(JSON.stringify(response, null, 2))
            ]);
        } catch (error: any) {
            const errorResponse = {
                success: false,
                command,
                error: error?.message || 'Unknown error'
            };
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(JSON.stringify(errorResponse, null, 2))
            ]);
        }
    }
}
