/**
 * GoToVariablesViewTool - Language Model Tool for opening the Variables view
 */

import * as vscode from 'vscode';
import { Session } from '../common/Session';
import { VariablesView } from '../admin/VariablesView';

/**
 * GoToVariablesViewTool - Opens the Variables panel
 */
export class GoToVariablesViewTool implements vscode.LanguageModelTool<void> {

    constructor() {}

    async prepareInvocation(
        options: vscode.LanguageModelToolInvocationPrepareOptions<void>,
        token: vscode.CancellationToken
    ): Promise<vscode.PreparedToolInvocation> {
        return {
            invocationMessage: 'Opening Variables View...'
        };
    }

    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<void>,
        token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {
        try {
            if (!Session.Current.Api) {
                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart('❌ Not connected to an Airflow server. Please connect to a server first.')
                ]);
            }

            VariablesView.render();

            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart('✅ Opened Variables View - showing Airflow variables (key-value configuration settings)')
            ]);

        } catch (error) {
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(`❌ Failed to open Variables View: ${error instanceof Error ? error.message : String(error)}`)
            ]);
        }
    }
}
