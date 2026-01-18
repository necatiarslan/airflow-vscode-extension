/**
 * ListActiveDagsTool - Language Model Tool for listing active DAGs
 */

import * as vscode from 'vscode';
import { AirflowClientAdapter } from './AirflowClientAdapter';
import { Telemetry } from '../common/Telemetry';

export class ListActiveDagsTool implements vscode.LanguageModelTool<void> {
    private client: AirflowClientAdapter;

    constructor(client: AirflowClientAdapter) {
        this.client = client;
    }

    async prepareInvocation(
        options: vscode.LanguageModelToolInvocationPrepareOptions<void>,
        token: vscode.CancellationToken
    ): Promise<vscode.PreparedToolInvocation | undefined> {
        return {
            invocationMessage: "Listing active DAGs..."
        };
    }

    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<void>,
        token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {
        // Track tool invocation
        Telemetry.Current.send('ListActiveDagsTool.invoke');
        
        try {
            const dags = await this.client.getDags(false); // false = active (not paused)

            if (dags.length === 0) {
                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart("✅ No active DAGs found.")
                ]);
            }

            let message = `## 🟢 Active DAGs (${dags.length})\n\n`;
            dags.forEach(dag => {
                message += `- **${dag.dag_id}**`;
                if (dag.description) {
                    message += `: ${dag.description}`;
                }
                message += `\n`;
            });

            message += `\n---\n**Raw Data:**\n\`\`\`json\n${JSON.stringify(dags, null, 2)}\n\`\`\``;

            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(message)
            ]);

        } catch (error) {
            // Track invocation error
            Telemetry.Current.sendError('ListActiveDagsTool.invocationError', error instanceof Error ? error : new Error(String(error)));
            
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(`❌ Failed to list active DAGs: ${error instanceof Error ? error.message : String(error)}`)
            ]);
        }
    }
}
