import { BaseTool, BaseToolInput } from '../common/BaseTool';
import { Session } from '../common/Session';
import { AirflowClientAdapter } from './AirflowClientAdapter';

export class AirflowTool extends BaseTool<BaseToolInput> {
    protected readonly toolName = 'AirflowTool';
    private readonly client: AirflowClientAdapter;

    constructor() {
        super();
        this.client = new AirflowClientAdapter();
    }

    protected async executeCommand(command: string, params: Record<string, any>): Promise<any> {
        if (!Session.Current?.Api) {
            throw new Error('No Airflow server connection. Please connect to a server first.');
        }

        switch (command) {
            case 'list_active_dags':
                return await this.client.getDags(false);

            case 'list_paused_dags':
                return await this.client.getDags(true);

            case 'get_running_dags':
                return await this.client.getRunningDags();

            case 'pause_dag': {
                const { dagId } = params;
                if (!dagId) { throw new Error('dagId is required'); }
                await this.client.pauseDag(dagId, true);
                return { message: `DAG ${dagId} paused successfully` };
            }

            case 'unpause_dag': {
                const { dagId } = params;
                if (!dagId) { throw new Error('dagId is required'); }
                await this.client.pauseDag(dagId, false);
                return { message: `DAG ${dagId} unpaused successfully` };
            }

            case 'trigger_dag_run': {
                const { dagId, configJson, date } = params;
                if (!dagId) { throw new Error('dagId is required'); }
                return await this.client.triggerDagRun(dagId, configJson || '{}', date);
            }

            case 'get_failed_runs': {
                const { timeRangeHours, dagIdFilter } = params;
                return await this.client.queryFailedRuns(timeRangeHours ?? 24, dagIdFilter);
            }

            case 'get_dag_runs': {
                const { dagId, date } = params;
                if (!dagId) { throw new Error('dagId is required'); }
                return await this.client.getDagRunHistory(dagId, date);
            }

            case 'cancel_dag_run': {
                const { dagId } = params;
                if (!dagId) { throw new Error('dagId is required'); }
                const latestRun = await this.client.getLatestDagRun(dagId);
                if (!latestRun) { throw new Error(`No running DAG run found for ${dagId}`); }
                if (latestRun.state !== 'running' && latestRun.state !== 'queued') {
                    throw new Error(`DAG run ${latestRun.dag_run_id} is in state '${latestRun.state}', not running or queued`);
                }
                await this.client.cancelDagRun(dagId, latestRun.dag_run_id);
                return { message: `DAG run ${latestRun.dag_run_id} cancelled successfully` };
            }

            case 'get_dag_run_detail': {
                const { dagId, dagRunId } = params;
                if (!dagId) { throw new Error('dagId is required'); }
                if (!dagRunId) { throw new Error('dagRunId is required'); }
                const tasks = await this.client.getTaskInstances(dagId, dagRunId);
                const taskLogs: Record<string, string> = {};
                for (const task of tasks.slice(0, 5)) {
                    try {
                        taskLogs[task.task_id] = await this.client.getTaskLog(dagId, dagRunId, task.task_id, String(task.try_number || 1));
                    } catch {
                        taskLogs[task.task_id] = 'Log unavailable';
                    }
                }
                return { dag_run_id: dagRunId, dag_id: dagId, tasks, task_logs: taskLogs };
            }

            case 'analyse_dag_latest_run': {
                const { dagId } = params;
                if (!dagId) { throw new Error('dagId is required'); }
                const latestRun = await this.client.getLatestDagRun(dagId);
                if (!latestRun) { throw new Error(`No runs found for DAG ${dagId}`); }
                const tasks = await this.client.getTaskInstances(dagId, latestRun.dag_run_id);
                let sourceCode = '';
                try { sourceCode = await this.client.getDagSourceCode(dagId); } catch {}
                const taskLogs: Record<string, string> = {};
                for (const task of tasks.slice(0, 5)) {
                    try {
                        taskLogs[task.task_id] = await this.client.getTaskLog(dagId, latestRun.dag_run_id, task.task_id, String(task.try_number || 1));
                    } catch {
                        taskLogs[task.task_id] = 'Log unavailable';
                    }
                }
                return { latest_run: latestRun, tasks, task_logs: taskLogs, source_code: sourceCode };
            }

            case 'get_dag_history': {
                const { dagId, date } = params;
                if (!dagId) { throw new Error('dagId is required'); }
                return await this.client.getDagRunHistory(dagId, date);
            }

            case 'get_dag_source_code': {
                const { dagId } = params;
                if (!dagId) { throw new Error('dagId is required'); }
                return { dag_id: dagId, source_code: await this.client.getDagSourceCode(dagId) };
            }

            case 'get_today':
                return {
                    iso: new Date().toISOString(),
                    date: new Date().toISOString().split('T')[0],
                    timestamp: Date.now()
                };

            default:
                throw new Error(`Unsupported command: ${command}`);
        }
    }
}
