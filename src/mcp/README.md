# Airflow MCP Client

**Management, Control, and Productivity** client for Apache Airflow VS Code Extension.

## Overview

The `AirflowMcpClient` is a TypeScript client that provides a comprehensive interface to interact with Apache Airflow's **Stable REST API v2**. It strictly adheres to the `/api/v2` standard and supports JWT Bearer Token authentication.

All request and response payloads use **snake_case** naming convention, as per the Airflow API standard.

## Features

### 🎛️ Control: DAG Lifecycle Management
- **List DAGs** with filtering and pagination
- **Pause/Unpause** DAGs with atomic updates
- **Trigger DAG runs** with custom configuration
- **Clear tasks** with upstream/downstream dependency control

### 📊 Productivity: Monitoring and Observability
- **Get task logs** with retry attempt support
- **Query DAG runs** by state and date ranges
- **Health checks** for metadatabase and scheduler
- **Task instance monitoring**

### ⚙️ Management: Configuration
- **CRUD operations** for Variables
- **CRUD operations** for Connections
- **Atomic updates** with `update_mask` enforcement

## Installation

The MCP client is part of the Airflow VS Code extension and doesn't require separate installation.

```typescript
import { AirflowMcpClient } from './mcp';
```

## Quick Start

### Initialize the Client

```typescript
import { AirflowMcpClient } from './mcp';

// Initialize with base URL and JWT token
const client = new AirflowMcpClient(
  'https://airflow.example.com',
  'your-jwt-bearer-token'
);
```

### Basic Examples

#### List DAGs
```typescript
// Get all active DAGs with pagination
const response = await client.listDags({ 
  limit: 100, 
  offset: 0,
  only_active: true 
});

console.log(`Found ${response.total_entries} DAGs`);
response.dags?.forEach(dag => {
  console.log(`- ${dag.dag_id} (${dag.is_paused ? 'paused' : 'active'})`);
});
```

#### Pause/Unpause a DAG
```typescript
// Pause a DAG
await client.pauseDag('my_data_pipeline', true);

// Unpause a DAG
await client.pauseDag('my_data_pipeline', false);
```

#### Trigger a DAG Run
```typescript
// Trigger with custom configuration
const dagRun = await client.triggerDagRun('my_dag', {
  conf: { 
    date: '2024-01-01',
    region: 'us-west-2'
  },
  note: 'Triggered from VS Code extension'
});

console.log(`DAG run created: ${dagRun.dag_run_id}`);
console.log(`State: ${dagRun.state}`);
```

#### Get Task Logs
```typescript
// Get logs for the first attempt
const logs = await client.getTaskLogs(
  'my_dag',           // DAG ID
  'manual_123',       // DAG run ID
  'extract_data',     // Task ID
  1                   // Try number (REQUIRED)
);

console.log(logs.content);

// Get logs for a retry attempt
const retryLogs = await client.getTaskLogs(
  'my_dag', 'manual_123', 'extract_data', 2
);
```

#### Monitor DAG Runs
```typescript
// Get all failed runs for a specific DAG
const failedRuns = await client.listDagRuns({
  dag_id: 'my_dag',
  state: ['failed'],
  limit: 50
});

failedRuns.dag_runs?.forEach(run => {
  console.log(`Failed run: ${run.dag_run_id}`);
  console.log(`  Started: ${run.start_date}`);
  console.log(`  Ended: ${run.end_date}`);
});
```

#### Clear Tasks
```typescript
// Clear failed tasks and their downstream dependencies
await client.clearTaskInstances('my_dag', {
  dry_run: false,
  only_failed: true,
  include_downstream: true,
  include_upstream: false,
  reset_dag_runs: true
});
```

#### Check Health Status
```typescript
const health = await client.getHealth();

if (health.scheduler.status === 'healthy') {
  console.log('✓ Scheduler is running');
  console.log(`  Last heartbeat: ${health.scheduler.latest_scheduler_heartbeat}`);
} else {
  console.error('✗ Scheduler is unhealthy!');
}

if (health.metadatabase.status === 'healthy') {
  console.log('✓ Database is accessible');
} else {
  console.error('✗ Database connection failed!');
}
```

