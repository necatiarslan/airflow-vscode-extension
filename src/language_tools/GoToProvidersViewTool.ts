/**
 * GoToProvidersViewTool - Language Model Tool for opening the Providers view
 */

import * as vscode from 'vscode';
import { Session } from '../common/Session';
import { ProvidersView } from '../admin/ProvidersView';
import { Telemetry } from '../common/Telemetry';

/**
 * GoToProvidersViewTool - Opens the Providers panel
 */
export class GoToProvidersViewTool implements vscode.LanguageModelTool<void> {

    constructor() {}

    async prepareInvocation(
        options: vscode.LanguageModelToolInvocationPrepareOptions<void>,
        token: vscode.CancellationToken
    ): Promise<vscode.PreparedToolInvocation> {
        return {
            invocationMessage: 'Opening Providers View...'
        };
    }

    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<void>,
        token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {
        // Track tool invocation
        Telemetry.Current.send('GoToProvidersViewTool.invoke');
        
        try {
            if (!Session.Current.Api) {
                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart('❌ Not connected to an Airflow server. Please connect to a server first.')
                ]);
            }

            ProvidersView.render();

            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart('✅ Opened Providers View - showing installed Airflow providers with their versions')
            ]);

        } catch (error) {
            // Track invocation error
            Telemetry.Current.sendError('GoToProvidersViewTool.invocationError', error instanceof Error ? error : new Error(String(error)));
            
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(`❌ Failed to open Providers View: ${error instanceof Error ? error.message : String(error)}`)
            ]);
        }
    }
}
