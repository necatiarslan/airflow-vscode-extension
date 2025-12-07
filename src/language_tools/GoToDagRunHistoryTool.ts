/**
 * GoToDagRunHistoryTool - Language Model Tool for opening the DAG Run History view
 * 
 * This tool allows users to open the DagRunHistory view with optional filters
 * for dagId, startDate, endDate, and status.
 */

import * as vscode from 'vscode';
import { DagTreeView } from '../dag/DagTreeView';
import { DagRunView } from '../report/DagRunView';

export interface IGoToDagRunHistoryParams {
    dag_id: string;
    start_date?: string;
    end_date?: string;
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
        const { dag_id, start_date, end_date, status } = options.input;

        let message = `Opening DAG Run History for: **${dag_id}**`;
        if (start_date) {
            message += `\nStart Date: **${start_date}**`;
        }
        if (end_date) {
            message += `\nEnd Date: **${end_date}**`;
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
        const { dag_id, start_date, end_date, status } = options.input;

        try {
            // Check if DagTreeView is available
            if (!DagTreeView.Current) {
                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart('❌ DagTreeView is not available. Please ensure the Airflow extension is active and connected to a server.')
                ]);
            }

            // Check if API is available
            if (!DagTreeView.Current.api) {
                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart('❌ Not connected to an Airflow server. Please connect to a server first.')
                ]);
            }

            const api = DagTreeView.Current.api;
            const extensionUri = DagTreeView.Current.context.extensionUri;

            // Validate date format if provided (YYYY-MM-DD)
            const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
            if (start_date && !dateRegex.test(start_date)) {
                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart(`❌ Invalid start_date format: "${start_date}". Expected format: YYYY-MM-DD`)
                ]);
            }
            if (end_date && !dateRegex.test(end_date)) {
                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart(`❌ Invalid end_date format: "${end_date}". Expected format: YYYY-MM-DD`)
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
            DagRunView.render(extensionUri, api, dag_id, start_date, end_date, status?.toLowerCase());

            let successMessage = `✅ Opened DAG Run History for: **${dag_id}**`;
            const filters: string[] = [];
            if (start_date) {
                filters.push(`Start Date: ${start_date}`);
            }
            if (end_date) {
                filters.push(`End Date: ${end_date}`);
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
                new vscode.LanguageModelTextPart(`❌ Failed to open DAG Run History for ${dag_id}: ${error instanceof Error ? error.message : String(error)}`)
            ]);
        }
    }
}
