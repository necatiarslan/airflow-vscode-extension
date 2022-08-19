"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Api = void 0;
/* eslint-disable @typescript-eslint/naming-convention */
const base_64_1 = require("base-64");
const ui = require("./ui");
const methodResult_1 = require("./methodResult");
const node_fetch_1 = require("node-fetch");
class Api {
    static getHeaders() {
        ui.logToOutput("api.getHeaders started");
        let result = {
            'Content-Type': 'application/json',
            'Authorization': 'Basic ' + (0, base_64_1.encode)(Api.apiUserName + ":" + Api.apiPassword)
        };
        ui.logToOutput("api.getHeaders completed");
        return result;
    }
    static isApiParamsSet() {
        if (!this.apiUrl || !this.apiUserName || !this.apiPassword) {
            ui.showWarningMessage("Please set Api URL, UserName and PassWord");
            return false;
        }
        return true;
    }
    static async triggerDag(dagId, config = undefined, date = undefined) {
        ui.logToOutput("api.triggerDag started");
        if (!Api.isApiParamsSet()) {
            return;
        }
        let result = new methodResult_1.MethodResult();
        if (!config) {
            config = "{}";
        }
        let logicalDateParam = "";
        if (date) {
            logicalDateParam = ', "logical_date": "' + date + 'T00:00:00Z",';
        }
        try {
            let params = {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Basic ' + (0, base_64_1.encode)(Api.apiUserName + ":" + Api.apiPassword)
                },
                body: '{"conf": ' + config + logicalDateParam + '}',
            };
            let response = await (0, node_fetch_1.default)(Api.apiUrl + '/dags/' + dagId + '/dagRuns', params);
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
        }
        catch (error) {
            ui.showErrorMessage(dagId + ' Dag Trigger Error !!!', error);
            result.isSuccessful = false;
            result.error = error;
            ui.logToOutput("api.triggerDag Error !!!", error);
            return result;
        }
    }
    static async getDagRun(dagId, dagRunId) {
        ui.logToOutput("api.getDagRun started");
        let result = new methodResult_1.MethodResult();
        try {
            let params = {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Basic ' + (0, base_64_1.encode)(Api.apiUserName + ":" + Api.apiPassword)
                }
            };
            //https://airflow.apache.org/api/v1/dags/{dag_id}/dagRuns/{dag_run_id}
            let response = await (0, node_fetch_1.default)(Api.apiUrl + '/dags/' + dagId + '/dagRuns/' + dagRunId, params);
            var responseDagRun = await response.json();
            if (response.status === 200) {
                result.result = responseDagRun;
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
        }
        catch (error) {
            ui.showErrorMessage(dagId + ' Dag Trigger Error !!!\n\n' + error.message);
            result.isSuccessful = false;
            result.error = error;
            ui.logToOutput("api.getDagRun Error !!!", error);
            return result;
        }
    }
    static async pauseDag(dagId, is_paused = true) {
        ui.logToOutput("api.pauseDag started");
        let result = new methodResult_1.MethodResult();
        try {
            let params = {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Basic ' + (0, base_64_1.encode)(Api.apiUserName + ":" + Api.apiPassword)
                },
                body: JSON.stringify({
                    "is_paused": is_paused
                }),
            };
            let response = await (0, node_fetch_1.default)(Api.apiUrl + '/dags/' + dagId, params);
            result.result = response.json();
            if (response.status === 200) {
                ui.showInfoMessage(dagId + ' Dag PAUSED');
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
        }
        catch (error) {
            ui.showErrorMessage('Error !!!', error);
            result.isSuccessful = false;
            result.error = error;
            ui.logToOutput("api.pauseDag Error !!!", error);
            return result;
        }
    }
    static async getSourceCode(dagId, fileToken) {
        ui.logToOutput("api.getSourceCode started");
        let result = new methodResult_1.MethodResult();
        try {
            let params = {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Basic ' + (0, base_64_1.encode)(Api.apiUserName + ":" + Api.apiPassword)
                }
            };
            let response = await (0, node_fetch_1.default)(Api.apiUrl + '/dagSources/' + fileToken, params);
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
        }
        catch (error) {
            ui.showErrorMessage('Error !!!\n\n', error);
            result.isSuccessful = false;
            result.error = error;
            ui.logToOutput("api.getSourceCode Error !!!", error);
            return result;
        }
    }
    static async getDagInfo(dagId) {
        ui.logToOutput("api.getDagInfo started");
        let result = new methodResult_1.MethodResult();
        try {
            let params = {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Basic ' + (0, base_64_1.encode)(Api.apiUserName + ":" + Api.apiPassword)
                }
            };
            let response = await (0, node_fetch_1.default)(Api.apiUrl + '/dags/' + dagId + '/details', params);
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
        }
        catch (error) {
            ui.showErrorMessage('Can not connect to Airflow. Please check Url, UserName and Password.\n\n' + error.message);
            result.isSuccessful = false;
            result.error = error;
            ui.logToOutput("api.getDagInfo Error !!!", error);
            return result;
        }
    }
    static async getDagTasks(dagId) {
        ui.logToOutput("api.getDagTasks started");
        let result = new methodResult_1.MethodResult();
        try {
            let params = {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Basic ' + (0, base_64_1.encode)(Api.apiUserName + ":" + Api.apiPassword)
                }
            };
            let response = await (0, node_fetch_1.default)(Api.apiUrl + '/dags/' + dagId + '/tasks', params);
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
        }
        catch (error) {
            ui.showErrorMessage('Error !!!\n\n', error);
            result.isSuccessful = false;
            result.error = error;
            ui.logToOutput("api.getDagTasks Error !!!", error);
            return result;
        }
    }
    static async getLastDagRun(dagId) {
        ui.logToOutput("api.getLastDagRun started");
        let result = await this.getDagRunHistory(dagId, 1);
        if (result.isSuccessful && Object.keys(result.result.dag_runs).length > 0) {
            return this.getDagRun(dagId, result.result.dag_runs[0].dag_run_id);
        }
        else {
            result.isSuccessful = false;
            result.result = undefined;
            result.error = new Error('No Dag Run Found for ' + dagId);
            return result;
        }
    }
    static async getDagRunHistory(dagId, limit) {
        ui.logToOutput("api.getDagRunHistory started");
        let result = new methodResult_1.MethodResult();
        try {
            let params = {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Basic ' + (0, base_64_1.encode)(Api.apiUserName + ":" + Api.apiPassword)
                }
            };
            let response = await (0, node_fetch_1.default)(Api.apiUrl + '/dags/' + dagId + '/dagRuns?order_by=-start_date&limit=' + limit, params);
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
        }
        catch (error) {
            ui.showErrorMessage('Error !!!', error);
            result.isSuccessful = false;
            result.error = error;
            ui.logToOutput("api.getDagRunHistory Error !!!", error);
            return result;
        }
    }
    static async getTaskInstances(dagId, dagRunId) {
        ui.logToOutput("api.getTaskInstances started");
        let result = new methodResult_1.MethodResult();
        try {
            let params = {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Basic ' + (0, base_64_1.encode)(Api.apiUserName + ":" + Api.apiPassword)
                }
            };
            //https://airflow.apache.org/api/v1/dags/{dag_id}/dagRuns/{dag_run_id}/taskInstances
            let response = await (0, node_fetch_1.default)(Api.apiUrl + '/dags/' + dagId + '/dagRuns/' + dagRunId + '/taskInstances', params);
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
        }
        catch (error) {
            ui.showErrorMessage('Error !!!', error);
            result.isSuccessful = false;
            result.error = error;
            ui.logToOutput("api.getTaskInstances Error !!!", error);
            return result;
        }
    }
    static async getLastDagRunLog(dagId) {
        ui.logToOutput("api.getLastDagRunLog started");
        let result = new methodResult_1.MethodResult();
        try {
            let params = {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Basic ' + (0, base_64_1.encode)(Api.apiUserName + ":" + Api.apiPassword)
                }
            };
            ui.showInfoMessage('Fecthing Latest DAG Run Logs, wait please ...');
            let response = await (0, node_fetch_1.default)(Api.apiUrl + '/dags/' + dagId + '/dagRuns?order_by=-start_date&limit=1', params);
            if (response.status === 200) {
                let dagRunResponse = await response.json();
                let dagRunId = dagRunResponse['dag_runs'][0]['dag_run_id'];
                let responseTaskInstances = await (await (0, node_fetch_1.default)(Api.apiUrl + '/dags/' + dagId + '/dagRuns/' + dagRunId + '/taskInstances', params));
                let responseTaskInstancesJson = await responseTaskInstances.json();
                result.result += '###################### BEGINING OF DAG RUN ######################\n\n';
                for (var taskInstance of responseTaskInstancesJson['task_instances']) {
                    let responseLogs = await (0, node_fetch_1.default)(Api.apiUrl + '/dags/' + dagId + '/dagRuns/' + dagRunId + '/taskInstances/' + taskInstance['task_id'] + '/logs/' + taskInstance['try_number'], params);
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
        }
        catch (error) {
            ui.showErrorMessage('Error !!!', error);
            result.isSuccessful = false;
            result.error = error;
            ui.logToOutput("api.getLastDagRunLog Error !!!", error);
            return result;
        }
    }
    static async getDagList() {
        ui.logToOutput("api.getDagList started");
        let result = new methodResult_1.MethodResult();
        try {
            let params = {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Basic ' + (0, base_64_1.encode)(Api.apiUserName + ":" + Api.apiPassword)
                }
            };
            let response = await (0, node_fetch_1.default)(Api.apiUrl + '/dags', params);
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
        }
        catch (error) {
            ui.showErrorMessage('Can not connect to Airflow. Please check Url, UserName and Password.', error);
            result.isSuccessful = false;
            result.error = error;
            ui.logToOutput("api.getDagList Error !!!", error);
            return result;
        }
    }
}
exports.Api = Api;
Api.apiUrl = '';
Api.apiUserName = '';
Api.apiPassword = '';
//# sourceMappingURL=api.js.map