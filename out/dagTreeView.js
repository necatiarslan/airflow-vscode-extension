"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DagTreeView = void 0;
/* eslint-disable @typescript-eslint/naming-convention */
const vscode = require("vscode");
const dagView_1 = require("./dagView");
const dagTreeDataProvider_1 = require("./dagTreeDataProvider");
const ui = require("./ui");
const api_1 = require("./api");
const methodResult_1 = require("./methodResult");
class DagTreeView {
    constructor(context) {
        this.filterString = '';
        this.ShowOnlyActive = true;
        this.ShowOnlyFavorite = false;
        this.ServerList = [];
        ui.logToOutput('DagTreeView.constructor Started');
        this.context = context;
        this.loadState();
        this.treeDataProvider = new dagTreeDataProvider_1.DagTreeDataProvider();
        this.view = vscode.window.createTreeView('dagTreeView', { treeDataProvider: this.treeDataProvider, showCollapseAll: true });
        this.refresh();
        context.subscriptions.push(this.view);
        // ensure intervals are cleared when extension is deactivated
        context.subscriptions.push({ dispose: () => this.dispose() });
        DagTreeView.Current = this;
        this.setFilterMessage();
    }
    dispose() {
        ui.logToOutput('DagTreeView.dispose Started');
        if (this.dagStatusInterval) {
            clearInterval(this.dagStatusInterval);
        }
    }
    async refresh() {
        ui.logToOutput('DagTreeView.refresh Started');
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Window,
            title: "Airflow: Loading...",
        }, async (progress, token) => {
            progress.report({ increment: 0 });
            await this.loadDags();
        });
        await this.getImportErrors();
    }
    resetView() {
        ui.logToOutput('DagTreeView.resetView Started');
        api_1.Api.apiUrl = '';
        api_1.Api.apiUserName = '';
        api_1.Api.apiPassword = '';
        this.filterString = '';
        this.dagList = undefined;
        this.treeDataProvider.dagList = this.dagList;
        this.treeDataProvider.refresh();
        this.setViewTitle();
        this.saveState();
        this.refresh();
    }
    viewDagView(node) {
        ui.logToOutput('DagTreeView.viewDagView Started');
        dagView_1.DagView.render(this.context.extensionUri, node.DagId);
    }
    async addToFavDAG(node) {
        ui.logToOutput('DagTreeView.addToFavDAG Started');
        node.IsFav = true;
        this.treeDataProvider.refresh();
    }
    async deleteFromFavDAG(node) {
        ui.logToOutput('DagTreeView.deleteFromFavDAG Started');
        node.IsFav = false;
        this.treeDataProvider.refresh();
    }
    async triggerDag(node) {
        ui.logToOutput('DagTreeView.triggerDag Started');
        if (!api_1.Api.isApiParamsSet()) {
            return;
        }
        if (node.IsPaused) {
            ui.showWarningMessage('Dag is PAUSED !!!');
            return;
        }
        if (node.isDagRunning()) {
            ui.showWarningMessage('Dag is ALREADY RUNNING !!!');
            return;
        }
        let result = await api_1.Api.triggerDag(node.DagId);
        if (result.isSuccessful) {
            var responseTrigger = result.result;
            node.LatestDagRunId = responseTrigger['dag_run_id'];
            node.LatestDagState = responseTrigger['state'];
            node.refreshUI();
            this.treeDataProvider.refresh();
            if (!this.dagStatusInterval) {
                this.dagStatusInterval = setInterval(() => {
                    void this.refreshRunningDagState(this).catch((err) => ui.logToOutput('refreshRunningDagState Error', err));
                }, 10 * 1000);
            }
        }
    }
    async refreshRunningDagState(dagTreeView) {
        ui.logToOutput('DagTreeView.refreshRunningDagState Started');
        if (!api_1.Api.isApiParamsSet()) {
            return;
        }
        let noDagIsRunning = true;
        for (var node of dagTreeView.treeDataProvider.visibleDagList) {
            //"queued" "running" "success" "failed"
            if (node.isDagRunning()) {
                noDagIsRunning = false;
                let result = await api_1.Api.getDagRun(node.DagId, node.LatestDagRunId);
                if (result.isSuccessful) {
                    node.LatestDagState = result.result['state'];
                    node.refreshUI();
                }
                else {
                    node.LatestDagRunId = '';
                    node.LatestDagState = '';
                }
            }
            dagTreeView.treeDataProvider.refresh();
        }
        if (noDagIsRunning && dagTreeView.dagStatusInterval) {
            clearInterval(dagTreeView.dagStatusInterval);
            ui.showInfoMessage('All Dag Run(s) Completed');
            ui.logToOutput('All Dag Run(s) Completed');
        }
    }
    async triggerDagWConfig(node) {
        ui.logToOutput('DagTreeView.triggerDagWConfig Started');
        if (!api_1.Api.isApiParamsSet()) {
            return;
        }
        let triggerDagConfig = await vscode.window.showInputBox({ placeHolder: 'Enter Configuration JSON (Optional, must be a dict object) or Press Enter' });
        if (!triggerDagConfig) {
            triggerDagConfig = "{}";
        }
        if (triggerDagConfig !== undefined) {
            let result = await api_1.Api.triggerDag(node.DagId, triggerDagConfig);
            if (result.isSuccessful) {
                var responseTrigger = result.result;
                node.LatestDagRunId = responseTrigger['dag_run_id'];
                node.LatestDagState = responseTrigger['state'];
                node.refreshUI();
                this.treeDataProvider.refresh();
                if (!this.dagStatusInterval) {
                    this.dagStatusInterval = setInterval(() => {
                        void this.refreshRunningDagState(this).catch((err) => ui.logToOutput('refreshRunningDagState Error', err));
                    }, 10 * 1000);
                }
            }
        }
    }
    async checkAllDagsRunState() {
        ui.logToOutput('DagTreeView.checkAllDagsRunState Started');
        if (!this.treeDataProvider) {
            return;
        }
        for (var node of this.treeDataProvider.visibleDagList) {
            if (!node.IsPaused) {
                this.checkDagRunState(node);
            }
        }
    }
    async notifyDagStateWithDagId(dagId) {
        ui.logToOutput('DagTreeView.checDagStateWitDagId Started');
        if (!this.treeDataProvider) {
            return;
        }
        for (var node of this.treeDataProvider.visibleDagList) {
            if (node.DagId === dagId) {
                this.checkDagRunState(node);
            }
        }
    }
    async checkDagRunState(node) {
        ui.logToOutput('DagTreeView.checkDagRunState Started');
        if (!api_1.Api.isApiParamsSet()) {
            return;
        }
        if (!node) {
            return;
        }
        if (!this.treeDataProvider) {
            return;
        }
        if (node.IsPaused) {
            ui.showWarningMessage(node.DagId + 'Dag is PAUSED');
            return;
        }
        let result = await api_1.Api.getLastDagRun(node.DagId);
        if (result.isSuccessful) {
            node.LatestDagRunId = result.result.dag_run_id;
            node.LatestDagState = result.result.state;
            node.refreshUI();
            this.treeDataProvider.refresh();
            if (node.isDagRunning()) {
                if (!this.dagStatusInterval) {
                    this.dagStatusInterval = setInterval(() => {
                        void this.refreshRunningDagState(this).catch((err) => ui.logToOutput('refreshRunningDagState Error', err));
                    }, 10 * 1000);
                }
            }
        }
    }
    async pauseDAG(node) {
        ui.logToOutput('DagTreeView.pauseDAG Started');
        if (!api_1.Api.isApiParamsSet()) {
            return;
        }
        if (node.IsPaused) {
            ui.showWarningMessage(node.DagId + 'Dag is already PAUSED');
            return;
        }
        //let userAnswer = await vscode.window.showInputBox({ placeHolder: node.dagId + ' DAG will be PAUSED. Yes/No ?' });
        //if (userAnswer !== 'Yes') { return; }
        let result = await api_1.Api.pauseDag(node.DagId, true);
        if (result.isSuccessful) {
            node.IsPaused = true;
            node.refreshUI();
            this.treeDataProvider.refresh();
        }
    }
    async notifyDagPaused(dagId) {
        ui.logToOutput('DagTreeView.notifyDagPaused Started');
        if (!this.treeDataProvider) {
            return;
        }
        this.refresh();
    }
    async notifyDagUnPaused(dagId) {
        ui.logToOutput('DagTreeView.notifyDagPaused Started');
        if (!this.treeDataProvider) {
            return;
        }
        this.refresh();
    }
    async unPauseDAG(node) {
        ui.logToOutput('DagTreeView.unPauseDAG Started');
        if (!api_1.Api.isApiParamsSet()) {
            return;
        }
        if (!node.IsPaused) {
            ui.showInfoMessage(node.DagId + 'Dag is already UNPAUSED');
            return;
        }
        //let userAnswer = await vscode.window.showInputBox({ placeHolder: node.dagId + ' DAG will be UNPAUSED. Yes/No ?' });
        //if (userAnswer !== 'Yes') { return; }
        let result = await api_1.Api.pauseDag(node.DagId, false);
        if (result.isSuccessful) {
            node.IsPaused = false;
            node.refreshUI();
            this.treeDataProvider.refresh();
        }
    }
    async lastDAGRunLog(node) {
        ui.logToOutput('DagTreeView.lastDAGRunLog Started');
        if (!api_1.Api.isApiParamsSet()) {
            return;
        }
        let result = await api_1.Api.getLastDagRunLog(node.DagId);
        if (result.isSuccessful) {
            const tmp = require('tmp');
            var fs = require('fs');
            const tmpFile = tmp.fileSync({ mode: 0o644, prefix: node.DagId, postfix: '.log' });
            fs.appendFileSync(tmpFile.name, result.result);
            ui.openFile(tmpFile.name);
        }
    }
    async dagSourceCode(node) {
        ui.logToOutput('DagTreeView.dagSourceCode Started');
        if (!api_1.Api.isApiParamsSet()) {
            return;
        }
        var result;
        if (api_1.Api.getAirflowVersion() === "v1") {
            result = await api_1.Api.getSourceCodeV1(node.DagId, node.FileToken);
        }
        else if (api_1.Api.getAirflowVersion() === "v2") {
            result = await api_1.Api.getSourceCodeV2(node.DagId);
        }
        else {
            result = new methodResult_1.MethodResult();
            result.isSuccessful = false;
            result.result = "Unknown Airflow Version";
        }
        if (result.isSuccessful) {
            const tmp = require('tmp');
            var fs = require('fs');
            const tmpFile = tmp.fileSync({ mode: 0o644, prefix: node.DagId, postfix: '.py' });
            fs.appendFileSync(tmpFile.name, result.result);
            ui.openFile(tmpFile.name);
        }
        else {
            ui.logToOutput(result.result);
            ui.showErrorMessage(result.result);
        }
    }
    async filter() {
        ui.logToOutput('DagTreeView.filter Started');
        let filterStringTemp = await vscode.window.showInputBox({ value: this.filterString, placeHolder: 'Enter your filters seperated by comma' });
        if (filterStringTemp === undefined) {
            return;
        }
        this.filterString = filterStringTemp;
        this.treeDataProvider.refresh();
        this.setFilterMessage();
        this.saveState();
    }
    async showOnlyActive() {
        ui.logToOutput('DagTreeView.showOnlyActive Started');
        this.ShowOnlyActive = !this.ShowOnlyActive;
        this.treeDataProvider.refresh();
        this.setFilterMessage();
        this.saveState();
    }
    async showOnlyFavorite() {
        ui.logToOutput('DagTreeView.showOnlyFavorite Started');
        this.ShowOnlyFavorite = !this.ShowOnlyFavorite;
        this.treeDataProvider.refresh();
        this.setFilterMessage();
        this.saveState();
    }
    async addServer() {
        ui.logToOutput('DagTreeView.addServer Started');
        let apiUrlTemp = await vscode.window.showInputBox({ value: 'http://localhost:8080/api/v1', placeHolder: 'API Full URL (Exp:http://localhost:8080/api/v1)' });
        if (!apiUrlTemp) {
            return;
        }
        let userNameTemp = await vscode.window.showInputBox({ placeHolder: 'User Name' });
        if (!userNameTemp) {
            return;
        }
        let passwordTemp = await vscode.window.showInputBox({ placeHolder: 'Password' });
        if (!passwordTemp) {
            return;
        }
        this.ServerList.push({ "apiUrl": apiUrlTemp, "apiUserName": userNameTemp, "apiPassword": passwordTemp });
        api_1.Api.apiUrl = apiUrlTemp;
        api_1.Api.apiUserName = userNameTemp;
        api_1.Api.apiPassword = passwordTemp;
        this.saveState();
        this.refresh();
    }
    async removeServer() {
        ui.logToOutput('DagTreeView.removeServer Started');
        if (this.ServerList.length === 0) {
            return;
        }
        const items = this.ServerList.map(s => `${s["apiUrl"]} - ${s["apiUserName"]}`);
        const selected = await vscode.window.showQuickPick(items, { canPickMany: false, placeHolder: 'Select To Remove' });
        if (!selected) {
            return;
        }
        const selectedItems = selected.split(' - ');
        if (selectedItems[0]) {
            this.ServerList = this.ServerList.filter(item => !(item["apiUrl"] === selectedItems[0] && item["apiUserName"] === selectedItems[1]));
            this.saveState();
            ui.showInfoMessage("Server removed, you can remain working on it or connect a new one.");
        }
    }
    async connectServer() {
        ui.logToOutput('DagTreeView.connectServer Started');
        if (this.ServerList.length === 0) {
            this.addServer();
            return;
        }
        var items = [];
        for (var s of this.ServerList) {
            items.push(s["apiUrl"] + " - " + s["apiUserName"]);
        }
        const selected = await vscode.window.showQuickPick(items, { canPickMany: false, placeHolder: 'Select To Connect' });
        if (!selected) {
            return;
        }
        const selectedItems = selected.split(' - ');
        if (selectedItems[0]) {
            const item = this.ServerList.find(item => item["apiUrl"] === selectedItems[0] && item["apiUserName"] === selectedItems[1]);
            api_1.Api.apiUrl = selectedItems[0];
            api_1.Api.apiUserName = item?.["apiUserName"];
            api_1.Api.apiPassword = item?.["apiPassword"];
            this.saveState();
            this.refresh();
        }
    }
    async clearServers() {
        ui.logToOutput('DagTreeView.clearServers Started');
        this.ServerList = [];
        this.saveState();
        ui.showInfoMessage("Server List Cleared");
    }
    async loadDags() {
        ui.logToOutput('DagTreeView.loadDags Started');
        if (!api_1.Api.isApiParamsSet()) {
            return;
        }
        this.dagList = undefined;
        this.treeDataProvider.dagList = this.dagList;
        let result = await api_1.Api.getDagList();
        if (result.isSuccessful) {
            this.dagList = result.result;
            this.treeDataProvider.dagList = this.dagList;
            this.treeDataProvider.loadDagTreeItemsFromApiResponse();
        }
        this.treeDataProvider.refresh();
        this.setViewTitle();
    }
    async setViewTitle() {
        if (api_1.Api.apiUrl && api_1.Api.apiUserName) {
            this.view.title = api_1.Api.apiUrl + " - " + api_1.Api.apiUserName;
        }
    }
    async getImportErrors() {
        ui.logToOutput('DagTreeView.getImportErrors Started');
        if (!api_1.Api.isApiParamsSet()) {
            return;
        }
        let result = await api_1.Api.getImportErrors();
        if (result.isSuccessful) {
            this.ImportErrorsJson = result.result;
            if (this.ImportErrorsJson.total_entries > 0) {
                ui.showOutputMessage(result.result, "Import Dag Errors! Check Output Panel");
            }
        }
    }
    saveState() {
        ui.logToOutput('DagTreeView.saveState Started');
        try {
            this.context.globalState.update('apiUrl', api_1.Api.apiUrl);
            this.context.globalState.update('apiUserName', api_1.Api.apiUserName);
            this.context.globalState.update('apiPassword', api_1.Api.apiPassword);
            this.context.globalState.update('filterString', this.filterString);
            this.context.globalState.update('ShowOnlyActive', this.ShowOnlyActive);
            this.context.globalState.update('ShowOnlyFavorite', this.ShowOnlyFavorite);
            this.context.globalState.update('ServerList', this.ServerList);
        }
        catch (error) {
            ui.logToOutput("dagTreeView.saveState Error !!!", error);
        }
    }
    setFilterMessage() {
        this.view.message = this.getBoolenSign(this.ShowOnlyFavorite) + 'Fav, ' + this.getBoolenSign(this.ShowOnlyActive) + 'Active, Filter : ' + this.filterString;
    }
    getBoolenSign(variable) {
        return variable ? "✓" : "𐄂";
    }
    loadState() {
        ui.logToOutput('DagTreeView.loadState Started');
        try {
            let apiUrlTemp = this.context.globalState.get('apiUrl');
            if (apiUrlTemp) {
                api_1.Api.apiUrl = apiUrlTemp;
            }
            let apiUserNameTemp = this.context.globalState.get('apiUserName');
            if (apiUserNameTemp) {
                api_1.Api.apiUserName = apiUserNameTemp;
            }
            let apiPasswordTemp = this.context.globalState.get('apiPassword');
            if (apiPasswordTemp) {
                api_1.Api.apiPassword = apiPasswordTemp;
            }
            let filterStringTemp = this.context.globalState.get('filterString');
            if (filterStringTemp) {
                this.filterString = filterStringTemp;
                this.setFilterMessage();
            }
            let ShowOnlyActiveTemp = this.context.globalState.get('ShowOnlyActive');
            if (ShowOnlyActiveTemp) {
                this.ShowOnlyActive = ShowOnlyActiveTemp;
            }
            let ShowOnlyFavoriteTemp = this.context.globalState.get('ShowOnlyFavorite');
            if (ShowOnlyFavoriteTemp) {
                this.ShowOnlyFavorite = ShowOnlyFavoriteTemp;
            }
            if (apiUrlTemp && !this.ServerList.find(e => e["apiUrl"] === apiUrlTemp)) {
                this.ServerList.push({ "apiUrl": apiUrlTemp, "apiUserName": apiUserNameTemp, "apiPassword": apiPasswordTemp });
            }
            let ServerListTemp = this.context.globalState.get('ServerList');
            if (ServerListTemp) {
                this.ServerList = ServerListTemp;
            }
        }
        catch (error) {
            ui.logToOutput("dagTreeView.loadState Error !!!", error);
        }
    }
    async viewConnections() {
        ui.logToOutput('DagTreeView.viewConnections Started');
        const { ConnectionsView } = await Promise.resolve().then(() => require('./connectionsView'));
        ConnectionsView.render(this.context.extensionUri);
    }
    async viewVariables() {
        ui.logToOutput('DagTreeView.viewVariables Started');
        const { VariablesView } = await Promise.resolve().then(() => require('./variablesView'));
        VariablesView.render(this.context.extensionUri);
    }
    async viewProviders() {
        ui.logToOutput('DagTreeView.viewProviders Started');
        const { ProvidersView } = await Promise.resolve().then(() => require('./providersView'));
        ProvidersView.render(this.context.extensionUri);
    }
}
exports.DagTreeView = DagTreeView;
//# sourceMappingURL=dagTreeView.js.map