/* eslint-disable @typescript-eslint/naming-convention */
import { encode } from 'base-64';
import { showInfoMessage, showWarningMessage, showErrorMessage } from './ui';
import { MethodResult } from './methodResult';
import fetch from 'node-fetch';

export class Api {

    public static apiUrl: string = '';
    public static apiUserName: string = '';
    public static apiPassword: string = '';

    public static getHeaders() {
        let result = {
                'Content-Type': 'application/json',
                'Authorization': 'Basic ' + encode(Api.apiUserName + ":" + Api.apiPassword)
            };

        return result;
    }

    public static isApiParamsSet(){
        if (!this.apiUrl || !this.apiUserName || !this.apiPassword) {
            showWarningMessage("Please set Api URL, UserName and PassWord"); 
            return false; 
        }
        return true;
    }

    public static async triggerDag(dagId:string, config:string=undefined): Promise<MethodResult<any>> {
		if(!Api.isApiParamsSet()) { return; }

        let result:MethodResult<any> = new MethodResult<any>(); 

        if (!config) {
			config = "{}";
		}

		try {
			let params = {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': 'Basic ' + encode(Api.apiUserName + ":" + Api.apiPassword)
				},
				body: '{"conf": ' + config + '}',
			};

			let response = await fetch(Api.apiUrl + '/dags/' + dagId + '/dagRuns', params);

			if (response.status === 200) {
				var responseTrigger = await response.json();
				
				showInfoMessage(dagId + " Dag Triggered.");

                result.result = responseTrigger;
                result.isSuccessful = true;
                return result;
			}
			else {
				showErrorMessage(dagId + ' Dag Trigger Error !!!\n\n' + response.statusText);
                result.isSuccessful = false;
                return result;
			}
		} catch (error) {
			showErrorMessage(dagId + ' Dag Trigger Error !!!\n\n' + error.message);
            result.isSuccessful = false;
            result.error = error;
            return result;
		}
    }

    public static async getDagRun(dagId:string, dagRunId:string): Promise<MethodResult<any>>  {

        let result:MethodResult<any> = new MethodResult<any>(); 
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

            if (response.status === 200) {
                var responseDagRun = await response.json();
                result.result = responseDagRun;
                result.isSuccessful = true;
                return result;
            }
            else {
                showErrorMessage(dagId + ' Error while fetching DAG status !!!\n\n' + response.statusText);
                result.isSuccessful = false;
                return result;
            }
        } catch (error) {
            showErrorMessage(dagId + ' Dag Trigger Error !!!\n\n' + error.message);
            result.isSuccessful = false;
            result.error = error;
            return result;
        }
    }

    public static async pauseDag(dagId:string, is_paused:boolean=true): Promise<MethodResult<any>>{
        let result:MethodResult<any> = new MethodResult<any>(); 
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

			if (response.status === 200) {
				showInfoMessage(dagId + ' Dag PAUSED');
                result.result = response.json();
                result.isSuccessful = true;
                return result;
			}
			else {
				showErrorMessage('Error !!!\n\n' + response.statusText);
                result.isSuccessful = false;
                return result;
			}

		} catch (error) {
			showErrorMessage('Error !!!', error);
            result.isSuccessful = false;
            result.error = error;
            return result;
		}
    }

    public static async getSourceCode(dagId:string, fileToken:string): Promise<MethodResult<any>> {
        let result:MethodResult<any> = new MethodResult<any>(); 
        try {
			let params = {
				method: 'GET',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': 'Basic ' + encode(Api.apiUserName + ":" + Api.apiPassword)
				}
			};

			let response = await fetch(Api.apiUrl + '/dagSources/' + fileToken, params);

			if (response.status === 200) {
				let sourceCode = await response.text();

                result.result = sourceCode;
                result.isSuccessful = true;
                return result;

			}
			else {
				showErrorMessage('Error !!!\n\n' + response.statusText);
                result.isSuccessful = false;
                return result;
			}

		} catch (error) {
			showErrorMessage('Error !!!\n\n', error);
            result.isSuccessful = false;
            result.error = error;
            return result;
		}
    }

    public static async getDagInfo(dagId:string): Promise<MethodResult<any>>{
        let result:MethodResult<any> = new MethodResult<any>(); 
        try {
			let params = {
				method: 'GET',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': 'Basic ' + encode(Api.apiUserName + ":" + Api.apiPassword)
				}
			};

			let response = await fetch(Api.apiUrl + '/dags/' + dagId + '/details', params);

			if (response.status === 200) {
				result.result= await response.json();
                result.isSuccessful = true;
                return result;
			}
			else {
				showErrorMessage(' Dag Load Error !!!\n\n' + response.statusText);
                result.isSuccessful = false;
                return result;
			}
		} catch (error) {
			showErrorMessage('Can not connect to Airflow. Please check Url, UserName and Password.\n\n' + error.message);
            result.isSuccessful = false;
            result.error = error;
            return result;
		}

    }

    public static async getLastDagRun(dagId:string): Promise<MethodResult<any>>{

        let result:MethodResult<any> = new MethodResult<any>(); 
        try {
			let params = {
				method: 'GET',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': 'Basic ' + encode(Api.apiUserName + ":" + Api.apiPassword)
				}
			};

			let response = await fetch(Api.apiUrl + '/dags/' + dagId + '/dagRuns?order_by=-start_date&limit=1', params);

			if (response.status === 200) {
                result.result= await response.json();
                result.isSuccessful = true;
                return result;
			}
			else {
				showErrorMessage('Error !!!\n\n' + response.statusText);
                result.isSuccessful = false;
                return result;
			}

		} catch (error) {
			showErrorMessage('Error !!!\n\n' + error.message);
            result.isSuccessful = false;
            result.error = error;
            return result;
		}

    }

    public static async getLastDagRunLog(dagId:string): Promise<MethodResult<string>> {
        
        let result:MethodResult<string> = new MethodResult<any>(); 
        try {
			let params = {
				method: 'GET',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': 'Basic ' + encode(Api.apiUserName + ":" + Api.apiPassword)
				}
			};

			showInfoMessage('Fecthing Latest DAG Run Logs, wait please ...');

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
                return result;
			}
			else {
				showErrorMessage('Error !!!\n\n' + response.statusText);
                result.isSuccessful = false;
                return result;
			}

		} catch (error) {
			showErrorMessage('Error !!!\n\n' + error.message);
            result.isSuccessful = false;
            result.error = error;
            return result;
		}
    }

    public static async getDagList(): Promise<MethodResult<any>>{
        let result:MethodResult<any> = new MethodResult<any>(); 

        try {
			let params = {
				method: 'GET',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': 'Basic ' + encode(Api.apiUserName + ":" + Api.apiPassword)
				}
			};

			let response = await fetch(Api.apiUrl + '/dags', params);

			if (response.status === 200) {
				result.result = await response.json();
                result.isSuccessful = true;
                return result;
			}
			else {
				showErrorMessage('Dag Load Error !!!\n\n' + response.statusText);
                result.isSuccessful = false;
                return result;
			}
		} catch (error) {
			showErrorMessage('Can not connect to Airflow. Please check Url, UserName and Password.', error);
            result.isSuccessful = false;
            result.error = error;
            return result;
		}
    }

}