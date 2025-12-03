# Airflow MCP Client - Quick Reference

## Installation & Setup

```typescript
import { AirflowMcpClient } from './mcp';

const client = new AirflowMcpClient(
  'https://airflow.example.com',
  'your-jwt-token'
);
```

---

## 🎛️ Control: DAG Management

```typescript
// List DAGs
const dags = await client.listDags({ limit: 100, only_active: true });

// Get specific DAG
const dag = await client.getDag('my_dag');

// Pause/Unpause
await client.pauseDag('my_dag', true);   // Pause
await client.pauseDag('my_dag', false);  // Unpause

// Trigger DAG
const run = await client.triggerDagRun('my_dag', {
  conf: { date: '2024-01-01' },
  note: 'Triggered from VS Code'
});

// Clear tasks
await client.clearTaskInstances('my_dag', {
  only_failed: true,
  include_downstream: true
});
```

---

## 📊 Productivity: Monitoring

```typescript
// Get DAG run
const run = await client.getDagRun('my_dag', 'run_id');

// List runs
const runs = await client.listDagRuns({
  dag_id: 'my_dag',
  state: ['failed', 'running']
});

// Get task instances
const tasks = await client.getTaskInstances('my_dag', 'run_id');

// Get logs (try_number is REQUIRED!)
const logs = await client.getTaskLogs('my_dag', 'run_id', 'task_id', 1);

// Health check
const health = await client.getHealth();
console.log(health.scheduler.status);      // 'healthy' or 'unhealthy'
console.log(health.metadatabase.status);    // 'healthy' or 'unhealthy'
```

---

## ⚙️ Management: Variables

```typescript
// List variables
const vars = await client.listVariables({ limit: 100 });

// Get variable
const myVar = await client.getVariable('my_key');

// Create variable
await client.createVariable({
  key: 'new_var',
  value: 'value',
  description: 'Description'
});

// Update variable (atomic with update_mask)
await client.updateVariable('my_key', { value: 'new_value' }, 'value');

// Delete variable
await client.deleteVariable('old_var');
```

---

## 🔗 Management: Connections

```typescript
// List connections
const conns = await client.listConnections({ limit: 100 });

// Get connection
const conn = await client.getConnection('postgres_conn');

// Create connection
await client.createConnection({
  connection_id: 'my_conn',
  conn_type: 'postgres',
  host: 'db.example.com',
  port: 5432
});

// Update connection
await client.updateConnection('my_conn', 
  { host: 'new-db.example.com' }, 
  'host'
);

// Delete connection
await client.deleteConnection('old_conn');
```

---

## 🚨 Error Handling

```typescript
import { AirflowApiException, ValidationError } from './mcp';

try {
  await client.triggerDagRun('my_dag');
} catch (error) {
  if (error instanceof AirflowApiException) {
    // HTTP errors (401, 404, 500, etc.)
    console.error(error.getUserFriendlyMessage());
    console.error(`Status: ${error.statusCode}`);
    console.error(`URL: ${error.requestUrl}`);
  } else if (error instanceof ValidationError) {
    // Parameter validation errors
    console.error(`Invalid param: ${error.parameterName}`);
  } else {
    // Other errors
    console.error('Unexpected error:', error);
  }
}
```

### Common Status Codes

| Code | Meaning | Action |
|------|---------|--------|
| 401 | Unauthorized | Check JWT token |
| 403 | Forbidden | Check permissions |
| 404 | Not Found | Verify DAG/resource exists |
| 409 | Conflict | Resource already exists |
| 422 | Validation Error | Check request payload |
| 500 | Server Error | Check Airflow logs |

---

## 💡 Best Practices

### 1. Always Specify try_number for Logs
```typescript
// ✅ Good
const logs = await client.getTaskLogs(dagId, runId, taskId, 1);

// ❌ Bad - will throw ValidationError
const logs = await client.getTaskLogs(dagId, runId, taskId);
```

