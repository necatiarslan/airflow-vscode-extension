/**
 * TriggerDagRunTool - Language Model Tool for triggering Airflow DAG runs
 * 
 * This tool implements a state-changing action that requires explicit user confirmation
 * via the prepareInvocation method. It displays the target DAG ID and configuration
 * payload in a markdown-formatted confirmation dialog before execution.
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import { AirflowClientAdapter } from './AirflowClientAdapter';
import { AIHandler } from './AIHandler';

/**
 * Input parameters for triggering a DAG run
 */
export interface ITriggerParams {
    dagId: string;
    configJson?: string;
    date?: string;
}

/**
 * TriggerDagRunTool - Implements vscode.LanguageModelTool for DAG triggering
 */
export class TriggerDagRunTool implements vscode.LanguageModelTool<ITriggerParams> {
    private client: AirflowClientAdapter;

    constructor(client: AirflowClientAdapter) {
        this.client = client;
    }

    /**
     * SECURITY CRITICAL: Prepare invocation with user confirmation
     * 
     * This method is called before invoke() and provides a confirmation gate
     * for the user to review the exact DAG and configuration before triggering.
     * 
     * @param options - Contains the parsed input parameters
     * @param token - Cancellation token
     * @returns PreparedToolInvocation with confirmation message
     */
    async prepareInvocation(
        options: vscode.LanguageModelToolInvocationPrepareOptions<ITriggerParams>,
        token: vscode.CancellationToken
    ): Promise<vscode.PreparedToolInvocation | undefined> {
        const { dagId, configJson, date } = options.input;
        
        // Process configJson: check if it's a file path
        let finalConfig = configJson || '{}';
        let configSource = 'Inline';

        if (configJson && !configJson.trim().startsWith('{')) {
            // Assume it's a file path if it doesn't start with {
            try {
                // Remove quotes if present
                const filePath = configJson.replace(/^['"]|['"]$/g, '');
                if (fs.existsSync(filePath)) {
                    finalConfig = fs.readFileSync(filePath, 'utf8');
                    configSource = `File: ${filePath}`;
                }
            } catch (error) {
                // If read fails, keep original string (validation will happen later)
                console.warn(`Failed to read config file: ${error}`);
            }
        }

        // Validate JSON
        try {
            JSON.parse(finalConfig);
        } catch (e) {
            throw new Error(`Invalid JSON configuration: ${e instanceof Error ? e.message : String(e)}`);
        }

        const confirmationMessage = new vscode.MarkdownString();
        confirmationMessage.isTrusted = true;
        confirmationMessage.appendMarkdown('## ⚠️ Trigger DAG Confirmation\n\n');
        confirmationMessage.appendMarkdown(`You are about to trigger the following DAG:\n\n`);
        confirmationMessage.appendMarkdown(`**DAG ID:** \`${dagId}\`\n`);
        if (date) {
            confirmationMessage.appendMarkdown(`**Logical Date:** \`${date}\`\n`);
        }
        confirmationMessage.appendMarkdown(`**Config Source:** ${configSource}\n\n`);
        confirmationMessage.appendMarkdown('**Configuration Payload:**\n');
        confirmationMessage.appendCodeblock(finalConfig, 'json');
        confirmationMessage.appendMarkdown('\nDo you want to proceed?');

        return {
            invocationMessage: `Triggering DAG: ${dagId}`,
            confirmationMessages: {
                title: 'Confirm DAG Trigger',
                message: confirmationMessage
            }
        };
    }

    /**
     * Execute the DAG trigger action
     * 
     * @param options - Contains the validated input parameters
     * @param token - Cancellation token
     * @returns LanguageModelToolResult with success/error information
     */
    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<ITriggerParams>,
        token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {
        const { dagId, configJson, date } = options.input;
        AIHandler.Current.currentDagId = dagId;

        try {
            // Re-process config for invoke (same logic as prepare)
            let finalConfig = configJson || '{}';
            if (configJson && !configJson.trim().startsWith('{')) {
                try {
                    const filePath = configJson.replace(/^['"]|['"]$/g, '');
                    if (fs.existsSync(filePath)) {
                        finalConfig = fs.readFileSync(filePath, 'utf8');
                    }
                } catch (error) {
                    // Ignore error here, will fail at JSON parse in client
                }
            }

            const result = await this.client.triggerDagRun(dagId, finalConfig, date);

            const message = [
                `✅ **Success!** DAG Run triggered.`,
                ``,
                `- **DAG ID:** ${result.dag_id}`,
                `- **Run ID:** ${result.dag_run_id}`,
                `- **State:** ${result.state}`,
                `- **Logical Date:** ${result.logical_date}`,
                date ? `- **Requested Date:** ${date}` : ''
            ].filter(Boolean).join('\n');

            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(message)
            ]);

        } catch (error) {
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(`❌ Failed to trigger DAG ${dagId}: ${error instanceof Error ? error.message : String(error)}`)
            ]);
        }
    }
}
