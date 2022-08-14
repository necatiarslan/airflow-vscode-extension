/* eslint-disable @typescript-eslint/naming-convention */
import * as vscode from 'vscode';
import fetch from 'node-fetch';
import { encode } from 'base-64';
import { DagView } from './dagView';
import { DagTreeItem } from './dagTreeItem';
import { DagTreeDataProvider } from './dagTreeDataProvider';
import { showInfoMessage, showWarningMessage, showErrorMessage, showFile } from './ui';
import { Api } from './api';
import { MethodResult } from './methodResult';

export class DagTreeView {

	view: vscode.TreeView<DagTreeItem>;
	treeDataProvider: DagTreeDataProvider;
	daglistResponse: any;
	context: vscode.ExtensionContext;
	filterString: string = '';
	dagStatusInterval: NodeJS.Timer;

	constructor(context: vscode.ExtensionContext) {
		this.context = context;
		this.treeDataProvider = new DagTreeDataProvider();
		this.view = vscode.window.createTreeView('dagTreeView', { treeDataProvider: this.treeDataProvider, showCollapseAll: true });
		this.loadState();
		this.refresh();
		context.subscriptions.push(this.view);
	}

	refresh(): void {
		this.loadDags();
	}

	resetView(): void {
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
		DagView.render(this.context.extensionUri, node.dagId);
	}

	async addToFavDAG(node: DagTreeItem) {
		node.isFav = true;
	}

	async deleteFromFavDAG(node: DagTreeItem) {
		node.isFav = false;
	}

	async triggerDag(node: DagTreeItem) {
		if(!Api.isApiParamsSet()) { return; }

		if (node.isPaused) {
			showWarningMessage('Dag is PAUSED !!!');
			return;
		}

		if (node.isDagRunning()) {
			showWarningMessage('Dag is ALREADY RUNNING !!!');
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
		}
	}

	async triggerDagWConfig(node: DagTreeItem) {
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
		if (!this.treeDataProvider) { return; }
		for (var node of this.treeDataProvider.visibleDagList) {
			if (!node.isPaused) {
				this.checkDagRunState(node);
			}
		}
	}

	async checkDagRunState(node: DagTreeItem) {
		if(!Api.isApiParamsSet()) { return; }

		if (!node) { return; }
		if (!this.treeDataProvider) { return; }
		if (node.isPaused) { showWarningMessage(node.dagId + 'Dag is PAUSED'); return; }

		let result = await Api.getLastDagRun(node.dagId);
		if (result.isSuccessful)
		{
			node.latestDagRunId = result.result['dag_runs'][0]['dag_run_id'];
			node.latestDagState = result.result['dag_runs'][0]['state'];
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
		if(!Api.isApiParamsSet()) { return; }

		if (node.isPaused) { showWarningMessage(node.dagId + 'Dag is already PAUSED'); return; }

		let userAnswer = await vscode.window.showInputBox({ placeHolder: node.dagId + ' DAG will be PAUSED. Yes/No ?' });
		if (userAnswer !== 'Yes') { return; }

		let result = await Api.pauseDag(node.dagId, true);
		if(result.isSuccessful)
		{
			node.isPaused = true;
			node.refreshUI();
			this.treeDataProvider.refresh();
		}

	}

	async unPauseDAG(node: DagTreeItem) {
		if(!Api.isApiParamsSet()) { return; }

		if (!node.isPaused) { showInfoMessage(node.dagId + 'Dag is already UNPAUSED'); return; }

		let userAnswer = await vscode.window.showInputBox({ placeHolder: node.dagId + ' DAG will be UNPAUSED. Yes/No ?' });
		if (userAnswer !== 'Yes') { return; }

		let result = await Api.pauseDag(node.dagId, false);
		if(result.isSuccessful)
		{
			node.isPaused = false;
			node.refreshUI();
			this.treeDataProvider.refresh();
		}
	}

	async lastDAGRunLog(node: DagTreeItem) {
		if(!Api.isApiParamsSet()) { return; }

		let result = await Api.getLastDagRunLog(node.dagId);
		if(result.isSuccessful)
		{
			const tmp = require('tmp');
			var fs = require('fs');
			const tmpFile = tmp.fileSync({ mode: 0o644, prefix: node.dagId, postfix: '.log' });
			fs.appendFileSync(result.result);
			showFile(tmpFile.name);
		}
	}

	async dagSourceCode(node: DagTreeItem) {
		if(!Api.isApiParamsSet()) { return; }

		let result = await Api.getSourceCode(node.dagId, node.fileToken);
		if(result.isSuccessful)
		{
			const tmp = require('tmp');
			var fs = require('fs');

			const tmpFile = tmp.fileSync({ mode: 0o644, prefix: node.dagId, postfix: '.py' });
			fs.appendFileSync(tmpFile.name, result.result);
			showFile(tmpFile.name);

			//TODO: Option to print to output
			// let outputAirflow = vscode.window.createOutputChannel("Airflow");
			// outputAirflow.clear();
			// outputAirflow.append(sourceCode);
			// outputAirflow.show();

			// this.showInfoMessage('Source Code printed to output.');
		}
		else
		{

		}

	}

	async filter() {
		let filterStringTemp = await vscode.window.showInputBox({ value: this.filterString, placeHolder: 'Enter your filters seperated by comma' });

		if (filterStringTemp === undefined) { return; }

		if (filterStringTemp !== '') {
			this.filterString = filterStringTemp;
			this.view.message = 'Filter : ' + this.filterString;
			this.treeDataProvider.filterString = this.filterString;
		}
		else {
			this.filterString = '';
			this.view.message = '';
			this.treeDataProvider.filterString = this.filterString;
		}
		this.saveState();
		this.treeDataProvider.refresh();
	}

	async addServer() {
		let apiUrlTemp = await vscode.window.showInputBox({ placeHolder: 'API Full URL (Exp:http://localhost:8080/api/v1)' });

		if (apiUrlTemp === undefined) { return; }

		if (apiUrlTemp === '' && Api.apiUrl) {
			let deleteApiConfig = await vscode.window.showInputBox({ placeHolder: 'Delete Current Airflow Connection Coniguration ? (Yes/No)' });
			if (deleteApiConfig === 'Yes') {
				this.resetView();
				return;
			}
			return;
		}

		let userNameTemp = await vscode.window.showInputBox({ placeHolder: 'User Name' });
		if (!userNameTemp) { return; }

		let passwordTemp = await vscode.window.showInputBox({ placeHolder: 'Password' });
		if (!passwordTemp) { return; }

		Api.apiUrl = apiUrlTemp;
		Api.apiUserName = userNameTemp;
		Api.apiPassword = passwordTemp;

		this.saveState();

		this.refresh();
	}

	async loadDags() {
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
		try {
			this.context.globalState.update('apiUrl', Api.apiUrl);
			this.context.globalState.update('apiUserName', Api.apiUserName);
			this.context.globalState.update('apiPassword', Api.apiPassword);
			this.context.globalState.update('filterString', this.filterString);
		} catch (error) {

		}
	}

	loadState() {
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
				this.view.message = 'Filter : ' + this.filterString;
				this.treeDataProvider.filterString = this.filterString;
			}
		} catch (error) {
			showErrorMessage('Airflow Extension can not load latest state !!!', error);
		}
	}
}

