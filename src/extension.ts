// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { AirflowViewManager } from './airflowView';

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

	vscode.commands.registerCommand('airflowView.triggerDag', (node: vscode.TreeItem) => {
		airflowView.triggerDag(node);
	});


}

// this method is called when your extension is deactivated
export function deactivate() {
	console.log('Extension "airflow-vscode-extension" is now deactive!');
}
