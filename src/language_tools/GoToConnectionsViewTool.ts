/**
 * GoToConnectionsViewTool - Language Model Tool for opening the Connections view
 */

import * as vscode from 'vscode';
import { DagTreeView } from '../dag/DagTreeView';
import { ConnectionsView } from '../admin/ConnectionsView';

/**
 * GoToConnectionsViewTool - Opens the Connections panel
 */
export class GoToConnectionsViewTool implements vscode.LanguageModelTool<void> {

    constructor() {}

    async prepareInvocation(
        options: vscode.LanguageModelToolInvocationPrepareOptions<void>,
        token: vscode.CancellationToken
    ): Promise<vscode.PreparedToolInvocation> {
        return {
            invocationMessage: 'Opening Connections View...'
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

            ConnectionsView.render(extensionUri, api);

            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart('✅ Opened Connections View - showing Airflow connections (databases, APIs, cloud services, etc.)')
            ]);

        } catch (error) {
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(`❌ Failed to open Connections View: ${error instanceof Error ? error.message : String(error)}`)
            ]);
        }
    }
}
