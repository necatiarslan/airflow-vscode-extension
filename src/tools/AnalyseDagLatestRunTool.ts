/**
 * AnalyseDagLatestRunTool - Language Model Tool for comprehensive DAG run analysis
 * 
 * This tool retrieves comprehensive information about the latest DAG run including:
 * - DAG run details
 * - Task instances
 * - DAG source code
 * - Task logs
 * 
 * It provides a complete analysis to help diagnose issues and understand execution.
 */

import * as vscode from 'vscode';
import { AirflowClientAdapter } from '../AirflowClientAdapter';

/**
 * Input parameters for analyzing latest DAG run
 */
export interface IAnalyseDagLatestRunParams {
    dag_id: string;
}

/**
 * AnalyseDagLatestRunTool - Implements vscode.LanguageModelTool for comprehensive DAG analysis
 */
export class AnalyseDagLatestRunTool implements vscode.LanguageModelTool<IAnalyseDagLatestRunParams> {
    private client: AirflowClientAdapter;

    constructor(client: AirflowClientAdapter) {
        this.client = client;
    }

    /**
     * Prepare invocation
     */
    async prepareInvocation(
        options: vscode.LanguageModelToolInvocationPrepareOptions<IAnalyseDagLatestRunParams>,
        token: vscode.CancellationToken
    ): Promise<vscode.PreparedToolInvocation | undefined> {
        const { dag_id } = options.input;

        return {
            invocationMessage: `Analyzing latest run for DAG '${dag_id}'...`
        };
    }

    /**
     * Execute comprehensive DAG run analysis
     */
    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<IAnalyseDagLatestRunParams>,
        token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {
        const { dag_id } = options.input;

        try {
            // Step 1: Get the latest DAG run
            const dagRun = await this.client.getLatestDagRun(dag_id);

            if (!dagRun) {
                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart(`ℹ️ No DAG run found for '${dag_id}'.`)
                ]);
            }

            // Step 2: Get task instances for this run
            const taskInstances = await this.client.getTaskInstances(dag_id, dagRun.dag_run_id);

            // Step 3: Get DAG source code
            let dagSourceCode = 'N/A';
            try {
                dagSourceCode = await this.client.getDagSource(dag_id);
            } catch (error) {
                dagSourceCode = `Failed to retrieve source code: ${error instanceof Error ? error.message : String(error)}`;
            }

            // Step 4: Get logs for each task (focusing on failed tasks first, then all)
            const taskLogs: { task_id: string; state: string; log: string }[] = [];
            
            // Sort tasks: failed first, then by execution order
            const sortedTasks = [...taskInstances].sort((a: any, b: any) => {
                const failedStates = ['failed', 'upstream_failed'];
                const aFailed = failedStates.includes(a.state);
                const bFailed = failedStates.includes(b.state);
                
                if (aFailed && !bFailed) return -1;
                if (!aFailed && bFailed) return 1;
                return 0;
            });

            // Get logs for up to 5 tasks (prioritizing failed tasks)
            const tasksToLog = sortedTasks.slice(0, 5);
            for (const task of tasksToLog) {
                try {
                    const log = await this.client.getTaskLog(
                        dag_id, 
                        dagRun.dag_run_id, 
                        task.task_id, 
                        task.try_number?.toString() || '1'
                    );
                    taskLogs.push({
                        task_id: task.task_id,
                        state: task.state,
                        log: log
                    });
                } catch (error) {
                    taskLogs.push({
                        task_id: task.task_id,
                        state: task.state,
                        log: `Failed to retrieve log: ${error instanceof Error ? error.message : String(error)}`
                    });
                }
            }