### Configuration Management

#### Variables
```typescript
// List all variables
const variables = await client.listVariables({ limit: 100 });

// Get a specific variable
const myVar = await client.getVariable('api_endpoint');
console.log(myVar.value);

// Create a new variable
await client.createVariable({
  key: 'new_config',
  value: 'production',
  description: 'Environment configuration'
});

// Update a variable (atomic update with update_mask)
await client.updateVariable(
  'api_endpoint',
  { value: 'https://api.example.com/v2' },
  'value'  // Explicitly specify which field to update
);

// Update both value and description
await client.updateVariable(
  'api_endpoint',
  { 
    value: 'https://api.example.com/v2',
    description: 'Updated API endpoint'
  },
  'value,description'  // List all fields being updated
);

// Delete a variable
await client.deleteVariable('old_config');
```

#### Connections
```typescript
// List all connections
const connections = await client.listConnections({ limit: 100 });

// Get a specific connection
const conn = await client.getConnection('postgres_prod');
console.log(`Host: ${conn.host}:${conn.port}`);
// Note: Password may be masked for security

// Create a new connection
await client.createConnection({
  connection_id: 'my_postgres',
  conn_type: 'postgres',
  host: 'db.example.com',
  port: 5432,
  login: 'airflow_user',
  password: 'secret',
  schema: 'public'
});

// Update a connection
await client.updateConnection(
  'my_postgres',
  { 
    host: 'new-db.example.com',
    port: 5433
  },
  'host,port'
);
```

## Error Handling

The client provides comprehensive error handling with custom exception classes:

```typescript
import { AirflowApiException, ValidationError, MissingUpdateMaskError } from './mcp';

try {
  await client.triggerDagRun('my_dag', { conf: { param: 'value' } });
} catch (error) {
  if (error instanceof AirflowApiException) {
    console.error(`API Error: ${error.getUserFriendlyMessage()}`);
    console.error(`Status: ${error.statusCode} ${error.statusText}`);
    console.error(`URL: ${error.requestUrl}`);
    console.error(`Response:`, error.responseBody);
  } else if (error instanceof ValidationError) {
    console.error(`Validation Error: ${error.message}`);
    console.error(`Parameter: ${error.parameterName}`);
  } else if (error instanceof MissingUpdateMaskError) {
    console.error(`Update Mask Error: ${error.message}`);
  } else {
    console.error('Unexpected error:', error);
  }
}
```

### Common HTTP Status Codes

| Code | Meaning | Common Cause |
|------|---------|--------------|
| 401 | Unauthorized | Invalid or expired JWT token |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | DAG, task, or resource doesn't exist |
| 409 | Conflict | Resource already exists or invalid state |
| 422 | Validation Error | Invalid request data |
| 500 | Internal Server Error | Airflow server issue |

## Architecture

### Atomic Updates with `update_mask`

The client enforces Airflow's atomic update pattern using the `update_mask` parameter for all PATCH operations. This ensures data integrity by explicitly specifying which fields should be modified.

```typescript
// ✓ Correct - explicitly specify the field
await client.pauseDag('my_dag', true);
// Internally uses: update_mask=is_paused

// ✓ Correct - update multiple fields
await client.updateVariable('my_var', 
  { value: 'new_value', description: 'new description' },
  'value,description'
);

// ✗ Wrong - will throw MissingUpdateMaskError
await client._patchResource('/dags/my_dag', { is_paused: true }, '');
```

### Request/Response Flow

1. **Request Construction**: URL is constructed with `/api/v2` prefix
2. **Authentication**: Bearer token added to `Authorization` header
3. **Content Negotiation**: `Content-Type: application/json` and `Accept: application/json` headers set
4. **Error Handling**: Non-2xx responses converted to `AirflowApiException`
5. **Response Parsing**: JSON parsed and typed according to TypeScript interfaces

