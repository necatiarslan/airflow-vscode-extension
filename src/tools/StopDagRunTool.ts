/**
 * StopDagRunTool - Language Model Tool for stopping a running DAG run
 * 
 * This tool stops the currently running DAG run for a specific DAG.
 * It requires user confirmation since it's a state-changing operation.
 */

import * as vscode from 'vscode';
import { AirflowClientAdapter } from '../AirflowClientAdapter';

/**
 * Input parameters for stopping a DAG run
 */
export interface IStopDagRunParams {
    dag_id: string;
}

/**
 * StopDagRunTool - Implements vscode.LanguageModelTool for stopping DAG runs
 */
export class StopDagRunTool implements vscode.LanguageModelTool<IStopDagRunParams> {
    private client: AirflowClientAdapter;

    constructor(client: AirflowClientAdapter) {
        this.client = client;
    }

    /**
     * Prepare invocation with user confirmation
     */
    async prepareInvocation(
        options: vscode.LanguageModelToolInvocationPrepareOptions<IStopDagRunParams>,
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
        confirmationMessage.appendMarkdown('## ⚠️ Stop DAG Run Confirmation\n\n');
        confirmationMessage.appendMarkdown(`You are about to **STOP** the running DAG run for:\n\n`);
        confirmationMessage.appendMarkdown(`**DAG ID:** \`${dag_id}\`\n`);
        if (runInfo) {
            confirmationMessage.appendMarkdown(runInfo);
        }
        confirmationMessage.appendMarkdown('**Effect:** The current DAG run will be marked as failed and stopped.\n\n');
        confirmationMessage.appendMarkdown('Do you want to proceed?');

        return {
            invocationMessage: `Stopping DAG run: ${dag_id}`,
            confirmationMessages: {
                title: 'Confirm Stop DAG Run',
                message: confirmationMessage
            }
        };
    }

    /**
     * Execute the stop DAG run action
     */
    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<IStopDagRunParams>,
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

            // Stop the DAG run
            await this.client.stopDagRun(dag_id, latestRun.dag_run_id);

            const message = [
                `✅ **Success!** DAG run stopped.`,
                ``,
                `- **DAG ID:** ${dag_id}`,
                `- **Run ID:** ${latestRun.dag_run_id}`,
                `- **Previous State:** ${latestRun.state}`,
                ``,
                `The DAG run has been marked as failed and stopped.`
            ].join('\n');

            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(message)
            ]);

        } catch (error) {
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(`❌ Failed to stop DAG run for ${dag_id}: ${error instanceof Error ? error.message : String(error)}`)
            ]);
        }
    }
}