            // Build comprehensive analysis report
            let report = this.buildAnalysisReport(dag_id, dagRun, taskInstances, dagSourceCode, taskLogs);

            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(report)
            ]);

        } catch (error) {
            const errorMessage = `
❌ Failed to analyze DAG run

**Error:** ${error instanceof Error ? error.message : String(error)}

Please check:
- The DAG ID is correct
- The Airflow server is accessible
- You have the necessary permissions
            `.trim();

            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(errorMessage)
            ]);
        }
    }

    /**
     * Build comprehensive analysis report
     */
    private buildAnalysisReport(
        dagId: string,
        dagRun: any,
        taskInstances: any[],
        dagSourceCode: string,
        taskLogs: { task_id: string; state: string; log: string }[]
    ): string {
        let report = `# 🔍 Comprehensive DAG Run Analysis\n\n`;
        report += `## DAG: ${dagId}\n\n`;
        report += `---\n\n`;

        // Section 1: DAG Run Overview
        report += `## 📊 DAG Run Overview\n\n`;
        report += `- **Run ID:** \`${dagRun.dag_run_id}\`\n`;
        report += `- **State:** ${this.getStatusEmoji(dagRun.state)} **${dagRun.state}**\n`;
        report += `- **Execution Date:** ${dagRun.execution_date}\n`;
        report += `- **Logical Date:** ${dagRun.logical_date}\n`;
        
        if (dagRun.start_date) {
            report += `- **Start Date:** ${dagRun.start_date}\n`;
        }
        if (dagRun.end_date) {
            report += `- **End Date:** ${dagRun.end_date}\n`;
            
            // Calculate duration
            const start = new Date(dagRun.start_date);
            const end = new Date(dagRun.end_date);
            const durationMs = end.getTime() - start.getTime();
            const durationSec = Math.floor(durationMs / 1000);
            const minutes = Math.floor(durationSec / 60);
            const seconds = durationSec % 60;
            report += `- **Duration:** ${minutes}m ${seconds}s\n`;
        }
        
        report += `\n---\n\n`;

        // Section 2: Task Instances Summary
        report += `## 📋 Task Instances (${taskInstances.length} tasks)\n\n`;
        
        // Group tasks by state
        const tasksByState: { [state: string]: any[] } = {};
        taskInstances.forEach((task: any) => {
            const state = task.state || 'unknown';
            if (!tasksByState[state]) {
                tasksByState[state] = [];
            }
            tasksByState[state].push(task);
        });

        // Display summary by state
        for (const [state, tasks] of Object.entries(tasksByState)) {
            report += `### ${this.getStatusEmoji(state)} ${state} (${tasks.length})\n`;
            tasks.forEach((task: any) => {
                report += `- **${task.task_id}**`;
                if (task.duration) {
                    report += ` - Duration: ${Math.round(task.duration)}s`;
                }
                if (task.start_date) {
                    report += ` - Started: ${task.start_date}`;
                }
                report += `\n`;
            });
            report += `\n`;
        }

        report += `---\n\n`;

        // Section 3: Task Logs Analysis
        if (taskLogs.length > 0) {
            report += `## 📝 Task Logs (Top ${taskLogs.length} tasks)\n\n`;
            
            taskLogs.forEach((taskLog, index) => {
                report += `### ${index + 1}. Task: ${taskLog.task_id} (${this.getStatusEmoji(taskLog.state)} ${taskLog.state})\n\n`;
                report += `\`\`\`\n${taskLog.log}\n\`\`\`\n\n`;
            });

            report += `---\n\n`;
        }

        // Section 4: DAG Source Code
        report += `## 💻 DAG Source Code\n\n`;
        report += `\`\`\`python\n${dagSourceCode}\n\`\`\`\n\n`;
        report += `---\n\n`;

        // Section 5: Raw Data
        report += `## 📦 Raw Data (JSON)\n\n`;
        report += `### DAG Run\n\`\`\`json\n${JSON.stringify(dagRun, null, 2)}\n\`\`\`\n\n`;
        report += `### Task Instances\n\`\`\`json\n${JSON.stringify(taskInstances, null, 2)}\n\`\`\`\n\n`;

        // Section 6: Analysis Prompt
        report += `---\n\n`;
        report += `## 🤖 Analysis Request\n\n`;
        report += `Please analyze the above information and provide:\n`;
        report += `1. **Summary of Execution:** What happened during this DAG run?\n`;
        report += `2. **Issues Identified:** What errors or problems occurred?\n`;
        report += `3. **Root Cause Analysis:** What likely caused any failures?\n`;
        report += `4. **Recommendations:** How can these issues be resolved?\n`;
        report += `5. **Code Review:** Any issues in the DAG code that need attention?\n`;

        return report;
    }

    /**
     * Helper to get emoji for task/run status
     */
    private getStatusEmoji(status: string): string {
        const statusMap: { [key: string]: string } = {
            'success': '✅',
            'failed': '❌',
            'running': '▶️',
            'queued': '⏳',
            'upstream_failed': '⚠️',
            'skipped': '⏭️',
            'up_for_retry': '🔄',
            'up_for_reschedule': '📅',
            'removed': '🗑️',
            'scheduled': '📆',
            'none': '⚪',
            'unknown': '❓'
        };
        return statusMap[status?.toLowerCase()] || '❓';
    }
}
