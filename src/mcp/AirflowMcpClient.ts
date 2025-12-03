/* eslint-disable @typescript-eslint/naming-convention */

import { AirflowApiException, MissingUpdateMaskError, ValidationError } from './errors';
import {
    Dag,
    DagRun,
    TaskInstance,
    Variable,
    Connection,
    HealthStatus,
    PaginatedResponse,
    TaskLogResponse,
    TriggerDagRunPayload,
    UpdateDagPayload,
    ClearDagRunPayload,
    ClearTaskInstancesPayload,
    UpdateVariablePayload,
    UpdateConnectionPayload,
    ListDagsParams,
    ListDagRunsParams,
    GetTaskLogsParams,
    PaginationParams
} from './types';

/**
 * AirflowMcpClient - Management, Control, and Productivity client for Apache Airflow
 * 
 * This client provides a comprehensive interface to interact with Airflow's Stable REST API v2.
 * It strictly adheres to the /api/v2 standard and uses JWT Bearer Token authentication.
 * 
 * All request and response payloads use snake_case naming convention as per Airflow API standard.
 * 
 * Features:
 * - Control: DAG lifecycle management (list, pause/unpause, trigger, clear)
 * - Productivity: Monitoring and observability (logs, run status, health checks)
 * - Management: Configuration management (variables, connections)
 * 
 * @example
 * ```typescript
 * const client = new AirflowMcpClient('https://airflow.example.com', 'your-jwt-token');
 * 
 * // List all DAGs
 * const dags = await client.listDags({ limit: 100 });
 * 
 * // Trigger a DAG run
 * const dagRun = await client.triggerDagRun('my_dag', { 
 *   conf: { param1: 'value1' } 
 * });
 * 
 * // Get task logs
 * const logs = await client.getTaskLogs('my_dag', 'run_id', 'task_id', { try_number: 1 });
 * ```
 */
export class AirflowMcpClient {
    private readonly baseUrl: string;
    private readonly authToken: string;
    private readonly apiPrefix = '/api/v2';

    /**
     * Creates an instance of AirflowMcpClient
     * 
     * @param baseUrl - The base URL of the Airflow server (e.g., 'https://airflow.example.com')
     * @param authToken - The JWT Bearer token for authentication
     */
    constructor(baseUrl: string, authToken: string) {
        // Remove trailing slash from baseUrl if present
        this.baseUrl = baseUrl.replace(/\/$/, '');
        this.authToken = authToken;

        if (!this.baseUrl) {
            throw new ValidationError('baseUrl', 'Base URL cannot be empty');
        }
        if (!this.authToken) {
            throw new ValidationError('authToken', 'Auth token cannot be empty');
        }
    }

    // ========================================================================
    // Core HTTP Methods
    // ========================================================================