## API Reference

### Core Classes

- **`AirflowMcpClient`**: Main client class
- **`AirflowApiException`**: HTTP error with detailed context
- **`MissingUpdateMaskError`**: Thrown when update_mask is missing
- **`ValidationError`**: Thrown for parameter validation errors

### Type Definitions

All types are exported from the `types.ts` module:

- **Resources**: `Dag`, `DagRun`, `TaskInstance`, `Variable`, `Connection`, `HealthStatus`
- **Payloads**: `TriggerDagRunPayload`, `ClearTaskInstancesPayload`, `UpdateVariablePayload`, etc.
- **Parameters**: `ListDagsParams`, `ListDagRunsParams`, `PaginationParams`, etc.

## Best Practices

### 1. Always Specify Try Number for Logs
```typescript
// Task may have retried multiple times
const taskInstance = await client.getDagRun(dagId, dagRunId);
const logs = await client.getTaskLogs(
  dagId, 
  dagRunId, 
  taskId, 
  taskInstance.try_number  // Use actual try number
);
```

### 2. Use Pagination for Large Collections
```typescript
// Don't load all DAGs at once
const PAGE_SIZE = 100;
let offset = 0;
let hasMore = true;

while (hasMore) {
  const response = await client.listDags({ limit: PAGE_SIZE, offset });
  
  // Process response.dags
  
  offset += PAGE_SIZE;
  hasMore = response.dags && response.dags.length === PAGE_SIZE;
}
```

### 3. Handle Errors Gracefully
```typescript
async function safeTriggerDag(dagId: string) {
  try {
    return await client.triggerDagRun(dagId);
  } catch (error) {
    if (error instanceof AirflowApiException && error.statusCode === 404) {
      console.log(`DAG ${dagId} not found`);
      return null;
    }
    throw error; // Re-throw other errors
  }
}
```

### 4. Use Type Guards
```typescript
import { DagRun } from './mcp';

function isDagRunning(dagRun: DagRun): boolean {
  return dagRun.state === 'running' || dagRun.state === 'queued';
}
```

## Testing

Example test cases:

```typescript
import { AirflowMcpClient, ValidationError } from './mcp';

describe('AirflowMcpClient', () => {
  let client: AirflowMcpClient;

  beforeEach(() => {
    client = new AirflowMcpClient(
      'https://test.example.com',
      'test-token'
    );
  });

  it('should throw ValidationError for empty dagId', async () => {
    await expect(client.pauseDag('', true)).rejects.toThrow(ValidationError);
  });

  it('should construct correct URL for listDags', async () => {
    // Mock fetch and verify URL construction
  });
});
```

## Migration from Existing API

If you're migrating from the existing `api.ts`:

```typescript
// Old approach
const api = new AirflowApi(config);
const result = await api.getDagList();

// New MCP approach
const client = new AirflowMcpClient(config.apiUrl, jwtToken);
const response = await client.listDags();
const dags = response.dags || [];
```

Key differences:
- MCP client uses JWT tokens directly (not username/password)
- All methods return properly typed responses
- Better error handling with custom exceptions
- Enforces `update_mask` for atomic updates

## Contributing

When adding new endpoints to the MCP client:

1. Add type definitions to `types.ts`
2. Implement the method in `AirflowMcpClient.ts`
3. Add JSDoc documentation with examples
4. Use the `_request()` helper for HTTP calls
5. Use `_patchResource()` for PATCH operations
6. Validate required parameters
7. Export new types from `index.ts`

## Resources

- [Airflow REST API Documentation](https://airflow.apache.org/docs/apache-airflow/stable/stable-rest-api-ref.html)
- [Airflow API Reference](https://airflow.apache.org/docs/apache-airflow/stable/stable-rest-api-ref.html)
- [JWT Authentication Guide](https://airflow.apache.org/docs/apache-airflow/stable/security/api.html)

## License

This module is part of the Airflow VS Code Extension and follows the same license.
