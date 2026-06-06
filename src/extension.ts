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
import * as skills from './common/Skills';
import { McpManager } from './mcp/McpManager';
import { McpManageView } from './mcp/McpManageView';
import { McpTreeView } from './mcp/McpTreeView';
import { WorkbenchTreeView } from './workbench/WorkbenchTreeView';
import { WorkbenchNodeBase } from './workbench/WorkbenchNodeBase';


// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	ui.logToOutput('Extension activation started');

	new Session(context);
	new AIHandler();

	const mcpManager = new McpManager(context);
	context.subscriptions.push(mcpManager);

	// Register MCP server definition provider for external MCP clients
	const serverPath = vscode.Uri.joinPath(context.extensionUri, 'out', 'mcp', 'server.js').fsPath;
	const mcpState = mcpManager.getSettingsSnapshot();
	if (typeof (vscode.lm as any)?.registerMcpServerDefinitionProvider === 'function') {
		context.subscriptions.push(
			(vscode.lm as any).registerMcpServerDefinitionProvider('airflow-ext.mcpProvider', {
				provideMcpServerDefinitions: () => [
					new (vscode as any).McpStdioServerDefinition({
						label: 'Airflow Tools',
						command: 'node',
						args: [serverPath],
						env: {
							AIRFLOW_MCP_PORT: String(mcpState.port || 37115),
							AIRFLOW_MCP_HOST: mcpState.host || '127.0.0.1'
						}
					})
				]
			})
		);
		ui.logToOutput('Registered MCP server definition provider');
	}

	let dagTreeView:DagTreeView = new DagTreeView();
	let adminTreeView:AdminTreeView = new AdminTreeView();
	let reportTreeView:ReportTreeView = new ReportTreeView();
	let mcpTreeView:McpTreeView = new McpTreeView();
	let workbenchTreeView: WorkbenchTreeView = new WorkbenchTreeView(dagTreeView);

	// Register the Admin Tree View
	vscode.window.registerTreeDataProvider('airflow-ext.adminTreeView', adminTreeView);
	ui.logToOutput('Admin Tree View registered');

	// Register the Report Tree View
	vscode.window.registerTreeDataProvider('airflow-ext.reportTreeView', reportTreeView);
	ui.logToOutput('Report Tree View registered');

	// Register the MCP Tree View
	vscode.window.registerTreeDataProvider('airflow-ext.mcpTreeView', mcpTreeView);
	ui.logToOutput('MCP Tree View registered');

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
	commands.push(vscode.commands.registerCommand('dagTreeView.clearDagRun', (node: DagTreeItem) => { dagTreeView.clearDagRun(node); }));
	commands.push(vscode.commands.registerCommand('dagTreeView.lastDAGRunLog', (node: DagTreeItem) => { dagTreeView.lastDAGRunLog(node); }));
	commands.push(vscode.commands.registerCommand('dagTreeView.dagSourceCode', (node: DagTreeItem) => { dagTreeView.dagSourceCode(node); }));
	commands.push(vscode.commands.registerCommand('dagTreeView.showDagInfo', (node: DagTreeItem) => { dagTreeView.showDagInfo(node); }));
	commands.push(vscode.commands.registerCommand('dagTreeView.addToFavDAG', (node: DagTreeItem) => { dagTreeView.addToFavDAG(node); }));
	commands.push(vscode.commands.registerCommand('dagTreeView.addToWorkbench', (node?: DagTreeItem) => { void dagTreeView.addToWorkbench(node); }));
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
	commands.push(vscode.commands.registerCommand('airflow-ext.installAirflowSkills', () => { skills.InstallSkills(); }));
	commands.push(vscode.commands.registerCommand('airflow-ext.donate', () => { vscode.env.openExternal(vscode.Uri.parse('https://github.com/sponsors/necatiarslan')); }));
	commands.push(vscode.commands.registerCommand('airflow-ext.newFeaturesSurvey', () => { vscode.env.openExternal(vscode.Uri.parse('https://forms.gle/r9tbBmHR7zFhoAnw8')); }));
	commands.push(vscode.commands.registerCommand('airflow-ext.requestFeature', () => { vscode.env.openExternal(vscode.Uri.parse('https://github.com/necatiarslan/airflow-vscode-extension/issues/new?labels=feature-request&template=feature_request.md')); }));
	commands.push(vscode.commands.registerCommand('airflow-ext.reportBug', () => { vscode.env.openExternal(vscode.Uri.parse('https://github.com/necatiarslan/airflow-vscode-extension/issues/new?labels=bug&template=bug_report.md')); }));

	commands.push(vscode.commands.registerCommand('airflow-ext.StartMcpServer', async () => { await mcpManager.startSession(); }));
	commands.push(vscode.commands.registerCommand('airflow-ext.StopMcpServers', () => { mcpManager.stopAll(); ui.showInfoMessage('All MCP sessions stopped.'); }));
	commands.push(vscode.commands.registerCommand('airflow-ext.OpenMcpManageView', () => { McpManageView.Render(context.extensionUri, mcpManager); }));
	commands.push(vscode.commands.registerCommand('airflow-ext.McpStatus', async () => {
		const status = await mcpManager.checkStatus();
		const msg = `MCP Bridge: ${status.running ? 'Running' : 'Stopped'} | Reachable: ${status.reachable ? 'Yes' : 'No'} | Sessions: ${status.activeSessions}/${status.sessionCap} | ${status.host}:${status.port}${status.message ? ' | ' + status.message : ''}`;
		ui.showInfoMessage(msg);
	}));

	commands.push(vscode.commands.registerCommand('workbenchTreeView.refresh', () => { workbenchTreeView.refresh(); }));
	commands.push(vscode.commands.registerCommand('workbenchTreeView.connectServer', () => { void workbenchTreeView.connectServer(); }));
	commands.push(vscode.commands.registerCommand('workbenchTreeView.filter', () => { void workbenchTreeView.filter(); }));
	commands.push(vscode.commands.registerCommand('workbenchTreeView.showOnlyActive', () => { workbenchTreeView.showOnlyActive(); }));
	commands.push(vscode.commands.registerCommand('workbenchTreeView.showOnlyFavorite', () => { workbenchTreeView.showOnlyFavorite(); }));
	commands.push(vscode.commands.registerCommand('workbenchTreeView.addAirflowDag', (dagId: string) => { void workbenchTreeView.addAirflowDag(dagId); }));
	commands.push(vscode.commands.registerCommand('workbenchTreeView.addRootNode', () => { void workbenchTreeView.addRootNode(); }));
	commands.push(vscode.commands.registerCommand('workbenchTreeView.addChildNode', (node: WorkbenchNodeBase) => { void workbenchTreeView.addChildNode(node); }));
	commands.push(vscode.commands.registerCommand('workbenchTreeView.renameNode', (node: WorkbenchNodeBase) => { void workbenchTreeView.renameNode(node); }));
	commands.push(vscode.commands.registerCommand('workbenchTreeView.deleteNode', (node: WorkbenchNodeBase) => { void workbenchTreeView.deleteNode(node); }));
	commands.push(vscode.commands.registerCommand('workbenchTreeView.moveUp', (node: WorkbenchNodeBase) => { workbenchTreeView.moveUp(node); }));
	commands.push(vscode.commands.registerCommand('workbenchTreeView.moveDown', (node: WorkbenchNodeBase) => { workbenchTreeView.moveDown(node); }));
	commands.push(vscode.commands.registerCommand('workbenchTreeView.moveToFolder', (node: WorkbenchNodeBase) => { void workbenchTreeView.moveToFolder(node); }));
	commands.push(vscode.commands.registerCommand('workbenchTreeView.openNode', (node: WorkbenchNodeBase) => { void workbenchTreeView.openNode(node); }));
	commands.push(vscode.commands.registerCommand('workbenchTreeView.editNote', (node: WorkbenchNodeBase) => { void workbenchTreeView.editNote(node); }));
	commands.push(vscode.commands.registerCommand('workbenchTreeView.showOnlyInThisWorkspace', (node: WorkbenchNodeBase) => { workbenchTreeView.showOnlyInThisWorkspace(node); }));
	commands.push(vscode.commands.registerCommand('workbenchTreeView.showInAnyWorkspace', (node: WorkbenchNodeBase) => { workbenchTreeView.showInAnyWorkspace(node); }));
	commands.push(vscode.commands.registerCommand('workbenchTreeView.setColor', (node: WorkbenchNodeBase) => { void workbenchTreeView.setColor(node); }));
	commands.push(vscode.commands.registerCommand('workbenchTreeView.setTooltip', (node: WorkbenchNodeBase) => { void workbenchTreeView.setTooltip(node); }));
	commands.push(vscode.commands.registerCommand('workbenchTreeView.addFav', (node: WorkbenchNodeBase) => { workbenchTreeView.addFav(node); }));
	commands.push(vscode.commands.registerCommand('workbenchTreeView.removeFav', (node: WorkbenchNodeBase) => { workbenchTreeView.removeFav(node); }));
	commands.push(vscode.commands.registerCommand('workbenchTreeView.hideNode', (node: WorkbenchNodeBase) => { workbenchTreeView.hideNode(node); }));
	commands.push(vscode.commands.registerCommand('workbenchTreeView.unHideNode', (node: WorkbenchNodeBase) => { workbenchTreeView.unHideNode(node); }));
	commands.push(vscode.commands.registerCommand('workbenchTreeView.triggerDag', (node: WorkbenchNodeBase) => { void workbenchTreeView.triggerDag(node); }));
	commands.push(vscode.commands.registerCommand('workbenchTreeView.lastDAGRunLog', (node: WorkbenchNodeBase) => { void workbenchTreeView.lastDAGRunLog(node); }));
	commands.push(vscode.commands.registerCommand('workbenchTreeView.askAI', (node: WorkbenchNodeBase) => { void workbenchTreeView.askAI(node); }));
	commands.push(vscode.commands.registerCommand('workbenchTreeView.showDagInfo', (node: WorkbenchNodeBase) => { void workbenchTreeView.showDagInfo(node); }));

	for (const c of commands) { context.subscriptions.push(c); }


	AIHandler.Current.registerChatParticipant();
	AIHandler.Current.registerAiTools();

	ui.logToOutput('Extension activation completed');
}

// this method is called when your extension is deactivated
export function deactivate() {
	ui.logToOutput('Extension is now deactive!');
}
