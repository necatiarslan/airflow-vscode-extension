/**
 * AnalyzeTaskLogTool - Language Model Tool for analyzing Airflow task logs
 * 
 * This tool retrieves task logs and provides them to the LLM for analysis.
 * It includes a security confirmation step to prevent accidental exposure of sensitive log data.
 */

import * as vscode from 'vscode';
import { AirflowClientAdapter } from '../AirflowClientAdapter';

/**
 * Input parameters for analyzing task logs
 */
export interface IAnalyzeParams {
    dag_id: string;
    dag_run_id?: string;
    task_id?: string;
    try_number?: string;
}

/**
 * AnalyzeDagRunTool - Implements vscode.LanguageModelTool for log analysis
 */
export class AnalyzeDagRunTool implements vscode.LanguageModelTool<IAnalyzeParams> {
    private client: AirflowClientAdapter;

    constructor(client: AirflowClientAdapter) {
        this.client = client;
    }

    /**
     * Helper to resolve optional parameters by fetching latest run/task details
     */
    private async resolveInput(input: IAnalyzeParams): Promise<Required<IAnalyzeParams>> {
        let { dag_id, dag_run_id, task_id, try_number } = input;

        // 1. Resolve DAG Run
        if (!dag_run_id) {
            const latestRun = await this.client.getLatestDagRun(dag_id);
            if (!latestRun) {
                throw new Error(`No runs found for DAG ${dag_id}`);
            }
            dag_run_id = latestRun.dag_run_id;
        }

        // 2. Resolve Task and Try Number
        if (!task_id || !try_number) {
            const tasks = await this.client.getTaskInstances(dag_id, dag_run_id);
            
            if (!task_id) {
                // Find first failed task
                const failedTask = tasks.find((t: any) => t.state === 'failed' || t.state === 'upstream_failed');
                if (!failedTask) {
                    throw new Error(`No failed tasks found in DAG run ${dag_run_id}. Please specify a task_id.`);
                }
                task_id = failedTask.task_id;
                // Use the try number from the found task if not provided
                if (!try_number) {
                    try_number = failedTask.try_number.toString();
                }
            } else if (!try_number) {
                // Task ID provided, but try_number missing
                const task = tasks.find((t: any) => t.task_id === task_id);
                if (task) {
                    try_number = task.try_number.toString();
                } else {
                    // Default to '1' if task instance not found (fallback)
                    try_number = '1';
                }
            }
        }

        return { 
            dag_id, 
            dag_run_id: dag_run_id!, 
            task_id: task_id!, 
            try_number: try_number || '1' 
        };
    }

    /**
     * SECURITY CRITICAL: Prepare invocation with user confirmation
     */
    async prepareInvocation(
        options: vscode.LanguageModelToolInvocationPrepareOptions<IAnalyzeParams>,
        token: vscode.CancellationToken
    ): Promise<vscode.PreparedToolInvocation | undefined> {
        
        try {
            // Resolve parameters to show the user exactly what will be analyzed
            const resolved = await this.resolveInput(options.input);
            const { dag_id, dag_run_id, task_id, try_number } = resolved;

            const confirmationMessage = new vscode.MarkdownString();
            confirmationMessage.isTrusted = true;
            confirmationMessage.appendMarkdown('## ⚠️ Analyze Task Log Confirmation\n\n');
            confirmationMessage.appendMarkdown('You are about to retrieve and analyze logs for the following task:\n\n');
            confirmationMessage.appendMarkdown(`- **DAG ID:** \`${dag_id}\`\n`);
            confirmationMessage.appendMarkdown(`- **Run ID:** \`${dag_run_id}\`\n`);
            confirmationMessage.appendMarkdown(`- **Task ID:** \`${task_id}\`\n`);
            confirmationMessage.appendMarkdown(`- **Try Number:** \`${try_number}\`\n\n`);
            
            confirmationMessage.appendMarkdown('**Security Warning:**\n');
            confirmationMessage.appendMarkdown('Task logs may contain sensitive information (environment variables, connection strings, data samples). ');
            confirmationMessage.appendMarkdown('Proceeding will send these logs to the Language Model for analysis.\n\n');
            confirmationMessage.appendMarkdown('Do you want to proceed?');

            return {
                invocationMessage: `Analyzing logs for ${dag_id} / ${task_id}`,
                confirmationMessages: {
                    title: 'Confirm Log Analysis',
                    message: confirmationMessage
                }
            };
        } catch (error) {
            // If resolution fails, we can't prepare the confirmation properly.
            // We return a generic error message in the confirmation dialog or throw?
            // Throwing here might be handled by VS Code UI.
            throw new Error(`Failed to prepare log analysis: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Execute the log analysis
     */
    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<IAnalyzeParams>,
        token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {
        try {
            // Re-resolve inputs (stateless)
            const { dag_id, dag_run_id, task_id, try_number } = await this.resolveInput(options.input);

            const logContent = await this.client.getTaskLog(dag_id, dag_run_id, task_id, try_number);

            const message = [
                `## Log Analysis for ${task_id}`,
                ``,
                `**Context:**`,
                `- DAG: ${dag_id}`,
                `- Run: ${dag_run_id}`,
                `- Try: ${try_number}`,
                ``,
                `**Log Content (Truncated):**`,
                '```',
                logContent,
                '```',
                ``,
                `Please analyze the above log for errors and suggest potential fixes.`
            ].join('\n');

            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(message)
            ]);

        } catch (error) {
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(`❌ Failed to analyze logs: ${error instanceof Error ? error.message : String(error)}`)
            ]);
        }
    }
}
