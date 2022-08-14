// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { DagTreeView } from './dagTreeView';
import { DagTreeItem } from './dagTreeItem';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	console.log('Extension "airflow-vscode-extension" is now active!');

	let dagTreeView:DagTreeView = new DagTreeView(context);

	vscode.commands.registerCommand('dagTreeView.refreshServer', () => {
		dagTreeView.refresh();
	});

	vscode.commands.registerCommand('dagTreeView.addServer', () => {
		dagTreeView.addServer();
	});

	vscode.commands.registerCommand('dagTreeView.filter', () => {
		dagTreeView.filter();
	});

	vscode.commands.registerCommand('dagTreeView.viewDagView', (node: DagTreeItem) => {
		dagTreeView.viewDagView(node);
	});

	vscode.commands.registerCommand('dagTreeView.triggerDag', (node: DagTreeItem) => {
		dagTreeView.triggerDag(node);
	});

	vscode.commands.registerCommand('dagTreeView.triggerDagWithConfig', (node: DagTreeItem) => {
		dagTreeView.triggerDagWConfig(node);
	});

	vscode.commands.registerCommand('dagTreeView.checkDagRunState', (node: DagTreeItem) => {
		dagTreeView.checkDagRunState(node);
	});

	vscode.commands.registerCommand('dagTreeView.checkAllDagsRunState', (node: DagTreeItem) => {
		dagTreeView.checkAllDagsRunState();
	});

	vscode.commands.registerCommand('dagTreeView.pauseDAG', (node: DagTreeItem) => {
		dagTreeView.pauseDAG(node);
	});

	vscode.commands.registerCommand('dagTreeView.unPauseDAG', (node: DagTreeItem) => {
		dagTreeView.unPauseDAG(node);
	});

	vscode.commands.registerCommand('dagTreeView.lastDAGRunLog', (node: DagTreeItem) => {
		dagTreeView.lastDAGRunLog(node);
	});

	vscode.commands.registerCommand('dagTreeView.dagSourceCode', (node: DagTreeItem) => {
		dagTreeView.dagSourceCode(node);
	});

	vscode.commands.registerCommand('dagTreeView.addToFavDAG', (node: DagTreeItem) => {
		dagTreeView.addToFavDAG(node);
	});

	vscode.commands.registerCommand('dagTreeView.deleteFromFavDAG', (node: DagTreeItem) => {
		dagTreeView.deleteFromFavDAG(node);
	});

}

// this method is called when your extension is deactivated
export function deactivate() {
	console.log('Extension "airflow-vscode-extension" is now deactive!');
}
