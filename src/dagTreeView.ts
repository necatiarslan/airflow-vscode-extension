/* eslint-disable @typescript-eslint/naming-convention */
import * as vscode from 'vscode';
import { DagView } from './dagView';
import { DagTreeItem } from './dagTreeItem';
import { DagTreeDataProvider } from './dagTreeDataProvider';
import * as ui from './ui';
import { Api } from './api';

export class DagTreeView {

	public static Current: DagTreeView | undefined;
	view: vscode.TreeView<DagTreeItem>;
	treeDataProvider: DagTreeDataProvider;
	daglistResponse: any;
	context: vscode.ExtensionContext;
	filterString: string = '';
	dagStatusInterval: NodeJS.Timer;
	public ShowOnlyActive: boolean = true;
	public ShowOnlyFavorite: boolean = false;

	public ServerList: {}[] = [];

	constructor(context: vscode.ExtensionContext) {
		ui.logToOutput('DagTreeView.constructor Started');
		this.context = context;
		this.loadState();
		this.treeDataProvider = new DagTreeDataProvider();
		this.view = vscode.window.createTreeView('dagTreeView', { treeDataProvider: this.treeDataProvider, showCollapseAll: true });
		this.refresh();
		context.subscriptions.push(this.view);
		DagTreeView.Current = this;
		this.setFilterMessage();
	}

	refresh(): void {
		ui.logToOutput('DagTreeView.refresh Started');
		this.loadDags();
	}

	resetView(): void {
		ui.logToOutput('DagTreeView.resetView Started');
		Api.apiUrl = '';
		Api.apiUserName = '';
		Api.apiPassword = '';
		this.filterString = '';

		this.daglistResponse = undefined;
		this.treeDataProvider.daglistResponse = this.daglistResponse;
		this.treeDataProvider.refresh();
		this.view.title = Api.apiUrl;

		this.saveState();
		this.refresh();
	}

	viewDagView(node: DagTreeItem): void {
		ui.logToOutput('DagTreeView.viewDagView Started');
		DagView.render(this.context.extensionUri, node.dagId);
	}

	async addToFavDAG(node: DagTreeItem) {
		ui.logToOutput('DagTreeView.addToFavDAG Started');
		node.isFav = true;
	}

	async deleteFromFavDAG(node: DagTreeItem) {
		ui.logToOutput('DagTreeView.deleteFromFavDAG Started');
		node.isFav = false;
	}

	async triggerDag(node: DagTreeItem) {
		ui.logToOutput('DagTreeView.triggerDag Started');
		if(!Api.isApiParamsSet()) { return; }

		if (node.isPaused) {
			ui.showWarningMessage('Dag is PAUSED !!!');
			return;
		}

		if (node.isDagRunning()) {
			ui.showWarningMessage('Dag is ALREADY RUNNING !!!');
			return;
		}

		let result = await Api.triggerDag(node.dagId);

		if(result.isSuccessful)
		{
			var responseTrigger = result.result;
			node.latestDagRunId = responseTrigger['dag_run_id'];
			node.latestDagState = responseTrigger['state'];
			node.refreshUI();
			this.treeDataProvider.refresh();
			if (this.dagStatusInterval) {
				this.dagStatusInterval.refresh();
			}
			else {
				this.dagStatusInterval = setInterval(this.refreshRunningDagState, 10 * 1000, this);
			}
		}
	}

