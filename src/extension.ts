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

	// 1. Register the Chat Participant
	const handler: vscode.ChatRequestHandler = async (request, context, stream, token) => {
		
		const activeDag = DagTreeView.Current?.activeDagForAI;
		if (!activeDag) {
			stream.markdown("No active DAG context found. Please use the 'Ask AI' button on a DAG item first.");
			return;
		}

		const dagLogs = activeDag.logs;
		const dagCode = activeDag.code;

		// B. Construct the Prompt
		const messages = [
			vscode.LanguageModelChatMessage.User(`You are an expert in Apache Airflow. Here is the code for a DAG and its recent execution logs. Analyze them and explain any errors.`),
			vscode.LanguageModelChatMessage.User(`DAG Code:\n\`\`\`python\n${dagCode}\n\`\`\``),
			vscode.LanguageModelChatMessage.User(`Execution Logs:\n\`\`\`text\n${dagLogs}\n\`\`\``),
			vscode.LanguageModelChatMessage.User(request.prompt || "Please analyze the error in these logs.")
		];

		// C. Send to VS Code's AI (Copilot)
		try {
			const [model] = await vscode.lm.selectChatModels({ family: 'gpt-4' });
			if (model) {
				const chatResponse = await model.sendRequest(messages, {}, token);
				for await (const fragment of chatResponse.text) {
					stream.markdown(fragment);
				}
			} else {
				stream.markdown("No suitable AI model found.");
			}
		} catch (err) {
			if (err instanceof Error) {
				stream.markdown(`I'm sorry, I couldn't connect to the AI model: ${err.message}`);
			} else {
				stream.markdown("I'm sorry, I couldn't connect to the AI model.");
			}
		}
	};

	const participant = vscode.chat.createChatParticipant('airflow-ext.participant', handler);
	participant.iconPath = vscode.Uri.joinPath(context.extensionUri, 'media', 'airflow-extension-logo.png');
	context.subscriptions.push(participant);

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
	commands.push(vscode.commands.registerCommand('dagTreeView.AskAI', (node: DagTreeItem) => { dagTreeView.askAI(node); }));

	for (const c of commands) { context.subscriptions.push(c); }

	ui.logToOutput('Extension activation completed');
}

// this method is called when your extension is deactivated
export function deactivate() {
	ui.logToOutput('Extension is now deactive!');
}
