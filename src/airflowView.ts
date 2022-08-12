/* eslint-disable @typescript-eslint/naming-convention */
import * as vscode from 'vscode';
import fetch from 'node-fetch';
import { encode } from 'base-64';
import { debug, trace } from 'console';

export class AirflowViewManager {

	view: vscode.TreeView<DagTreeItem>;
	treeDataProvider: AirflowTreeDataProvider;
	daglistResponse: any;
	apiUrl: string = '';
	apiUserName: string = '';
	apiPassword: string = '';
	context: vscode.ExtensionContext;
	filterString: string = '';
	dagStatusInterval: NodeJS.Timer;

	constructor(context: vscode.ExtensionContext) {
		this.context = context;
		this.treeDataProvider = new AirflowTreeDataProvider();
		this.view = vscode.window.createTreeView('airflowView', { treeDataProvider: this.treeDataProvider, showCollapseAll: true });
		this.loadState();
		this.refresh();
		context.subscriptions.push(this.view);
	}

	refresh(): void {
		this.loadDags();
	}

	resetView(): void {
		this.apiUrl = '';
		this.apiUserName = '';
		this.apiPassword = '';
		this.filterString = '';

		this.daglistResponse = undefined;
		this.treeDataProvider.daglistResponse = this.daglistResponse;
		this.treeDataProvider.refresh();
		this.view.title = this.apiUrl;

		this.saveState();
		this.refresh();
	}

	viewDagView(): void {
		this.showInfoMessage("Development In Progress ...");
	}

	async addToFavDAG(node: DagTreeItem) {
		node.isFav = true;
	}

	async deleteFromFavDAG(node: DagTreeItem) {
		node.isFav = false;
	}

