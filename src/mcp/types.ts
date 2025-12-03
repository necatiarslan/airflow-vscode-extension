/* eslint-disable @typescript-eslint/naming-convention */

/**
 * MCP (Management, Control, and Productivity) Types for Airflow REST API v2
 * All fields use snake_case naming convention as per Airflow API standard
 */

// ============================================================================
// Core Resource Types
// ============================================================================

/**
 * Represents a DAG (Directed Acyclic Graph) in Airflow
 */
export interface Dag {
    dag_id: string;
    dag_display_name?: string;
    is_paused: boolean;
    is_active: boolean;
    is_subdag?: boolean;
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
    max_active_tasks?: number;
    max_active_runs?: number;
    has_task_concurrency_limits?: boolean;
    has_import_errors?: boolean;
    next_dagrun?: string | null;
    next_dagrun_data_interval_start?: string | null;
    next_dagrun_data_interval_end?: string | null;
    next_dagrun_create_after?: string | null;
}

/**
 * Represents a DAG Run instance
 */
export interface DagRun {
    dag_run_id: string;
    dag_id: string;
    logical_date: string;
    execution_date: string;
    start_date: string | null;
    end_date: string | null;
    state: 'queued' | 'running' | 'success' | 'failed';
    external_trigger: boolean;
    conf: Record<string, any>;
    data_interval_start?: string | null;
    data_interval_end?: string | null;
    last_scheduling_decision?: string | null;
    run_type?: string;
    note?: string | null;
}

/**
 * Represents a Task Instance in a DAG Run
 */
export interface TaskInstance {
    task_id: string;
    dag_id: string;
    dag_run_id: string;
    execution_date: string;
    start_date: string | null;
    end_date: string | null;
    duration: number | null;
    state: string | null;
    try_number: number;
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
    map_index: number;
    rendered_fields?: Record<string, any>;
    trigger?: any;
    triggerer_job?: any;
    note?: string | null;
}

/**
 * Represents an Airflow Variable
 */
export interface Variable {
    key: string;
    value?: string;
    description?: string | null;
}

/**
 * Represents an Airflow Connection
 */
export interface Connection {
    connection_id: string;
    conn_type: string;
    description?: string | null;
    host?: string | null;
    login?: string | null;
    schema?: string | null;
    port?: number | null;
    password?: string | null; // May be masked in responses
    extra?: string | null;
}

/**
 * Health check response from Airflow
 */
export interface HealthStatus {
    metadatabase: {
        status: string; // "healthy" or "unhealthy"
    };
    scheduler: {
        status: string; // "healthy" or "unhealthy"
        latest_scheduler_heartbeat: string | null;
    };
}

// ============================================================================
// Request/Response Wrapper Types
// ============================================================================

/**
 * Paginated list response
 */
export interface PaginatedResponse<T> {
    total_entries: number;
    dags?: T[];
    dag_runs?: T[];
    task_instances?: T[];
    variables?: T[];
    connections?: T[];
    [key: string]: any;
}

/**
 * Task logs response
 */
export interface TaskLogResponse {
    continuation_token: string | null;
    content: string;
}

// ============================================================================
// Request Payload Types
// ============================================================================

/**
 * Payload for triggering a new DAG run
 */
export interface TriggerDagRunPayload {
    dag_run_id?: string;
    logical_date?: string;
    execution_date?: string;
    conf?: Record<string, any>;
    note?: string;
}

/**
 * Payload for pausing/unpausing a DAG
 */
export interface UpdateDagPayload {
    is_paused: boolean;
}

/**
 * Payload for clearing DAG runs
 */
export interface ClearDagRunPayload {
    dry_run?: boolean;
    task_ids?: string[];
    start_date?: string;
    end_date?: string;
    only_failed?: boolean;
    only_running?: boolean;
    include_subdags?: boolean;
    include_parentdag?: boolean;
    reset_dag_runs?: boolean;
}

/**
 * Payload for clearing task instances
 */
export interface ClearTaskInstancesPayload {
    dry_run?: boolean;
    task_ids?: string[];
    dag_run_id?: string;
    include_upstream?: boolean;
    include_downstream?: boolean;
    include_future?: boolean;
    include_past?: boolean;
    reset_dag_runs?: boolean;
}

/**
 * Payload for updating a variable
 */
export interface UpdateVariablePayload {
    key: string;
    value?: string;
    description?: string;
}

/**
 * Payload for updating a connection
 */
export interface UpdateConnectionPayload {
    connection_id: string;
    conn_type?: string;
    description?: string;
    host?: string;
    login?: string;
    schema?: string;
    port?: number;
    password?: string;
    extra?: string;
}

// ============================================================================
// Query Parameter Types
// ============================================================================

/**
 * Common pagination parameters
 */
export interface PaginationParams {
    limit?: number;
    offset?: number;
}

/**
 * Query parameters for listing DAGs
 */
export interface ListDagsParams extends PaginationParams {
    order_by?: string;
    tags?: string[];
    only_active?: boolean;
    paused?: boolean;
    dag_id_pattern?: string;
}

/**
 * Query parameters for listing DAG runs
 */
export interface ListDagRunsParams extends PaginationParams {
    dag_id?: string;
    state?: string[];
    execution_date_gte?: string;
    execution_date_lte?: string;
    start_date_gte?: string;
    start_date_lte?: string;
    end_date_gte?: string;
    end_date_lte?: string;
}

/**
 * Query parameters for getting task logs
 */
export interface GetTaskLogsParams {
    full_content?: boolean;
    map_index?: number;
    token?: string;
}
