# Airflow MCP Client - Architecture Overview

## Component Hierarchy

```
┌─────────────────────────────────────────────────────────────────┐
│                   VS Code Extension Layer                        │
│  (dagTreeView.ts, dagView.ts, extension.ts, etc.)               │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ imports
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    MCP Client Public API                         │
│                 (src/mcp/index.ts exports)                       │
│                                                                  │
│  ┌───────────────────┐  ┌──────────────┐  ┌─────────────────┐ │
│  │ AirflowMcpClient  │  │ Error Classes│  │   Type Defs     │ │
│  │                   │  │              │  │                 │ │
│  │ - Control         │  │ - ApiError   │  │ - Dag           │ │
│  │ - Productivity    │  │ - Validation │  │ - DagRun        │ │
│  │ - Management      │  │ - UpdateMask │  │ - Variable      │ │
│  └───────────────────┘  └──────────────┘  └─────────────────┘ │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ HTTP Requests
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              Airflow REST API v2 (/api/v2)                      │
│                                                                  │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────┐   │
│  │ /dags       │  │ /dagRuns     │  │ /variables          │   │
│  │ /health     │  │ /taskInst... │  │ /connections        │   │
│  └─────────────┘  └──────────────┘  └─────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## File Structure

```
src/mcp/
├── index.ts                # Public exports, entry point
├── AirflowMcpClient.ts     # Main client implementation
├── types.ts                # TypeScript interfaces
├── errors.ts               # Custom error classes
├── examples.ts             # Usage examples
├── README.md               # Comprehensive documentation
├── SUMMARY.md              # Implementation summary
└── QUICKREF.md             # Quick reference card
```

---

## Class Architecture

### AirflowMcpClient

```
┌──────────────────────────────────────────────────────────────┐
│              AirflowMcpClient                                 │
├──────────────────────────────────────────────────────────────┤
│ Private Fields:                                               │
│  - baseUrl: string                                            │
│  - authToken: string                                          │
│  - apiPrefix: string = '/api/v2'                              │
├──────────────────────────────────────────────────────────────┤
│ Core Methods:                                                 │
│  - _request<T>(method, path, data?, params?): Promise<T>     │
│  - _patchResource<T>(path, body, updateMask): Promise<T>     │
├──────────────────────────────────────────────────────────────┤
│ Control (DAG Lifecycle):                                      │
│  ✓ listDags(params?)                                         │
│  ✓ getDag(dagId)                                             │
│  ✓ pauseDag(dagId, isPaused)                                 │
│  ✓ triggerDagRun(dagId, payload?)                            │
│  ✓ clearTaskInstances(dagId, payload)                        │
│  ✓ clearDagRuns(dagId, payload)                              │
├──────────────────────────────────────────────────────────────┤
│ Productivity (Monitoring):                                    │
│  ✓ getTaskLogs(dagId, dagRunId, taskId, tryNumber, params?) │
│  ✓ getDagRun(dagId, dagRunId)                                │
│  ✓ listDagRuns(params?)                                      │
│  ✓ getTaskInstances(dagId, dagRunId, params?)               │
│  ✓ getHealth()                                               │
├──────────────────────────────────────────────────────────────┤
│ Management (Configuration):                                   │
│  ✓ listVariables(params?)                                    │
│  ✓ getVariable(variableKey)                                  │
│  ✓ createVariable(payload)                                   │
│  ✓ updateVariable(variableKey, payload, updateMask)          │
│  ✓ deleteVariable(variableKey)                               │
│  ✓ listConnections(params?)                                  │
│  ✓ getConnection(connectionId)                               │
│  ✓ createConnection(payload)                                 │
│  ✓ updateConnection(connectionId, payload, updateMask)       │
│  ✓ deleteConnection(connectionId)                            │
└──────────────────────────────────────────────────────────────┘
```

---

## Request/Response Flow

```
┌─────────────────┐
│ Extension Code  │
└────────┬────────┘
         │
         │ client.triggerDagRun('my_dag', {...})
         ▼