	async triggerDag(node: DagTreeItem) {

		if(node.isPaused){
			this.showWarningMessage('Dag is PAUSED !!!');
			return;
		}

		if(node.isDagRunning()){
			this.showWarningMessage('Dag is ALREADY RUNNING !!!');
			return;
		}

		try {
			let params = {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': 'Basic ' + encode(this.apiUserName + ":" + this.apiPassword)
				},
				body: JSON.stringify(
					{
						"conf": {}
					}),
			};

			let response = await fetch(this.apiUrl + '/dags/' + node.dagId + '/dagRuns', params);

			if (response.status === 200) {
				var responseTrigger = await response.json();
				node.latestDagRunId = responseTrigger['dag_run_id'];
				node.latestDagState = responseTrigger['state'];
				node.refreshUI();
				this.treeDataProvider.refresh();
				if(this.dagStatusInterval)
				{
					this.dagStatusInterval.refresh();
				}
				else
				{
					this.dagStatusInterval = setInterval(this.refreshRunningDagState, 10*1000, this);
				}
				
				this.showInfoMessage(node.dagId + " Dag Triggered.");
			}
			else {
				this.showErrorMessage(node.dagId + ' Dag Trigger Error !!!\n\n' + response.statusText);
			}
		} catch (error) {
			this.showErrorMessage(node.dagId + ' Dag Trigger Error !!!\n\n' + error.message);
		}
	}

	async refreshRunningDagState(airflowViewManager:AirflowViewManager) {
		let noDagIsRunning:boolean = true;
		for(var node of airflowViewManager.treeDataProvider.visibleDagList)
		{
			//"queued" "running" "success" "failed"
			if(node.isDagRunning())
			{
				noDagIsRunning = false;
				try {
					let params = {
						method: 'GET',
						headers: {
							'Content-Type': 'application/json',
							'Authorization': 'Basic ' + encode(airflowViewManager.apiUserName + ":" + airflowViewManager.apiPassword)
						}
					};
					
					//https://airflow.apache.org/api/v1/dags/{dag_id}/dagRuns/{dag_run_id}
					let response = await fetch(airflowViewManager.apiUrl + '/dags/' + node.dagId + '/dagRuns/' + node.latestDagRunId, params);
		
					if (response.status === 200) {
						var responseDagRun = await response.json();
						node.latestDagState = responseDagRun['state'];
						node.refreshUI();
					}
					else {
						node.latestDagRunId = '';
						node.latestDagState = '';
						airflowViewManager.showErrorMessage(node.dagId + ' Error while fetching DAG status !!!\n\n' + response.statusText);
					}
				} catch (error) {
					airflowViewManager.showErrorMessage(node.dagId + ' Dag Trigger Error !!!\n\n' + error.message);
				}
			}
			airflowViewManager.treeDataProvider.refresh();
		}
		if(noDagIsRunning && airflowViewManager.dagStatusInterval)
		{
			clearInterval(airflowViewManager.dagStatusInterval);
		}
	}

	async triggerDagWConfig(node: DagTreeItem) {
		let triggerDagConfig = await vscode.window.showInputBox({ placeHolder: 'Enter Configuration JSON (Optional, must be a dict object) or Press Enter' });

		if(!triggerDagConfig)
		{
			triggerDagConfig = "{}";
		}

		if (triggerDagConfig !== undefined) {
			try {
				let params = {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'Authorization': 'Basic ' + encode(this.apiUserName + ":" + this.apiPassword)
					},
					body: '{"conf": ' + triggerDagConfig + '}',
				};

				let response = await fetch(this.apiUrl + '/dags/' + node.label + '/dagRuns', params);

				if (response.status === 200) {
					var responseTrigger = await response.json();
					node.latestDagRunId = responseTrigger['dag_run_id'];
					node.latestDagState = responseTrigger['state'];
					node.refreshUI();
					this.treeDataProvider.refresh();
					if(this.dagStatusInterval)
					{
						this.dagStatusInterval.refresh();
					}
					else
					{
						this.dagStatusInterval = setInterval(this.refreshRunningDagState, 10*1000, this);
					}
					this.showInfoMessage(node.label + " Dag Triggered.");
				}
				else {
					this.showErrorMessage(node.label + ' Dag Trigger Error !!!\n\n' + response.statusText);
				}
			} catch (error) {
				this.showErrorMessage(node.label + ' Dag Trigger Error !!!\n\n' + error.message);
			}

		}
	}

	async checkAllDagsRunState() {
		if(!this.treeDataProvider){ return; }
		for(var node of this.treeDataProvider.visibleDagList)
		{
			if(!node.isPaused)
			{
				this.checkDagRunState(node);
			}
		}
	}

	async checkDagRunState(node: DagTreeItem) {
		if(!node){ return; }
		if(!this.treeDataProvider){ return; }
		if (node.isPaused) { this.showWarningMessage(node.dagId + 'Dag is PAUSED'); return; }

		try {
			let params = {
				method: 'GET',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': 'Basic ' + encode(this.apiUserName + ":" + this.apiPassword)
				}
			};

			let response = await fetch(this.apiUrl + '/dags/' + node.dagId + '/dagRuns?order_by=-start_date&limit=1', params);

			if (response.status === 200) {
				let dagRunResponse = await response.json();
				node.latestDagRunId = dagRunResponse['dag_runs'][0]['dag_run_id'];
				node.latestDagState = dagRunResponse['dag_runs'][0]['state'];
				node.refreshUI();
				this.treeDataProvider.refresh();

				if(node.isDagRunning)
				{
					if(this.dagStatusInterval)
					{
						this.dagStatusInterval.refresh();
					}
					else
					{
						this.dagStatusInterval = setInterval(this.refreshRunningDagState, 10*1000, this);
					}
				}
			}
			else {
				this.showErrorMessage('Error !!!\n\n' + response.statusText);
			}
			
		} catch (error) {
			this.showErrorMessage('Error !!!\n\n' + error.message);
		}
	}

	async pauseDAG(node: DagTreeItem) {
		if (!this.apiUrl) { return; }
		if (!this.apiUserName) { return; }
		if (!this.apiPassword) { return; }
		if (node.isPaused) { this.showWarningMessage(node.dagId + 'Dag is already PAUSED'); return; }

		let userAnswer = await vscode.window.showInputBox({ placeHolder: node.dagId + ' DAG will be PAUSED. Yes/No ?' });
		if (userAnswer !== 'Yes') { return; }

		try {
			let params = {
				method: 'PATCH',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': 'Basic ' + encode(this.apiUserName + ":" + this.apiPassword)
				},
				body: JSON.stringify(
					{
						"is_paused": true
					}),
			};

			let response = await fetch(this.apiUrl + '/dags/' + node.dagId, params);

			if (response.status === 200) {
				node.isPaused = true;
				node.refreshUI();
				this.treeDataProvider.refresh();
				this.showInfoMessage(node.dagId + ' Dag PAUSED');
			}
			else {
				this.showErrorMessage('Error !!!\n\n' + response.statusText);
			}
			
		} catch (error) {
			this.showErrorMessage('Error !!! \n\n' + error.message);
		}
	}

	async unPauseDAG(node: DagTreeItem) {
		if (!this.apiUrl) { return; }
		if (!this.apiUserName) { return; }
		if (!this.apiPassword) { return; }
		if (!node.isPaused) { this.showInfoMessage(node.dagId + 'Dag is already UNPAUSED'); return;}

		let userAnswer = await vscode.window.showInputBox({ placeHolder: node.dagId + ' DAG will be UNPAUSED. Yes/No ?' });
		if (userAnswer !== 'Yes') { return; }

		try {
			let params = {
				method: 'PATCH',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': 'Basic ' + encode(this.apiUserName + ":" + this.apiPassword)
				},
				body: JSON.stringify(
					{
						"is_paused": false
					}),
			};

			let response = await fetch(this.apiUrl + '/dags/' + node.dagId, params);

			if (response.status === 200) {
				node.isPaused = false;
				node.refreshUI();
				this.treeDataProvider.refresh();
				this.showInfoMessage(node.dagId + ' Dag UNPAUSED');
			}
			else {
				this.showErrorMessage('Error !!!\n\n' + response.statusText);
			}
			
		} catch (error) {
			this.showErrorMessage('Error !!! \n\n' + error.message);
		}
	}

	async lastDAGRunLog(node: DagTreeItem) {
		if (!this.apiUrl) { return; }
		if (!this.apiUserName) { return; }
		if (!this.apiPassword) { return; }

		try {
			let params = {
				method: 'GET',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': 'Basic ' + encode(this.apiUserName + ":" + this.apiPassword)
				}
			};

			this.showInfoMessage('Fecthing Latest DAG Run Logs, wait please ...');

			let response = await fetch(this.apiUrl + '/dags/' + node.dagId + '/dagRuns?order_by=-start_date&limit=1', params);

			if (response.status === 200) {
				let dagRunResponse = await response.json();
				let dagRunId = dagRunResponse['dag_runs'][0]['dag_run_id'];
				let responseTaskInstances = await (await fetch(this.apiUrl + '/dags/' + node.dagId + '/dagRuns/' + dagRunId + '/taskInstances', params));
				let responseTaskInstancesJson = await responseTaskInstances.json();

				const tmp = require('tmp');
				var fs = require('fs');
				const tmpFile = tmp.fileSync({ mode: 0o644, prefix: node.dagId, postfix: '.log' });

				fs.appendFileSync(tmpFile.name, '###################### BEGINING OF DAG RUN ######################\n\n');
				for(var taskInstance of responseTaskInstancesJson['task_instances'])
				{
					let responseLogs = await fetch(this.apiUrl + '/dags/' + node.dagId + '/dagRuns/' + dagRunId+ '/taskInstances/' + taskInstance['task_id'] + '/logs/' + taskInstance['try_number'], params);
					let responseLogsText = await responseLogs.text();
					fs.appendFileSync(tmpFile.name, '############################################################\n');
					fs.appendFileSync(tmpFile.name, 'Dag=' + node.dagId + '\n');
					fs.appendFileSync(tmpFile.name, 'DagRun=' + dagRunId + '\n');
					fs.appendFileSync(tmpFile.name, 'TaskId=' + taskInstance['task_id'] + '\n');
					fs.appendFileSync(tmpFile.name, 'Try=' + taskInstance['try_number'] + '\n');
					fs.appendFileSync(tmpFile.name, '############################################################\n\n');
					fs.appendFileSync(tmpFile.name, responseLogsText);
				}
				fs.appendFileSync(tmpFile.name, '###################### END OF DAG RUN ######################\n\n');
				this.showFile(tmpFile.name);
			}
			else {
				this.showErrorMessage('Error !!!\n\n' + response.statusText);
			}
			
		} catch (error) {
			this.showErrorMessage('Error !!!\n\n' + error.message);
		}
	}

	async showFile(file: string) {
		vscode.commands.executeCommand('vscode.open', vscode.Uri.file(file));
	}

	async dagSourceCode(node: DagTreeItem) {
		if (!this.apiUrl) { return; }
		if (!this.apiUserName) { return; }
		if (!this.apiPassword) { return; }

		try {
			let params = {
				method: 'GET',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': 'Basic ' + encode(this.apiUserName + ":" + this.apiPassword)
				}
			};

			let response = await fetch(this.apiUrl + '/dagSources/' + node.fileToken, params);

			if (response.status === 200) {
				let sourceCode = await response.text();

				const tmp = require('tmp');
				var fs = require('fs');

				const tmpFile = tmp.fileSync({ mode: 0o644, prefix: node.dagId, postfix: '.py' });
				fs.appendFileSync(tmpFile.name, sourceCode);
				this.showFile(tmpFile.name);

				//TODO: Option to print to output
				// let outputAirflow = vscode.window.createOutputChannel("Airflow");
				// outputAirflow.clear();
				// outputAirflow.append(sourceCode);
				// outputAirflow.show();
				
				// this.showInfoMessage('Source Code printed to output.');
			}
			else {
				this.showErrorMessage('Error !!!\n\n' + response.statusText);
			}
			
		} catch (error) {
			this.showErrorMessage('Error !!!\n\n' + error.message);
		}
	}

	showInfoMessage(message: string): void {
		vscode.window.showInformationMessage(message);
	}

	showWarningMessage(message: string): void {
		vscode.window.showWarningMessage(message);
	}

	showErrorMessage(message: string): void {
		vscode.window.showErrorMessage(message);
	}

	async filter() {
		let filterStringTemp = await vscode.window.showInputBox({value:this.filterString, placeHolder: 'Enter your filters seperated by comma' });
		
		if(filterStringTemp === undefined) { return; }
		
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

		if (apiUrlTemp === '' && this.apiUrl) {
			let deleteApiConfig = await vscode.window.showInputBox({ placeHolder: 'Delete Current Airflow Connection Coniguration ? (Yes/No)'});
			if(deleteApiConfig === 'Yes')
			{
				this.resetView();
				return;
			}
			return;
		}

		let userNameTemp = await vscode.window.showInputBox({ placeHolder: 'User Name' });
		if (!userNameTemp) { return; }

		let passwordTemp = await vscode.window.showInputBox({ placeHolder: 'Password' });
		if (!passwordTemp) { return; }

		this.apiUrl = apiUrlTemp;
		this.apiUserName = userNameTemp;
		this.apiPassword = passwordTemp;

		this.saveState();

		this.refresh();
	}

	async loadDags() {
		if (!this.apiUrl) { return; }
		if (!this.apiUserName) { return; }
		if (!this.apiPassword) { return; }

		this.daglistResponse = undefined;
		this.treeDataProvider.daglistResponse = this.daglistResponse;

		try {
			let params = {
				method: 'GET',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': 'Basic ' + encode(this.apiUserName + ":" + this.apiPassword)
				}
			};

			let response = await fetch(this.apiUrl + '/dags', params);

			if (response.status === 200) {
				this.daglistResponse = await response.json();
				this.treeDataProvider.daglistResponse = this.daglistResponse;
				this.treeDataProvider.loadDagTreeItemsFromApiResponse();
			}
			else {
				this.showErrorMessage(' Dag Load Error !!!\n\n' + response.statusText);
			}
		} catch (error) {
			this.showErrorMessage('Can not connect to Airflow. Please check Url, UserName and Password.\n\n' + error.message);
		}

		this.treeDataProvider.refresh();

		this.view.title = this.apiUrl;
		//this.view.message = 'message';
	}

	saveState() {
		try {
			this.context.globalState.update('apiUrl', this.apiUrl);
			this.context.globalState.update('apiUserName', this.apiUserName);
			this.context.globalState.update('apiPassword', this.apiPassword);
			this.context.globalState.update('filterString', this.filterString);
		} catch (error) {

		}
	}

	loadState() {
		try {
			let apiUrlTemp: string = this.context.globalState.get('apiUrl');
			if (apiUrlTemp) { this.apiUrl = apiUrlTemp; }

			let apiUserNameTemp: string = this.context.globalState.get('apiUserName');
			if (apiUserNameTemp) { this.apiUserName = apiUserNameTemp; }

			let apiPasswordTemp: string = this.context.globalState.get('apiPassword');
			if (apiPasswordTemp) { this.apiPassword = apiPasswordTemp; }

			let filterStringTemp: string = this.context.globalState.get('filterString');
			if (filterStringTemp) {
				this.filterString = filterStringTemp;
				this.view.message = 'Filter : ' + this.filterString;
				this.treeDataProvider.filterString = this.filterString;
			}
		} catch (error) {

		}
	}
}

