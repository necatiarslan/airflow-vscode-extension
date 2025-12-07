// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as ui from './common/UI';
import {Session} from './common/Session';
import { DagTreeView } from './dag/DagTreeView';
import { DagTreeItem } from './dag/DagTreeItem';
import { AdminTreeView } from './admin/AdminTreeView';
import { ReportTreeView } from './report/ReportTreeView';
import { AirflowClientAdapter } from './language_tools/AirflowClientAdapter';
import { TriggerDagRunTool } from './language_tools/TriggerDagRunTool';
import { GetFailedRunsTool } from './language_tools/GetFailedRunsTool';
import { ListActiveDagsTool } from './language_tools/ListActiveDagsTool';
import { ListPausedDagsTool } from './language_tools/ListPausedDagsTool';
import { GetRunningDagsTool } from './language_tools/GetRunningDagsTool';
import { PauseDagTool } from './language_tools/PauseDagTool';
import { UnpauseDagTool } from './language_tools/UnpauseDagTool';
import { GetDagRunsTool } from './language_tools/GetDagRunsTool';
import { CancelDagRunTool } from './language_tools/CancelDagRunTool';
import { AnalyseDagLatestRunTool } from './language_tools/AnalyseDagLatestRunTool';
import { GetDagHistoryTool } from './language_tools/GetDagHistoryTool';
import { GetDagRunDetailTool } from './language_tools/GetDagRunDetailTool';
import { GoToDagViewTool } from './language_tools/GoToDagViewTool';
import { GoToDagRunHistoryTool } from './language_tools/GoToDagRunHistoryTool';
import { GoToProvidersViewTool } from './language_tools/GoToProvidersViewTool';
import { GoToConnectionsViewTool } from './language_tools/GoToConnectionsViewTool';
import { GoToVariablesViewTool } from './language_tools/GoToVariablesViewTool';
import { GoToConfigsViewTool } from './language_tools/GoToConfigsViewTool';
import { GoToPluginsViewTool } from './language_tools/GoToPluginsViewTool';
import { GoToServerHealthViewTool } from './language_tools/GoToServerHealthViewTool';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	ui.logToOutput('Extension activation started');


	Session.Current = new Session(context);

	let dagTreeView:DagTreeView = new DagTreeView();
	let adminTreeView:AdminTreeView = new AdminTreeView();
	let reportTreeView:ReportTreeView = new ReportTreeView();

	// Register the Admin Tree View
	vscode.window.registerTreeDataProvider('adminTreeView', adminTreeView);
	ui.logToOutput('Admin Tree View registered');

	// Register the Report Tree View
	vscode.window.registerTreeDataProvider('reportTreeView', reportTreeView);
	ui.logToOutput('Report Tree View registered');

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
	commands.push(vscode.commands.registerCommand('dagTreeView.cancelDagRun', (node: DagTreeItem) => { dagTreeView.cancelDagRun(node); }));
	commands.push(vscode.commands.registerCommand('dagTreeView.lastDAGRunLog', (node: DagTreeItem) => { dagTreeView.lastDAGRunLog(node); }));
	commands.push(vscode.commands.registerCommand('dagTreeView.dagSourceCode', (node: DagTreeItem) => { dagTreeView.dagSourceCode(node); }));
	commands.push(vscode.commands.registerCommand('dagTreeView.showDagInfo', (node: DagTreeItem) => { dagTreeView.showDagInfo(node); }));
	commands.push(vscode.commands.registerCommand('dagTreeView.addToFavDAG', (node: DagTreeItem) => { dagTreeView.addToFavDAG(node); }));
	commands.push(vscode.commands.registerCommand('dagTreeView.deleteFromFavDAG', (node: DagTreeItem) => { dagTreeView.deleteFromFavDAG(node); }));
	commands.push(vscode.commands.registerCommand('dagTreeView.showDagView', (node: DagTreeItem) => { dagTreeView.viewDagView(node); }));
	commands.push(vscode.commands.registerCommand('dagTreeView.viewConnections', () => { dagTreeView.viewConnections(); }));
	commands.push(vscode.commands.registerCommand('dagTreeView.viewVariables', () => { dagTreeView.viewVariables(); }));
	commands.push(vscode.commands.registerCommand('dagTreeView.viewProviders', () => { dagTreeView.viewProviders(); }));
	commands.push(vscode.commands.registerCommand('dagTreeView.viewConfigs', () => { dagTreeView.viewConfigs(); }));
	commands.push(vscode.commands.registerCommand('dagTreeView.viewPlugins', () => { dagTreeView.viewPlugins(); }));
	commands.push(vscode.commands.registerCommand('dagTreeView.viewServerHealth', () => { dagTreeView.viewServerHealth(); }));
	commands.push(vscode.commands.registerCommand('dagTreeView.viewDagRuns', () => { dagTreeView.viewDagRuns(); }));
	commands.push(vscode.commands.registerCommand('dagTreeView.viewDagRunHistory', () => { dagTreeView.viewDagRunHistory(); }));
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

	// Register Tool 6: get_running_dags (Monitoring)
	const getRunningDagsTool = vscode.lm.registerTool(
		'get_running_dags',
		new GetRunningDagsTool(airflowClient)
	);
	context.subscriptions.push(getRunningDagsTool);
	ui.logToOutput('Registered tool: get_running_dags');

	// Register Tool 7: pause_dag (Control)
	const pauseDagTool = vscode.lm.registerTool(
		'pause_dag',
		new PauseDagTool(airflowClient)
	);
	context.subscriptions.push(pauseDagTool);
	ui.logToOutput('Registered tool: pause_dag');

	// Register Tool 8: unpause_dag (Control)
	const unpauseDagTool = vscode.lm.registerTool(
		'unpause_dag',
		new UnpauseDagTool(airflowClient)
	);
	context.subscriptions.push(unpauseDagTool);
	ui.logToOutput('Registered tool: unpause_dag');

	// Register Tool 9: get_dag_runs (Monitoring)
	const getDagRunsTool = vscode.lm.registerTool(
		'get_dag_runs',
		new GetDagRunsTool(airflowClient)
	);
	context.subscriptions.push(getDagRunsTool);
	ui.logToOutput('Registered tool: get_dag_runs');

	// Register Tool 10: cancel_dag_run (Control)
	const cancelDagRunTool = vscode.lm.registerTool(
		'cancel_dag_run',
		new CancelDagRunTool(airflowClient)
	);
	context.subscriptions.push(cancelDagRunTool);
	ui.logToOutput('Registered tool: cancel_dag_run');

	// Register Tool 11: analyse_dag_latest_run (Analysis)
	const analyseDagLatestRunTool = vscode.lm.registerTool(
		'analyse_dag_latest_run',
		new AnalyseDagLatestRunTool(airflowClient)
	);
	context.subscriptions.push(analyseDagLatestRunTool);
	ui.logToOutput('Registered tool: analyse_dag_latest_run');

	// Register Tool 12: get_dag_history (Monitoring)
	const getDagHistoryTool = vscode.lm.registerTool(
		'get_dag_history',
		new GetDagHistoryTool(airflowClient)
	);
	context.subscriptions.push(getDagHistoryTool);
	ui.logToOutput('Registered tool: get_dag_history');

	// Register Tool 13: get_dag_run_detail (Analysis)
	const getDagRunDetailTool = vscode.lm.registerTool(
		'get_dag_run_detail',
		new GetDagRunDetailTool(airflowClient)
	);
	context.subscriptions.push(getDagRunDetailTool);
	ui.logToOutput('Registered tool: get_dag_run_detail');

	// Register Tool 14: go_to_dag_view (Navigation)
	const goToDagViewTool = vscode.lm.registerTool(
		'go_to_dag_view',
		new GoToDagViewTool()
	);
	context.subscriptions.push(goToDagViewTool);
	ui.logToOutput('Registered tool: go_to_dag_view');

	// Register Tool 15: go_to_dag_run_history (Navigation)
	const goToDagRunHistoryTool = vscode.lm.registerTool(
		'go_to_dag_run_history',
		new GoToDagRunHistoryTool()
	);
	context.subscriptions.push(goToDagRunHistoryTool);
	ui.logToOutput('Registered tool: go_to_dag_run_history');

	// Register Tool 16: go_to_providers_view (Navigation)
	const goToProvidersViewTool = vscode.lm.registerTool(
		'go_to_providers_view',
		new GoToProvidersViewTool()
	);
	context.subscriptions.push(goToProvidersViewTool);
	ui.logToOutput('Registered tool: go_to_providers_view');

	// Register Tool 17: go_to_connections_view (Navigation)
	const goToConnectionsViewTool = vscode.lm.registerTool(
		'go_to_connections_view',
		new GoToConnectionsViewTool()
	);
	context.subscriptions.push(goToConnectionsViewTool);
	ui.logToOutput('Registered tool: go_to_connections_view');

	// Register Tool 18: go_to_variables_view (Navigation)
	const goToVariablesViewTool = vscode.lm.registerTool(
		'go_to_variables_view',
		new GoToVariablesViewTool()
	);
	context.subscriptions.push(goToVariablesViewTool);
	ui.logToOutput('Registered tool: go_to_variables_view');

	// Register Tool 19: go_to_configs_view (Navigation)
	const goToConfigsViewTool = vscode.lm.registerTool(
		'go_to_configs_view',
		new GoToConfigsViewTool()
	);
	context.subscriptions.push(goToConfigsViewTool);
	ui.logToOutput('Registered tool: go_to_configs_view');

	// Register Tool 20: go_to_plugins_view (Navigation)
	const goToPluginsViewTool = vscode.lm.registerTool(
		'go_to_plugins_view',
		new GoToPluginsViewTool()
	);
	context.subscriptions.push(goToPluginsViewTool);
	ui.logToOutput('Registered tool: go_to_plugins_view');

	// Register Tool 21: go_to_server_health_view (Navigation)
	const goToServerHealthViewTool = vscode.lm.registerTool(
		'go_to_server_health_view',
		new GoToServerHealthViewTool()
	);
	context.subscriptions.push(goToServerHealthViewTool);
	ui.logToOutput('Registered tool: go_to_server_health_view');

	ui.logToOutput('All Language Model Tools registered successfully');

	for (const c of commands) { context.subscriptions.push(c); }

	ui.logToOutput('Extension activation completed');
}

// this method is called when your extension is deactivated
export function deactivate() {
	ui.logToOutput('Extension is now deactive!');
}
