/* eslint-disable @typescript-eslint/naming-convention */
import * as vscode from 'vscode';
import * as tmp from 'tmp';
import * as fs from 'fs';
import { DagTreeItem } from './DagTreeItem';
import { DagTreeDataProvider } from './DagTreeDataProvider';
import { DagView } from './DagView';
import { DailyDagRunView } from '../report/DailyDagRunView';
import { DagRunView } from '../report/DagRunView';
import * as ui from '../common/UI';
import { AirflowApi } from '../common/Api';
import { AskAIContext, ServerConfig } from '../common/Types';
import * as MessageHub from '../common/MessageHub';

export class DagTreeView {

	public static Current: DagTreeView | undefined;
	public view: vscode.TreeView<DagTreeItem>;
	public treeDataProvider: DagTreeDataProvider;
	public context: vscode.ExtensionContext;
	public filterString: string = '';
	public dagStatusInterval: NodeJS.Timeout | undefined;
	public ShowOnlyActive: boolean = true;
	public ShowOnlyFavorite: boolean = false;
	
	public ServerList: ServerConfig[] = [];
	public api: AirflowApi | undefined;
	public currentServer: ServerConfig | undefined;

	constructor(context: vscode.ExtensionContext) {
		ui.logToOutput('DagTreeView.constructor Started');
		this.context = context;
		this.treeDataProvider = new DagTreeDataProvider();
		this.view = vscode.window.createTreeView('dagTreeView', { treeDataProvider: this.treeDataProvider, showCollapseAll: true });
		this.loadState();
		
		context.subscriptions.push(this.view);
		context.subscriptions.push({ dispose: () => this.dispose() });
		DagTreeView.Current = this;
		this.setFilterMessage();
		this.refresh();
	}

	public dispose() {
		ui.logToOutput('DagTreeView.dispose Started');
		if (this.dagStatusInterval) {
			clearInterval(this.dagStatusInterval);
		}
	}