export class AirflowTreeDataProvider implements vscode.TreeDataProvider<DagTreeItem>
{
	private _onDidChangeTreeData: vscode.EventEmitter<DagTreeItem | undefined | void> = new vscode.EventEmitter<DagTreeItem | undefined | void>();
	readonly onDidChangeTreeData: vscode.Event<DagTreeItem | undefined | void> = this._onDidChangeTreeData.event;
	daglistResponse: any;
	filterString: string = '';
	dagList: DagTreeItem[] = [];
	visibleDagList: DagTreeItem[] = [];

	refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	loadDagTreeItemsFromApiResponse(){
		this.dagList = [];
		if (this.daglistResponse) {
			for (var dag of this.daglistResponse["dags"]) {
				if (dag) {
					let treeItem = new DagTreeItem(dag);
					this.dagList.push(treeItem);
				}
			}
		}
	}

	getChildren(element: DagTreeItem): Thenable<DagTreeItem[]> {
		if (!element) {
			this.visibleDagList = [];
			for (var node of this.dagList)
			{
				if (!this.filterString || (this.filterString && node.doesFilterMatch(this.filterString))) {
					this.visibleDagList.push(node);
				}
			}
			return Promise.resolve(this.visibleDagList);
		}
		return Promise.resolve([]);
	}

