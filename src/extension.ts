// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { DagTreeView } from './dagTreeView';
import { DagTreeItem } from './dagTreeItem';
import * as ui from './ui';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	ui.logToOutput('Extension activation started');

	let dagTreeView:DagTreeView = new DagTreeView(context);

	vscode.commands.registerCommand('dagTreeView.refreshServer', () => {
		dagTreeView.refresh();
	});

	vscode.commands.registerCommand('dagTreeView.addServer', () => {
		dagTreeView.addServer();
	});

	vscode.commands.registerCommand('dagTreeView.removeServer', () => {
		dagTreeView.removeServer();
	});

	vscode.commands.registerCommand('dagTreeView.connectServer', () => {
		dagTreeView.connectServer();
	});

	vscode.commands.registerCommand('dagTreeView.filter', () => {
		dagTreeView.filter();
	});

	vscode.commands.registerCommand('dagTreeView.showOnlyActive', () => {
		dagTreeView.showOnlyActive();
	});

	vscode.commands.registerCommand('dagTreeView.showOnlyFavorite', () => {
		dagTreeView.showOnlyFavorite();
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

	vscode.commands.registerCommand('dagTreeView.showDagView', (node: DagTreeItem) => {
		dagTreeView.viewDagView(node);
	});

	ui.logToOutput('Extension activation completed');
}

// this method is called when your extension is deactivated
export function deactivate() {
	ui.logToOutput('Extension is now deactive!');
}
