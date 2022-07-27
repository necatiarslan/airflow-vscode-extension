// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { AirflowView } from './airflowView';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	console.log('Extension "airflow-vscode-extension" is now active!');

	vscode.commands.registerCommand('airflowView.refreshServer', () => {
		vscode.window.showInformationMessage('airflowView.refreshServer clicked!');
	});

	vscode.commands.registerCommand('airflowView.addServer', () => {
		vscode.window.showInformationMessage('airflowView.addServer clicked!');
	});

	vscode.commands.registerCommand('airflowView.viewDagView', () => {
		vscode.window.showInformationMessage('airflowView.viewDagView clicked!');
	});

	new AirflowView(context);
}

// this method is called when your extension is deactivated
export function deactivate() {
	console.log('Extension "airflow-vscode-extension" is now deactive!');
}
