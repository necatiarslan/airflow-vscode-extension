/* eslint-disable @typescript-eslint/naming-convention */
import * as vscode from 'vscode';
import { DagView } from './dagView';
import { DagTreeItem } from './dagTreeItem';
import { DagTreeDataProvider } from './dagTreeDataProvider';
import * as ui from './ui';
import { Api } from './api';
import { urlToHttpOptions } from 'url';

export class DagTreeView {

	public static Current: DagTreeView | undefined;
	public view: vscode.TreeView<DagTreeItem>;
	public treeDataProvider: DagTreeDataProvider;
	public daglistResponse: any;
	public context: vscode.ExtensionContext;
	public filterString: string = '';
	public dagStatusInterval: NodeJS.Timer;
	public ShowOnlyActive: boolean = true;
	public ShowOnlyFavorite: boolean = false;
	public ImportErrorsJson: any;

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

		vscode.window.withProgress({
			location: vscode.ProgressLocation.Window,
			title: "Airflow: Loading...",
		}, (progress, token) => {
			progress.report({ increment: 0 });

			this.loadDags();

			return new Promise<void>(resolve => { resolve(); });
		});

		this.getImportErrors();
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
		this.setViewTitle();

		this.saveState();
		this.refresh();
	}

	viewDagView(node: DagTreeItem): void {
		ui.logToOutput('DagTreeView.viewDagView Started');
		DagView.render(this.context.extensionUri, node.DagId);
	}

	async addToFavDAG(node: DagTreeItem) {
		ui.logToOutput('DagTreeView.addToFavDAG Started');
		node.IsFav = true;
	}

	async deleteFromFavDAG(node: DagTreeItem) {
		ui.logToOutput('DagTreeView.deleteFromFavDAG Started');
		node.IsFav = false;
	}

	async triggerDag(node: DagTreeItem) {
		ui.logToOutput('DagTreeView.triggerDag Started');
		if(!Api.isApiParamsSet()) { return; }

		if (node.IsPaused) {
			ui.showWarningMessage('Dag is PAUSED !!!');
			return;
		}

		if (node.isDagRunning()) {
			ui.showWarningMessage('Dag is ALREADY RUNNING !!!');
			return;
		}

		let result = await Api.triggerDag(node.DagId);

		if(result.isSuccessful)
		{
			var responseTrigger = result.result;
			node.LatestDagRunId = responseTrigger['dag_run_id'];
			node.LatestDagState = responseTrigger['state'];
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

				let result = await Api.getDagRun(node.DagId, node.LatestDagRunId);

				if(result.isSuccessful)
				{
					node.LatestDagState = result.result['state'];
					node.refreshUI();
				}
				else
				{
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

	async triggerDagWConfig(node: DagTreeItem) {
		ui.logToOutput('DagTreeView.triggerDagWConfig Started');
		if(!Api.isApiParamsSet()) { return; }

		let triggerDagConfig = await vscode.window.showInputBox({ placeHolder: 'Enter Configuration JSON (Optional, must be a dict object) or Press Enter' });

		if (!triggerDagConfig) {
			triggerDagConfig = "{}";
		}

		if (triggerDagConfig !== undefined) {
			
			let result = await Api.triggerDag(node.DagId, triggerDagConfig);
		
			if(result.isSuccessful)
			{
				var responseTrigger = result.result;
				node.LatestDagRunId = responseTrigger['dag_run_id'];
				node.LatestDagState = responseTrigger['state'];
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
			if (!node.IsPaused) {
				this.checkDagRunState(node);
			}
		}
	}

	public async notifyDagStateWithDagId(dagId: string){
		ui.logToOutput('DagTreeView.checDagStateWitDagId Started');
		if (!this.treeDataProvider) { return; }
		for (var node of this.treeDataProvider.visibleDagList) {
			if (node.DagId === dagId) {
				this.checkDagRunState(node);
			}
		}
	}

	async checkDagRunState(node: DagTreeItem) {
		ui.logToOutput('DagTreeView.checkDagRunState Started');
		if(!Api.isApiParamsSet()) { return; }

		if (!node) { return; }
		if (!this.treeDataProvider) { return; }
		if (node.IsPaused) { ui.showWarningMessage(node.DagId + 'Dag is PAUSED'); return; }

		let result = await Api.getLastDagRun(node.DagId);
		if (result.isSuccessful)
		{
			node.LatestDagRunId = result.result.dag_run_id;
			node.LatestDagState = result.result.state;
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

		if (node.IsPaused) { ui.showWarningMessage(node.DagId + 'Dag is already PAUSED'); return; }

		//let userAnswer = await vscode.window.showInputBox({ placeHolder: node.dagId + ' DAG will be PAUSED. Yes/No ?' });
		//if (userAnswer !== 'Yes') { return; }

		let result = await Api.pauseDag(node.DagId, true);
		if(result.isSuccessful)
		{
			node.IsPaused = true;
			node.refreshUI();
			this.treeDataProvider.refresh();
		}

	}

	public async notifyDagPaused(dagId: string){
		ui.logToOutput('DagTreeView.notifyDagPaused Started');
		if (!this.treeDataProvider) { return; }
		for (var node of this.treeDataProvider.visibleDagList) {
			if (node.DagId === dagId) {
				node.IsPaused = true;
				node.refreshUI();
				this.treeDataProvider.refresh();
			}
		}
	}

	public async notifyDagUnPaused(dagId: string){
		ui.logToOutput('DagTreeView.notifyDagPaused Started');
		if (!this.treeDataProvider) { return; }
		for (var node of this.treeDataProvider.visibleDagList) {
			if (node.DagId === dagId) {
				node.IsPaused = false;
				node.refreshUI();
				this.treeDataProvider.refresh();
			}
		}
	}

	async unPauseDAG(node: DagTreeItem) {
		ui.logToOutput('DagTreeView.unPauseDAG Started');
		if(!Api.isApiParamsSet()) { return; }

		if (!node.IsPaused) { ui.showInfoMessage(node.DagId + 'Dag is already UNPAUSED'); return; }

		//let userAnswer = await vscode.window.showInputBox({ placeHolder: node.dagId + ' DAG will be UNPAUSED. Yes/No ?' });
		//if (userAnswer !== 'Yes') { return; }

		let result = await Api.pauseDag(node.DagId, false);
		if(result.isSuccessful)
		{
			node.IsPaused = false;
			node.refreshUI();
			this.treeDataProvider.refresh();
		}
	}

	async lastDAGRunLog(node: DagTreeItem) {
		ui.logToOutput('DagTreeView.lastDAGRunLog Started');
		if(!Api.isApiParamsSet()) { return; }

		let result = await Api.getLastDagRunLog(node.DagId);
		if(result.isSuccessful)
		{
			const tmp = require('tmp');
			var fs = require('fs');
			const tmpFile = tmp.fileSync({ mode: 0o644, prefix: node.DagId, postfix: '.log' });
			fs.appendFileSync(tmpFile.name, result.result);
			ui.openFile(tmpFile.name);
		}
	}

	async dagSourceCode(node: DagTreeItem) {
		ui.logToOutput('DagTreeView.dagSourceCode Started');
		if(!Api.isApiParamsSet()) { return; }

		let result = await Api.getSourceCode(node.DagId, node.FileToken);
		if(result.isSuccessful)
		{
			const tmp = require('tmp');
			var fs = require('fs');

			const tmpFile = tmp.fileSync({ mode: 0o644, prefix: node.DagId, postfix: '.py' });
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
			items.push(s["apiUrl"]+ " - " + s["apiUserName"]);
		}

		let selected = await vscode.window.showQuickPick(items, {canPickMany:false});
		let selectedItems = selected.split(" - ");

		if(selectedItems[0])
		{
			this.ServerList = this.ServerList.filter(item => item["apiUrl"] !== selectedItems[0]);
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
			items.push(s["apiUrl"] + " - " + s["apiUserName"]);
		}

		let selected = await vscode.window.showQuickPick(items, {canPickMany:false});
		let selectedItems = selected.split(" - ");


		if(selectedItems[0])
		{
			var item = this.ServerList.find(e => e["apiUrl"] === selectedItems[0]);

			Api.apiUrl = selectedItems[0];
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
		this.setViewTitle();
	}

	async setViewTitle(){
		if(Api.apiUrl && Api.apiUserName)
		{
			this.view.title = Api.apiUrl + " - " + Api.apiUserName;
		}
	}

	async getImportErrors(){
		ui.logToOutput('DagTreeView.getImportErrors Started');
		if(!Api.isApiParamsSet()) { return; }

		let result = await Api.getImportErrors();
		if(result.isSuccessful)
		{
			this.ImportErrorsJson = result.result;
			if(this.ImportErrorsJson.total_entries > 0)
			{
				ui.showOutputMessage(result.result, "Import Dag Errors! Check Output Panel");
			}
			
		}
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

