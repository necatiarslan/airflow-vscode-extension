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
    vscode.commands.registerCommand('dagTreeView.refreshServer', () => {
        dagTreeView.refresh();
    });
    vscode.commands.registerCommand('dagTreeView.addServer', () => {
        dagTreeView.addServer();
    });
    vscode.commands.registerCommand('dagTreeView.filter', () => {
        dagTreeView.filter();
    });
    vscode.commands.registerCommand('dagTreeView.viewDagView', (node) => {
        dagTreeView.viewDagView(node);
    });
    vscode.commands.registerCommand('dagTreeView.triggerDag', (node) => {
        dagTreeView.triggerDag(node);
    });
    vscode.commands.registerCommand('dagTreeView.triggerDagWithConfig', (node) => {
        dagTreeView.triggerDagWConfig(node);
    });
    vscode.commands.registerCommand('dagTreeView.checkDagRunState', (node) => {
        dagTreeView.checkDagRunState(node);
    });
    vscode.commands.registerCommand('dagTreeView.checkAllDagsRunState', (node) => {
        dagTreeView.checkAllDagsRunState();
    });
    vscode.commands.registerCommand('dagTreeView.pauseDAG', (node) => {
        dagTreeView.pauseDAG(node);
    });
    vscode.commands.registerCommand('dagTreeView.unPauseDAG', (node) => {
        dagTreeView.unPauseDAG(node);
    });
    vscode.commands.registerCommand('dagTreeView.lastDAGRunLog', (node) => {
        dagTreeView.lastDAGRunLog(node);
    });
    vscode.commands.registerCommand('dagTreeView.dagSourceCode', (node) => {
        dagTreeView.dagSourceCode(node);
    });
    vscode.commands.registerCommand('dagTreeView.addToFavDAG', (node) => {
        dagTreeView.addToFavDAG(node);
    });
    vscode.commands.registerCommand('dagTreeView.deleteFromFavDAG', (node) => {
        dagTreeView.deleteFromFavDAG(node);
    });
    ui.logToOutput('Extension activation completed');
}
exports.activate = activate;
// this method is called when your extension is deactivated
function deactivate() {
    ui.logToOutput('Extension is now deactive!');
}
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map