/**
 * PauseDagTool - Language Model Tool for pausing a DAG
 */

import * as vscode from 'vscode';
import { AirflowClientAdapter } from './AirflowClientAdapter';
import { AIHandler } from './AIHandler';
import { Telemetry } from '../common/Telemetry';

export interface IPauseDagParams {
    dagId: string;
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
        const { dagId } = options.input;

        const confirmationMessage = new vscode.MarkdownString();
        confirmationMessage.isTrusted = true;
        confirmationMessage.appendMarkdown('## ⚠️ Pause DAG Confirmation\n\n');
        confirmationMessage.appendMarkdown(`You are about to **PAUSE** the following DAG:\n\n`);
        confirmationMessage.appendMarkdown(`**DAG ID:** \`${dagId}\`\n\n`);
        confirmationMessage.appendMarkdown('**Effect:** No new runs will be scheduled for this DAG.\n\n');
        confirmationMessage.appendMarkdown('Do you want to proceed?');

        return {
            invocationMessage: `Pausing DAG: ${dagId}`,
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
        const { dagId } = options.input;
        AIHandler.Current.currentDagId = dagId;
        
        // Track tool invocation
        Telemetry.Current.send('PauseDagTool.invoke');
        
        try {
            await this.client.pauseDag(dagId, true); // true = pause

            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(`✅ Successfully PAUSED DAG: **${dagId}**`)
            ]);

        } catch (error) {
            // Track invocation error
            Telemetry.Current.sendError('PauseDagTool.invocationError', error instanceof Error ? error : new Error(String(error)));
            
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(`❌ Failed to pause DAG ${dagId}: ${error instanceof Error ? error.message : String(error)}`)
            ]);
        }
    }
}