	getTreeItem(element: DagTreeItem): DagTreeItem {
		return element;
	}
}

export class DagTreeItem extends vscode.TreeItem {
	public isPaused: boolean;
	public isActive: boolean;
	public dagId: string;
	public owners: string[];
	public tags: string[];
	public apiResponse: any;
	public fileToken: string;
	public latestDagRunId: string;
	public latestDagState: string;
	public isFav: boolean = false;

	constructor(apiResponse: any) {
		super(apiResponse["dag_id"]);
		this.setApiResponse(apiResponse);
		this.refreshUI();
	  }

	  public setApiResponse(apiResponse: any) {
		this.apiResponse = apiResponse;
		this.dagId = apiResponse["dag_id"];
		this.isActive = apiResponse["is_active"];
		this.isPaused = apiResponse["is_paused"];
		this.owners = apiResponse["owners"];
		this.tags = apiResponse["tags"];
		this.fileToken = apiResponse["file_token"];
	  }

	  public isDagRunning():boolean{
		return (this.latestDagState === 'queued' || this.latestDagState === 'running');
	  }

	  public refreshUI() {
		if (this.isPaused) {
			this.iconPath = new vscode.ThemeIcon('circle-outline');
			this.apiResponse["is_paused"] = true;
		}
		else {
			//"queued" "running" "success" "failed"
			if (this.latestDagState === 'queued')
			{
				this.iconPath = new vscode.ThemeIcon('loading~spin');
			}
			else if (this.latestDagState === 'running')
			{
				this.iconPath = new vscode.ThemeIcon('loading~spin');
			}
			else if (this.latestDagState === 'success')
			{
				this.iconPath = new vscode.ThemeIcon('check');
			}
			else if (this.latestDagState === 'failed')
			{
				this.iconPath = new vscode.ThemeIcon('error');
			}
			else{
				this.iconPath = new vscode.ThemeIcon('circle-filled');
			}
			this.apiResponse["is_paused"] = false;
		}
	  }

	  public doesFilterMatch(filterString: string): boolean {
		let words: string[] = filterString.split(',');
		let matchingWords: string[] = [];
		for (var word of words) {
			if (word==='active' && !this.isPaused) { matchingWords.push(word); continue; }
			if (word==='paused' && this.isPaused) { matchingWords.push(word); continue; }
			if (this.dagId.includes(word)) { matchingWords.push(word); continue; }
			if (this.owners.includes(word)) { matchingWords.push(word); continue; }
			if (word==='fav' && this.isFav) { matchingWords.push(word); continue; }
			
			//TODO
			// for(var t of this.tags)
			// {
			// 	if (t.includes(word)) { matchingWords.push(word); continue; }
			// }
		}

		return words.length === matchingWords.length;
	}
}
