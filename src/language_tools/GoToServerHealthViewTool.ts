/**
 * GoToServerHealthViewTool - Language Model Tool for opening the Server Health view
 */

import * as vscode from 'vscode';
import { Session } from '../common/Session';
import { ServerHealthView } from '../admin/ServerHealthView';
import { Telemetry } from '../common/Telemetry';

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
        // Track tool invocation
        Telemetry.Current.send('GoToServerHealthViewTool.invoke');
        
        try {
            if (!Session.Current.Api) {
                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart('❌ Not connected to an Airflow server. Please connect to a server first.')
                ]);
            }

            ServerHealthView.render();

            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart('✅ Opened Server Health View - showing Airflow server health status, scheduler status, and metadata database status')
            ]);

        } catch (error) {
            // Track invocation error
            Telemetry.Current.sendError('GoToServerHealthViewTool.invocationError', error instanceof Error ? error : new Error(String(error)));
            
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(`❌ Failed to open Server Health View: ${error instanceof Error ? error.message : String(error)}`)
            ]);
        }
    }
}
