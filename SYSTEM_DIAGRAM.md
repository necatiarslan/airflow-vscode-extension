# Airflow VS Code Extension - System Diagram

This diagram shows the runtime architecture of the extension, including VS Code UI components, Airflow API integrations, AI tools, and the MCP bridge/server path.

```mermaid
flowchart LR
	U[Developer] --> VS[VS Code]

	subgraph EH[Extension Host]
		ACT[activate in extension.ts]
		SESS[Session]
		AIH[AIHandler]

		subgraph UI[Tree Views and Commands]
			DAGV[DagTreeView]
			ADMINV[AdminTreeView]
			REPORTV[ReportTreeView]
			MCPV[McpTreeView and McpManageView]
		end

		subgraph CORE[Common Runtime]
			API[Api client]
			REG[ToolRegistry]
			MSG[MessageHub and UI]
		end

		subgraph LT[Language Tools]
			AFT[AirflowTool]
			DAGTOOLS[GetDagRuns Trigger Pause Unpause Cancel etc]
			NAVTOOLS[GoTo Views and Diagnostics]
		end

		subgraph MCP[MCP Runtime]
			MM[McpManager]
			MBS[McpBridgeServer]
			MD[McpDispatcher]
			MS[McpSession via Pseudoterminal]
			MCPCLI[out mcp server.js stdio client]
		end
	end

	subgraph AF[Airflow Environment]
		AFAPI[Airflow REST API]
		AFDAG[DAGs DAG Runs Logs Configs]
	end

	subgraph EXT[External MCP Clients]
		COP[Copilot and MCP-capable clients]
	end

	subgraph WEB[Webviews]
		DVIEW[DagView]
		RVIEW[DagRunView DagLogView DailyDagRunView]
		AVIEW[Admin detail views Connections Variables Plugins Providers Health Configs]
	end

	%% Activation wiring
	VS --> ACT
	ACT --> SESS
	ACT --> AIH
	ACT --> DAGV
	ACT --> ADMINV
	ACT --> REPORTV
	ACT --> MCPV
	ACT --> MM

	%% Core and tools
	AIH --> REG
	REG --> AFT
	REG --> DAGTOOLS
	REG --> NAVTOOLS
	DAGV --> API
	ADMINV --> API
	REPORTV --> API
	AFT --> API
	DAGTOOLS --> API
	NAVTOOLS --> MSG

	%% Airflow backend
	API --> AFAPI
	AFAPI --> AFDAG

	%% UI outputs
	DAGV --> DVIEW
	REPORTV --> RVIEW
	ADMINV --> AVIEW
	MSG --> VS

	%% MCP path
	MM --> MBS
	MBS --> MD
	MD --> REG
	MM --> MS
	ACT -. registerMcpServerDefinitionProvider .-> MCPCLI
	MCPCLI <-- stdio --> COP
	MCPCLI <-- tcp host port --> MBS
```

## Request and Control Flow

1. User actions in tree views and commands call extension handlers.
2. Handlers use API and tool runtime to query or mutate Airflow resources.
3. Results render in tree items, webviews, and output messages.
4. MCP clients connect through stdio to `out/mcp/server.js`.
5. The stdio bridge connects to `McpBridgeServer` over configured host and port.
6. `McpDispatcher` resolves enabled tools from `ToolRegistry` and executes tool commands.

## MCP Capacity Model

- `McpBridgeServer` enforces a session cap from MCP settings.
- Extra MCP socket connections are queued until capacity is available.
- `McpManager` tracks active pseudoterminal sessions and can start/stop all sessions.