### 2. Use Pagination for Large Lists
```typescript
// ✅ Good
const PAGE_SIZE = 100;
let offset = 0;
let hasMore = true;

while (hasMore) {
  const response = await client.listDags({ limit: PAGE_SIZE, offset });
  // Process response.dags
  hasMore = response.dags && response.dags.length === PAGE_SIZE;
  offset += PAGE_SIZE;
}

// ❌ Bad - may timeout or OOM
const allDags = await client.listDags({ limit: 100000 });
```

### 3. Atomic Updates with update_mask
```typescript
// ✅ Good - explicit field specification
await client.updateVariable('key', { value: 'new' }, 'value');

// ✅ Good - multiple fields
await client.updateVariable('key', 
  { value: 'new', description: 'updated' },
  'value,description'
);

// ❌ Bad - will throw MissingUpdateMaskError
await client._patchResource('/variables/key', { value: 'new' }, '');
```

### 4. Handle 404 Gracefully
```typescript
// ✅ Good
try {
  const dag = await client.getDag('my_dag');
} catch (error) {
  if (error instanceof AirflowApiException && error.statusCode === 404) {
    console.log('DAG not found, creating...');
    // Handle missing DAG
  } else {
    throw error;
  }
}
```

### 5. Retry on Server Errors
```typescript
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof AirflowApiException && error.statusCode >= 500) {
        if (i < maxRetries - 1) {
          await new Promise(r => setTimeout(r, 1000 * (i + 1)));
          continue;
        }
      }
      throw error;
    }
  }
  throw new Error('Unreachable');
}

const dags = await withRetry(() => client.listDags());
```

---

## 🔍 Debugging Tips

### Check Connection
```typescript
const health = await client.getHealth();
if (health.scheduler.status !== 'healthy') {
  console.error('Scheduler is down!');
}
```

### Find Failed Tasks
```typescript
const runs = await client.listDagRuns({ dag_id: 'my_dag', state: ['failed'] });
for (const run of runs.dag_runs || []) {
  const tasks = await client.getTaskInstances('my_dag', run.dag_run_id);
  const failed = tasks.task_instances?.filter(t => t.state === 'failed');
  console.log(`Failed tasks:`, failed?.map(t => t.task_id));
}
```

### Get Latest Logs
```typescript
const run = await client.getDagRun(dagId, runId);
const tasks = await client.getTaskInstances(dagId, runId);

for (const task of tasks.task_instances || []) {
  const logs = await client.getTaskLogs(
    dagId, 
    runId, 
    task.task_id, 
    task.try_number  // Use actual try number
  );
  console.log(`\n=== ${task.task_id} ===\n${logs.content}`);
}
```

---

## 📖 Type Reference

### Core Types
- `Dag` - DAG metadata
- `DagRun` - DAG run instance
- `TaskInstance` - Task execution instance
- `Variable` - Airflow variable
- `Connection` - Airflow connection
- `HealthStatus` - System health

### Payloads
- `TriggerDagRunPayload` - Trigger configuration
- `ClearTaskInstancesPayload` - Clear task configuration
- `UpdateVariablePayload` - Variable update data
- `UpdateConnectionPayload` - Connection update data

### Parameters
- `ListDagsParams` - DAG list filters
- `ListDagRunsParams` - DAG run filters
- `GetTaskLogsParams` - Log retrieval options
- `PaginationParams` - Pagination controls

---

## 🚀 Performance Tips

1. **Batch operations** when possible
2. **Limit results** with pagination params
3. **Cache health checks** (don't check every request)
4. **Reuse client instance** (don't create new clients)
5. **Use Promise.all** for parallel requests

```typescript
// ✅ Good - parallel requests
const [dags, variables, connections] = await Promise.all([
  client.listDags({ limit: 100 }),
  client.listVariables({ limit: 100 }),
  client.listConnections({ limit: 100 })
]);

// ❌ Bad - sequential requests
const dags = await client.listDags({ limit: 100 });
const variables = await client.listVariables({ limit: 100 });
const connections = await client.listConnections({ limit: 100 });
```

---

## 📚 Further Reading

- **Full Documentation:** `src/mcp/README.md`
- **Examples:** `src/mcp/examples.ts`
- **Implementation Summary:** `src/mcp/SUMMARY.md`
- **Airflow API Docs:** https://airflow.apache.org/docs/apache-airflow/stable/stable-rest-api-ref.html
