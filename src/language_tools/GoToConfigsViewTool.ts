/**
 * GoToConfigsViewTool - Language Model Tool for opening the Configs view
 */

import * as vscode from 'vscode';
import { Session } from '../common/Session';
import { ConfigsView } from '../admin/ConfigsView';
import { Telemetry } from '../common/Telemetry';

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
        // Track tool invocation
        Telemetry.Current.send('GoToConfigsViewTool.invoke');
        
        try {

            if (!Session.Current.Api) {
                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart('❌ Not connected to an Airflow server. Please connect to a server first.')
                ]);
            }

            ConfigsView.render();

            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart('✅ Opened Configs View - showing Airflow configuration settings (airflow.cfg)')
            ]);

        } catch (error) {
            // Track invocation error
            Telemetry.Current.sendError('GoToConfigsViewTool.invocationError', error instanceof Error ? error : new Error(String(error)));
            
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(`❌ Failed to open Configs View: ${error instanceof Error ? error.message : String(error)}`)
            ]);
        }
    }
}
