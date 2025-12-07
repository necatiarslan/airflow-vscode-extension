
import { Session } from '../common/Session';
import * as MessageHub from '../common/MessageHub';

export interface IDagRunResult {
    dag_id: string;
    dag_run_id: string;
    state: string;
    execution_date: string;
    logical_date: string;
    start_date?: string;
    end_date?: string;
    conf?: Record<string, unknown>;
}

export interface IFailedRunSummary {
    dag_id: string;
    dag_run_id: string;
    state: 'failed' | 'upstream_failed' | 'skipped';
    execution_date: string;
    logical_date: string;
    start_date?: string;
    end_date?: string;
    error_message?: string;
}

export interface IDagSummary {
    dag_id: string;
    is_paused: boolean;
    is_active: boolean;
    description?: string;
    owners?: string[];
    tags?: { name: string }[];
}

export interface ITaskInstance {
    task_id: string;
    dag_id: string;
    dag_run_id: string;
    execution_date: string;
    start_date: string;
    end_date: string;
    duration: number;
    state: string;
    try_number: number;
    map_index: number;
    max_tries: number;
    hostname: string;
    unixname: string;
    pool: string;
    pool_slots: number;
    queue: string;
    priority_weight: number;
    operator: string;
    queued_when: string;
    pid: number;
    executor_config: string;
}

export class AirflowClientAdapter {
    
    /**
     * Triggers a DAG run via POST /dags/{dag_id}/dagRuns
     * 
     * @param dagId - The DAG identifier
     * @param configJson - JSON string containing the DAG run configuration (optional)
     * @param date - The logical date for the run (optional)
     * @returns Promise with the created DAG run result
     */
    async triggerDagRun(dagId: string, configJson: string = '{}', date?: string): Promise<IDagRunResult> {
        // Validate JSON before calling API
        try {
            JSON.parse(configJson);
        } catch (error) {
            throw new Error(`Invalid JSON in config_json parameter: ${error instanceof Error ? error.message : String(error)}`);
        }

        const result = await Session.Current.Api.triggerDag(dagId, configJson, date);

        if (!result.isSuccessful) {
            throw new Error(result.error?.message || 'Failed to trigger DAG run');
        }

        MessageHub.DagTriggered(this, dagId, result.result.dag_run_id);

        // Map the API response to our interface
        const apiResponse = result.result;
        return {
            dag_id: apiResponse.dag_id || dagId,
            dag_run_id: apiResponse.dag_run_id || apiResponse.run_id || '',
            state: apiResponse.state || 'queued',
            execution_date: apiResponse.execution_date || apiResponse.logical_date || new Date().toISOString(),
            logical_date: apiResponse.logical_date || apiResponse.execution_date || new Date().toISOString(),
            start_date: apiResponse.start_date,
            end_date: apiResponse.end_date,
            conf: apiResponse.conf
        };
    }

