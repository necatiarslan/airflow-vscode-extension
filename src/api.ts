/* eslint-disable @typescript-eslint/naming-convention */
import { encode } from 'base-64';
import * as ui from './ui';
import { MethodResult } from './methodResult';
import fetch from 'node-fetch';

export class Api {

	public static apiUrl: string = '';
	public static apiUserName: string = '';
	public static apiPassword: string = '';

	public static getHeaders() {
		ui.logToOutput("api.getHeaders started");
		let result = {
			'Content-Type': 'application/json',
			'Authorization': 'Basic ' + encode(Api.apiUserName + ":" + Api.apiPassword)
		};
		ui.logToOutput("api.getHeaders completed");
		return result;
	}

	public static isApiParamsSet() {
		if (!this.apiUrl || !this.apiUserName || !this.apiPassword) {
			ui.showWarningMessage("Please set Api URL, UserName and PassWord");
			return false;
		}
		return true;
	}

	public static async triggerDag(dagId: string, config: string = undefined, date: string = undefined): Promise<MethodResult<any>> {
		ui.logToOutput("api.triggerDag started");
		if (!Api.isApiParamsSet()) { return; }

		let result: MethodResult<any> = new MethodResult<any>();

		if (!config) {
			config = "{}";
		}
		let logicalDateParam: string = "";
		if (date) {
			logicalDateParam = ', "logical_date": "' + date + 'T00:00:00Z",';
		}

		try {

			let params = {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': 'Basic ' + encode(Api.apiUserName + ":" + Api.apiPassword)
				},
				body: '{"conf": ' + config + logicalDateParam + '}',
			};

			let response = await fetch(Api.apiUrl + '/dags/' + dagId + '/dagRuns', params);

			result.result = await response.json();
			if (response.status === 200) {
				ui.showInfoMessage(dagId + " Dag Triggered.");
				result.isSuccessful = true;
				ui.logToOutput("api.triggerDag completed");
				return result;
			}
			else {
				ui.showApiErrorMessage('Error !!!', result.result);
				result.isSuccessful = false;
				ui.logToOutput("api.triggerDag completed");
				return result;
			}
		} catch (error) {
			ui.showErrorMessage(dagId + ' Dag Trigger Error !!!', error);
			result.isSuccessful = false;
			result.error = error;
			ui.logToOutput("api.triggerDag Error !!!", error);
			return result;
		}
	}

	public static async getDagRun(dagId: string, dagRunId: string): Promise<MethodResult<any>> {
		ui.logToOutput("api.getDagRun started");
		let result: MethodResult<any> = new MethodResult<any>();
		try {
			let params = {
				method: 'GET',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': 'Basic ' + encode(Api.apiUserName + ":" + Api.apiPassword)
				}
			};

			//https://airflow.apache.org/api/v1/dags/{dag_id}/dagRuns/{dag_run_id}
			let response = await fetch(Api.apiUrl + '/dags/' + dagId + '/dagRuns/' + dagRunId, params);

			result.result = await response.json();
			if (response.status === 200) {
				result.isSuccessful = true;
				ui.logToOutput("api.getDagRun completed");
				return result;
			}
			else {
				ui.showApiErrorMessage('Error !!!', result.result);
				result.isSuccessful = false;
				ui.logToOutput("api.getDagRun completed");
				return result;
			}
		} catch (error) {
			ui.showErrorMessage(dagId + ' Dag Trigger Error !!!\n\n' + error.message);
			result.isSuccessful = false;
			result.error = error;
			ui.logToOutput("api.getDagRun Error !!!", error);
			return result;
		}
	}

	public static async pauseDag(dagId: string, is_paused: boolean = true): Promise<MethodResult<any>> {
		ui.logToOutput("api.pauseDag started");
		let result: MethodResult<any> = new MethodResult<any>();
		try {
			let params = {
				method: 'PATCH',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': 'Basic ' + encode(Api.apiUserName + ":" + Api.apiPassword)
				},
				body: JSON.stringify(
					{
						"is_paused": is_paused
					}),
			};

			let response = await fetch(Api.apiUrl + '/dags/' + dagId, params);

			result.result = response.json();
			if (response.status === 200) {
				ui.showInfoMessage(dagId + ' Dag ' + (is_paused ? "PAUSED" : "UN-PAUSED"));
				result.isSuccessful = true;
				ui.logToOutput("api.pauseDag completed");
				return result;
			}
			else {
				ui.showApiErrorMessage('Error !!!', result.result);
				result.isSuccessful = false;
				ui.logToOutput("api.pauseDag completed");
				return result;
			}

		} catch (error) {
			ui.showErrorMessage('Error !!!', error);
			result.isSuccessful = false;
			result.error = error;
			ui.logToOutput("api.pauseDag Error !!!", error);
			return result;
		}
	}

	public static async getSourceCode(dagId: string, fileToken: string): Promise<MethodResult<any>> {
		ui.logToOutput("api.getSourceCode started");
		let result: MethodResult<any> = new MethodResult<any>();
		try {
			let params = {
				method: 'GET',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': 'Basic ' + encode(Api.apiUserName + ":" + Api.apiPassword)
				}
			};

			let response = await fetch(Api.apiUrl + '/dagSources/' + fileToken, params);

			result.result = await response.text();
			if (response.status === 200) {
				result.isSuccessful = true;
				ui.logToOutput("api.getSourceCode completed");
				return result;

			}
			else {
				ui.showApiErrorMessage('Error !!!', result.result);
				result.isSuccessful = false;
				ui.logToOutput("api.getSourceCode completed");
				return result;
			}

		} catch (error) {
			ui.showErrorMessage('Error !!!\n\n', error);
			result.isSuccessful = false;
			result.error = error;
			ui.logToOutput("api.getSourceCode Error !!!", error);
			return result;
		}
	}

	public static async getDagInfo(dagId: string): Promise<MethodResult<any>> {
		ui.logToOutput("api.getDagInfo started");
		let result: MethodResult<any> = new MethodResult<any>();
		try {
			let params = {
				method: 'GET',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': 'Basic ' + encode(Api.apiUserName + ":" + Api.apiPassword)
				}
			};

			let response = await fetch(Api.apiUrl + '/dags/' + dagId + '/details', params);

			result.result = await response.json();
			if (response.status === 200) {
				result.isSuccessful = true;
				ui.logToOutput("api.getDagInfo completed");
				return result;
			}
			else {
				ui.showApiErrorMessage('Error !!!', result.result);
				result.isSuccessful = false;
				ui.logToOutput("api.getDagInfo completed");
				return result;
			}
		} catch (error) {
			ui.showErrorMessage('Can not connect to Airflow. Please check Url, UserName and Password.\n\n' + error.message);
			result.isSuccessful = false;
			result.error = error;
			ui.logToOutput("api.getDagInfo Error !!!", error);
			return result;
		}

	}

	public static async getDagTasks(dagId: string): Promise<MethodResult<any>> {
		ui.logToOutput("api.getDagTasks started");
		let result: MethodResult<any> = new MethodResult<any>();
		try {
			let params = {
				method: 'GET',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': 'Basic ' + encode(Api.apiUserName + ":" + Api.apiPassword)
				}
			};

			let response = await fetch(Api.apiUrl + '/dags/' + dagId + '/tasks', params);

			result.result = await response.json();
			if (response.status === 200) {
				result.isSuccessful = true;
				ui.logToOutput("api.getDagTasks completed");
				return result;
			}
			else {
				ui.showApiErrorMessage('Error !!!', result.result);
				result.isSuccessful = false;
				ui.logToOutput("api.getDagTasks completed");
				return result;
			}
		} catch (error) {
			ui.showErrorMessage('Error !!!\n\n', error);
			result.isSuccessful = false;
			result.error = error;
			ui.logToOutput("api.getDagTasks Error !!!", error);
			return result;
		}

	}

	public static async getLastDagRun(dagId: string): Promise<MethodResult<any>> {
		ui.logToOutput("api.getLastDagRun started");
		let result = await this.getDagRunHistory(dagId, 1);
		if (result.isSuccessful && Object.keys(result.result.dag_runs).length>0 )
		{
			return this.getDagRun(dagId, result.result.dag_runs[0].dag_run_id);
		}
		else
		{
			result.isSuccessful = false;
			result.result = undefined;
			result.error = new Error('No Dag Run Found for ' + dagId);
			return result;
		}
		
	}

	public static async getDagRunHistory(dagId: string, limit: number): Promise<MethodResult<any>> {
		ui.logToOutput("api.getDagRunHistory started");
		let result: MethodResult<any> = new MethodResult<any>();
		try {
			let params = {
				method: 'GET',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': 'Basic ' + encode(Api.apiUserName + ":" + Api.apiPassword)
				}
			};

			let response = await fetch(Api.apiUrl + '/dags/' + dagId + '/dagRuns?order_by=-start_date&limit=' + limit, params);

			result.result = await response.json();
			if (response.status === 200) {
				result.isSuccessful = true;
				ui.logToOutput("api.getDagRunHistory completed");
				return result;
			}
			else {
				ui.showApiErrorMessage('Error !!!', result.result);
				result.isSuccessful = false;
				ui.logToOutput("api.getDagRunHistory completed");
				return result;
			}

		} catch (error) {
			ui.showErrorMessage('Error !!!', error);
			result.isSuccessful = false;
			result.error = error;
			ui.logToOutput("api.getDagRunHistory Error !!!", error);
			return result;
		}

	}

	public static async getTaskInstances(dagId: string, dagRunId: string): Promise<MethodResult<any>> {
		ui.logToOutput("api.getTaskInstances started");
		let result: MethodResult<any> = new MethodResult<any>();
		try {
			let params = {
				method: 'GET',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': 'Basic ' + encode(Api.apiUserName + ":" + Api.apiPassword)
				}
			};

			//https://airflow.apache.org/api/v1/dags/{dag_id}/dagRuns/{dag_run_id}/taskInstances
			let response = await fetch(Api.apiUrl + '/dags/' + dagId + '/dagRuns/' + dagRunId + '/taskInstances', params);

			result.result = await response.json();
			if (response.status === 200) {
				result.isSuccessful = true;
				ui.logToOutput("api.getTaskInstances completed");
				return result;
			}
			else {
				ui.showApiErrorMessage('Error !!!', result.result);
				result.isSuccessful = false;
				ui.logToOutput("api.getTaskInstances completed");
				return result;
			}

		} catch (error) {
			ui.showErrorMessage('Error !!!', error);
			result.isSuccessful = false;
			result.error = error;
			ui.logToOutput("api.getTaskInstances Error !!!", error);
			return result;
		}

	}

	public static async getLastDagRunLog(dagId: string): Promise<MethodResult<string>> {
		ui.logToOutput("api.getLastDagRunLog started");
		let result: MethodResult<string> = new MethodResult<any>();
		try {
			let params = {
				method: 'GET',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': 'Basic ' + encode(Api.apiUserName + ":" + Api.apiPassword)
				}
			};

			ui.showInfoMessage('Fecthing Latest DAG Run Logs, wait please ...');

			let response = await fetch(Api.apiUrl + '/dags/' + dagId + '/dagRuns?order_by=-start_date&limit=1', params);

			if (response.status === 200) {
				let dagRunResponse = await response.json();
				let dagRunId = dagRunResponse['dag_runs'][0]['dag_run_id'];
				let responseTaskInstances = await (await fetch(Api.apiUrl + '/dags/' + dagId + '/dagRuns/' + dagRunId + '/taskInstances', params));
				let responseTaskInstancesJson = await responseTaskInstances.json();

				result.result += '###################### BEGINING OF DAG RUN ######################\n\n';
				for (var taskInstance of responseTaskInstancesJson['task_instances']) {
					let responseLogs = await fetch(Api.apiUrl + '/dags/' + dagId + '/dagRuns/' + dagRunId + '/taskInstances/' + taskInstance['task_id'] + '/logs/' + taskInstance['try_number'], params);
					let responseLogsText = await responseLogs.text();
					result.result += '############################################################\n';
					result.result += 'Dag=' + dagId + '\n';
					result.result += 'DagRun=' + dagRunId + '\n';
					result.result += 'TaskId=' + taskInstance['task_id'] + '\n';
					result.result += 'Try=' + taskInstance['try_number'] + '\n';
					result.result += '############################################################\n\n';
					result.result += responseLogsText;
				}
				result.result += '###################### END OF DAG RUN ######################\n\n';
				result.isSuccessful = true;
				ui.logToOutput("api.getLastDagRunLog completed");
				return result;
			}
			else {
				ui.showErrorMessage('Error !!!\n\n' + response.statusText);
				result.isSuccessful = false;
				ui.logToOutput("api.getLastDagRunLog completed");
				return result;
			}

		} catch (error) {
			ui.showErrorMessage('Error !!!', error);
			result.isSuccessful = false;
			result.error = error;
			ui.logToOutput("api.getLastDagRunLog Error !!!", error);
			return result;
		}
	}

	public static async getDagList(): Promise<MethodResult<any>> {
		ui.logToOutput("api.getDagList started");
		let result: MethodResult<any> = new MethodResult<any>();

		try {
			let params = {
				method: 'GET',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': 'Basic ' + encode(Api.apiUserName + ":" + Api.apiPassword)
				}
			};

			let response = await fetch(Api.apiUrl + '/dags', params);

			result.result = await response.json();
			if (response.status === 200) {
				result.isSuccessful = true;
				ui.logToOutput("api.getDagList completed");
				return result;
			}
			else {
				ui.showApiErrorMessage('Error !!!', result.result);
				result.isSuccessful = false;
				ui.logToOutput("api.getDagList completed");
				return result;
			}
		} catch (error) {
			ui.showErrorMessage('Can not connect to Airflow. Please check Url, UserName and Password.', error);
			result.isSuccessful = false;
			result.error = error;
			ui.logToOutput("api.getDagList Error !!!", error);
			return result;
		}
	}

	/*
	{
    "import_errors": [
        {
            "filename": "/opt/airflow/dags/dag_load_error.py",
            "import_error_id": 98,
            "stack_trace": "Traceback (most recent call last):\n  File \"<frozen importlib._bootstrap>\", line 219, in _call_with_frames_removed\n  File \"/opt/airflow/dags/dag_load_error.py\", line 73, in <module>\n    this_will_skip2 >> run_this_last\nNameError: name 'this_will_skip2' is not defined\n",
            "timestamp": "2022-09-21T03:00:58.618426+00:00"
        }
    ],
    "total_entries": 1
	}
	 */
	public static async getImportErrors(): Promise<MethodResult<any>> {
		ui.logToOutput("api.getImportErrors started");
		let result: MethodResult<any> = new MethodResult<any>();

		try {
			let params = {
				method: 'GET',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': 'Basic ' + encode(Api.apiUserName + ":" + Api.apiPassword)
				}
			};

			let response = await fetch(Api.apiUrl + '/importErrors', params);

			result.result = await response.json();
			if (response.status === 200) {
				result.isSuccessful = true;
				ui.logToOutput("api.getImportErrors completed");
				return result;
			}
			else {
				ui.showApiErrorMessage('Error !!!', result.result);
				result.isSuccessful = false;
				ui.logToOutput("api.getImportErrors completed");
				return result;
			}
		} catch (error) {
			ui.showErrorMessage('Can not connect to Airflow. Please check Url, UserName and Password.', error);
			result.isSuccessful = false;
			result.error = error;
			ui.logToOutput("api.getImportErrors Error !!!", error);
			return result;
		}
	}

}