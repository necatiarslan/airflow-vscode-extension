// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { AirflowViewManager, DagTreeItem } from './airflowView';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	console.log('Extension "airflow-vscode-extension" is now active!');

	let airflowView:AirflowViewManager = new AirflowViewManager(context);

	vscode.commands.registerCommand('airflowView.refreshServer', () => {
		airflowView.refresh();
	});

	vscode.commands.registerCommand('airflowView.addServer', () => {
		airflowView.addServer();
	});

	vscode.commands.registerCommand('airflowView.filter', () => {
		airflowView.filter();
	});

	vscode.commands.registerCommand('airflowView.viewDagView', () => {
		airflowView.viewDagView();
	});

	vscode.commands.registerCommand('airflowView.triggerDag', (node: DagTreeItem) => {
		airflowView.triggerDag(node);
	});

	vscode.commands.registerCommand('airflowView.triggerDagWithConfig', (node: DagTreeItem) => {
		airflowView.triggerDagWConfig(node);
	});

	vscode.commands.registerCommand('airflowView.checkDagRunState', (node: DagTreeItem) => {
		airflowView.checkDagRunState(node);
	});

	vscode.commands.registerCommand('airflowView.checkAllDagsRunState', (node: DagTreeItem) => {
		airflowView.checkAllDagsRunState();
	});

	vscode.commands.registerCommand('airflowView.pauseDAG', (node: DagTreeItem) => {
		airflowView.pauseDAG(node);
	});

	vscode.commands.registerCommand('airflowView.unPauseDAG', (node: DagTreeItem) => {
		airflowView.unPauseDAG(node);
	});

	vscode.commands.registerCommand('airflowView.lastDAGRunLog', (node: DagTreeItem) => {
		airflowView.lastDAGRunLog(node);
	});

	vscode.commands.registerCommand('airflowView.dagSourceCode', (node: DagTreeItem) => {
		airflowView.dagSourceCode(node);
	});

}

// this method is called when your extension is deactivated
export function deactivate() {
	console.log('Extension "airflow-vscode-extension" is now deactive!');
}
