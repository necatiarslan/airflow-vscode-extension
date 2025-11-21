"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require("vscode");
const dagTreeView_1 = require("./dagTreeView");
const ui = require("./ui");
// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
function activate(context) {
    ui.logToOutput('Extension activation started');
    let dagTreeView = new dagTreeView_1.DagTreeView(context);
    // register commands and keep disposables so they are cleaned up on deactivate
    const commands = [];
    commands.push(vscode.commands.registerCommand('dagTreeView.refreshServer', () => { dagTreeView.refresh(); }));
    commands.push(vscode.commands.registerCommand('dagTreeView.addServer', () => { dagTreeView.addServer(); }));
    commands.push(vscode.commands.registerCommand('dagTreeView.removeServer', () => { dagTreeView.removeServer(); }));
    commands.push(vscode.commands.registerCommand('dagTreeView.connectServer', () => { dagTreeView.connectServer(); }));
    commands.push(vscode.commands.registerCommand('dagTreeView.clearServers', () => { dagTreeView.clearServers(); }));
    commands.push(vscode.commands.registerCommand('dagTreeView.filter', () => { dagTreeView.filter(); }));
    commands.push(vscode.commands.registerCommand('dagTreeView.showOnlyActive', () => { dagTreeView.showOnlyActive(); }));
    commands.push(vscode.commands.registerCommand('dagTreeView.showOnlyFavorite', () => { dagTreeView.showOnlyFavorite(); }));
    commands.push(vscode.commands.registerCommand('dagTreeView.viewDagView', (node) => { dagTreeView.viewDagView(node); }));
    commands.push(vscode.commands.registerCommand('dagTreeView.triggerDag', (node) => { dagTreeView.triggerDag(node); }));
    commands.push(vscode.commands.registerCommand('dagTreeView.triggerDagWithConfig', (node) => { dagTreeView.triggerDagWConfig(node); }));
    commands.push(vscode.commands.registerCommand('dagTreeView.checkDagRunState', (node) => { dagTreeView.checkDagRunState(node); }));
    commands.push(vscode.commands.registerCommand('dagTreeView.checkAllDagsRunState', () => { dagTreeView.checkAllDagsRunState(); }));
    commands.push(vscode.commands.registerCommand('dagTreeView.pauseDAG', (node) => { dagTreeView.pauseDAG(node); }));
    commands.push(vscode.commands.registerCommand('dagTreeView.unPauseDAG', (node) => { dagTreeView.unPauseDAG(node); }));
    commands.push(vscode.commands.registerCommand('dagTreeView.lastDAGRunLog', (node) => { dagTreeView.lastDAGRunLog(node); }));
    commands.push(vscode.commands.registerCommand('dagTreeView.dagSourceCode', (node) => { dagTreeView.dagSourceCode(node); }));
    commands.push(vscode.commands.registerCommand('dagTreeView.addToFavDAG', (node) => { dagTreeView.addToFavDAG(node); }));
    commands.push(vscode.commands.registerCommand('dagTreeView.deleteFromFavDAG', (node) => { dagTreeView.deleteFromFavDAG(node); }));
    commands.push(vscode.commands.registerCommand('dagTreeView.showDagView', (node) => { dagTreeView.viewDagView(node); }));
    commands.push(vscode.commands.registerCommand('dagTreeView.viewConnections', () => { dagTreeView.viewConnections(); }));
    commands.push(vscode.commands.registerCommand('dagTreeView.viewVariables', () => { dagTreeView.viewVariables(); }));
    commands.push(vscode.commands.registerCommand('dagTreeView.viewProviders', () => { dagTreeView.viewProviders(); }));
    for (const c of commands) {
        context.subscriptions.push(c);
    }
    ui.logToOutput('Extension activation completed');
}
exports.activate = activate;
// this method is called when your extension is deactivated
function deactivate() {
    ui.logToOutput('Extension is now deactive!');
}
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map