┌─────────────────────────────┐
│ AirflowMcpClient            │
│                             │
│ 1. Validate parameters      │──┐
│ 2. Call _request()          │  │ ValidationError?
└──────────┬──────────────────┘  ◄─┘
           │
           │ _request('POST', '/dags/my_dag/dagRuns', {...})
           ▼
┌─────────────────────────────┐
│ _request() method           │
│                             │
│ 1. Build URL                │
│    baseUrl + /api/v2 + path │
│                             │
│ 2. Add query params         │
│    limit=100&offset=0       │
│                             │
│ 3. Set headers              │
│    Authorization: Bearer... │
│    Content-Type: app/json   │
│                             │
│ 4. Stringify body           │
│    JSON.stringify(data)     │
│                             │
│ 5. Call fetch()             │
└──────────┬──────────────────┘
           │
           │ HTTP POST
           ▼
┌─────────────────────────────┐
│ Airflow Server              │
│ POST /api/v2/dags/.../runs  │
└──────────┬──────────────────┘
           │
           │ Response
           ▼
┌─────────────────────────────┐
│ _request() method           │
│                             │
│ 6. Check response.ok        │──┐
│                             │  │ !ok?
│ 7. Parse JSON               │  │
│                             │  │
│ 8. Return typed data        │  │
└──────────┬──────────────────┘  │
           │                     │
           │ Success             │ Error
           ▼                     ▼
┌─────────────────┐    ┌────────────────────┐
│ DagRun object   │    │ AirflowApiException│
│ returned        │    └────────────────────┘
└─────────────────┘
```

---

## Error Handling Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    Error Hierarchy                        │
└──────────────────────────────────────────────────────────┘

                        Error (built-in)
                            │
          ┌─────────────────┼─────────────────┐
          │                 │                 │
    ValidationError  MissingUpdateMaskError   AirflowApiException
          │                 │                      │
          │                 │                      │
    Parameter         update_mask           HTTP Errors
    validation        missing for           (401, 403, 404,
    failures          PATCH ops              500, etc.)


AirflowApiException Methods:
  ├─ getUserFriendlyMessage(): string
  ├─ toJSON(): object
  └─ fromResponse(response): Promise<AirflowApiException>

Error Flow:
  1. Validate params → ValidationError
  2. Check update_mask → MissingUpdateMaskError  
  3. HTTP call → AirflowApiException (if response.ok === false)
  4. Network failure → Generic Error
```

---

## Data Flow: Atomic Updates

```
Example: Pausing a DAG

1. Extension calls:
   ┌──────────────────────────────────────┐
   │ client.pauseDag('my_dag', true)      │
   └──────────────┬───────────────────────┘
                  │
                  ▼
2. pauseDag method:
   ┌──────────────────────────────────────┐
   │ validate dagId                        │
   │ create payload: {is_paused: true}    │
   │ call _patchResource(...)             │
   │   with updateMask='is_paused'        │
   └──────────────┬───────────────────────┘
                  │
                  ▼
3. _patchResource validates:
   ┌──────────────────────────────────────┐
   │ if (!updateMask) throw error         │
   │ call _request('PATCH', ...)          │
   └──────────────┬───────────────────────┘
                  │
                  ▼
4. _request builds URL:
   ┌──────────────────────────────────────┐
   │ PATCH /api/v2/dags/my_dag?           │
   │       update_mask=is_paused          │
   │                                      │
   │ Body: {"is_paused": true}            │
   └──────────────┬───────────────────────┘
                  │
                  ▼
5. Airflow receives:
   ┌──────────────────────────────────────┐
   │ Update ONLY is_paused field          │
   │ Leave all other fields unchanged     │
   │ Return updated DAG                   │
   └──────────────┬───────────────────────┘
                  │
                  ▼
6. Result:
   ┌──────────────────────────────────────┐
   │ Dag object with is_paused=true       │
   │ All other fields preserved           │
   └──────────────────────────────────────┘
```

