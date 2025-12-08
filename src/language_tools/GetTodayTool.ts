import * as vscode from 'vscode';

export class GetTodayTool implements vscode.LanguageModelTool<void> {
    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<void>,
        token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {
        const today = new Date();
        
        // Format: YYYY-MM-DD
        const formattedDate = today.toISOString().split('T')[0];
        
        // Additional formats for user convenience
        const dayOfWeek = today.toLocaleDateString('en-US', { weekday: 'long' });
        const fullDate = today.toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });

        const result = `## Today's Date

**ISO Format:** ${formattedDate}
**Full Date:** ${fullDate}
**Day of Week:** ${dayOfWeek}

*Use the ISO format (${formattedDate}) when filtering DAG runs or working with date ranges.*`;

        return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart(result)
        ]);
    }

    async prepareInvocation(
        options: vscode.LanguageModelToolInvocationPrepareOptions<void>,
        token: vscode.CancellationToken
    ): Promise<vscode.PreparedToolInvocation> {
        return {
            invocationMessage: 'Getting current system date...'
        };
    }
}
