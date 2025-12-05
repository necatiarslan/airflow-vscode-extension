/**
 * GetRunningDagsTool - Language Model Tool for listing currently running DAGs
 */

import * as vscode from 'vscode';
import { AirflowClientAdapter } from './AirflowClientAdapter';

export class GetRunningDagsTool implements vscode.LanguageModelTool<void> {
    private client: AirflowClientAdapter;

    constructor(client: AirflowClientAdapter) {
        this.client = client;
    }

    async prepareInvocation(
        options: vscode.LanguageModelToolInvocationPrepareOptions<void>,
        token: vscode.CancellationToken
    ): Promise<vscode.PreparedToolInvocation | undefined> {
        return {
            invocationMessage: "Checking for running DAGs..."
        };
    }

    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<void>,
        token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {
        try {
            const runningDags = await this.client.getRunningDags();

            if (runningDags.length === 0) {
                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart("✅ No DAGs are currently running.")
                ]);
            }

            let message = `## ▶️ Running DAGs (${runningDags.length})\n\n`;
            runningDags.forEach(dag => {
                const stateEmoji = dag.latest_run_state === 'running' ? '▶️' : '⏳';
                message += `- ${stateEmoji} **${dag.dag_id}** - State: ${dag.latest_run_state}, Run ID: \`${dag.latest_run_id}\``;
                if (dag.description) {
                    message += `\n  Description: ${dag.description}`;
                }
                if (dag.owners && dag.owners.length > 0) {
                    message += `\n  Owners: ${dag.owners.join(', ')}`;
                }
                message += `\n`;
            });

            message += `\n---\n**Raw Data:**\n\`\`\`json\n${JSON.stringify(runningDags, null, 2)}\n\`\`\``;

            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(message)
            ]);

        } catch (error) {
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(`❌ Failed to get running DAGs: ${error instanceof Error ? error.message : String(error)}`)
            ]);
        }
    }
}
