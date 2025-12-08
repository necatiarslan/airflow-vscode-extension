/**
 * GoToDagViewTool - Language Model Tool for opening the DAG View panel
 * 
 * This tool allows users to open the DagView for a specific DAG,
 * optionally navigating to a specific DAG run.
 */

import * as vscode from 'vscode';
import { Session } from '../common/Session';
import { DagView } from '../dag/DagView';

export interface IGoToDagViewParams {
    dagId: string;
    dagRunId?: string;
}

/**
 * GoToDagViewTool - Implements vscode.LanguageModelTool for opening DAG View
 * 
 * This tool opens the DagView panel to display information about a specific DAG.
 * If a dagRunId is provided, it will navigate to that specific run.
 */
export class GoToDagViewTool implements vscode.LanguageModelTool<IGoToDagViewParams> {

    constructor() {
        // No external dependencies needed - uses DagTreeView.Current directly
    }

    async prepareInvocation(
        options: vscode.LanguageModelToolInvocationPrepareOptions<IGoToDagViewParams>,
        token: vscode.CancellationToken
    ): Promise<vscode.PreparedToolInvocation> {
        const { dagId, dagRunId } = options.input;

        let message = `Opening DAG View for: **${dagId}**`;
        if (dagRunId) {
            message += `\nDAG Run ID: **${dagRunId}**`;
        }

        return {
            invocationMessage: message
        };
    }

    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<IGoToDagViewParams>,
        token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {
        const { dagId, dagRunId } = options.input;

        try {

            // Check if API is available
            if (!Session.Current.Api) {
                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart('❌ Not connected to an Airflow server. Please connect to a server first.')
                ]);
            }

            // Open the DagView with the specified DAG ID and optional run ID
            DagView.render(dagId, dagRunId);

            let successMessage = `✅ Opened DAG View for: **${dagId}**`;
            if (dagRunId) {
                successMessage += `\n📋 Showing DAG Run: **${dagRunId}**`;
            } else {
                successMessage += `\n📋 Showing latest DAG run`;
            }

            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(successMessage)
            ]);

        } catch (error) {
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(`❌ Failed to open DAG View for ${dagId}: ${error instanceof Error ? error.message : String(error)}`)
            ]);
        }
    }
}
