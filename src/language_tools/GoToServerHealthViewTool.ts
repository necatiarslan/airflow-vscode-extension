/**
 * GoToServerHealthViewTool - Language Model Tool for opening the Server Health view
 */

import * as vscode from 'vscode';
import { DagTreeView } from '../dag/DagTreeView';
import { ServerHealthView } from '../admin/ServerHealthView';

/**
 * GoToServerHealthViewTool - Opens the Server Health panel
 */
export class GoToServerHealthViewTool implements vscode.LanguageModelTool<void> {

    constructor() {}

    async prepareInvocation(
        options: vscode.LanguageModelToolInvocationPrepareOptions<void>,
        token: vscode.CancellationToken
    ): Promise<vscode.PreparedToolInvocation> {
        return {
            invocationMessage: 'Opening Server Health View...'
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

            ServerHealthView.render(extensionUri, api);

            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart('✅ Opened Server Health View - showing Airflow server health status, scheduler status, and metadata database status')
            ]);

        } catch (error) {
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(`❌ Failed to open Server Health View: ${error instanceof Error ? error.message : String(error)}`)
            ]);
        }
    }
}
