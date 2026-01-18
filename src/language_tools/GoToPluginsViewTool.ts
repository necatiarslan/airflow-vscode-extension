/**
 * GoToPluginsViewTool - Language Model Tool for opening the Plugins view
 */

import * as vscode from 'vscode';
import { Session } from '../common/Session';
import { PluginsView } from '../admin/PluginsView';
import { Telemetry } from '../common/Telemetry';

/**
 * GoToPluginsViewTool - Opens the Plugins panel
 */
export class GoToPluginsViewTool implements vscode.LanguageModelTool<void> {

    constructor() {}

    async prepareInvocation(
        options: vscode.LanguageModelToolInvocationPrepareOptions<void>,
        token: vscode.CancellationToken
    ): Promise<vscode.PreparedToolInvocation> {
        return {
            invocationMessage: 'Opening Plugins View...'
        };
    }

    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<void>,
        token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {
        // Track tool invocation
        Telemetry.Current.send('GoToPluginsViewTool.invoke');
        
        try {
            if (!Session.Current.Api) {
                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart('❌ Not connected to an Airflow server. Please connect to a server first.')
                ]);
            }

            PluginsView.render();

            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart('✅ Opened Plugins View - showing installed Airflow plugins')
            ]);

        } catch (error) {
            // Track invocation error
            Telemetry.Current.sendError('GoToPluginsViewTool.invocationError', error instanceof Error ? error : new Error(String(error)));
            
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(`❌ Failed to open Plugins View: ${error instanceof Error ? error.message : String(error)}`)
            ]);
        }
    }
}
