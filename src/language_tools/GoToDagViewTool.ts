/**
 * GoToDagViewTool - Language Model Tool for opening the DAG View panel
 * 
 * This tool allows users to open the DagView for a specific DAG,
 * optionally navigating to a specific DAG run.
 */

import * as vscode from 'vscode';
import { DagTreeView } from '../dag/DagTreeView';
import { DagView } from '../dag/DagView';

export interface IGoToDagViewParams {
    dag_id: string;
    dag_run_id?: string;
}

/**
 * GoToDagViewTool - Implements vscode.LanguageModelTool for opening DAG View
 * 
 * This tool opens the DagView panel to display information about a specific DAG.
 * If a dag_run_id is provided, it will navigate to that specific run.
 */
export class GoToDagViewTool implements vscode.LanguageModelTool<IGoToDagViewParams> {

    constructor() {
        // No external dependencies needed - uses DagTreeView.Current directly
    }

    async prepareInvocation(
        options: vscode.LanguageModelToolInvocationPrepareOptions<IGoToDagViewParams>,
        token: vscode.CancellationToken
    ): Promise<vscode.PreparedToolInvocation> {
        const { dag_id, dag_run_id } = options.input;

        let message = `Opening DAG View for: **${dag_id}**`;
        if (dag_run_id) {
            message += `\nDAG Run ID: **${dag_run_id}**`;
        }

        return {
            invocationMessage: message
        };
    }

    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<IGoToDagViewParams>,
        token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {
        const { dag_id, dag_run_id } = options.input;

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

            // Open the DagView with the specified DAG ID and optional run ID
            DagView.render(extensionUri, dag_id, api, dag_run_id);

            let successMessage = `✅ Opened DAG View for: **${dag_id}**`;
            if (dag_run_id) {
                successMessage += `\n📋 Showing DAG Run: **${dag_run_id}**`;
            } else {
                successMessage += `\n📋 Showing latest DAG run`;
            }

            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(successMessage)
            ]);

        } catch (error) {
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(`❌ Failed to open DAG View for ${dag_id}: ${error instanceof Error ? error.message : String(error)}`)
            ]);
        }
    }
}
