/**
 * GoToConnectionsViewTool - Language Model Tool for opening the Connections view
 */

import * as vscode from 'vscode';
import { Session } from '../common/Session';
import { ConnectionsView } from '../admin/ConnectionsView';
import { Telemetry } from '../common/Telemetry';

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
        // Track tool invocation
        Telemetry.Current.send('GoToConnectionsViewTool.invoke');
        
        try {
            if (!Session.Current.Api) {
                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart('❌ Not connected to an Airflow server. Please connect to a server first.')
                ]);
            }

            ConnectionsView.render();

            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart('✅ Opened Connections View - showing Airflow connections (databases, APIs, cloud services, etc.)')
            ]);

        } catch (error) {
            // Track invocation error
            Telemetry.Current.sendError('GoToConnectionsViewTool.invocationError', error instanceof Error ? error : new Error(String(error)));
            
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(`❌ Failed to open Connections View: ${error instanceof Error ? error.message : String(error)}`)
            ]);
        }
    }
}