	async refreshRunningDagState(dagTreeView: DagTreeView) {
		ui.logToOutput('DagTreeView.refreshRunningDagState Started');
		if(!Api.isApiParamsSet()) { return; }

		let noDagIsRunning: boolean = true;
		for (var node of dagTreeView.treeDataProvider.visibleDagList) {
			//"queued" "running" "success" "failed"
			if (node.isDagRunning()) {
				noDagIsRunning = false;

				let result = await Api.getDagRun(node.dagId, node.latestDagRunId);

				if(result.isSuccessful)
				{
					node.latestDagState = result.result['state'];
					node.refreshUI();
				}
				else
				{
					node.latestDagRunId = '';
					node.latestDagState = '';
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

	async triggerDagWConfig(node: DagTreeItem) {
		ui.logToOutput('DagTreeView.triggerDagWConfig Started');
		if(!Api.isApiParamsSet()) { return; }

		let triggerDagConfig = await vscode.window.showInputBox({ placeHolder: 'Enter Configuration JSON (Optional, must be a dict object) or Press Enter' });

		if (!triggerDagConfig) {
			triggerDagConfig = "{}";
		}

		if (triggerDagConfig !== undefined) {
			
			let result = await Api.triggerDag(node.dagId, triggerDagConfig);
		
			if(result.isSuccessful)
			{
				var responseTrigger = result.result;
				node.latestDagRunId = responseTrigger['dag_run_id'];
				node.latestDagState = responseTrigger['state'];
				node.refreshUI();
				this.treeDataProvider.refresh();
				if (this.dagStatusInterval) {
					this.dagStatusInterval.refresh();
				}
				else {
					this.dagStatusInterval = setInterval(this.refreshRunningDagState, 10 * 1000, this);
				}
			}

		}
	}

	async checkAllDagsRunState() {
		ui.logToOutput('DagTreeView.checkAllDagsRunState Started');
		if (!this.treeDataProvider) { return; }
		for (var node of this.treeDataProvider.visibleDagList) {
			if (!node.isPaused) {
				this.checkDagRunState(node);
			}
		}
	}

	public async notifyDagStateWithDagId(dagId: string){
		ui.logToOutput('DagTreeView.checDagStateWitDagId Started');
		if (!this.treeDataProvider) { return; }
		for (var node of this.treeDataProvider.visibleDagList) {
			if (node.dagId === dagId) {
				this.checkDagRunState(node);
			}
		}
	}

	async checkDagRunState(node: DagTreeItem) {
		ui.logToOutput('DagTreeView.checkDagRunState Started');
		if(!Api.isApiParamsSet()) { return; }

		if (!node) { return; }
		if (!this.treeDataProvider) { return; }
		if (node.isPaused) { ui.showWarningMessage(node.dagId + 'Dag is PAUSED'); return; }

		let result = await Api.getLastDagRun(node.dagId);
		if (result.isSuccessful)
		{
			node.latestDagRunId = result.result.dag_run_id;
			node.latestDagState = result.result.state;
			node.refreshUI();
			this.treeDataProvider.refresh();

			if (node.isDagRunning) {
				if (this.dagStatusInterval) {
					this.dagStatusInterval.refresh();
				}
				else {
					this.dagStatusInterval = setInterval(this.refreshRunningDagState, 10 * 1000, this);
				}
			}
		}

	}

	async pauseDAG(node: DagTreeItem) {
		ui.logToOutput('DagTreeView.pauseDAG Started');
		if(!Api.isApiParamsSet()) { return; }

		if (node.isPaused) { ui.showWarningMessage(node.dagId + 'Dag is already PAUSED'); return; }

		//let userAnswer = await vscode.window.showInputBox({ placeHolder: node.dagId + ' DAG will be PAUSED. Yes/No ?' });
		//if (userAnswer !== 'Yes') { return; }

		let result = await Api.pauseDag(node.dagId, true);
		if(result.isSuccessful)
		{
			node.isPaused = true;
			node.refreshUI();
			this.treeDataProvider.refresh();
		}

	}

	public async notifyDagPaused(dagId: string){
		ui.logToOutput('DagTreeView.notifyDagPaused Started');
		if (!this.treeDataProvider) { return; }
		for (var node of this.treeDataProvider.visibleDagList) {
			if (node.dagId === dagId) {
				node.isPaused = true;
				node.refreshUI();
				this.treeDataProvider.refresh();
			}
		}
	}

	public async notifyDagUnPaused(dagId: string){
		ui.logToOutput('DagTreeView.notifyDagPaused Started');
		if (!this.treeDataProvider) { return; }
		for (var node of this.treeDataProvider.visibleDagList) {
			if (node.dagId === dagId) {
				node.isPaused = false;
				node.refreshUI();
				this.treeDataProvider.refresh();
			}
		}
	}

	async unPauseDAG(node: DagTreeItem) {
		ui.logToOutput('DagTreeView.unPauseDAG Started');
		if(!Api.isApiParamsSet()) { return; }

		if (!node.isPaused) { ui.showInfoMessage(node.dagId + 'Dag is already UNPAUSED'); return; }

		//let userAnswer = await vscode.window.showInputBox({ placeHolder: node.dagId + ' DAG will be UNPAUSED. Yes/No ?' });
		//if (userAnswer !== 'Yes') { return; }

		let result = await Api.pauseDag(node.dagId, false);
		if(result.isSuccessful)
		{
			node.isPaused = false;
			node.refreshUI();
			this.treeDataProvider.refresh();
		}
	}

	async lastDAGRunLog(node: DagTreeItem) {
		ui.logToOutput('DagTreeView.lastDAGRunLog Started');
		if(!Api.isApiParamsSet()) { return; }

		let result = await Api.getLastDagRunLog(node.dagId);
		if(result.isSuccessful)
		{
			const tmp = require('tmp');
			var fs = require('fs');
			const tmpFile = tmp.fileSync({ mode: 0o644, prefix: node.dagId, postfix: '.log' });
			fs.appendFileSync(tmpFile.name, result.result);
			ui.openFile(tmpFile.name);
		}
	}

	async dagSourceCode(node: DagTreeItem) {
		ui.logToOutput('DagTreeView.dagSourceCode Started');
		if(!Api.isApiParamsSet()) { return; }

		let result = await Api.getSourceCode(node.dagId, node.fileToken);
		if(result.isSuccessful)
		{
			const tmp = require('tmp');
			var fs = require('fs');

			const tmpFile = tmp.fileSync({ mode: 0o644, prefix: node.dagId, postfix: '.py' });
			fs.appendFileSync(tmpFile.name, result.result);
			ui.openFile(tmpFile.name);
		}
		else
		{

		}

	}

	async filter() {
		ui.logToOutput('DagTreeView.filter Started');
		let filterStringTemp = await vscode.window.showInputBox({ value: this.filterString, placeHolder: 'Enter your filters seperated by comma' });

		if (filterStringTemp === undefined) { return; }

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

		let apiUrlTemp = await vscode.window.showInputBox({ placeHolder: 'API Full URL (Exp:http://localhost:8080/api/v1)' });
		if (apiUrlTemp === undefined) { return; }

		if(this.ServerList.find(e => e["apiUrl"] === apiUrlTemp))
		{
			ui.showWarningMessage(apiUrlTemp + " Already Added.");
			return;
		}

		let userNameTemp = await vscode.window.showInputBox({ placeHolder: 'User Name' });
		if (!userNameTemp) { return; }

		let passwordTemp = await vscode.window.showInputBox({ placeHolder: 'Password' });
		if (!passwordTemp) { return; }

		this.ServerList.push({ "apiUrl": apiUrlTemp, "apiUserName":userNameTemp, "apiPassword": passwordTemp});


		Api.apiUrl = apiUrlTemp;
		Api.apiUserName = userNameTemp;
		Api.apiPassword = passwordTemp;

		this.saveState();
		this.refresh();
	}

	async removeServer() {
		ui.logToOutput('DagTreeView.removeServer Started');
		if(this.ServerList.length === 0) { return; }

		var items: string[] = [];
		for(var s of this.ServerList)
		{
			items.push(s["apiUrl"]);
		}

		let apiUrlTemp = await vscode.window.showQuickPick(items, {canPickMany:false});
		if(apiUrlTemp)
		{
			this.ServerList = this.ServerList.filter(item => item["apiUrl"] !== apiUrlTemp);
			ui.showInfoMessage("Server removed, you can remain working on it or connect a new one.");
		}

	}

	async connectServer() {
		ui.logToOutput('DagTreeView.connectServer Started');

		if(this.ServerList.length === 0)
		{
			this.addServer();
			return;
		}

		var items: string[] = [];
		for(var s of this.ServerList)
		{
			items.push(s["apiUrl"]);
		}

		let apiUrlTemp = await vscode.window.showQuickPick(items, {canPickMany:false});

		if(apiUrlTemp)
		{
			var item = this.ServerList.find(e => e["apiUrl"] === apiUrlTemp);

			Api.apiUrl = apiUrlTemp;
			Api.apiUserName = item["apiUserName"];
			Api.apiPassword = item["apiPassword"];
	
			this.saveState();
			this.refresh();
		}
	}

	async loadDags() {
		ui.logToOutput('DagTreeView.loadDags Started');
		if(!Api.isApiParamsSet()) { return; }

		this.daglistResponse = undefined;
		this.treeDataProvider.daglistResponse = this.daglistResponse;

		let result = await Api.getDagList();
		if(result.isSuccessful)
		{
			this.daglistResponse = result.result;
			this.treeDataProvider.daglistResponse = this.daglistResponse;
			this.treeDataProvider.loadDagTreeItemsFromApiResponse();
		}
		this.treeDataProvider.refresh();
		this.view.title = Api.apiUrl;
	}

	saveState() {
		ui.logToOutput('DagTreeView.saveState Started');
		try {
			this.context.globalState.update('apiUrl', Api.apiUrl);
			this.context.globalState.update('apiUserName', Api.apiUserName);
			this.context.globalState.update('apiPassword', Api.apiPassword);
			this.context.globalState.update('filterString', this.filterString);
			this.context.globalState.update('ShowOnlyActive', this.ShowOnlyActive);
			this.context.globalState.update('ShowOnlyFavorite', this.ShowOnlyFavorite);
			this.context.globalState.update('ServerList', this.ServerList);

		} catch (error) {
			ui.logToOutput("dagTreeView.saveState Error !!!", error);
		}
	}

	setFilterMessage(){
		this.view.message = this.getBoolenSign(this.ShowOnlyFavorite) + 'Fav, '+this.getBoolenSign(this.ShowOnlyActive)+'Active, Filter : ' + this.filterString;
	}

	getBoolenSign(variable: boolean){
		return variable ? "✓" : "𐄂";
	}


	loadState() {
		ui.logToOutput('DagTreeView.loadState Started');
		try {
			let apiUrlTemp: string = this.context.globalState.get('apiUrl');
			if (apiUrlTemp) { Api.apiUrl = apiUrlTemp; }

			let apiUserNameTemp: string = this.context.globalState.get('apiUserName');
			if (apiUserNameTemp) { Api.apiUserName = apiUserNameTemp; }

			let apiPasswordTemp: string = this.context.globalState.get('apiPassword');
			if (apiPasswordTemp) { Api.apiPassword = apiPasswordTemp; }

			let filterStringTemp: string = this.context.globalState.get('filterString');
			if (filterStringTemp) {
				this.filterString = filterStringTemp;
				this.setFilterMessage();
			}

			let ShowOnlyActiveTemp: boolean = this.context.globalState.get('ShowOnlyActive');
			if (ShowOnlyActiveTemp) { this.ShowOnlyActive = ShowOnlyActiveTemp; }

			let ShowOnlyFavoriteTemp: boolean = this.context.globalState.get('ShowOnlyFavorite');
			if (ShowOnlyFavoriteTemp) { this.ShowOnlyFavorite = ShowOnlyFavoriteTemp; }

			if(!this.ServerList.find(e => e["apiUrl"] === apiUrlTemp))
			{
				this.ServerList.push({ "apiUrl": apiUrlTemp, "apiUserName":apiUserNameTemp, "apiPassword": apiPasswordTemp });
			}

			let ServerListTemp: {}[] = this.context.globalState.get('ServerList');
			if (ServerListTemp) { this.ServerList = ServerListTemp; }
		} catch (error) {
			ui.logToOutput("dagTreeView.loadState Error !!!", error);
		}
	}
}

