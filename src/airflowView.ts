import * as vscode from 'vscode';
import fetch from 'node-fetch';
import { encode } from 'base-64';

export class AirflowViewManager {

	view: vscode.TreeView<vscode.TreeItem>;
	treeDataProvider: AirflowTreeDataProvider;
	daglistResponse: Promise<ResponseData>;
	apiUrl: string = "http://localhost:8080/api/v1";
	apiUserName: string = 'airflow';
	apiPassword: string = 'airflow';
	context: vscode.ExtensionContext;
	filterString: string = '';

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

	viewDagView(): void {
		this.showInfoMessage("Development In Progress ...");
	}

	async triggerDag(node: vscode.TreeItem) {
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

			let response = await fetch(this.apiUrl + '/dags/' + node.label + '/dagRuns', params);

			if (response.status === 200) {
				this.showInfoMessage(node.label + " Dag Triggered.");
			}
			else {
				this.showErrorMessage(node.label + ' Dag Trigger Error !!!\n\n' + response.statusText);
			}
		} catch (error) {
			this.showErrorMessage(node.label + ' Dag Trigger Error !!!\n\n' + error.message);
		}
	}

	async triggerDagWConfig(node: vscode.TreeItem) {
		let triggerDagConfig = await vscode.window.showInputBox({ placeHolder: 'Enter Configuration JSON (Optional, must be a dict object) or Press Enter' });

		this.showInfoMessage("Development is in progress. Please wait for next versions.");
		return;

		// if(!triggerDagConfig)
		// {
		// 	triggerDagConfig = {};
		// }

		if (triggerDagConfig !== undefined) {
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

				let response = await fetch(this.apiUrl + '/dags/' + node.label + '/dagRuns', params);

				if (response.status === 200) {
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

	async pauseDAG(node: vscode.TreeItem) {
		let userAnswer = await vscode.window.showInputBox({ placeHolder: node.label + ' DAG will be PAUSED. Yes/No ?' });

		this.showInfoMessage("Development is in progress. Please wait for next versions.");
	}

	async unPauseDAG(node: vscode.TreeItem) {
		let userAnswer = await vscode.window.showInputBox({ placeHolder: node.label + ' DAG will be UNPAUSED/ACTIVATED. Yes/No ?' });

		this.showInfoMessage("Development is in progress. Please wait for next versions.");
	}

	async lastDAGRunLog(node: vscode.TreeItem) {
		this.showInfoMessage("Development is in progress. Please wait for next versions.");
	}

	async dagSourceCode(node: vscode.TreeItem) {
		this.showInfoMessage("Development is in progress. Please wait for next versions.");
	}

	showInfoMessage(message: string): void {
		vscode.window.showInformationMessage(message);
	}

	showErrorMessage(message: string): void {
		vscode.window.showErrorMessage(message);
	}

	async filter() {
		let filterStringTemp = await vscode.window.showInputBox({ placeHolder: 'Enter your filters seperated by comma' });
		if (filterStringTemp) {
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
		if (!apiUrlTemp) { return; }

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

			this.daglistResponse = await response.json() as Promise<ResponseData>;
			this.treeDataProvider.daglistResponse = this.daglistResponse;
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

export class AirflowTreeDataProvider implements vscode.TreeDataProvider<vscode.TreeItem>
{
	private _onDidChangeTreeData: vscode.EventEmitter<vscode.TreeItem | undefined | void> = new vscode.EventEmitter<vscode.TreeItem | undefined | void>();
	readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined | void> = this._onDidChangeTreeData.event;
	daglistResponse: Promise<ResponseData>;
	filterString: string = '';

	refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	getChildren(element: vscode.TreeItem): Thenable<vscode.TreeItem[]> {
		if (!element) {
			let dagList: vscode.TreeItem[] = [];

			if (this.daglistResponse) {
				for (var dag of this.daglistResponse["dags"]) {
					if (dag) {

						let dagId: string = dag["dag_id"];
						let isActive: boolean = dag["is_active"];
						let isPaused: boolean = dag["is_paused"];
						let owners: string[] = dag["owners"];
						let tags: string[] = dag["tags"];

						if (!this.filterString || (this.filterString && this.doesFilterMatch(dagId, isActive, isPaused, owners, tags))) {
							let treeItem = new vscode.TreeItem(dagId);
							if (isPaused) {
								treeItem.iconPath = new vscode.ThemeIcon('debug-breakpoint-unverified');
							}
							else {
								treeItem.iconPath = new vscode.ThemeIcon('debug-breakpoint');
							}

							dagList.push(treeItem);
						}
					}
				}
			}

			return Promise.resolve(dagList);
		}
		return Promise.resolve([]);
	}

	doesFilterMatch(dagId: string, isActive: boolean, isPaused: boolean, owners: string[], tags: string[]): boolean {
		if (this.filterString.includes('active') && !isPaused) { return true; }
		if (this.filterString.includes('paused') && isPaused) { return true; }

		let words: string[] = this.filterString.split(',');
		for (var word of words) {
			if (dagId.includes(word)) { return true; }
			if (owners.includes(word)) { return true; }
			//TODO
			//if(tags.forEach(function(e){ e.normalize.includes(word); })) { return true; }
		}

		return false;
	}

	getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
		return element;
	}
}

interface ITag {
	name: string
}

interface ResponseData {
	"dags": [
		{
			"dag_id": "string",
			"root_dag_id": "string",
			"is_paused": true,
			"is_active": true,
			"is_subdag": true,
			"last_parsed_time": "2019-08-24T14:15:22Z",
			"last_pickled": "2019-08-24T14:15:22Z",
			"last_expired": "2019-08-24T14:15:22Z",
			"scheduler_lock": true,
			"pickle_id": "string",
			"default_view": "string",
			"fileloc": "string",
			"file_token": "string",
			"owners": [
				"string"
			],
			"description": "string",
			"schedule_interval": {
				"__type": "string",
				"days": 0,
				"seconds": 0,
				"microseconds": 0
			},
			"timetable_description": "string",
			"tags": [
				{
					"name": "string"
				}
			],
			"max_active_tasks": 0,
			"max_active_runs": 0,
			"has_task_concurrency_limits": true,
			"has_import_errors": true,
			"next_dagrun": "2019-08-24T14:15:22Z",
			"next_dagrun_data_interval_start": "2019-08-24T14:15:22Z",
			"next_dagrun_data_interval_end": "2019-08-24T14:15:22Z",
			"next_dagrun_create_after": "2019-08-24T14:15:22Z"
		}
	],
	"total_entries": 0
}