---

## Authentication Flow

```
┌─────────────────────────────────────────────────────────┐
│         JWT Token Lifecycle (External to MCP)           │
└─────────────────────────────────────────────────────────┘

    User provides          Token passed        Token used in
    credentials      →     to constructor  →   all requests
         │                       │                    │
         ▼                       ▼                    ▼
  ┌─────────────┐      ┌──────────────┐      ┌─────────────┐
  │ Airflow     │      │ new MCP      │      │ Authorization│
  │ /login      │      │ Client(url,  │      │ Bearer <JWT> │
  │ endpoint    │      │ token)       │      │ header       │
  └─────────────┘      └──────────────┘      └─────────────┘
         │
         │ JWT token
         ▼
  ┌─────────────┐
  │ Extension   │
  │ stores      │
  │ token       │
  └─────────────┘

Note: Token refresh/renewal is handled outside MCP client
      MCP client assumes token is valid for all requests
```

---

## Type System

```
┌──────────────────────────────────────────────────────────┐
│                  Core Resource Types                      │
│                                                           │
│  Dag ──────────┐                                         │
│  DagRun ───────┤                                         │
│  TaskInstance ─┤─── Represent Airflow entities           │
│  Variable ─────┤                                         │
│  Connection ───┤                                         │
│  HealthStatus ─┘                                         │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│                 Request Payload Types                     │
│                                                           │
│  TriggerDagRunPayload ──────┐                           │
│  ClearTaskInstancesPayload ─┤                           │
│  UpdateDagPayload ──────────┤─── Data sent to API       │
│  UpdateVariablePayload ─────┤                           │
│  UpdateConnectionPayload ───┘                           │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│                Query Parameter Types                      │
│                                                           │
│  PaginationParams ─────┐                                 │
│  ListDagsParams ───────┤─── URL query parameters         │
│  ListDagRunsParams ────┤                                 │
│  GetTaskLogsParams ────┘                                 │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│                Response Wrapper Types                     │
│                                                           │
│  PaginatedResponse<T> ──┐                               │
│  TaskLogResponse ───────┴── Structured API responses     │
└──────────────────────────────────────────────────────────┘

All types enforce snake_case field naming ✓
```

---

## API Coverage Map

```
┌────────────────────────────────────────────────────────┐
│        Airflow REST API v2 Endpoints Covered          │
└────────────────────────────────────────────────────────┘

Control (DAG Management):
  GET    /dags                              → listDags()
  GET    /dags/{dagId}                      → getDag()
  PATCH  /dags/{dagId}                      → pauseDag()
  POST   /dags/{dagId}/dagRuns              → triggerDagRun()
  POST   /dags/{dagId}/clearTaskInstances   → clearTaskInstances()
  POST   /dags/{dagId}/clearDagRuns         → clearDagRuns()

Productivity (Monitoring):
  GET    /dagRuns                            → listDagRuns()
  GET    /dags/{dagId}/dagRuns/{dagRunId}   → getDagRun()
  GET    /dags/{dagId}/dagRuns/{dagRunId}/
         taskInstances                       → getTaskInstances()
  GET    /dags/{dagId}/dagRuns/{dagRunId}/
         taskInstances/{taskId}/logs         → getTaskLogs()
  GET    /health                             → getHealth()

Management (Variables):
  GET    /variables                          → listVariables()
  GET    /variables/{variableKey}            → getVariable()
  POST   /variables                          → createVariable()
  PATCH  /variables/{variableKey}            → updateVariable()
  DELETE /variables/{variableKey}            → deleteVariable()

Management (Connections):
  GET    /connections                        → listConnections()
  GET    /connections/{connectionId}         → getConnection()
  POST   /connections                        → createConnection()
  PATCH  /connections/{connectionId}         → updateConnection()
  DELETE /connections/{connectionId}         → deleteConnection()

Total Endpoints: 21
Coverage: 100% of specified requirements
```

