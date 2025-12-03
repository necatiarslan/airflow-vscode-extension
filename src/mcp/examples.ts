/**
 * Example usage of the AirflowMcpClient
 * 
 * This file demonstrates real-world usage patterns for the MCP client
 * in a VS Code extension context.
 */

import { 
    AirflowMcpClient, 
    AirflowApiException, 
    ValidationError,
    Dag,
    DagRun 
} from './index';

// ============================================================================
// Example 1: Initialize and Test Connection
// ============================================================================

async function initializeClient(baseUrl: string, jwtToken: string): Promise<AirflowMcpClient | null> {
    try {
        const client = new AirflowMcpClient(baseUrl, jwtToken);
        
        // Test connection by checking health
        const health = await client.getHealth();
        
        console.log('✓ Connected to Airflow');
        console.log(`  Scheduler: ${health.scheduler.status}`);
        console.log(`  Database: ${health.metadatabase.status}`);
        
        return client;
    } catch (error) {
        if (error instanceof AirflowApiException) {
            console.error(`✗ Connection failed: ${error.getUserFriendlyMessage()}`);
        } else {
            console.error(`✗ Unexpected error: ${error}`);
        }
        return null;
    }
}

// ============================================================================
// Example 2: DAG Management Dashboard
// ============================================================================

async function getDagDashboard(client: AirflowMcpClient) {
    try {
        // Get all active DAGs
        const response = await client.listDags({ 
            limit: 100,
            only_active: true 
        });

        const dags = response.dags || [];
        
        console.log(`\n📊 DAG Dashboard (${dags.length} active DAGs)\n`);
        console.log('─'.repeat(80));
        
        for (const dag of dags) {
            const status = dag.is_paused ? '⏸️  Paused' : '▶️  Active';
            const schedule = dag.schedule_interval?.value || 'None';
            
            console.log(`${status} | ${dag.dag_id}`);
            console.log(`  📅 Schedule: ${schedule}`);
            console.log(`  👥 Owners: ${dag.owners.join(', ')}`);
            console.log(`  🏷️  Tags: ${dag.tags.map(t => t.name).join(', ') || 'None'}`);
            
            if (dag.next_dagrun) {
                console.log(`  ⏭️  Next run: ${dag.next_dagrun}`);
            }
            
            console.log('─'.repeat(80));
        }
        
        return dags;
    } catch (error) {
        if (error instanceof AirflowApiException) {
            console.error(`Failed to load dashboard: ${error.getUserFriendlyMessage()}`);
        }
        return [];
    }
}

// ============================================================================
// Example 3: Monitor DAG Runs with Real-time Updates
// ============================================================================

async function monitorDagRuns(
    client: AirflowMcpClient, 
    dagId: string,
    pollIntervalMs: number = 5000
) {
    console.log(`\n🔍 Monitoring DAG runs for: ${dagId}\n`);
    
    const monitorOnce = async () => {
        try {
            const response = await client.listDagRuns({
                dag_id: dagId,
                limit: 10,
                state: ['running', 'queued', 'failed']
            });
            
            const runs = response.dag_runs || [];
            
            if (runs.length === 0) {
                console.log('  No active runs');
                return;
            }
            
            for (const run of runs) {
                const stateIcon = {
                    'running': '🔄',
                    'queued': '⏳',
                    'failed': '❌',
                    'success': '✅'
                }[run.state] || '❓';
                
                console.log(`${stateIcon} ${run.dag_run_id} - ${run.state}`);
                console.log(`  Started: ${run.start_date || 'Not started'}`);
                
                if (run.state === 'failed') {
                    // Get task instances to find which task failed
                    const taskInstances = await client.getTaskInstances(dagId, run.dag_run_id);
                    const failedTasks = taskInstances.task_instances?.filter(t => t.state === 'failed') || [];
                    
                    if (failedTasks.length > 0) {
                        console.log(`  Failed tasks: ${failedTasks.map(t => t.task_id).join(', ')}`);
                    }
                }
            }
            
        } catch (error) {
            if (error instanceof AirflowApiException && error.statusCode === 404) {
                console.error(`DAG '${dagId}' not found`);
                return;
            }
            throw error;
        }
    };
    
    // Monitor continuously
    const intervalId = setInterval(monitorOnce, pollIntervalMs);
    
    // Run once immediately
    await monitorOnce();
    
    // Return cleanup function
    return () => clearInterval(intervalId);
}

