// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as ui from './common/UI';
import { Session } from './common/Session';
import { DagTreeView } from './dag/DagTreeView';
import { DagTreeItem } from './dag/DagTreeItem';
import { AdminTreeView } from './admin/AdminTreeView';
import { ReportTreeView } from './report/ReportTreeView';
import { AIHandler } from './language_tools/AIHandler';
import { Telemetry } from './common/Telemetry';
import { version } from 'os';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	ui.logToOutput('Extension activation started');

	new Telemetry(context);
	const properties = {
		extensionVersion: context.extension.packageJSON.version, 
		vscodeVersion: vscode.version, 
		osVersion: version(), 
		platform: process.platform, 
		appName: vscode.env.appName, 
		appHost: vscode.env.appHost,
		language: vscode.env.language
	};
	Telemetry.Current.send('extension.activate.called', properties);

	new Session(context);
	new AIHandler();

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
	commands.push(vscode.commands.registerCommand('dagTreeView.AskAI', (node: DagTreeItem) => { AIHandler.Current.askAI(node.DagId, node.FileToken); }));
	
	// Support and feedback commands
	commands.push(vscode.commands.registerCommand('airflow-ext.donate', () => { vscode.env.openExternal(vscode.Uri.parse('https://github.com/sponsors/necatiarslan')); }));
	commands.push(vscode.commands.registerCommand('airflow-ext.newFeaturesSurvey', () => { vscode.env.openExternal(vscode.Uri.parse('https://bit.ly/airflow-extension-survey')); }));
	commands.push(vscode.commands.registerCommand('airflow-ext.requestFeature', () => { vscode.env.openExternal(vscode.Uri.parse('https://github.com/necatiarslan/airflow-vscode-extension/issues/new?labels=feature-request&template=feature_request.md')); }));
	commands.push(vscode.commands.registerCommand('airflow-ext.reportBug', () => { vscode.env.openExternal(vscode.Uri.parse('https://github.com/necatiarslan/airflow-vscode-extension/issues/new?labels=bug&template=bug_report.md')); }));
	
	for (const c of commands) { context.subscriptions.push(c); }


	AIHandler.Current.registerChatParticipant();
	AIHandler.Current.registerAiTools();

	Telemetry.Current?.send('extension.activated');
	ui.logToOutput('Extension activation completed');
}

// this method is called when your extension is deactivated
export function deactivate() {
	ui.logToOutput('Extension is now deactive!');
}
