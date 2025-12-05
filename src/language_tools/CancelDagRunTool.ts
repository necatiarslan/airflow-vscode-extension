/**
 * CancelDagRunTool - Language Model Tool for cancelling a running DAG run
 * 
 * This tool cancels the currently running DAG run for a specific DAG.
 * It requires user confirmation since it's a state-changing operation.
 */

import * as vscode from 'vscode';
import { AirflowClientAdapter } from './AirflowClientAdapter';

/**
 * Input parameters for cancelling a DAG run
 */
export interface ICancelDagRunParams {
    dag_id: string;
}

/**
 * CancelDagRunTool - Implements vscode.LanguageModelTool for cancelling DAG runs
 */
export class CancelDagRunTool implements vscode.LanguageModelTool<ICancelDagRunParams> {
    private client: AirflowClientAdapter;

    constructor(client: AirflowClientAdapter) {
        this.client = client;
    }

    /**
     * Prepare invocation with user confirmation
     */
    async prepareInvocation(
        options: vscode.LanguageModelToolInvocationPrepareOptions<ICancelDagRunParams>,
        token: vscode.CancellationToken
    ): Promise<vscode.PreparedToolInvocation> {
        const { dag_id } = options.input;

        // Try to get the current running DAG run
        let runInfo = '';
        try {
            const latestRun = await this.client.getLatestDagRun(dag_id);
            if (latestRun && (latestRun.state === 'running' || latestRun.state === 'queued')) {
                runInfo = `\n**Current Run:** \`${latestRun.dag_run_id}\`\n**State:** ${latestRun.state}\n\n`;
            }
        } catch (error) {
            // Ignore error, proceed with generic confirmation
        }

        const confirmationMessage = new vscode.MarkdownString();
        confirmationMessage.isTrusted = true;
        confirmationMessage.appendMarkdown('## ⚠️ Cancel DAG Run Confirmation\n\n');
        confirmationMessage.appendMarkdown(`You are about to **CANCEL** the running DAG run for:\n\n`);
        confirmationMessage.appendMarkdown(`**DAG ID:** \`${dag_id}\`\n`);
        if (runInfo) {
            confirmationMessage.appendMarkdown(runInfo);
        }
        confirmationMessage.appendMarkdown('**Effect:** The current DAG run will be marked as failed and cancelled.\n\n');
        confirmationMessage.appendMarkdown('Do you want to proceed?');

        return {
            invocationMessage: `Cancelling DAG run: ${dag_id}`,
            confirmationMessages: {
                title: 'Confirm Cancel DAG Run',
                message: confirmationMessage
            }
        };
    }

    /**
     * Execute the cancel DAG run action
     */
    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<ICancelDagRunParams>,
        token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {
        const { dag_id } = options.input;

        try {
            // First, get the latest DAG run to find the running one
            const latestRun = await this.client.getLatestDagRun(dag_id);

            if (!latestRun) {
                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart(`ℹ️ No DAG run found for '${dag_id}'.`)
                ]);
            }

            // Check if the latest run is actually running
            if (latestRun.state !== 'running' && latestRun.state !== 'queued') {
                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart(`ℹ️ DAG '${dag_id}' is not currently running.\n\nLatest run state: **${latestRun.state}**\nRun ID: \`${latestRun.dag_run_id}\``)
                ]);
            }

            // Cancel the DAG run
            await this.client.cancelDagRun(dag_id, latestRun.dag_run_id);

            const message = [
                `✅ **Success!** DAG run cancelled.`,
                ``,
                `- **DAG ID:** ${dag_id}`,
                `- **Run ID:** ${latestRun.dag_run_id}`,
                `- **Previous State:** ${latestRun.state}`,
                ``,
                `The DAG run has been marked as failed and cancelled.`
            ].join('\n');

            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(message)
            ]);

        } catch (error) {
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(`❌ Failed to cancel DAG run for ${dag_id}: ${error instanceof Error ? error.message : String(error)}`)
            ]);
        }
    }
}