    /**
     * Private utility method to make HTTP requests to the Airflow API
     * 
     * Handles:
     * - URL construction with /api/v2 prefix
     * - Authentication headers (Bearer token)
     * - Content-Type headers
     * - Error handling and conversion to AirflowApiException
     * 
     * @param method - HTTP method (GET, POST, PATCH, DELETE)
     * @param path - API endpoint path (without /api/v2 prefix)
     * @param data - Request body data (will be JSON stringified)
     * @param params - Query parameters
     * @returns Response data as JSON
     * @throws AirflowApiException on HTTP errors
     */
    private async _request<T = any>(
        method: string,
        path: string,
        data?: any,
        params?: Record<string, any>
    ): Promise<T> {
        // Construct full URL
        const url = new URL(`${this.baseUrl}${this.apiPrefix}${path}`);

        // Add query parameters
        if (params) {
            Object.entries(params).forEach(([key, value]) => {
                if (value !== undefined && value !== null) {
                    if (Array.isArray(value)) {
                        // Handle array parameters (e.g., state=running&state=failed)
                        value.forEach(v => url.searchParams.append(key, String(v)));
                    } else {
                        url.searchParams.append(key, String(value));
                    }
                }
            });
        }

        // Prepare headers
        const headers: Record<string, string> = {
            'Authorization': `Bearer ${this.authToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };

        // Prepare fetch options
        const options: RequestInit = {
            method,
            headers
        };

        // Add body for POST/PATCH requests
        if (data && (method === 'POST' || method === 'PATCH' || method === 'PUT')) {
            options.body = JSON.stringify(data);
        }

        try {
            const response = await fetch(url.toString(), options);

            // Handle non-2xx responses
            if (!response.ok) {
                throw await AirflowApiException.fromResponse(response, method, url.toString());
            }

            // Handle 204 No Content
            if (response.status === 204) {
                return {} as T;
            }

            // Parse JSON response
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                return await response.json() as T;
            }

            // Return text for non-JSON responses
            return await response.text() as any;

        } catch (error) {
            // Re-throw AirflowApiException as-is
            if (error instanceof AirflowApiException) {
                throw error;
            }

            // Wrap other errors
            throw new Error(`Failed to make request to ${url}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Protected utility method for atomic resource updates using PATCH
     * 
     * The update_mask parameter is REQUIRED by Airflow for all PATCH operations.
     * This ensures atomic updates by explicitly specifying which fields in the
     * request body should be modified, preventing accidental overwrites.
     * 
     * @param path - API endpoint path
     * @param body - Request body containing fields to update
     * @param updateMask - Comma-separated list of field names to update (e.g., "is_paused" or "key,value")
     * @returns Updated resource
     * @throws MissingUpdateMaskError if updateMask is not provided
     * @throws AirflowApiException on HTTP errors
     * 
     * @example
     * ```typescript
     * // Correct usage - explicitly specify the field being updated
     * await this._patchResource('/dags/my_dag', { is_paused: true }, 'is_paused');
     * 
     * // This will throw MissingUpdateMaskError
     * await this._patchResource('/dags/my_dag', { is_paused: true }, '');
     * ```
     */
    protected async _patchResource<T = any>(
        path: string,
        body: any,
        updateMask: string
    ): Promise<T> {
        if (!updateMask || updateMask.trim() === '') {
            throw new MissingUpdateMaskError(path);
        }

        return this._request<T>('PATCH', path, body, { update_mask: updateMask });
    }

    // ========================================================================
    // A. Control: DAG Lifecycle Management
    // ========================================================================

    /**
     * List all DAGs with optional filtering and pagination
     * 
     * @param params - Query parameters for filtering and pagination
     * @returns Paginated list of DAGs
     * 
     * @example
     * ```typescript
     * const result = await client.listDags({ 
     *   limit: 50, 
     *   offset: 0,
     *   only_active: true 
     * });
     * console.log(`Found ${result.total_entries} DAGs`);
     * ```
     */
    public async listDags(params?: ListDagsParams): Promise<PaginatedResponse<Dag>> {
        return this._request<PaginatedResponse<Dag>>('GET', '/dags', undefined, params);
    }

    /**
     * Get details of a specific DAG
     * 
     * @param dagId - The DAG ID
     * @returns DAG details
     */
    public async getDag(dagId: string): Promise<Dag> {
        if (!dagId) {
            throw new ValidationError('dagId');
        }
        return this._request<Dag>('GET', `/dags/${encodeURIComponent(dagId)}`);
    }

    /**
     * Pause or unpause a DAG
     * 
     * Uses the atomic update pattern with update_mask to ensure safe modification.
     * Only the is_paused field will be updated.
     * 
     * @param dagId - The DAG ID
     * @param isPaused - true to pause, false to unpause
     * @returns Updated DAG details
     * 
     * @example
     * ```typescript
     * // Pause a DAG
     * await client.pauseDag('my_dag', true);
     * 
     * // Unpause a DAG
     * await client.pauseDag('my_dag', false);
     * ```
     */
    public async pauseDag(dagId: string, isPaused: boolean): Promise<Dag> {
        if (!dagId) {
            throw new ValidationError('dagId');
        }

        const payload: UpdateDagPayload = { is_paused: isPaused };
        return this._patchResource<Dag>(
            `/dags/${encodeURIComponent(dagId)}`,
            payload,
            'is_paused'
        );
    }

    /**
     * Trigger a new DAG run
     * 
     * @param dagId - The DAG ID to trigger
     * @param payload - Optional configuration for the DAG run
     * @returns Created DAG run details
     * 
     * @example
     * ```typescript
     * // Trigger with custom configuration
     * const dagRun = await client.triggerDagRun('my_dag', {
     *   conf: { 
     *     param1: 'value1',
     *     param2: 'value2'
     *   },
     *   note: 'Triggered from VS Code extension'
     * });
     * ```
     */
    public async triggerDagRun(
        dagId: string,
        payload?: TriggerDagRunPayload
    ): Promise<DagRun> {
        if (!dagId) {
            throw new ValidationError('dagId');
        }

        return this._request<DagRun>(
            'POST',
            `/dags/${encodeURIComponent(dagId)}/dagRuns`,
            payload || {}
        );
    }

    /**
     * Clear task instances for a DAG
     * 
     * This operation allows clearing tasks with fine-grained control over
     * which tasks are affected and whether to include upstream/downstream dependencies.
     * 
     * @param dagId - The DAG ID
     * @param payload - Configuration for clearing tasks
     * @returns Result of the clear operation
     * 
     * @example
     * ```typescript
     * // Clear failed tasks and their downstream dependencies
     * await client.clearTaskInstances('my_dag', {
     *   dry_run: false,
     *   only_failed: true,
     *   include_downstream: true,
     *   include_upstream: false
     * });
     * ```
     */
    public async clearTaskInstances(
        dagId: string,
        payload: ClearTaskInstancesPayload
    ): Promise<any> {
        if (!dagId) {
            throw new ValidationError('dagId');
        }

        return this._request(
            'POST',
            `/dags/${encodeURIComponent(dagId)}/clearTaskInstances`,
            payload
        );
    }

    /**
     * Clear DAG runs
     * 
     * @param dagId - The DAG ID
     * @param payload - Configuration for clearing DAG runs
     * @returns Result of the clear operation
     */
    public async clearDagRuns(
        dagId: string,
        payload: ClearDagRunPayload
    ): Promise<any> {
        if (!dagId) {
            throw new ValidationError('dagId');
        }

        return this._request(
            'POST',
            `/dags/${encodeURIComponent(dagId)}/clearDagRuns`,
            payload
        );
    }

    // ========================================================================
    // B. Productivity: Monitoring and Observability
    // ========================================================================

    /**
     * Get task instance logs
     * 
     * IMPORTANT: The try_number parameter is REQUIRED to fetch logs for a specific
     * retry attempt. Airflow tasks may retry multiple times, and each attempt
     * has its own set of logs.
     * 
     * @param dagId - The DAG ID
     * @param dagRunId - The DAG run ID
     * @param taskId - The task ID
     * @param tryNumber - The retry attempt number (1-indexed, REQUIRED)
     * @param params - Additional query parameters
     * @returns Task logs
     * 
     * @example
     * ```typescript
     * // Get logs for the first attempt
     * const logs = await client.getTaskLogs('my_dag', 'run_123', 'my_task', 1);
     * 
     * // Get logs for the second retry
     * const retryLogs = await client.getTaskLogs('my_dag', 'run_123', 'my_task', 2);
     * ```
     */
    public async getTaskLogs(
        dagId: string,
        dagRunId: string,
        taskId: string,
        tryNumber: number,
        params?: GetTaskLogsParams
    ): Promise<TaskLogResponse> {
        if (!dagId) {
            throw new ValidationError('dagId');
        }
        if (!dagRunId) {
            throw new ValidationError('dagRunId');
        }
        if (!taskId) {
            throw new ValidationError('taskId');
        }
        if (!tryNumber || tryNumber < 1) {
            throw new ValidationError('tryNumber', 'try_number must be a positive integer');
        }

        const queryParams = {
            ...params,
            try_number: tryNumber
        };

        return this._request<TaskLogResponse>(
            'GET',
            `/dags/${encodeURIComponent(dagId)}/dagRuns/${encodeURIComponent(dagRunId)}/taskInstances/${encodeURIComponent(taskId)}/logs`,
            undefined,
            queryParams
        );
    }

    /**
     * Get a specific DAG run
     * 
     * @param dagId - The DAG ID
     * @param dagRunId - The DAG run ID
     * @returns DAG run details
     */
    public async getDagRun(dagId: string, dagRunId: string): Promise<DagRun> {
        if (!dagId) {
            throw new ValidationError('dagId');
        }
        if (!dagRunId) {
            throw new ValidationError('dagRunId');
        }

        return this._request<DagRun>(
            'GET',
            `/dags/${encodeURIComponent(dagId)}/dagRuns/${encodeURIComponent(dagRunId)}`
        );
    }

    /**
     * List DAG runs with filtering
     * 
     * Supports querying by DAG ID, state, and date ranges for comprehensive monitoring.
     * 
     * @param params - Query parameters for filtering and pagination
     * @returns Paginated list of DAG runs
     * 
     * @example
     * ```typescript
     * // Get all failed runs for a specific DAG
     * const failedRuns = await client.listDagRuns({
     *   dag_id: 'my_dag',
     *   state: ['failed'],
     *   limit: 100
     * });
     * ```
     */
    public async listDagRuns(params?: ListDagRunsParams): Promise<PaginatedResponse<DagRun>> {
        return this._request<PaginatedResponse<DagRun>>('GET', '/dagRuns', undefined, params);
    }

    /**
     * Get task instances for a DAG run
     * 
     * @param dagId - The DAG ID
     * @param dagRunId - The DAG run ID
     * @param params - Optional pagination parameters
     * @returns List of task instances
     */
    public async getTaskInstances(
        dagId: string,
        dagRunId: string,
        params?: PaginationParams
    ): Promise<PaginatedResponse<TaskInstance>> {
        if (!dagId) {
            throw new ValidationError('dagId');
        }
        if (!dagRunId) {
            throw new ValidationError('dagRunId');
        }

        return this._request<PaginatedResponse<TaskInstance>>(
            'GET',
            `/dags/${encodeURIComponent(dagId)}/dagRuns/${encodeURIComponent(dagRunId)}/taskInstances`,
            undefined,
            params
        );
    }

    /**
     * Get Airflow health status
     * 
     * Checks the health of critical Airflow components:
     * - Metadatabase: Database connectivity and status
     * - Scheduler: Scheduler process status and heartbeat
     * 
     * @returns Health status of Airflow components
     * 
     * @example
     * ```typescript
     * const health = await client.getHealth();
     * if (health.scheduler.status === 'healthy') {
     *   console.log('Scheduler is running');
     *   console.log('Last heartbeat:', health.scheduler.latest_scheduler_heartbeat);
     * }
     * ```
     */
    public async getHealth(): Promise<HealthStatus> {
        return this._request<HealthStatus>('GET', '/health');
    }

    // ========================================================================
    // C. Management: Configuration
    // ========================================================================

    /**
     * List all Airflow variables
     * 
     * @param params - Optional pagination parameters
     * @returns Paginated list of variables
     * 
     * @example
     * ```typescript
     * const variables = await client.listVariables({ limit: 100 });
     * variables.variables?.forEach(v => {
     *   console.log(`${v.key}: ${v.value}`);
     * });
     * ```
     */
    public async listVariables(params?: PaginationParams): Promise<PaginatedResponse<Variable>> {
        return this._request<PaginatedResponse<Variable>>('GET', '/variables', undefined, params);
    }

    /**
     * Get a specific variable by key
     * 
     * @param variableKey - The variable key
     * @returns Variable details
     */
    public async getVariable(variableKey: string): Promise<Variable> {
        if (!variableKey) {
            throw new ValidationError('variableKey');
        }

        return this._request<Variable>('GET', `/variables/${encodeURIComponent(variableKey)}`);
    }

    /**
     * Update an Airflow variable
     * 
     * Uses the atomic update pattern with update_mask to safely modify variables.
     * You can update the value, description, or both.
     * 
     * @param variableKey - The variable key
     * @param payload - Fields to update
     * @param updateMask - Comma-separated list of fields to update (e.g., "value" or "value,description")
     * @returns Updated variable
     * 
     * @example
     * ```typescript
     * // Update only the value
     * await client.updateVariable('my_var', { value: 'new_value' }, 'value');
     * 
     * // Update both value and description
     * await client.updateVariable('my_var', { 
     *   value: 'new_value',
     *   description: 'Updated description'
     * }, 'value,description');
     * ```
     */
    public async updateVariable(
        variableKey: string,
        payload: Partial<UpdateVariablePayload>,
        updateMask: string
    ): Promise<Variable> {
        if (!variableKey) {
            throw new ValidationError('variableKey');
        }

        return this._patchResource<Variable>(
            `/variables/${encodeURIComponent(variableKey)}`,
            payload,
            updateMask
        );
    }

    /**
     * Create a new variable
     * 
     * @param payload - Variable data
     * @returns Created variable
     */
    public async createVariable(payload: Variable): Promise<Variable> {
        if (!payload.key) {
            throw new ValidationError('key', 'Variable key is required');
        }

        return this._request<Variable>('POST', '/variables', payload);
    }

    /**
     * Delete a variable
     * 
     * @param variableKey - The variable key to delete
     */
    public async deleteVariable(variableKey: string): Promise<void> {
        if (!variableKey) {
            throw new ValidationError('variableKey');
        }

        await this._request('DELETE', `/variables/${encodeURIComponent(variableKey)}`);
    }

    /**
     * Get a specific connection by ID
     * 
     * Note: Sensitive fields like passwords may be masked in the response
     * for security reasons.
     * 
     * @param connectionId - The connection ID
     * @returns Connection details (with potentially masked sensitive fields)
     * 
     * @example
     * ```typescript
     * const conn = await client.getConnection('my_postgres_conn');
     * console.log(`Host: ${conn.host}`);
     * console.log(`Port: ${conn.port}`);
     * // Password may be masked: conn.password === '***'
     * ```
     */
    public async getConnection(connectionId: string): Promise<Connection> {
        if (!connectionId) {
            throw new ValidationError('connectionId');
        }

        return this._request<Connection>('GET', `/connections/${encodeURIComponent(connectionId)}`);
    }

    /**
     * List all connections
     * 
     * @param params - Optional pagination parameters
     * @returns Paginated list of connections
     */
    public async listConnections(params?: PaginationParams): Promise<PaginatedResponse<Connection>> {
        return this._request<PaginatedResponse<Connection>>('GET', '/connections', undefined, params);
    }

    /**
     * Update a connection
     * 
     * @param connectionId - The connection ID
     * @param payload - Fields to update
     * @param updateMask - Comma-separated list of fields to update
     * @returns Updated connection
     */
    public async updateConnection(
        connectionId: string,
        payload: Partial<UpdateConnectionPayload>,
        updateMask: string
    ): Promise<Connection> {
        if (!connectionId) {
            throw new ValidationError('connectionId');
        }

        return this._patchResource<Connection>(
            `/connections/${encodeURIComponent(connectionId)}`,
            payload,
            updateMask
        );
    }

    /**
     * Create a new connection
     * 
     * @param payload - Connection data
     * @returns Created connection
     */
    public async createConnection(payload: Connection): Promise<Connection> {
        if (!payload.connection_id) {
            throw new ValidationError('connection_id', 'Connection ID is required');
        }

        return this._request<Connection>('POST', '/connections', payload);
    }

    /**
     * Delete a connection
     * 
     * @param connectionId - The connection ID to delete
     */
    public async deleteConnection(connectionId: string): Promise<void> {
        if (!connectionId) {
            throw new ValidationError('connectionId');
        }

        await this._request('DELETE', `/connections/${encodeURIComponent(connectionId)}`);
    }
}
