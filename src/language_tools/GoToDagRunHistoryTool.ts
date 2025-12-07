/**
 * GoToDagRunHistoryTool - Language Model Tool for opening the DAG Run History view
 * 
 * This tool allows users to open the DagRunHistory view with optional filters
 * for dagId, startDate, endDate, and status.
 */

import * as vscode from 'vscode';
import { Session } from '../common/Session';
import { DagRunView } from '../report/DagRunView';

export interface IGoToDagRunHistoryParams {
    dagId: string;
    startDate?: string;
    endDate?: string;
    status?: string;
}

/**
 * GoToDagRunHistoryTool - Implements vscode.LanguageModelTool for opening DAG Run History View
 * 
 * This tool opens the DagRunHistory panel to display run history for a specific DAG.
 * Optional filters can be applied for date range and status.
 */
export class GoToDagRunHistoryTool implements vscode.LanguageModelTool<IGoToDagRunHistoryParams> {

    constructor() {
        // No external dependencies needed - uses DagTreeView.Current directly
    }

    async prepareInvocation(
        options: vscode.LanguageModelToolInvocationPrepareOptions<IGoToDagRunHistoryParams>,
        token: vscode.CancellationToken
    ): Promise<vscode.PreparedToolInvocation> {
        const { dagId, startDate, endDate, status } = options.input;

        let message = `Opening DAG Run History for: **${dagId}**`;
        if (startDate) {
            message += `\nStart Date: **${startDate}**`;
        }
        if (endDate) {
            message += `\nEnd Date: **${endDate}**`;
        }
        if (status) {
            message += `\nStatus Filter: **${status}**`;
        }

        return {
            invocationMessage: message
        };
    }

    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<IGoToDagRunHistoryParams>,
        token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {
        const { dagId, startDate, endDate, status } = options.input;

        try {
            // Check if API is available
            if (!Session.Current?.Api) {
                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart('❌ Not connected to an Airflow server. Please connect to a server first.')
                ]);
            }

            // Validate date format if provided (YYYY-MM-DD)
            const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
            if (startDate && !dateRegex.test(startDate)) {
                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart(`❌ Invalid startDate format: "${startDate}". Expected format: YYYY-MM-DD`)
                ]);
            }
            if (endDate && !dateRegex.test(endDate)) {
                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart(`❌ Invalid endDate format: "${endDate}". Expected format: YYYY-MM-DD`)
                ]);
            }

            // Validate status if provided
            const validStatuses = ['success', 'failed', 'running', 'queued', 'upstream_failed', 'skipped', 'deferred'];
            if (status && !validStatuses.includes(status.toLowerCase())) {
                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart(`❌ Invalid status: "${status}". Valid values: ${validStatuses.join(', ')}`)
                ]);
            }

            // Open the DagRunView with the specified parameters
            DagRunView.render(dagId, startDate, endDate, status?.toLowerCase());

            let successMessage = `✅ Opened DAG Run History for: **${dagId}**`;
            const filters: string[] = [];
            if (startDate) {
                filters.push(`Start Date: ${startDate}`);
            }
            if (endDate) {
                filters.push(`End Date: ${endDate}`);
            }
            if (status) {
                filters.push(`Status: ${status}`);
            }
            if (filters.length > 0) {
                successMessage += `\n📋 Filters applied: ${filters.join(', ')}`;
            }

            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(successMessage)
            ]);

        } catch (error) {
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(`❌ Failed to open DAG Run History for ${dagId}: ${error instanceof Error ? error.message : String(error)}`)
            ]);
        }
    }
}
