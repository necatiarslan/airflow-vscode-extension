// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { DagTreeView } from './DagTreeView';
import { DagTreeItem } from './DagTreeItem';
import { AdminTreeView } from './AdminTreeView';
import * as ui from './UI';
import { AirflowClientAdapter } from './AirflowClientAdapter';
import { TriggerDagRunTool } from './tools/TriggerDagRunTool';
import { GetFailedRunsTool } from './tools/GetFailedRunsTool';
import { ListActiveDagsTool } from './tools/ListActiveDagsTool';
import { ListPausedDagsTool } from './tools/ListPausedDagsTool';
import { PauseDagTool } from './tools/PauseDagTool';
import { UnpauseDagTool } from './tools/UnpauseDagTool';
import { GetDagRunsTool } from './tools/GetDagRunsTool';
import { StopDagRunTool } from './tools/StopDagRunTool';
import { AnalyseDagLatestRunTool } from './tools/AnalyseDagLatestRunTool';
import { GetDagHistoryTool } from './tools/GetDagHistoryTool';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	ui.logToOutput('Extension activation started');

	let dagTreeView:DagTreeView = new DagTreeView(context);
	let adminTreeView:AdminTreeView = new AdminTreeView(context);

	// Register the Admin Tree View
	vscode.window.registerTreeDataProvider('adminTreeView', adminTreeView);
	ui.logToOutput('Admin Tree View registered');

	// register commands and keep disposables so they are cleaned up on deactivate
	const commands: vscode.Disposable[] = [];

	commands.push(vscode.commands.registerCommand('dagTreeView.refreshServer', () => { dagTreeView.refresh(); }));
	commands.push(vscode.commands.registerCommand('dagTreeView.addServer', () => { dagTreeView.addServer(); }));
	commands.push(vscode.commands.registerCommand('dagTreeView.removeServer', () => { dagTreeView.removeServer(); }));
	commands.push(vscode.commands.registerCommand('dagTreeView.connectServer', () => { dagTreeView.connectServer(); }));
	commands.push(vscode.commands.registerCommand('dagTreeView.clearServers', () => { dagTreeView.clearServers(); }));
	commands.push(vscode.commands.registerCommand('dagTreeView.filter', () => { dagTreeView.filter(); }));
	commands.push(vscode.commands.registerCommand('dagTreeView.showOnlyActive', () => { dagTreeView.showOnlyActive(); }));
	commands.push(vscode.commands.registerCommand('dagTreeView.showOnlyFavorite', () => { dagTreeView.showOnlyFavorite(); }));
	commands.push(vscode.commands.registerCommand('dagTreeView.viewDagView', (node: DagTreeItem) => { dagTreeView.viewDagView(node); }));
	commands.push(vscode.commands.registerCommand('dagTreeView.triggerDag', (node: DagTreeItem) => { dagTreeView.triggerDag(node); }));
	commands.push(vscode.commands.registerCommand('dagTreeView.triggerDagWithConfig', (node: DagTreeItem) => { dagTreeView.triggerDagWConfig(node); }));
	commands.push(vscode.commands.registerCommand('dagTreeView.checkDagRunState', (node: DagTreeItem) => { dagTreeView.checkDagRunState(node); }));
	commands.push(vscode.commands.registerCommand('dagTreeView.checkAllDagsRunState', () => { dagTreeView.checkAllDagsRunState(); }));
	commands.push(vscode.commands.registerCommand('dagTreeView.pauseDAG', (node: DagTreeItem) => { dagTreeView.pauseDAG(node); }));
	commands.push(vscode.commands.registerCommand('dagTreeView.unPauseDAG', (node: DagTreeItem) => { dagTreeView.unPauseDAG(node); }));
	commands.push(vscode.commands.registerCommand('dagTreeView.lastDAGRunLog', (node: DagTreeItem) => { dagTreeView.lastDAGRunLog(node); }));
	commands.push(vscode.commands.registerCommand('dagTreeView.dagSourceCode', (node: DagTreeItem) => { dagTreeView.dagSourceCode(node); }));
	commands.push(vscode.commands.registerCommand('dagTreeView.showDagInfo', (node: DagTreeItem) => { dagTreeView.showDagInfo(node); }));
	commands.push(vscode.commands.registerCommand('dagTreeView.addToFavDAG', (node: DagTreeItem) => { dagTreeView.addToFavDAG(node); }));
	commands.push(vscode.commands.registerCommand('dagTreeView.deleteFromFavDAG', (node: DagTreeItem) => { dagTreeView.deleteFromFavDAG(node); }));
	commands.push(vscode.commands.registerCommand('dagTreeView.showDagView', (node: DagTreeItem) => { dagTreeView.viewDagView(node); }));
	commands.push(vscode.commands.registerCommand('dagTreeView.viewConnections', () => { dagTreeView.viewConnections(); }));
	commands.push(vscode.commands.registerCommand('dagTreeView.viewVariables', () => { dagTreeView.viewVariables(); }));
	commands.push(vscode.commands.registerCommand('dagTreeView.viewProviders', () => { dagTreeView.viewProviders(); }));
	commands.push(vscode.commands.registerCommand('dagTreeView.viewDagRuns', () => { dagTreeView.viewDagRuns(); }));
	commands.push(vscode.commands.registerCommand('dagTreeView.AskAI', (node: DagTreeItem) => { dagTreeView.askAI(node); }));

	const participant = vscode.chat.createChatParticipant('airflow-ext.participant', dagTreeView.aIHandler.bind(dagTreeView));
	participant.iconPath = vscode.Uri.joinPath(context.extensionUri, 'media', 'airflow-extension-logo.png');
	context.subscriptions.push(participant);

	// Register Language Model Tools for AI-powered control, monitoring, and debugging
	ui.logToOutput('Registering Language Model Tools...');
	
	// Initialize the API adapter (uses DagTreeView.Current.api dynamically)
	const airflowClient = new AirflowClientAdapter();

	// Register Tool 1: trigger_dag_run (Control)
	const triggerDagRunTool = vscode.lm.registerTool(
		'trigger_dag_run',
		new TriggerDagRunTool(airflowClient)
	);
	context.subscriptions.push(triggerDagRunTool);
	ui.logToOutput('Registered tool: trigger_dag_run');

	// Register Tool 2: get_failed_runs (Monitoring)
	const getFailedRunsTool = vscode.lm.registerTool(
		'get_failed_runs',
		new GetFailedRunsTool(airflowClient)
	);
	context.subscriptions.push(getFailedRunsTool);
	ui.logToOutput('Registered tool: get_failed_runs');

	// Register Tool 4: list_active_dags (Monitoring)
	const listActiveDagsTool = vscode.lm.registerTool(
		'list_active_dags',
		new ListActiveDagsTool(airflowClient)
	);
	context.subscriptions.push(listActiveDagsTool);
	ui.logToOutput('Registered tool: list_active_dags');

	// Register Tool 5: list_paused_dags (Monitoring)
	const listPausedDagsTool = vscode.lm.registerTool(
		'list_paused_dags',
		new ListPausedDagsTool(airflowClient)
	);
	context.subscriptions.push(listPausedDagsTool);
	ui.logToOutput('Registered tool: list_paused_dags');

	// Register Tool 6: pause_dag (Control)
	const pauseDagTool = vscode.lm.registerTool(
		'pause_dag',
		new PauseDagTool(airflowClient)
	);
	context.subscriptions.push(pauseDagTool);
	ui.logToOutput('Registered tool: pause_dag');

	// Register Tool 7: unpause_dag (Control)
	const unpauseDagTool = vscode.lm.registerTool(
		'unpause_dag',
		new UnpauseDagTool(airflowClient)
	);
	context.subscriptions.push(unpauseDagTool);
	ui.logToOutput('Registered tool: unpause_dag');

	// Register Tool 8: get_dag_runs (Monitoring)
	const getDagRunsTool = vscode.lm.registerTool(
		'get_dag_runs',
		new GetDagRunsTool(airflowClient)
	);
	context.subscriptions.push(getDagRunsTool);
	ui.logToOutput('Registered tool: get_dag_runs');

	// Register Tool 9: stop_dag_run (Control)
	const stopDagRunTool = vscode.lm.registerTool(
		'stop_dag_run',
		new StopDagRunTool(airflowClient)
	);
	context.subscriptions.push(stopDagRunTool);
	ui.logToOutput('Registered tool: stop_dag_run');

	// Register Tool 10: analyse_dag_latest_run (Analysis)
	const analyseDagLatestRunTool = vscode.lm.registerTool(
		'analyse_dag_latest_run',
		new AnalyseDagLatestRunTool(airflowClient)
	);
	context.subscriptions.push(analyseDagLatestRunTool);
	ui.logToOutput('Registered tool: analyse_dag_latest_run');

	// Register Tool 11: get_dag_history (Monitoring)
	const getDagHistoryTool = vscode.lm.registerTool(
		'get_dag_history',
		new GetDagHistoryTool(airflowClient)
	);
	context.subscriptions.push(getDagHistoryTool);
	ui.logToOutput('Registered tool: get_dag_history');

	ui.logToOutput('All Language Model Tools registered successfully');

	for (const c of commands) { context.subscriptions.push(c); }

	ui.logToOutput('Extension activation completed');
}

// this method is called when your extension is deactivated
export function deactivate() {
	ui.logToOutput('Extension is now deactive!');
}