// ============================================================================
// Example 4: Intelligent DAG Triggering with Validation
// ============================================================================

async function triggerDagSafely(
    client: AirflowMcpClient,
    dagId: string,
    config: Record<string, any> = {},
    note?: string
): Promise<DagRun | null> {
    try {
        // First, verify the DAG exists and is not paused
        const dag = await client.getDag(dagId);
        
        if (!dag.is_active) {
            console.error(`❌ Cannot trigger '${dagId}': DAG is not active`);
            return null;
        }
        
        if (dag.is_paused) {
            console.warn(`⚠️  DAG '${dagId}' is paused. Unpausing...`);
            await client.pauseDag(dagId, false);
        }
        
        // Trigger the DAG
        console.log(`🚀 Triggering DAG: ${dagId}`);
        const dagRun = await client.triggerDagRun(dagId, {
            conf: config,
            note: note || `Triggered from VS Code at ${new Date().toISOString()}`
        });
        
        console.log(`✅ DAG run created: ${dagRun.dag_run_id}`);
        console.log(`   State: ${dagRun.state}`);
        console.log(`   Started: ${dagRun.start_date}`);
        
        return dagRun;
        
    } catch (error) {
        if (error instanceof AirflowApiException) {
            console.error(`❌ Failed to trigger DAG: ${error.getUserFriendlyMessage()}`);
            
            if (error.statusCode === 409) {
                console.log('   Hint: A run may already be in progress');
            }
        } else if (error instanceof ValidationError) {
            console.error(`❌ Validation error: ${error.message}`);
        }
        
        return null;
    }
}

// ============================================================================
// Example 5: Retrieve and Display Task Logs
// ============================================================================

async function showTaskLogs(
    client: AirflowMcpClient,
    dagId: string,
    dagRunId: string,
    taskId: string
) {
    try {
        // First get the task instance to know how many attempts were made
        const taskInstances = await client.getTaskInstances(dagId, dagRunId);
        const taskInstance = taskInstances.task_instances?.find(t => t.task_id === taskId);
        
        if (!taskInstance) {
            console.error(`Task '${taskId}' not found in run '${dagRunId}'`);
            return;
        }
        
        console.log(`\n📋 Logs for ${taskId} (Try ${taskInstance.try_number}/${taskInstance.max_tries})\n`);
        console.log('═'.repeat(80));
        
        // Get logs for the most recent attempt
        const logResponse = await client.getTaskLogs(
            dagId,
            dagRunId,
            taskId,
            taskInstance.try_number
        );
        
        console.log(logResponse.content);
        console.log('═'.repeat(80));
        
        // If there were retries, show previous attempts
        if (taskInstance.try_number > 1) {
            console.log(`\n📜 Previous attempts available: 1 to ${taskInstance.try_number - 1}`);
            
            for (let tryNum = 1; tryNum < taskInstance.try_number; tryNum++) {
                console.log(`\n--- Try ${tryNum} ---`);
                const prevLog = await client.getTaskLogs(dagId, dagRunId, taskId, tryNum);
                console.log(prevLog.content.substring(0, 500) + '...\n');
            }
        }
        
    } catch (error) {
        if (error instanceof AirflowApiException) {
            console.error(`Failed to retrieve logs: ${error.getUserFriendlyMessage()}`);
        }
    }
}

// ============================================================================
// Example 6: Bulk Operations on DAGs
// ============================================================================

