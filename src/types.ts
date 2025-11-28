/* eslint-disable @typescript-eslint/naming-convention */
export interface AirflowDag {
    dag_id: string;
    is_paused: boolean;
    is_active: boolean;
    fileloc: string;
    file_token: string;
    owners: string[];
    description: string | null;
    schedule_interval: {
        __type: string;
        days?: number;
        value?: string;
    } | null;
    tags: { name: string }[];
}

export interface AirflowDagRun {
    dag_id: string;
    dag_run_id: string;
    execution_date: string;
    start_date: string;
    end_date: string | null;
    state: 'queued' | 'running' | 'success' | 'failed' | 'other'; // Add other states as needed
    conf: Record<string, any>;
    logical_date?: string; // v2
}

export interface AirflowTaskInstance {
    task_id: string;
    dag_id: string;
    execution_date: string;
    start_date: string;
    end_date: string | null;
    duration: number | null;
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
    queued_when: string | null;
    pid: number | null;
    executor_config: string;
}

export interface AirflowImportError {
    import_error_id: number;
    timestamp: string;
    filename: string;
    stack_trace: string;
}

export interface AirflowConnection {
    connection_id: string;
    conn_type: string;
    host: string | null;
    login: string | null;
    schema: string | null;
    port: number | null;
}

export interface AirflowVariable {
    key: string;
    value: string;
    description: string | null;
}

export interface AirflowProvider {
    package_name: string;
    description: string;
    version: string;
}

export interface ServerConfig {
    apiUrl: string;
    apiUserName: string;
    apiPassword: string;
}

export interface AskAIContext {
    code: string;
    logs: string;
    dag: string|null;
    dagRun: string|null;
    tasks: string|null;
    taskInstances: string|null;
}