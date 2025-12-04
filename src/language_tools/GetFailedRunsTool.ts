/**
 * GetFailedRunsTool - Language Model Tool for monitoring failed DAG runs
 * 
 * This tool implements a read-only observability action that retrieves
 * failed DAG runs from Airflow. It does not require user confirmation
 * since it's a non-destructive operation.
 */

import * as vscode from 'vscode';
import { AirflowClientAdapter, IFailedRunSummary } from './AirflowClientAdapter';

/**
 * Input parameters for querying failed runs
 */
export interface IQueryRunsParams {
    time_range_hours?: number;
    dag_id_filter?: string;
}

/**
 * GetFailedRunsTool - Implements vscode.LanguageModelTool for monitoring
 */
export class GetFailedRunsTool implements vscode.LanguageModelTool<IQueryRunsParams> {
    private client: AirflowClientAdapter;

    constructor(client: AirflowClientAdapter) {
        this.client = client;
    }

    /**
     * Prepare invocation - minimal for read-only operations
     * 
     * Since this is a read-only monitoring tool, we don't need extensive
     * confirmation dialogs. This method can return undefined or a simple message.
     * 
     * @param options - Contains the parsed input parameters
     * @param token - Cancellation token
     * @returns PreparedToolInvocation or undefined
     */
    async prepareInvocation(
        options: vscode.LanguageModelToolInvocationPrepareOptions<IQueryRunsParams>,
        token: vscode.CancellationToken
    ): Promise<vscode.PreparedToolInvocation | undefined> {
        const timeRange = options.input.time_range_hours || 24;
        const dagFilter = options.input.dag_id_filter;

        const message = dagFilter
            ? `Querying failed runs for DAG '${dagFilter}' (last ${timeRange} hours)`
            : `Querying all failed runs (last ${timeRange} hours)`;

        return {
            invocationMessage: message
        };
    }

    /**
     * Execute the query for failed DAG runs
     * 
     * @param options - Contains the validated input parameters
     * @param token - Cancellation token
     * @returns LanguageModelToolResult with failed runs data
     */
    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<IQueryRunsParams>,
        token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {
        const timeRange = options.input.time_range_hours || 24;
        const dagFilter = options.input.dag_id_filter;

        try {
            // Call the mock API client to get failed runs
            const failedRuns = await this.client.queryFailedRuns(timeRange, dagFilter);

            // Format the response for the LLM
            if (failedRuns.length === 0) {
                const noFailuresMessage = dagFilter
                    ? `✅ No failed runs found for DAG '${dagFilter}' in the last ${timeRange} hours.`
                    : `✅ No failed runs found in the last ${timeRange} hours. All DAGs are healthy!`;

                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart(noFailuresMessage)
                ]);
            }

            // Build a detailed summary
            let summaryMessage = `## ⚠️ Failed DAG Runs Report\n\n`;
            summaryMessage += `**Time Range:** Last ${timeRange} hours\n`;
            if (dagFilter) {
                summaryMessage += `**DAG Filter:** ${dagFilter}\n`;
            }
            summaryMessage += `**Total Failed Runs:** ${failedRuns.length}\n\n`;
            summaryMessage += `---\n\n`;

            // Add individual run details
            failedRuns.forEach((run: IFailedRunSummary, index: number) => {
                summaryMessage += `### ${index + 1}. ${run.dag_id}\n\n`;
                summaryMessage += `- **Run ID:** \`${run.dag_run_id}\`\n`;
                summaryMessage += `- **State:** ${run.state}\n`;
                summaryMessage += `- **Execution Date:** ${run.execution_date}\n`;
                summaryMessage += `- **Logical Date:** ${run.logical_date}\n`;
                if (run.start_date) {
                    summaryMessage += `- **Started:** ${run.start_date}\n`;
                }
                if (run.end_date) {
                    summaryMessage += `- **Ended:** ${run.end_date}\n`;
                }
                if (run.error_message) {
                    summaryMessage += `- **Error:** ${run.error_message}\n`;
                }
                summaryMessage += `\n`;
            });

            // Also include raw JSON for LLM processing
            summaryMessage += `\n---\n\n**Raw Data (JSON):**\n\n`;
            summaryMessage += `\`\`\`json\n${JSON.stringify(failedRuns, null, 2)}\n\`\`\`\n`;

            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(summaryMessage)
            ]);

        } catch (error) {
            // Handle errors gracefully
            const errorMessage = `
❌ Failed to Query DAG Runs

**Error:** ${error instanceof Error ? error.message : String(error)}

Please check:
- The Airflow server is accessible
- You have the necessary permissions
- The time range and filters are valid
            `.trim();

            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(errorMessage)
            ]);
        }
    }
}