---

## Performance Characteristics

```
┌────────────────────────────────────────────────────────┐
│              Operation Complexity                       │
└────────────────────────────────────────────────────────┘

Initialization:
  new AirflowMcpClient(url, token)     → O(1)

Single Resource Operations:
  getDag(id)                           → O(1)
  triggerDagRun(id, conf)              → O(1)
  pauseDag(id, state)                  → O(1)

List Operations (with pagination):
  listDags({ limit: n })               → O(n)
  listDagRuns({ limit: n })            → O(n)
  listVariables({ limit: n })          → O(n)

Log Retrieval:
  getTaskLogs(...)                     → O(log_size)
  
Bulk Operations (using Promise.all):
  Parallel requests                    → O(max(requests))
  Sequential requests                  → O(sum(requests))

Memory Usage:
  Base client                          → ~1 KB
  Per request                          → ~response_size
  No internal caching                  → O(1) overhead
```

---

## Security Considerations

```
┌────────────────────────────────────────────────────────┐
│                Security Features                        │
└────────────────────────────────────────────────────────┘

✓ JWT Bearer token authentication
✓ HTTPS recommended (enforced by baseUrl config)
✓ No credential storage in client (token passed at init)
✓ No logging of sensitive data (tokens, passwords)
✓ Password masking awareness in Connection responses
✓ Proper error handling (no sensitive data in errors)
✓ Input validation before API calls
✓ URL encoding of user inputs
✓ Type safety prevents injection attacks

⚠️ Responsibility of caller:
  - Token refresh/renewal
  - Secure token storage
  - HTTPS enforcement
  - Certificate validation
  - Rate limiting
```

---

## Extension Integration Points

```typescript
// 1. Initialize client (once)
const client = new AirflowMcpClient(config.apiUrl, jwtToken);

// 2. DAG Tree View (dagTreeView.ts)
const dags = await client.listDags({ only_active: true });
// Update tree view with dags

// 3. DAG Details View (dagView.ts)
const dag = await client.getDag(dagId);
const runs = await client.listDagRuns({ dag_id: dagId });
// Render webview with details

// 4. Trigger Command
await client.triggerDagRun(dagId, { conf: userConfig });
// Show notification

// 5. Monitor Command
const health = await client.getHealth();
// Display status bar item

// 6. Variables View (variablesView.ts)
const vars = await client.listVariables();
// Render variables tree

// 7. Logs Panel
const logs = await client.getTaskLogs(dagId, runId, taskId, tryNum);
// Display in output channel
```

---

## Future Enhancement Opportunities

```
Not in current scope but architected to support:

1. Caching Layer
   └─ Add cache interceptor in _request()
   
2. Request Batching
   └─ Queue multiple requests, send as batch
   
3. WebSocket Support
   └─ Real-time updates for DAG runs
   
4. Retry Logic
   └─ Built-in exponential backoff (see examples.ts)
   
5. Metrics Collection
   └─ Track API performance, success rates
   
6. Connection Pooling
   └─ Reuse HTTP connections
   
7. Request Middleware
   └─ Plugin system for request/response transformation
   
8. Response Streaming
   └─ For large log files
```

---

## Testing Strategy

```
Unit Tests (recommended):
  ├─ AirflowMcpClient
  │  ├─ Constructor validation
  │  ├─ _request URL construction
  │  ├─ _patchResource update_mask enforcement
  │  └─ Parameter validation
  │
  ├─ Error Classes
  │  ├─ AirflowApiException.fromResponse()
  │  ├─ getUserFriendlyMessage() for each status code
  │  └─ toJSON() serialization
  │
  └─ Types
     └─ Interface contracts

Integration Tests (recommended):
  ├─ Against live Airflow instance
  ├─ Against mock server
  └─ Error scenario coverage

E2E Tests (recommended):
  └─ VS Code extension commands using MCP client
```

