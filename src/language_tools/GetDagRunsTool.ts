/**
 * GetDagRunsTool - Language Model Tool for retrieving DAG runs
 * 
 * This tool retrieves the runs for a specific DAG, optionally filtered by date.
 * Returns run ID, start time, duration, and status for each run.
 */

import * as vscode from 'vscode';
import { AirflowClientAdapter } from './AirflowClientAdapter';
import * as ui from '../common/UI';
import { AIHandler } from './AIHandler';

/**
 * Input parameters for querying DAG runs
 */
export interface IGetDagRunsParams {
    dagId: string;
    date?: string; // Optional date in ISO format (defaults to today)
}

/**
 * GetDagRunsTool - Implements vscode.LanguageModelTool for retrieving DAG runs
 */
export class GetDagRunsTool implements vscode.LanguageModelTool<IGetDagRunsParams> {
    private client: AirflowClientAdapter;

    constructor(client: AirflowClientAdapter) {
        this.client = client;
    }

    /**
     * Prepare invocation - minimal for read-only operations
     */
    async prepareInvocation(
        options: vscode.LanguageModelToolInvocationPrepareOptions<IGetDagRunsParams>,
        token: vscode.CancellationToken
    ): Promise<vscode.PreparedToolInvocation | undefined> {
        const { dagId, date } = options.input;
        const dateStr = date ||  ui.toISODateString(new Date());

        return {
            invocationMessage: `Retrieving runs for DAG '${dagId}' (date: ${dateStr})`
        };
    }

    /**
     * Execute the query for DAG runs
     */
    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<IGetDagRunsParams>,
        token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {
        const { dagId, date } = options.input;
        AIHandler.Current.currentDagId = dagId;
        
        try {
            // Get DAG run history from the API
            const result = await this.client.getDagRunHistory(dagId);

            if (!result || !result.dag_runs || result.dag_runs.length === 0) {
                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart(`ℹ️ No runs found for DAG '${dagId}'.`)
                ]);
            }

            let runs = result.dag_runs;

            // Filter by date if provided
            if (date) {
                const targetDate = new Date(date);
                runs = runs.filter((run: any) => {
                    const runDate = new Date(run.execution_date || run.logical_date);
                    return  ui.toISODateString(runDate) === ui.toISODateString(targetDate);
                });

                if (runs.length === 0) {
                    return new vscode.LanguageModelToolResult([
                        new vscode.LanguageModelTextPart(`ℹ️ No runs found for DAG '${dagId}' on ${date}.`)
                    ]);
                }
            }

            // Build detailed summary
            let summaryMessage = `## 📊 DAG Runs for '${dagId}'\n\n`;
            if (date) {
                summaryMessage += `**Date Filter:** ${date}\n`;
            } else {
                summaryMessage += `**Date Filter:** Today (${ui.toISODateString(new Date())})\n`;
            }
            summaryMessage += `**Total Runs:** ${runs.length}\n\n`;
            summaryMessage += `---\n\n`;

            // Add individual run details
            runs.forEach((run: any, index: number) => {
                const startTime = run.start_date || run.execution_date || 'N/A';
                const endTime = run.end_date || 'N/A';
                let duration = 'N/A';
                
                if (run.start_date && run.end_date) {
                    const start = new Date(run.start_date);
                    const end = new Date(run.end_date);
                    const durationMs = end.getTime() - start.getTime();
                    const durationSec = Math.floor(durationMs / 1000);
                    const minutes = Math.floor(durationSec / 60);
                    const seconds = durationSec % 60;
                    duration = `${minutes}m ${seconds}s`;
                }

                const status = run.state || 'unknown';
                const statusEmoji = this.getStatusEmoji(status);

                summaryMessage += `### ${index + 1}. Run: ${run.dag_run_id || run.run_id}\n\n`;
                summaryMessage += `- **Status:** ${statusEmoji} ${status}\n`;
                summaryMessage += `- **Start Time:** ${startTime}\n`;
                if (endTime !== 'N/A') {
                    summaryMessage += `- **End Time:** ${endTime}\n`;
                }
                summaryMessage += `- **Duration:** ${duration}\n`;
                summaryMessage += `- **Execution Date:** ${run.execution_date || run.logical_date}\n`;
                summaryMessage += `\n`;
            });

            // Include raw JSON for LLM processing
            summaryMessage += `\n---\n\n**Raw Data (JSON):**\n\n`;
            summaryMessage += `\`\`\`json\n${JSON.stringify(runs, null, 2)}\n\`\`\`\n`;

            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(summaryMessage)
            ]);

        } catch (error) {
            const errorMessage = `
❌ Failed to retrieve DAG runs

**Error:** ${error instanceof Error ? error.message : String(error)}

Please check:
- The DAG ID is correct
- The Airflow server is accessible
- You have the necessary permissions
            `.trim();

            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(errorMessage)
            ]);
        }
    }

    /**
     * Helper to get emoji for run status
     */
    private getStatusEmoji(status: string): string {
        const statusMap: { [key: string]: string } = {
            'success': '✅',
            'failed': '❌',
            'running': '▶️',
            'queued': '⏳',
            'upstream_failed': '⚠️',
            'skipped': '⏭️',
            'up_for_retry': '🔄',
            'up_for_reschedule': '📅',
            'removed': '🗑️',
            'scheduled': '📆'
        };
        return statusMap[status.toLowerCase()] || '❓';
    }
}
