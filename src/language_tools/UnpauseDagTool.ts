/**
 * UnpauseDagTool - Language Model Tool for unpausing (activating) a DAG
 */

import * as vscode from 'vscode';
import { AirflowClientAdapter } from './AirflowClientAdapter';

export interface IUnpauseDagParams {
    dagId: string;
}

export class UnpauseDagTool implements vscode.LanguageModelTool<IUnpauseDagParams> {
    private client: AirflowClientAdapter;

    constructor(client: AirflowClientAdapter) {
        this.client = client;
    }

    async prepareInvocation(
        options: vscode.LanguageModelToolInvocationPrepareOptions<IUnpauseDagParams>,
        token: vscode.CancellationToken
    ): Promise<vscode.PreparedToolInvocation> {
        const { dagId } = options.input;

        const confirmationMessage = new vscode.MarkdownString();
        confirmationMessage.isTrusted = true;
        confirmationMessage.appendMarkdown('## ⚠️ Unpause DAG Confirmation\n\n');
        confirmationMessage.appendMarkdown(`You are about to **UNPAUSE** (activate) the following DAG:\n\n`);
        confirmationMessage.appendMarkdown(`**DAG ID:** \`${dagId}\`\n\n`);
        confirmationMessage.appendMarkdown('**Effect:** New runs will be scheduled for this DAG.\n\n');
        confirmationMessage.appendMarkdown('Do you want to proceed?');

        return {
            invocationMessage: `Unpausing DAG: ${dagId}`,
            confirmationMessages: {
                title: 'Confirm Unpause DAG',
                message: confirmationMessage
            }
        };
    }

    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<IUnpauseDagParams>,
        token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {
        const { dagId } = options.input;

        try {
            await this.client.pauseDag(dagId, false); // false = unpause

            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(`✅ Successfully UNPAUSED DAG: **${dagId}**`)
            ]);

        } catch (error) {
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(`❌ Failed to unpause DAG ${dagId}: ${error instanceof Error ? error.message : String(error)}`)
            ]);
        }
    }
}
