/**
 * GoToConfigsViewTool - Language Model Tool for opening the Configs view
 */

import * as vscode from 'vscode';
import { DagTreeView } from '../dag/DagTreeView';
import { ConfigsView } from '../admin/ConfigsView';

/**
 * GoToConfigsViewTool - Opens the Configs panel
 */
export class GoToConfigsViewTool implements vscode.LanguageModelTool<void> {

    constructor() {}

    async prepareInvocation(
        options: vscode.LanguageModelToolInvocationPrepareOptions<void>,
        token: vscode.CancellationToken
    ): Promise<vscode.PreparedToolInvocation> {
        return {
            invocationMessage: 'Opening Configs View...'
        };
    }

    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<void>,
        token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {
        try {
            if (!DagTreeView.Current) {
                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart('❌ DagTreeView is not available. Please ensure the Airflow extension is active.')
                ]);
            }

            if (!DagTreeView.Current.api) {
                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart('❌ Not connected to an Airflow server. Please connect to a server first.')
                ]);
            }

            const api = DagTreeView.Current.api;
            const extensionUri = DagTreeView.Current.context.extensionUri;

            ConfigsView.render(extensionUri, api);

            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart('✅ Opened Configs View - showing Airflow configuration settings (airflow.cfg)')
            ]);

        } catch (error) {
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(`❌ Failed to open Configs View: ${error instanceof Error ? error.message : String(error)}`)
            ]);
        }
    }
}
