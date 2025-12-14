/**
 * GoToDagLogViewTool - Language Model Tool for opening the DAG Log View panel
 * 
 * This tool allows users to open the DagLogView for a specific DAG,
 * optionally providing dagRunId, taskId, and tryNumber.
 */

import * as vscode from 'vscode';
import { Session } from '../common/Session';
import { DagLogView } from '../report/DagLogView';
import { AIHandler } from './AIHandler';

/**
 * Input parameters for opening DAG Log View
 */
export interface IGoToDagLogViewParams {
    dagId: string;
    dagRunId?: string;
    taskId?: string;
    tryNumber?: number;
}

/**
 * GoToDagLogViewTool - Implements vscode.LanguageModelTool for opening DAG Log View
 * 
 * This tool opens the DagLogView panel to display logs for tasks.
 */
export class GoToDagLogViewTool implements vscode.LanguageModelTool<IGoToDagLogViewParams> {

    constructor() {
    }

    async prepareInvocation(
        options: vscode.LanguageModelToolInvocationPrepareOptions<IGoToDagLogViewParams>,
        token: vscode.CancellationToken
    ): Promise<vscode.PreparedToolInvocation> {
        const { dagId, dagRunId, taskId, tryNumber } = options.input;

        let message = `Opening DAG Log View for: **${dagId}**`;
        if (dagRunId) {
            message += `\nDAG Run ID: **${dagRunId}**`;
        }
        if (taskId) {
            message += `\nTask ID: **${taskId}**`;
        }
        if (tryNumber) {
            message += `\nTry Number: **${tryNumber}**`;
        }

        return {
            invocationMessage: message
        };
    }

    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<IGoToDagLogViewParams>,
        token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {
        const { dagId, dagRunId, taskId, tryNumber } = options.input;
        AIHandler.Current.currentDagId = dagId;
        
        try {

            // Check if API is available
            if (!Session.Current.Api) {
                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart('❌ Not connected to an Airflow server. Please connect to a server first.')
                ]);
            }

            // Open the DagLogView with the specified parameters
            DagLogView.render(dagId, dagRunId, taskId, tryNumber);

            let successMessage = `✅ Opened DAG Log View for: **${dagId}**`;
            if (dagRunId) successMessage += `, Run: **${dagRunId}**`;
            if (taskId) successMessage += `, Task: **${taskId}**`;
            if (tryNumber) successMessage += `, Try: **${tryNumber}**`;

            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(successMessage)
            ]);

        } catch (error) {
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(`❌ Failed to open DAG Log View for ${dagId}: ${error instanceof Error ? error.message : String(error)}`)
            ]);
        }
    }
}
