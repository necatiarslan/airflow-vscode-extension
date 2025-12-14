/**
 * GetDagHistoryTool - Language Model Tool for retrieving DAG run history
 * 
 * This tool retrieves the run history for a specific DAG, optionally filtered by date.
 * Returns date of run, status, duration, and notes for each run.
 */

import * as vscode from 'vscode';
import { AirflowClientAdapter } from './AirflowClientAdapter';
import * as ui from '../common/UI';
import { AIHandler } from './AIHandler';

/**
 * Input parameters for querying DAG history
 */
export interface IGetDagHistoryParams {
    dagId: string;
    date?: string; // Optional date in YYYY-MM-DD format (defaults to today)
}

/**
 * GetDagHistoryTool - Implements vscode.LanguageModelTool for retrieving DAG history
 */
export class GetDagHistoryTool implements vscode.LanguageModelTool<IGetDagHistoryParams> {
    private client: AirflowClientAdapter;

    constructor(client: AirflowClientAdapter) {
        this.client = client;
    }

    /**
     * Prepare invocation - minimal for read-only operations
     */
    async prepareInvocation(
        options: vscode.LanguageModelToolInvocationPrepareOptions<IGetDagHistoryParams>,
        token: vscode.CancellationToken
    ): Promise<vscode.PreparedToolInvocation | undefined> {
        const { dagId, date } = options.input;
        const dateStr = date || ui.toISODateString(new Date());

        return {
            invocationMessage: `Retrieving history for DAG '${dagId}' (date: ${dateStr})`
        };
    }

    /**
     * Execute the query for DAG history
     */
    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<IGetDagHistoryParams>,
        token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {
        const { dagId, date } = options.input;
        AIHandler.Current.currentDagId = dagId;
        // Use today's date if not provided
        const queryDate = date ||  ui.toISODateString(new Date());

        try {
            // Get DAG run history from the API
            const result = await this.client.getDagRunHistory(dagId, queryDate);

            if (!result || !result.dag_runs || result.dag_runs.length === 0) {
                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart(`ℹ️ No run history found for DAG '${dagId}' on ${queryDate}.`)
                ]);
            }

            const runs = result.dag_runs;

            // Build detailed summary
            let summaryMessage = `## 📜 DAG Run History for '${dagId}'\n\n`;
            summaryMessage += `**Date Filter:** ${queryDate}\n`;
            summaryMessage += `**Total Runs:** ${runs.length}\n\n`;
            summaryMessage += `---\n\n`;

            // Add individual run details in a table-like format
            summaryMessage += `| # | Date/Time | Status | Duration | Note |\n`;
            summaryMessage += `|---|-----------|--------|----------|------|\n`;

            runs.forEach((run: any, index: number) => {
                const runDate = run.execution_date || run.logical_date || 'N/A';
                const status = this.getStatusEmoji(run.state) + ' ' + (run.state || 'unknown');
                
                let duration = 'N/A';
                if (run.start_date && run.end_date) {
                    const start = new Date(run.start_date);
                    const end = new Date(run.end_date);
                    const durationMs = end.getTime() - start.getTime();
                    const durationSec = Math.floor(durationMs / 1000);
                    const minutes = Math.floor(durationSec / 60);
                    const seconds = durationSec % 60;
                    duration = `${minutes}m ${seconds}s`;
                } else if (run.start_date && !run.end_date) {
                    duration = '⏳ Running';
                }
                
                const note = run.note || '-';
                
                summaryMessage += `| ${index + 1} | ${runDate} | ${status} | ${duration} | ${note} |\n`;
            });

            summaryMessage += `\n---\n\n`;

            // Add detailed breakdown
            summaryMessage += `### Detailed Breakdown\n\n`;
            
            runs.forEach((run: any, index: number) => {
                summaryMessage += `#### ${index + 1}. Run ID: ${run.dag_run_id || run.run_id}\n\n`;
                summaryMessage += `- **Status:** ${this.getStatusEmoji(run.state)} ${run.state || 'unknown'}\n`;
                summaryMessage += `- **Execution Date:** ${run.execution_date || run.logical_date}\n`;
                summaryMessage += `- **Logical Date:** ${run.logical_date || run.execution_date}\n`;
                
                if (run.start_date) {
                    summaryMessage += `- **Start Date:** ${run.start_date}\n`;
                }
                if (run.end_date) {
                    summaryMessage += `- **End Date:** ${run.end_date}\n`;
                    
                    const start = new Date(run.start_date);
                    const end = new Date(run.end_date);
                    const durationMs = end.getTime() - start.getTime();
                    const durationSec = Math.floor(durationMs / 1000);
                    const minutes = Math.floor(durationSec / 60);
                    const seconds = durationSec % 60;
                    summaryMessage += `- **Duration:** ${minutes}m ${seconds}s\n`;
                }
                
                if (run.note) {
                    summaryMessage += `- **Note:** ${run.note}\n`;
                }
                
                if (run.conf && Object.keys(run.conf).length > 0) {
                    summaryMessage += `- **Configuration:** \`${JSON.stringify(run.conf)}\`\n`;
                }
                
                summaryMessage += `\n`;
            });

            // Include raw JSON for LLM processing
            summaryMessage += `---\n\n**Raw Data (JSON):**\n\n`;
            summaryMessage += `\`\`\`json\n${JSON.stringify(runs, null, 2)}\n\`\`\`\n`;

            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(summaryMessage)
            ]);

        } catch (error) {
            const errorMessage = `
❌ Failed to retrieve DAG history

**Error:** ${error instanceof Error ? error.message : String(error)}

Please check:
- The DAG ID is correct
- The date format is YYYY-MM-DD
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
        return statusMap[status?.toLowerCase()] || '❓';
    }
}