	async refresh(): Promise<void> {
		ui.logToOutput('DagTreeView.refresh Started');
		if (!this.api) {
			this.treeDataProvider.dagList = [];
			this.treeDataProvider.refresh();
			return;
		}

		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Window,
			title: "Airflow: Loading...",
		}, async (progress) => {
			progress.report({ increment: 0 });
			await this.loadDags();
		});
		
		await this.getImportErrors();
	}

	resetView(): void {
		ui.logToOutput('DagTreeView.resetView Started');
		this.api = undefined;
		this.currentServer = undefined;
		this.filterString = '';

		this.treeDataProvider.dagList = undefined;
		this.treeDataProvider.refresh();
		this.setViewTitle();

		this.saveState();
		this.refresh();
	}

	viewDagView(node: DagTreeItem): void {
		ui.logToOutput('DagTreeView.viewDagView Started');
		if (this.api) {
			DagView.render(this.context.extensionUri, node.DagId, this.api);
		}
	}

	async addToFavDAG(node: DagTreeItem) {
		ui.logToOutput('DagTreeView.addToFavDAG Started');
		node.IsFav = true;
		this.treeDataProvider.refresh();
	}

	async deleteFromFavDAG(node: DagTreeItem) {
		ui.logToOutput('DagTreeView.deleteFromFavDAG Started');
		node.IsFav = false;
		this.treeDataProvider.refresh();
	}

	/**
	 * Helper method to create a temp file and open it
	 */
	private createAndOpenTempFile(content: string, prefix: string, extension: string): void {
		const tmpFile = tmp.fileSync({ mode: 0o644, prefix, postfix: extension });
		fs.appendFileSync(tmpFile.name, content);
		ui.openFile(tmpFile.name);
	}

	/**
	 * Helper method to start the DAG status refresh interval
	 */
	private startDagStatusInterval(): void {
		if (!this.dagStatusInterval) {
			this.dagStatusInterval = setInterval(() => {
				void this.refreshRunningDagState(this).catch((err: any) => ui.logToOutput('refreshRunningDagState Error', err));
			}, 10 * 1000);
		}
	}

	/**
	 * Helper method to handle post-trigger state updates
	 */
	private handleTriggerSuccess(node: DagTreeItem, responseTrigger: any): void {
		node.LatestDagRunId = responseTrigger['dagRunId'];
		node.LatestDagState = responseTrigger['state'];
		node.refreshUI();
		this.treeDataProvider.refresh();
		this.startDagStatusInterval();
		MessageHub.DagTriggered(this, node.DagId, node.LatestDagRunId);
	}

	async triggerDag(node: DagTreeItem) {
		ui.logToOutput('DagTreeView.triggerDag Started');
		if (!this.api) { return; }

		if (node.IsPaused) {
			ui.showWarningMessage('Dag is PAUSED !!!');
			return;
		}

		if (node.isDagRunning()) {
			ui.showWarningMessage('Dag is ALREADY RUNNING !!!');
			return;
		}

		const result = await this.api.triggerDag(node.DagId);

		if (result.isSuccessful) {
			this.handleTriggerSuccess(node, result.result);
		}
	}

	async refreshRunningDagState(dagTreeView: DagTreeView) {
		ui.logToOutput('DagTreeView.refreshRunningDagState Started');
		if (!dagTreeView.api) { return; }

		let noDagIsRunning: boolean = true;
		for (const node of dagTreeView.treeDataProvider.visibleDagList) {
			if (node.isDagRunning()) {
				noDagIsRunning = false;

				const result = await dagTreeView.api.getDagRun(node.DagId, node.LatestDagRunId);

				if (result.isSuccessful) {
					node.LatestDagState = result.result['state'];
					node.refreshUI();
				} else {
					node.LatestDagRunId = '';
					node.LatestDagState = '';
				}
			}
			dagTreeView.treeDataProvider.refresh();
		}
		if (noDagIsRunning && dagTreeView.dagStatusInterval) {
			clearInterval(dagTreeView.dagStatusInterval);
			dagTreeView.dagStatusInterval = undefined;
			//ui.showInfoMessage('All Dag Run(s) Completed');
			ui.logToOutput('All Dag Run(s) Completed');
		}
	}

	async triggerDagWConfig(node: DagTreeItem) {
		ui.logToOutput('DagTreeView.triggerDagWConfig Started');
		if (!this.api) { return; }

		let triggerDagConfig = await vscode.window.showInputBox({ placeHolder: 'Enter Configuration JSON (Optional, must be a dict object) or Press Enter' });

		if (!triggerDagConfig) {
			triggerDagConfig = "{}";
		}

		if (triggerDagConfig !== undefined) {
			const result = await this.api.triggerDag(node.DagId, triggerDagConfig);

			if (result.isSuccessful) {
				this.handleTriggerSuccess(node, result.result);
			}
		}
	}

	public async checkAllDagsRunState() {
		ui.logToOutput('DagTreeView.checkAllDagsRunState Started');
		if (!this.treeDataProvider) { return; }
		for (const node of this.treeDataProvider.visibleDagList) {
			if (!node.IsPaused) {
				this.checkDagRunState(node);
			}
		}
	}

	public async notifyDagStateWithDagId(dagId: string, dagRunId?: string, dagState?: string) {
		ui.logToOutput('DagTreeView.notifyDagStateWithDagId Started');
		if (!this.treeDataProvider) { return; }
		for (const node of this.treeDataProvider.visibleDagList) {
			if (node.DagId === dagId) {
				//this.checkDagRunState(node);
				node.LatestDagRunId = dagRunId;
				node.LatestDagState = dagState;
				node.refreshUI();	
				this.treeDataProvider.refresh();

				if (node.isDagRunning()) {
					this.startDagStatusInterval();
				}
			}
		}
	}

	async checkDagRunState(node: DagTreeItem) {
		ui.logToOutput('DagTreeView.checkDagRunState Started');
		if (!this.api) { return; }
		if (!node) { return; }
		if (node.IsPaused) { ui.showWarningMessage(node.DagId + 'Dag is PAUSED'); return; }

		const result = await this.api.getLastDagRun(node.DagId);
		if (result.isSuccessful) {
			node.LatestDagRunId = result.result.dag_run_id;
			node.LatestDagState = result.result.state;
			node.refreshUI();
			this.treeDataProvider.refresh();

			if (node.isDagRunning()) {
				this.startDagStatusInterval();
			}
		}
	}

	async pauseDAG(node: DagTreeItem) {
		ui.logToOutput('DagTreeView.pauseDAG Started');
		if (!this.api) { return; }
		if (node.IsPaused) { ui.showWarningMessage(node.DagId + 'Dag is already PAUSED'); return; }

		const result = await this.api.pauseDag(node.DagId, true);
		if (result.isSuccessful) {
			node.IsPaused = true;
			node.refreshUI();
			this.treeDataProvider.refresh();
			MessageHub.DagPaused(this, node.DagId);
		}
	}

	public async notifyDagPaused(dagId: string) {
		ui.logToOutput('DagTreeView.notifyDagPaused Started');
		this.refresh();
	}

	public async notifyDagUnPaused(dagId: string) {
		ui.logToOutput('DagTreeView.notifyDagUnPaused Started');
		this.refresh();
	}

	async unPauseDAG(node: DagTreeItem) {
		ui.logToOutput('DagTreeView.unPauseDAG Started');
		if (!this.api) { return; }
		if (!node.IsPaused) { ui.showInfoMessage(node.DagId + 'Dag is already UNPAUSED'); return; }

		const result = await this.api.pauseDag(node.DagId, false);
		if (result.isSuccessful) {
			node.IsPaused = false;
			node.refreshUI();
			this.treeDataProvider.refresh();
			MessageHub.DagUnPaused(this, node.DagId);
		}
	}

	async cancelDagRun(node: DagTreeItem) {
		ui.logToOutput('DagTreeView.cancelDagRun Started');
		if (!this.api) { return; }
		
		if (!node.isDagRunning()) {
			ui.showWarningMessage('No running DAG to cancel');
			return;
		}

		if (!node.LatestDagRunId) {
			ui.showWarningMessage('No DAG run ID found');
			return;
		}

		const result = await this.api.cancelDagRun(node.DagId, node.LatestDagRunId);
		if (result.isSuccessful) {
			node.LatestDagState = 'failed';
			node.refreshUI();
			this.treeDataProvider.refresh();
			ui.showInfoMessage(`DAG Run ${node.LatestDagRunId} cancelled`);
			
			MessageHub.DagRunCancelled(this, node.DagId, node.LatestDagRunId);
		}
	}

	async lastDAGRunLog(node: DagTreeItem) {
		ui.logToOutput('DagTreeView.lastDAGRunLog Started');
		if (!this.api) { return; }

		const result = await this.api.getLastDagRunLog(node.DagId);
		if (result.isSuccessful) {
			this.createAndOpenTempFile(result.result, node.DagId, '.log');
		}
	}

	async dagSourceCode(node: DagTreeItem) {
		ui.logToOutput('DagTreeView.dagSourceCode Started');
		if (!this.api) { return; }

		const result = await this.api.getSourceCode(node.DagId, node.FileToken);

		if (result.isSuccessful) {
			this.createAndOpenTempFile(result.result, node.DagId, '.py');
		} else {
			ui.logToOutput(result.result);
			ui.showErrorMessage(result.result);
		}
	}

	async showDagInfo(node: DagTreeItem) {
		ui.logToOutput('DagTreeView.showDagInfo Started');
		if (!this.api) { return; }

		const result = await this.api.getDagInfo(node.DagId);

		if (result.isSuccessful) {
			this.createAndOpenTempFile(JSON.stringify(result.result, null, 2), node.DagId + '_info', '.json');
		} else {
			ui.logToOutput(result.result);
			ui.showErrorMessage('Failed to fetch DAG info');
		}
	}

	public askAIContext: AskAIContext | undefined;

	public async aIHandler (request: vscode.ChatRequest, context: vscode.ChatContext, stream: vscode.ChatResponseStream, token: vscode.CancellationToken) : Promise<void>
	{
		const aiContext = DagTreeView.Current?.askAIContext;
		
		// 1. Define the tools we want to expose to the model
		// These must match the definitions in package.json
		const tools: vscode.LanguageModelChatTool[] = [
			{
				name: 'list_active_dags',
				description: 'Lists all Airflow DAGs that are currently active (not paused). Returns a list of DAG IDs and their details.',
				inputSchema: {
					type: 'object',
					properties: {},
					required: []
				}
			},
			{
				name: 'list_paused_dags',
				description: 'Lists all Airflow DAGs that are currently paused. Returns a list of DAG IDs and their details.',
				inputSchema: {
					type: 'object',
					properties: {},
					required: []
				}
			},
			{
				name: 'get_running_dags',
				description: 'Lists all Airflow DAGs that currently have running or queued DAG runs. Use this when asked about running, executing, or in-progress DAGs. Returns DAG IDs with run states and run IDs.',
				inputSchema: {
					type: 'object',
					properties: {},
					required: []
				}
			},
			{
				name: 'pause_dag',
				description: 'Pauses a specific Airflow DAG. Required input: dag_id (string).',
				inputSchema: {
					type: 'object',
					properties: {
						dagId: { type: 'string', description: 'The unique identifier (ID) of the DAG to pause' }
					},
					required: ['dagId']
				}
			},
			{
				name: 'unpause_dag',
				description: 'Unpauses (activates) a specific Airflow DAG. Required input: dag_id (string).',
				inputSchema: {
					type: 'object',
					properties: {
						dagId: { type: 'string', description: 'The unique identifier (ID) of the DAG to unpause' }
					},
					required: ['dagId']
				}
			},
			{
				name: 'trigger_dag_run',
				description: 'Triggers a DAG run. Inputs: dag_id (string), config_json (string, optional), date (string, optional).',
				inputSchema: {
					type: 'object',
					properties: {
						dagId: { type: 'string', description: 'The DAG ID' },
						configJson: { type: 'string', description: 'JSON configuration or file path' },
						date: { type: 'string', description: 'Logical date in ISO 8601 format' }
					},
					required: ['dagId']
				}
			},
			{
				name: 'get_failed_runs',
				description: 'Gets failed DAG runs. Inputs: time_range_hours (number), dag_id_filter (string).',
				inputSchema: {
					type: 'object',
					properties: {
						timeRangeHours: { type: 'number' },
						dagIdFilter: { type: 'string' }
					},
					required: []
				}
			},
			{
				name: 'get_dag_runs',
				description: 'Retrieves DAG runs for a given DAG. Optional date (YYYY-MM-DD). Returns run id, start time, duration, status.',
				inputSchema: {
					type: 'object',
					properties: {
						dagId: { type: 'string', description: 'The DAG ID' },
						date: { type: 'string', description: 'Optional date filter YYYY-MM-DD' }
					},
					required: ['dagId']
				}
			},
			{
				name: 'get_dag_history',
				description: 'Retrieves DAG run history for a given date (defaults to today). Returns date/time, status, duration, note.',
				inputSchema: {
					type: 'object',
					properties: {
						dagId: { type: 'string', description: 'The DAG ID' },
						date: { type: 'string', description: 'Optional date filter YYYY-MM-DD' }
					},
					required: ['dagId']
				}
			},
			{
				name: 'cancel_dag_run',
				description: 'Cancels the currently running DAG run for the given DAG. Required: dag_id.',
				inputSchema: {
					type: 'object',
					properties: {
						dagId: { type: 'string', description: 'The DAG ID' }
					},
					required: ['dagId']
				}
			},
			{
				name: 'analyse_dag_latest_run',
				description: 'Comprehensive analysis of the latest DAG run including tasks, source code, and logs. Required: dag_id.',
				inputSchema: {
					type: 'object',
					properties: {
						dagId: { type: 'string', description: 'The DAG ID' }
					},
					required: ['dagId']
				}
			},
			{
				name: 'get_dag_run_detail',
				description: 'Comprehensive analysis of a specific DAG run by run ID. Analyzes tasks, source code, and logs for the specified run. Required: dag_id, dag_run_id.',
				inputSchema: {
					type: 'object',
					properties: {
						dagId: { type: 'string', description: 'The DAG ID' },
						dagRunId: { type: 'string', description: 'The DAG run ID to analyze' }
					},
					required: ['dagId', 'dagRunId']
				}
			},
			{
				name: 'go_to_dag_view',
				description: 'Opens the DAG View panel to display information about a specific DAG. Optional: provide dag_run_id to view a specific run. Required: dag_id.',
				inputSchema: {
					type: 'object',
					properties: {
						dagId: { type: 'string', description: 'The DAG ID to view' },
						dagRunId: { type: 'string', description: 'Optional DAG run ID to navigate to a specific run' }
					},
					required: ['dagId']
				}
			},
			{
				name: 'go_to_dag_run_history',
				description: 'Opens the DAG Run History panel with optional filters. Shows run history for a DAG with optional date range and status filters. Required: dag_id.',
				inputSchema: {
					type: 'object',
					properties: {
						dagId: { type: 'string', description: 'The DAG ID to view history for' },
						startDate: { type: 'string', description: 'Optional start date filter (YYYY-MM-DD format)' },
						endDate: { type: 'string', description: 'Optional end date filter (YYYY-MM-DD format)' },
						status: { type: 'string', description: 'Optional status filter (success, failed, running, queued, upstream_failed)' }
					},
					required: ['dagId']
				}
			},
			{
				name: 'go_to_providers_view',
				description: 'Opens the Providers View panel to display installed Airflow providers. No inputs required.',
				inputSchema: {
					type: 'object',
					properties: {},
					required: []
				}
			},
			{
				name: 'go_to_connections_view',
				description: 'Opens the Connections View panel to display Airflow connections. No inputs required.',
				inputSchema: {
					type: 'object',
					properties: {},
					required: []
				}
			},
			{
				name: 'go_to_variables_view',
				description: 'Opens the Variables View panel to display Airflow variables. No inputs required.',
				inputSchema: {
					type: 'object',
					properties: {},
					required: []
				}
			},
			{
				name: 'go_to_configs_view',
				description: 'Opens the Configs View panel to display Airflow configuration settings. No inputs required.',
				inputSchema: {
					type: 'object',
					properties: {},
					required: []
				}
			},
			{
				name: 'go_to_plugins_view',
				description: 'Opens the Plugins View panel to display installed Airflow plugins. No inputs required.',
				inputSchema: {
					type: 'object',
					properties: {},
					required: []
				}
			},
			{
				name: 'go_to_server_health_view',
				description: 'Opens the Server Health View panel to display Airflow server health status. No inputs required.',
				inputSchema: {
					type: 'object',
					properties: {},
					required: []
				}
			}
		];

		// 2. Construct the Initial Messages
		const messages: vscode.LanguageModelChatMessage[] = [
			vscode.LanguageModelChatMessage.User(`You are an expert in Apache Airflow. You have access to tools to manage DAGs, view logs, and check status. Use them when appropriate.`)
		];

		// Add context if available
		if (aiContext) {
			messages.push(vscode.LanguageModelChatMessage.User(`Context:\nDAG: ${aiContext.dag || 'N/A'}\nLogs: ${aiContext.logs || 'N/A'}\nCode: ${aiContext.code || 'N/A'}`));
		}

		messages.push(vscode.LanguageModelChatMessage.User(request.prompt));

		// 3. Select Model and Send Request
		try {
			const [model] = await vscode.lm.selectChatModels({ family: 'gpt-4' });
			if (!model) {
				stream.markdown("No suitable AI model found.");
				return;
			}

			// Tool calling loop
			let keepGoing = true;
			while (keepGoing && !token.isCancellationRequested) {
				keepGoing = false; // Default to stop unless we get a tool call

				const chatResponse = await model.sendRequest(messages, { tools }, token);
				let toolCalls: vscode.LanguageModelToolCallPart[] = [];

				for await (const fragment of chatResponse.text) {
					stream.markdown(fragment);
				}
				
				// Collect tool calls from the response
				for await (const part of chatResponse.stream) {
					if (part instanceof vscode.LanguageModelToolCallPart) {
						toolCalls.push(part);
					}
				}

				// Execute tools if any were called
				if (toolCalls.length > 0) {
					keepGoing = true; // We need to send results back to the model
					
					// Add the model's response (including tool calls) to history
					messages.push(vscode.LanguageModelChatMessage.Assistant(toolCalls));

					for (const toolCall of toolCalls) {
						stream.progress(`Running tool: ${toolCall.name}...`);
						
						try {
							// Invoke the tool using VS Code LM API
							const result = await vscode.lm.invokeTool(
								toolCall.name, 
								{ input: toolCall.input } as any, 
								token
							);
							
							// Convert result to string/text part
							const resultText = result.content
								.filter(part => part instanceof vscode.LanguageModelTextPart)
								.map(part => (part as vscode.LanguageModelTextPart).value)
								.join('\n');
							
							// Add result to history
							messages.push(vscode.LanguageModelChatMessage.User([
								new vscode.LanguageModelToolResultPart(toolCall.callId, [new vscode.LanguageModelTextPart(resultText)])
							]));

						} catch (err) {
							const errorMessage = `Tool execution failed: ${err instanceof Error ? err.message : String(err)}`;
							messages.push(vscode.LanguageModelChatMessage.User([
								new vscode.LanguageModelToolResultPart(toolCall.callId, [new vscode.LanguageModelTextPart(errorMessage)])
							]));
						}
					}
				}
			}

		} catch (err) {
			if (err instanceof Error) {
				stream.markdown(`I'm sorry, I couldn't connect to the AI model: ${err.message}`);
			} else {
				stream.markdown("I'm sorry, I couldn't connect to the AI model.");
			}
		}
	};
	
	async isChatCommandAvailable(): Promise<boolean> {
		const commands = await vscode.commands.getCommands(true); // 'true' includes internal commands
		return commands.includes('workbench.action.chat.open');
	}

	public async askAI(node: DagTreeItem) {
		ui.logToOutput('DagTreeView.askAI Started');
		if (!this.api) { return; }
		if (!await this.isChatCommandAvailable()) {
			ui.showErrorMessage('Chat command is not available. Please ensure you have access to VS Code AI features.');
			return;
		}

		let dagSourceCode = '';
		let latestDagLogs = '';

		// Fetch DAG Source Code
		const sourceResult = await this.api.getSourceCode(node.DagId, node.FileToken);
		if (sourceResult.isSuccessful) {
			dagSourceCode = sourceResult.result;
		} else {
			ui.showErrorMessage('Failed to fetch DAG source code for AI analysis.');
			return;
		}

		// Fetch Latest DAG Run Logs
		const logResult = await this.api.getLastDagRunLog(node.DagId);
		if (logResult.isSuccessful) {
			latestDagLogs = logResult.result;
		} else {
			ui.showErrorMessage('Failed to fetch latest DAG run logs for AI analysis.');
			return;
		}

		await this.askAIWithContext({ code: dagSourceCode, logs: latestDagLogs, dag: node.DagId, dagRun: node.LatestDagRunId, tasks: null, taskInstances: null });
	}

	public async askAIWithContext(askAIContext: AskAIContext) {
		this.askAIContext = askAIContext;

		const appName = vscode.env.appName;
		let commandId = '';
		if (appName.includes('Antigravity')) {
			// Antigravity replaces the Chat with an Agent workflow.
			// We must use the Agent Manager command instead.
			// **REPLACE WITH THE ACTUAL ANTIGRAVITY AGENT COMMAND ID**
			commandId = 'antigravity.startAgentTask';

		} else if (appName.includes('Code - OSS') || appName.includes('Visual Studio Code')) {
			// This is standard VS Code or VSCodium. Check for the legacy Chat command.
			commandId = 'workbench.action.chat.open';

		} else {
			// Unknown environment, default to checking if the command exists at all.
			commandId = 'workbench.action.chat.open';
		}

		await vscode.commands.executeCommand(commandId, {
			query: '@airflow Analyze the current logs'
		});
	}

	async filter() {
		ui.logToOutput('DagTreeView.filter Started');
		const filterStringTemp = await vscode.window.showInputBox({ value: this.filterString, placeHolder: 'Enter your filters seperated by comma' });

		if (filterStringTemp === undefined) { return; }

		this.filterString = filterStringTemp;
		this.treeDataProvider.refresh();
		this.setFilterMessage();
		this.saveState();
	}

	async showOnlyActive() {
		ui.logToOutput('DagTreeView.showOnlyActive Started');
		this.ShowOnlyActive = !this.ShowOnlyActive;
		this.treeDataProvider.refresh();
		this.setFilterMessage();
		this.saveState();
	}

	async showOnlyFavorite() {
		ui.logToOutput('DagTreeView.showOnlyFavorite Started');
		this.ShowOnlyFavorite = !this.ShowOnlyFavorite;
		this.treeDataProvider.refresh();
		this.setFilterMessage();
		this.saveState();
	}

	async addServer() {
		ui.logToOutput('DagTreeView.addServer Started');

		const apiUrlTemp = await vscode.window.showInputBox({ value: 'http://localhost:8080/api/v2', placeHolder: 'API Full URL (Exp:http://localhost:8080/api/v1)' });
		if (!apiUrlTemp) { return; }

		const userNameTemp = await vscode.window.showInputBox({ placeHolder: 'User Name' });
		if (!userNameTemp) { return; }

		const passwordTemp = await vscode.window.showInputBox({ placeHolder: 'Password' });
		if (!passwordTemp) { return; }

		const newServer: ServerConfig = { apiUrl: apiUrlTemp, apiUserName: userNameTemp, apiPassword: passwordTemp };
		this.ServerList.push(newServer);

		let api = new AirflowApi(newServer);
		let result = await api.checkConnection();
		if (!result) {
			ui.showErrorMessage("Failed to connect to server.");
			return;
		}

		this.currentServer = newServer;
		this.api = api;

		this.saveState();
		this.refresh();
	}

	async removeServer() {
		ui.logToOutput('DagTreeView.removeServer Started');
		if (this.ServerList.length === 0) { return; }

		const items: string[] = this.ServerList.map(s => `${s.apiUrl} - ${s.apiUserName}`);

		const selected = await vscode.window.showQuickPick(items, { canPickMany: false, placeHolder: 'Select To Remove' });
		if (!selected) { return; }

		const selectedItems = selected.split(' - ');
		if (selectedItems[0]) {
			this.ServerList = this.ServerList.filter(item => !(item.apiUrl === selectedItems[0] && item.apiUserName === selectedItems[1]));
			
			// If we removed the current server, reset
			if (this.currentServer && this.currentServer.apiUrl === selectedItems[0] && this.currentServer.apiUserName === selectedItems[1]) {
				this.currentServer = undefined;
				this.api = undefined;
				this.treeDataProvider.dagList = undefined;
				this.treeDataProvider.refresh();
			}
			
			this.saveState();
			ui.showInfoMessage("Server removed.");
		}
	}

	async connectServer() {
		ui.logToOutput('DagTreeView.connectServer Started');

		if (this.ServerList.length === 0) {
			this.addServer();
			return;
		}

		const items: string[] = [];
		for (const s of this.ServerList) {
			items.push(s.apiUrl + " - " + s.apiUserName);
		}

		const selected = await vscode.window.showQuickPick(items, { canPickMany: false, placeHolder: 'Select To Connect' });
		if (!selected) { return; }

		const selectedItems = selected.split(' - ');

		if (selectedItems[0]) {
			const item = this.ServerList.find(item => item.apiUrl === selectedItems[0] && item.apiUserName === selectedItems[1]);
			if (item) {
				let api = new AirflowApi(item);
				let result = await api.checkConnection();
				if (result) {
					this.currentServer = item;
					this.api = new AirflowApi(this.currentServer);
					this.saveState();
					this.refresh();
				}
				else {
					ui.showErrorMessage("Failed to connect to server.");
				}
			}
		}
	}

	async clearServers() {
		ui.logToOutput('DagTreeView.clearServers Started');
		this.ServerList = [];
		this.currentServer = undefined;
		this.api = undefined;
		this.treeDataProvider.dagList = undefined;
		this.treeDataProvider.refresh();
		this.saveState();
		ui.showInfoMessage("Server List Cleared");
	}

	async loadDags() {
		ui.logToOutput('DagTreeView.loadDags Started');
		if (!this.api) { return; }

		this.treeDataProvider.dagList = undefined;

		const result = await this.api.getDagList();
		if (result.isSuccessful) {
			this.treeDataProvider.dagList = result.result;
			this.treeDataProvider.loadDagTreeItemsFromApiResponse();
		}
		this.treeDataProvider.refresh();
		this.setViewTitle();
	}

	async loadLatestRunStatusForAllDags() {
		ui.logToOutput('DagTreeView.loadLatestRunStatusForAllDags Started');
		if (!this.api) { return; }

		// Fetch latest run status for each visible DAG (limit to avoid too many API calls)
		const visibleDags = this.treeDataProvider.visibleDagList.slice(0, 50); // Limit to first 50 DAGs
		
		for (const dagItem of visibleDags) {
			if (!dagItem.IsPaused) {
				try {
					const runResult = await this.api.getLastDagRun(dagItem.DagId);
					if (runResult.isSuccessful && runResult.result) {
						dagItem.LatestDagRunId = runResult.result.dag_run_id;
						dagItem.LatestDagState = runResult.result.state;
						dagItem.refreshUI();
					}
				} catch (error) {
					// Silently continue if a DAG's last run can't be fetched
					ui.logToOutput(`Failed to fetch last run for ${dagItem.DagId}`, error as Error);
				}
			}
		}
		
		this.treeDataProvider.refresh();
	}

	async setViewTitle() {
		if (this.currentServer) {
			this.view.title = this.currentServer.apiUrl + " - " + this.currentServer.apiUserName;
		} else {
			this.view.title = "Airflow";
		}
	}

	async getImportErrors() {
		ui.logToOutput('DagTreeView.getImportErrors Started');
		if (!this.api) { return; }

		const result = await this.api.getImportErrors();
		if (result.isSuccessful) {
			const importErrors = result.result;
			if (importErrors.total_entries > 0) {
				ui.showOutputMessage(result.result, "Import Dag Errors! Check Output Panel");
			}
		}
	}

	saveState() {
		ui.logToOutput('DagTreeView.saveState Started');
		try {
			if (this.currentServer) {
				this.context.globalState.update('apiUrl', this.currentServer.apiUrl);
				this.context.globalState.update('apiUserName', this.currentServer.apiUserName);
				this.context.globalState.update('apiPassword', this.currentServer.apiPassword);
			} else {
				this.context.globalState.update('apiUrl', undefined);
				this.context.globalState.update('apiUserName', undefined);
				this.context.globalState.update('apiPassword', undefined);
			}

			this.context.globalState.update('filterString', this.filterString);
			this.context.globalState.update('ShowOnlyActive', this.ShowOnlyActive);
			this.context.globalState.update('ShowOnlyFavorite', this.ShowOnlyFavorite);
			this.context.globalState.update('ServerList', this.ServerList);

		} catch (error) {
			ui.logToOutput("dagTreeView.saveState Error !!!", error as Error);
		}
	}

	setFilterMessage() {
		if (this.currentServer) {
			this.view.message = this.getBoolenSign(this.ShowOnlyFavorite) + 'Fav, ' + this.getBoolenSign(this.ShowOnlyActive) + 'Active, Filter : ' + this.filterString;
		}
	}

	getBoolenSign(variable: boolean) {
		return variable ? "✓" : "𐄂";
	}

	loadState() {
		ui.logToOutput('DagTreeView.loadState Started');
		try {
			const apiUrlTemp: string = this.context.globalState.get('apiUrl') || '';
			const apiUserNameTemp: string = this.context.globalState.get('apiUserName') || '';
			const apiPasswordTemp: string = this.context.globalState.get('apiPassword') || '';

			if (apiUrlTemp && apiUserNameTemp) {
				this.currentServer = { apiUrl: apiUrlTemp, apiUserName: apiUserNameTemp, apiPassword: apiPasswordTemp };
				this.api = new AirflowApi(this.currentServer);
			}

			const filterStringTemp: string = this.context.globalState.get('filterString') || '';
			if (filterStringTemp) {
				this.filterString = filterStringTemp;
				this.setFilterMessage();
			}

			const ShowOnlyActiveTemp: boolean | undefined = this.context.globalState.get('ShowOnlyActive');
			if (ShowOnlyActiveTemp !== undefined) { this.ShowOnlyActive = ShowOnlyActiveTemp; }

			const ShowOnlyFavoriteTemp: boolean | undefined = this.context.globalState.get('ShowOnlyFavorite');
			if (ShowOnlyFavoriteTemp !== undefined) { this.ShowOnlyFavorite = ShowOnlyFavoriteTemp; }

			const ServerListTemp: ServerConfig[] = this.context.globalState.get('ServerList') || [];
			if (ServerListTemp) { this.ServerList = ServerListTemp; }
			
			// Ensure current server is in the list
			if (this.currentServer && !this.ServerList.find(e => e.apiUrl === this.currentServer?.apiUrl && e.apiUserName === this.currentServer?.apiUserName)) {
				this.ServerList.push(this.currentServer);
			}

		} catch (error) {
			ui.logToOutput("dagTreeView.loadState Error !!!", error as Error);
		}
	}

	async viewConnections() {
		ui.logToOutput('DagTreeView.viewConnections Started');
		if (this.api) {
			const { ConnectionsView } = await import('../admin/ConnectionsView');
			ConnectionsView.render(this.context.extensionUri, this.api);
		}
	}

	async viewVariables() {
		ui.logToOutput('DagTreeView.viewVariables Started');
		if (this.api) {
			const { VariablesView } = await import('../admin/VariablesView');
			VariablesView.render(this.context.extensionUri, this.api);
		}
	}

	async viewProviders() {
		ui.logToOutput('DagTreeView.viewProviders Started');
		if (this.api) {
			const { ProvidersView } = await import('../admin/ProvidersView');
			ProvidersView.render(this.context.extensionUri, this.api);
		}
	}

	async viewConfigs() {
		ui.logToOutput('DagTreeView.viewConfigs Started');
		if (this.api) {
			const { ConfigsView } = await import('../admin/ConfigsView');
			ConfigsView.render(this.context.extensionUri, this.api);
		}
	}

	async viewPlugins() {
		ui.logToOutput('DagTreeView.viewPlugins Started');
		if (this.api) {
			const { PluginsView } = await import('../admin/PluginsView');
			PluginsView.render(this.context.extensionUri, this.api);
		}
	}

	async viewDagRuns() {
		ui.logToOutput('DagTreeView.viewDagRuns Started');
		if (this.api) {
			DailyDagRunView.render(this.context.extensionUri, this.api);
		}
	}

	async viewDagRunHistory() {
		ui.logToOutput('DagTreeView.viewDagRunHistory Started');
		if (this.api) {
			DagRunView.render(this.context.extensionUri, this.api);
		}
	}

	async viewServerHealth() {
		ui.logToOutput('DagTreeView.viewServerHealth Started');
		if (this.api) {
			const { ServerHealthView } = await import('../admin/ServerHealthView');
			ServerHealthView.render(this.context.extensionUri, this.api);
		}
	}
}