async function bulkPauseDags(
    client: AirflowMcpClient,
    dagIdPattern: RegExp,
    pause: boolean
) {
    try {
        const response = await client.listDags({ limit: 1000 });
        const matchingDags = response.dags?.filter(dag => dagIdPattern.test(dag.dag_id)) || [];
        
        console.log(`\n${pause ? '⏸️' : '▶️'} ${pause ? 'Pausing' : 'Unpausing'} ${matchingDags.length} DAGs...\n`);
        
        const results = await Promise.allSettled(
            matchingDags.map(dag => 
                client.pauseDag(dag.dag_id, pause)
                    .then(() => ({ dagId: dag.dag_id, success: true }))
                    .catch(error => ({ dagId: dag.dag_id, success: false, error }))
            )
        );
        
        let successCount = 0;
        let failCount = 0;
        
        results.forEach(result => {
            if (result.status === 'fulfilled' && result.value.success) {
                console.log(`  ✅ ${result.value.dagId}`);
                successCount++;
            } else {
                const value = result.status === 'fulfilled' ? result.value : { dagId: 'unknown' };
                console.log(`  ❌ ${value.dagId}`);
                failCount++;
            }
        });
        
        console.log(`\n📊 Results: ${successCount} succeeded, ${failCount} failed`);
        
    } catch (error) {
        console.error('Bulk operation failed:', error);
    }
}

// ============================================================================
// Example 7: Variable Management
// ============================================================================

async function manageVariables(client: AirflowMcpClient) {
    console.log('\n⚙️  Variable Management\n');
    
    try {
        // List all variables
        const response = await client.listVariables({ limit: 100 });
        console.log(`Found ${response.total_entries} variables\n`);
        
        response.variables?.forEach(v => {
            console.log(`  ${v.key}: ${v.value}`);
            if (v.description) {
                console.log(`    Description: ${v.description}`);
            }
        });
        
        // Create a new variable
        console.log('\n➕ Creating new variable...');
        await client.createVariable({
            key: 'vscode_extension_version',
            value: '1.0.0',
            description: 'Version of the VS Code extension'
        });
        console.log('  ✅ Variable created');
        
        // Update the variable
        console.log('\n✏️  Updating variable...');
        await client.updateVariable(
            'vscode_extension_version',
            { value: '1.1.0' },
            'value'
        );
        console.log('  ✅ Variable updated');
        
        // Verify the update
        const updated = await client.getVariable('vscode_extension_version');
        console.log(`  Current value: ${updated.value}`);
        
    } catch (error) {
        if (error instanceof AirflowApiException) {
            console.error(`Variable operation failed: ${error.getUserFriendlyMessage()}`);
        }
    }
}

// ============================================================================
// Example 8: Advanced Error Handling and Retry Logic
// ============================================================================

async function robustApiCall<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    retryDelayMs: number = 1000
): Promise<T | null> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await operation();
        } catch (error) {
            lastError = error as Error;
            
            if (error instanceof AirflowApiException) {
                // Don't retry on client errors (4xx)
                if (error.statusCode >= 400 && error.statusCode < 500) {
                    console.error(`Client error (${error.statusCode}), not retrying`);
                    break;
                }
                
                // Retry on server errors (5xx) or network errors
                console.warn(`Attempt ${attempt}/${maxRetries} failed: ${error.getUserFriendlyMessage()}`);
                
                if (attempt < maxRetries) {
                    console.log(`Retrying in ${retryDelayMs}ms...`);
                    await new Promise(resolve => setTimeout(resolve, retryDelayMs));
                }
            } else {
                // Network error or other unexpected error
                console.warn(`Attempt ${attempt}/${maxRetries} failed:`, error);
                
                if (attempt < maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, retryDelayMs));
                }
            }
        }
    }
    
    console.error(`All ${maxRetries} attempts failed`);
    if (lastError) {
        console.error('Last error:', lastError);
    }
    
    return null;
}

// ============================================================================
// Example 9: Complete Workflow - Debug a Failed DAG Run
// ============================================================================