    /**
     * Queries for failed DAG runs using the Airflow API
     * 
     * @param timeRangeHours - Number of hours to look back (default 24)
     * @param dagIdFilter - Optional DAG ID filter
     * @returns Promise with array of failed run summaries
     */
    async queryFailedRuns(timeRangeHours: number = 24, dagIdFilter?: string): Promise<IFailedRunSummary[]> {
        const failedRuns: IFailedRunSummary[] = [];

        try {
            // If dagIdFilter is specified, query only that DAG
            if (dagIdFilter) {
                const result = await Session.Current.Api.getDagRunHistory(dagIdFilter);
                if (result.isSuccessful && result.result?.dag_runs) {
                    failedRuns.push(...this.filterFailedRuns(result.result.dag_runs, timeRangeHours));
                }
            } else {
                // If no filter, we need to get the DAG list first, then query each
                const dagListResult = await Session.Current.Api.getDagList();
                if (dagListResult.isSuccessful && dagListResult.result) {
                    // Handle both v1 (array) and v2 (object with dags property) responses
                    const resultData = dagListResult.result as any;
                    const dags = Array.isArray(resultData) ? resultData : (resultData.dags || []);
                    
                    // Limit to first 20 DAGs to avoid too many API calls
                    const dagsToCheck = dags.slice(0, 20);
                    
                    // Query each DAG's runs in parallel
                    const runPromises = dagsToCheck.map(async (dag: any) => {
                        try {
                            const dagId = dag.dag_id;
                            const runResult = await Session.Current.Api.getDagRunHistory(dagId);
                            if (runResult.isSuccessful && runResult.result?.dag_runs) {
                                return this.filterFailedRuns(runResult.result.dag_runs, timeRangeHours);
                            }
                        } catch (error) {
                            // Silently continue on error for individual DAGs
                            return [];
                        }
                        return [];
                    });

                    const results = await Promise.all(runPromises);
                    results.forEach(runs => failedRuns.push(...runs));
                }
            }

            return failedRuns;

        } catch (error) {
            throw new Error(`Failed to query failed runs: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Retrieves a list of DAGs filtered by paused state
     * 
     * @param isPaused - Whether to list paused (true) or active (false) DAGs
     * @returns Promise with array of DAG summaries
     */
    async getDags(isPaused: boolean): Promise<IDagSummary[]> {
        try {
            const dagListResult = await Session.Current.Api.getDagList();
            if (!dagListResult.isSuccessful || !dagListResult.result) {
                throw new Error(dagListResult.error?.message || 'Failed to fetch DAG list');
            }

            // Handle both v1 (array) and v2 (object with dags property) responses
            const resultData = dagListResult.result as any;
            const dags = Array.isArray(resultData) ? resultData : (resultData.dags || []);

            return dags
                .filter((dag: any) => dag.is_paused === isPaused)
                .map((dag: any) => ({
                    dag_id: dag.dag_id,
                    is_paused: dag.is_paused,
                    is_active: dag.is_active !== undefined ? dag.is_active : !dag.is_paused,
                    description: dag.description,
                    owners: dag.owners,
                    tags: dag.tags
                }));

        } catch (error) {
            throw new Error(`Failed to get DAG list: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Retrieves a list of DAGs that are currently running
     * 
     * @returns Promise with array of DAG summaries that have running DAG runs
     */
    async getRunningDags(): Promise<Array<IDagSummary & { latest_run_state: string; latest_run_id: string }>> {
        try {
            const dagListResult = await Session.Current.Api.getDagList();
            if (!dagListResult.isSuccessful || !dagListResult.result) {
                throw new Error(dagListResult.error?.message || 'Failed to fetch DAG list');
            }

            const resultData = dagListResult.result as any;
            const dags = Array.isArray(resultData) ? resultData : (resultData.dags || []);

            // Filter and enrich DAGs with their latest run info
            const runningDags: Array<IDagSummary & { latest_run_state: string; latest_run_id: string }> = [];

            for (const dag of dags) {
                if (dag.is_paused) {
                    continue; // Skip paused DAGs
                }

                try {
                    const latestRun = await this.getLatestDagRun(dag.dag_id);
                    if (latestRun && (latestRun.state === 'running' || latestRun.state === 'queued')) {
                        runningDags.push({
                            dag_id: dag.dag_id,
                            is_paused: dag.is_paused,
                            is_active: dag.is_active !== undefined ? dag.is_active : !dag.is_paused,
                            description: dag.description,
                            owners: dag.owners,
                            tags: dag.tags,
                            latest_run_state: latestRun.state,
                            latest_run_id: latestRun.dag_run_id
                        });
                    }
                } catch (error) {
                    // Continue if we can't get the latest run for a DAG
                    continue;
                }
            }

            return runningDags;

        } catch (error) {
            throw new Error(`Failed to get running DAGs: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Pauses or unpauses a DAG
     * 
     * @param dagId - The DAG ID
     * @param isPaused - True to pause, false to unpause
     */
    async pauseDag(dagId: string, isPaused: boolean): Promise<void> {
        try {
            const result = await Session.Current.Api.pauseDag(dagId, isPaused);
            if (!result.isSuccessful) {
                throw new Error(result.error?.message || `Failed to ${isPaused ? 'pause' : 'unpause'} DAG`);
            }
            MessageHub.DagPaused(this, dagId);
        } catch (error) {
            throw new Error(`Failed to change DAG state: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Retrieves the latest DAG run for a given DAG
     * 
     * @param dagId - The DAG ID
     * @returns Promise with the latest DAG run result or undefined if not found
     */
    async getLatestDagRun(dagId: string): Promise<IDagRunResult | undefined> {
        try {
            const result = await Session.Current.Api.getLastDagRun(dagId);
            if (!result.isSuccessful || !result.result) {
                return undefined;
            }
            
            const apiResponse = result.result;
            return {
                dag_id: apiResponse.dag_id || dagId,
                dag_run_id: apiResponse.dag_run_id || apiResponse.run_id || '',
                state: apiResponse.state || 'unknown',
                execution_date: apiResponse.execution_date || apiResponse.logical_date || new Date().toISOString(),
                logical_date: apiResponse.logical_date || apiResponse.execution_date || new Date().toISOString(),
                start_date: apiResponse.start_date,
                end_date: apiResponse.end_date,
                conf: apiResponse.conf
            };
        } catch (error) {
            // Return undefined on error to allow caller to handle
            return undefined;
        }
    }

    /**
     * Retrieves task instances for a specific DAG run
     * 
     * @param dagId - The DAG ID
     * @param dagRunId - The DAG run ID
     * @returns Promise with array of task instances
     */
    async getTaskInstances(dagId: string, dagRunId: string): Promise<any[]> {
        try {
            const result = await Session.Current.Api.getTaskInstances(dagId, dagRunId);
            if (!result.isSuccessful || !result.result) {
                return [];
            }
            
            // API v2 returns { task_instances: [...] }
            return result.result.task_instances || [];
        } catch (error) {
            return [];
        }
    }

    /**
     * Retrieves task log content
     * 
     * @param dagId - The DAG ID
     * @param dagRunId - The DAG run ID
     * @param taskId - The task ID
     * @param tryNumber - The task attempt number
     * @returns Promise with the log content (truncated for LLM processing)
     */
    async getTaskLog(dagId: string, dagRunId: string, taskId: string, tryNumber: string): Promise<string> {
        try {
            // Use the existing getTaskInstanceLog method
            const result = await Session.Current.Api.getTaskInstanceLogText(dagId, dagRunId, taskId);

            if (!result.isSuccessful) {
                throw new Error(result.error?.message || 'Failed to retrieve task log');
            }

            const logContent = result.result || '';

            // Truncate to last 400 characters for token efficiency
            if (logContent.length > 400) {
                return '...' + logContent.slice(-400);
            }

            return logContent;

        } catch (error) {
            throw new Error(`Failed to get task log: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Helper method to filter failed runs within the time range
     */
    private filterFailedRuns(dagRuns: any[], timeRangeHours: number): IFailedRunSummary[] {
        const cutoffTime = new Date();
        cutoffTime.setHours(cutoffTime.getHours() - timeRangeHours);

        const failedStates = ['failed', 'upstream_failed', 'skipped'];

        return dagRuns
            .filter((run: any) => {
                // Filter by state
                if (!failedStates.includes(run.state)) {
                    return false;
                }

                // Filter by time range
                const runDate = new Date(run.execution_date || run.logical_date || run.start_date);
                return runDate >= cutoffTime;
            })
            .map((run: any) => ({
                dag_id: run.dag_id,
                dag_run_id: run.dag_run_id || run.run_id,
                state: run.state,
                execution_date: run.execution_date || run.logical_date,
                logical_date: run.logical_date || run.execution_date,
                start_date: run.start_date,
                end_date: run.end_date,
                error_message: this.extractErrorMessage(run)
            }));
    }

    /**
     * Retrieves DAG run history for a specific DAG
     * 
     * @param dagId - The DAG ID
     * @param date - Optional date filter (YYYY-MM-DD format)
     * @returns Promise with DAG runs data
     */
    async getDagRunHistory(dagId: string, date?: string): Promise<any> {
        try {
            const result = await Session.Current.Api.getDagRunHistory(dagId, date);
            if (!result.isSuccessful || !result.result) {
                throw new Error(result.error?.message || 'Failed to fetch DAG run history');
            }
            return result.result;
        } catch (error) {
            throw new Error(`Failed to get DAG run history: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Stops a running DAG run by setting its state to failed
     * 
     * @param dagId - The DAG ID
     * @param dagRunId - The DAG run ID to stop
     */
    async cancelDagRun(dagId: string, dagRunId: string): Promise<void> {
        try {
            const result = await Session.Current.Api.cancelDagRun(dagId, dagRunId);
            if (!result.isSuccessful) {
                throw new Error(result.error?.message || 'Failed to cancel DAG run');
            }
            MessageHub.DagRunCancelled(this, dagId, dagRunId);
        } catch (error) {
            throw new Error(`Failed to stop DAG run: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Retrieves the source code for a DAG
     * 
     * @param dagId - The DAG ID
     * @returns Promise with the DAG source code
     */
    async getDagSource(dagId: string): Promise<string> {
        try {
            const result = await Session.Current.Api.getSourceCode(dagId);
            if (!result.isSuccessful || !result.result) {
                throw new Error(result.error?.message || 'Failed to fetch DAG source code');
            }
            return result.result;
        } catch (error) {
            throw new Error(`Failed to get DAG source code: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Helper to extract error message from DAG run
     */
    private extractErrorMessage(run: any): string | undefined {
        // Try to extract error information from the run object
        if (run.note) {
            return run.note;
        }
        if (run.state === 'failed') {
            return `DAG run failed`;
        }
        if (run.state === 'upstream_failed') {
            return `Upstream task(s) failed`;
        }
        if (run.state === 'skipped') {
            return `DAG run was skipped`;
        }
        return undefined;
    }
}
