/**
 * PauseDagTool - Language Model Tool for pausing a DAG
 */

import * as vscode from 'vscode';
import { AirflowClientAdapter } from '../AirflowClientAdapter';

export interface IPauseDagParams {
    dag_id: string;
}

export class PauseDagTool implements vscode.LanguageModelTool<IPauseDagParams> {
    private client: AirflowClientAdapter;

    constructor(client: AirflowClientAdapter) {
        this.client = client;
    }

    async prepareInvocation(
        options: vscode.LanguageModelToolInvocationPrepareOptions<IPauseDagParams>,
        token: vscode.CancellationToken
    ): Promise<vscode.PreparedToolInvocation> {
        const { dag_id } = options.input;

        const confirmationMessage = new vscode.MarkdownString();
        confirmationMessage.isTrusted = true;
        confirmationMessage.appendMarkdown('## ⚠️ Pause DAG Confirmation\n\n');
        confirmationMessage.appendMarkdown(`You are about to **PAUSE** the following DAG:\n\n`);
        confirmationMessage.appendMarkdown(`**DAG ID:** \`${dag_id}\`\n\n`);
        confirmationMessage.appendMarkdown('**Effect:** No new runs will be scheduled for this DAG.\n\n');
        confirmationMessage.appendMarkdown('Do you want to proceed?');

        return {
            invocationMessage: `Pausing DAG: ${dag_id}`,
            confirmationMessages: {
                title: 'Confirm Pause DAG',
                message: confirmationMessage
            }
        };
    }

    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<IPauseDagParams>,
        token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {
        const { dag_id } = options.input;

        try {
            await this.client.pauseDag(dag_id, true); // true = pause

            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(`✅ Successfully PAUSED DAG: **${dag_id}**`)
            ]);

        } catch (error) {
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(`❌ Failed to pause DAG ${dag_id}: ${error instanceof Error ? error.message : String(error)}`)
            ]);
        }
    }
}