async function debugFailedDagRun(
    client: AirflowMcpClient,
    dagId: string,
    dagRunId: string
) {
    console.log(`\n🔍 Debugging failed DAG run: ${dagId}/${dagRunId}\n`);
    
    try {
        // Get DAG run details
        const dagRun = await client.getDagRun(dagId, dagRunId);
        
        console.log('📊 Run Information:');
        console.log(`  State: ${dagRun.state}`);
        console.log(`  Started: ${dagRun.start_date}`);
        console.log(`  Ended: ${dagRun.end_date || 'Still running'}`);
        console.log(`  Config:`, JSON.stringify(dagRun.conf, null, 2));
        
        // Get task instances
        const taskResponse = await client.getTaskInstances(dagId, dagRunId);
        const tasks = taskResponse.task_instances || [];
        
        // Find failed tasks
        const failedTasks = tasks.filter(t => t.state === 'failed');
        
        if (failedTasks.length > 0) {
            console.log(`\n❌ Failed Tasks (${failedTasks.length}):\n`);
            
            for (const task of failedTasks) {
                console.log(`  📋 ${task.task_id}`);
                console.log(`    Operator: ${task.operator}`);
                console.log(`    Attempts: ${task.try_number}/${task.max_tries}`);
                console.log(`    Duration: ${task.duration || 'N/A'}s`);
                
                // Get logs for the failed task
                console.log(`\n    📜 Logs (last 1000 chars):`);
                const logs = await client.getTaskLogs(dagId, dagRunId, task.task_id, task.try_number);
                const lastLogs = logs.content.slice(-1000);
                console.log('    ' + lastLogs.replace(/\n/g, '\n    '));
                console.log('\n');
            }
            
            // Suggest actions
            console.log('💡 Suggested Actions:');
            console.log('  1. Review the logs above for error messages');
            console.log('  2. Check if upstream tasks completed successfully');
            console.log('  3. Verify DAG configuration and connections');
            console.log('  4. Consider clearing and re-running failed tasks');
        } else {
            console.log('\n✅ No failed tasks found');
        }
        
    } catch (error) {
        if (error instanceof AirflowApiException) {
            console.error(`Debug failed: ${error.getUserFriendlyMessage()}`);
        }
    }
}

// ============================================================================
// Example 10: Integration with VS Code Extension
// ============================================================================

/**
 * Example showing how to integrate the MCP client into VS Code commands
 */
export class AirflowMcpIntegration {
    private client: AirflowMcpClient | null = null;

    async connect(baseUrl: string, jwtToken: string): Promise<boolean> {
        this.client = await initializeClient(baseUrl, jwtToken);
        return this.client !== null;
    }

    async refreshDagList(): Promise<Dag[]> {
        if (!this.client) {
            throw new Error('Not connected to Airflow');
        }
        
        return getDagDashboard(this.client);
    }

    async triggerDag(dagId: string, config: Record<string, any>): Promise<DagRun | null> {
        if (!this.client) {
            throw new Error('Not connected to Airflow');
        }
        
        return triggerDagSafely(this.client, dagId, config);
    }

    async getTaskLogs(dagId: string, dagRunId: string, taskId: string): Promise<void> {
        if (!this.client) {
            throw new Error('Not connected to Airflow');
        }
        
        await showTaskLogs(this.client, dagId, dagRunId, taskId);
    }

    async checkHealth(): Promise<boolean> {
        if (!this.client) {
            return false;
        }
        
        try {
            const health = await this.client.getHealth();
            return health.scheduler.status === 'healthy' && 
                   health.metadatabase.status === 'healthy';
        } catch {
            return false;
        }
    }
}

// Export example functions for reuse
export {
    initializeClient,
    getDagDashboard,
    monitorDagRuns,
    triggerDagSafely,
    showTaskLogs,
    bulkPauseDags,
    manageVariables,
    robustApiCall,
    debugFailedDagRun
};
