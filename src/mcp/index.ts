/**
 * Airflow MCP (Management, Control, and Productivity) Client
 * 
 * This module provides a comprehensive TypeScript client for interacting with
 * Apache Airflow's Stable REST API v2.
 * 
 * @module mcp
 */

// Main client
export { AirflowMcpClient } from './AirflowMcpClient';

// Error classes
export {
    AirflowApiException,
    MissingUpdateMaskError,
    ValidationError
} from './errors';

// Type definitions
export type {
    // Core resources
    Dag,
    DagRun,
    TaskInstance,
    Variable,
    Connection,
    HealthStatus,
    
    // Response types
    PaginatedResponse,
    TaskLogResponse,
    
    // Request payload types
    TriggerDagRunPayload,
    UpdateDagPayload,
    ClearDagRunPayload,
    ClearTaskInstancesPayload,
    UpdateVariablePayload,
    UpdateConnectionPayload,
    
    // Query parameter types
    PaginationParams,
    ListDagsParams,
    ListDagRunsParams,
    GetTaskLogsParams
} from './types';
