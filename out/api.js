"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Api = void 0;
/* eslint-disable @typescript-eslint/naming-convention */
const base_64_1 = require("base-64");
const ui = require("./ui");
const methodResult_1 = require("./methodResult");
const node_fetch_1 = require("node-fetch");
class Api {
    static async getJwtToken() {
        ui.logToOutput("api.getJwtToken started");
        if (!Api.jwtToken) {
            try {
                let params = {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: '{"username": "' + Api.apiUserName + '", "password": "' + Api.apiPassword + '"}',
                };
                let response = await (0, node_fetch_1.default)(Api.apiUrl.replace("/api/v2", "") + '/auth/token', params);
                let result = await response.json();
                if (response.status === 201) {
                    ui.logToOutput("api.getJwtToken completed");
                    Api.jwtToken = result['access_token'];
                }
                else {
                    ui.showApiErrorMessage('getJwtToken Error !!!', result);
                    ui.logToOutput("api.getJwtToken Error !!!" + result);
                    Api.jwtToken = undefined;
                }
            }
            catch (error) {
                ui.showErrorMessage('getJwtToken Error !!!', error);
                ui.logToOutput("api.getJwtToken Error !!!", error);
                Api.jwtToken = undefined;
            }
        }
        return Api.jwtToken;
    }
    static getAirflowVersion() {
        if (Api.apiUrl.includes("v1")) {
            return "v1";
        }
        else if (Api.apiUrl.includes("v2")) {
            return "v2";
        }
        else {
            return "";
        }
    }
    static async getHeaders() {
        const headers = {
            'Content-Type': 'application/json'
        };
        if (Api.getAirflowVersion() === "v1") {
            headers['Authorization'] = 'Basic ' + (0, base_64_1.encode)(Api.apiUserName + ":" + Api.apiPassword);
        }
        else if (Api.getAirflowVersion() === "v2") {
            const token = await Api.getJwtToken();
            if (token) {
                headers['Authorization'] = 'Bearer ' + token;
            }
            else {
                // no token - leave headers without Authorization
                ui.showWarningMessage('Unable to obtain JWT token for Airflow API v2.');
            }
        }
        return headers;
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
        if (Api.getAirflowVersion() === "v1") {
            return Api.triggerDagV1(dagId, config, date);
        }
        else if (Api.getAirflowVersion() === "v2") {
            return Api.triggerDagV2(dagId, config, date);
        }
        const mr = new methodResult_1.MethodResult();
        mr.isSuccessful = false;
        mr.error = new Error('Unknown Airflow API version');
        return mr;
    }
    static async triggerDagV1(dagId, config = undefined, date = undefined) {
        ui.logToOutput("api.triggerDagV1 started");
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
                headers: await Api.getHeaders(),
                body: '{"conf": ' + config + logicalDateParam + '}',
            };
            let response = await (0, node_fetch_1.default)(Api.apiUrl + '/dags/' + dagId + '/dagRuns', params);
            result.result = await response.json();
            if (response.status === 200) {
                ui.showInfoMessage(dagId + " Dag Triggered.");
                result.isSuccessful = true;
                ui.logToOutput("api.triggerDagV1 completed");
                return result;
            }
            else {
                ui.showApiErrorMessage(dagId + ' Api Call Error !!!', result.result);
                result.isSuccessful = false;
                ui.logToOutput("api.triggerDagV1 completed");
                return result;
            }
        }
        catch (error) {
            ui.showErrorMessage(dagId + ' System Error !!!', error);
            result.isSuccessful = false;
            result.error = error;
            ui.logToOutput("api.triggerDagV1 Error !!!", error);
            return result;
        }
    }
    static async triggerDagV2(dagId, config = undefined, date = undefined) {
        ui.logToOutput("api.triggerDagV2 started");
        if (!Api.isApiParamsSet()) {
            return;
        }
        let result = new methodResult_1.MethodResult();
        if (!config) {
            config = "{}";
        }
        let logicalDateParam = "";
        if (!date) {
            let today = new Date();
            date = today.toISOString();
        }
        else {
            date = date + 'T00:00:00Z';
        }
        logicalDateParam = ', "logical_date": "' + date + '"';
        try {
            let params = {
                method: 'POST',
                headers: await Api.getHeaders(),
                body: '{"conf": ' + config + logicalDateParam + '}',
            };
            let response = await (0, node_fetch_1.default)(Api.apiUrl + '/dags/' + dagId + '/dagRuns', params);
            result.result = await response.json();
            if (response.status === 200) {
                ui.showInfoMessage(dagId + " Dag Triggered.");
                result.isSuccessful = true;
                ui.logToOutput("api.triggerDagV2 completed");
                return result;
            }
            else {
                ui.showApiErrorMessage(dagId + ' Api Call Error !!!', result.result);
                result.isSuccessful = false;
                ui.logToOutput("api.triggerDagV2 completed");
                return result;
            }
        }
        catch (error) {
            ui.showErrorMessage(dagId + ' System Error !!!', error);
            result.isSuccessful = false;
            result.error = error;
            ui.logToOutput("api.triggerDagV2 Error !!!", error);
            return result;
        }
    }
    static async getDagRun(dagId, dagRunId) {
        ui.logToOutput("api.getDagRun started");
        let result = new methodResult_1.MethodResult();
        try {
            let params = {
                method: 'GET',
                headers: await Api.getHeaders()
            };
            //https://airflow.apache.org/api/v1/dags/{dag_id}/dagRuns/{dag_run_id}
            let response = await (0, node_fetch_1.default)(Api.apiUrl + '/dags/' + dagId + '/dagRuns/' + dagRunId, params);
            result.result = await response.json();
            if (response.status === 200) {
                result.isSuccessful = true;
                ui.logToOutput("api.getDagRun completed");
                return result;
            }
            else {
                ui.showApiErrorMessage(dagId + ' Api Call Error !!!', result.result);
                result.isSuccessful = false;
                ui.logToOutput("api.getDagRun completed");
                return result;
            }
        }
        catch (error) {
            ui.showErrorMessage(dagId + ' System Error !!!', error);
            result.isSuccessful = false;
            result.error = error;
            ui.logToOutput("api.getDagRun Error !!!", error);
            return result;
        }
    }
    static async cancelDagRun(dagId, dagRunId) {
        ui.logToOutput("api.cancelDagRun started");
        let result = new methodResult_1.MethodResult();
        try {
            let params = {
                method: 'PATCH',
                headers: await Api.getHeaders(),
                body: JSON.stringify({
                    "state": "failed"
                }),
            };
            //https://airflow.apache.org/api/v1/dags/{dag_id}/dagRuns/{dag_run_id}
            let response = await (0, node_fetch_1.default)(Api.apiUrl + '/dags/' + dagId + '/dagRuns/' + dagRunId, params);
            result.result = await response.json();
            if (response.status === 200) {
                result.isSuccessful = true;
                ui.logToOutput("api.cancelDagRun completed");
                return result;
            }
            else {
                ui.showApiErrorMessage(dagId + ' Api Call Error !!!', result.result);
                result.isSuccessful = false;
                ui.logToOutput("api.cancelDagRun completed");
                return result;
            }
        }
        catch (error) {
            ui.showErrorMessage(dagId + ' System Error !!!', error);
            result.isSuccessful = false;
            result.error = error;
            ui.logToOutput("api.cancelDagRun Error !!!", error);
            return result;
        }
    }
    static async pauseDag(dagId, is_paused = true) {
        ui.logToOutput("api.pauseDag started");
        let result = new methodResult_1.MethodResult();
        try {
            let params = {
                method: 'PATCH',
                headers: await Api.getHeaders(),
                body: JSON.stringify({
                    "is_paused": is_paused
                }),
            };
            let response = await (0, node_fetch_1.default)(Api.apiUrl + '/dags/' + dagId, params);
            result.result = await response.json();
            if (response.status === 200) {
                ui.showInfoMessage(dagId + ' Dag ' + (is_paused ? "PAUSED" : "UN-PAUSED"));
                result.isSuccessful = true;
                ui.logToOutput("api.pauseDag completed");
                return result;
            }
            else {
                ui.showApiErrorMessage(dagId + ' Api Call Error !!!', result.result);
                result.isSuccessful = false;
                ui.logToOutput("api.pauseDag completed");
                return result;
            }
        }
        catch (error) {
            ui.showErrorMessage(dagId + ' System Error !!!', error);
            result.isSuccessful = false;
            result.error = error;
            ui.logToOutput("api.pauseDag Error !!!", error);
            return result;
        }
    }
    static async getSourceCodeV1(dagId, fileToken) {
        ui.logToOutput("api.getSourceCode started");
        let result = new methodResult_1.MethodResult();
        try {
            let params = {
                method: 'GET',
                headers: await Api.getHeaders()
            };
            let response = await (0, node_fetch_1.default)(Api.apiUrl + '/dagSources/' + fileToken, params);
            result.result = await response.text();
            if (response.status === 200) {
                result.isSuccessful = true;
                ui.logToOutput("api.getSourceCode completed");
                return result;
            }
            else {
                ui.showApiErrorMessage(dagId + ' Api Call Error !!!', result.result);
                result.isSuccessful = false;
                ui.logToOutput("api.getSourceCode completed");
                return result;
            }
        }
        catch (error) {
            ui.showErrorMessage(dagId + ' System Error !!!', error);
            result.isSuccessful = false;
            result.error = error;
            ui.logToOutput("api.getSourceCode Error !!!", error);
            return result;
        }
    }
    static async getSourceCodeV2(dagId) {
        ui.logToOutput("api.getSourceCode started");
        let result = new methodResult_1.MethodResult();
        try {
            let params = {
                method: 'GET',
                headers: await Api.getHeaders()
            };
            let response = await (0, node_fetch_1.default)(Api.apiUrl + '/dagSources/' + dagId, params);
            result.result = (await response.json())["content"];
            if (response.status === 200) {
                result.isSuccessful = true;
                ui.logToOutput("api.getSourceCode completed");
                return result;
            }
            else {
                ui.showApiErrorMessage(dagId + ' Api Call Error !!!', result.result);
                result.isSuccessful = false;
                ui.logToOutput("api.getSourceCode completed");
                return result;
            }
        }
        catch (error) {
            ui.showErrorMessage(dagId + ' System Error !!!', error);
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
                headers: await Api.getHeaders()
            };
            let response = await (0, node_fetch_1.default)(Api.apiUrl + '/dags/' + dagId + '/details', params);
            result.result = await response.json();
            if (response.status === 200) {
                result.isSuccessful = true;
                ui.logToOutput("api.getDagInfo completed");
                return result;
            }
            else {
                ui.showApiErrorMessage(dagId + ' Api Call Error !!!', result.result);
                result.isSuccessful = false;
                ui.logToOutput("api.getDagInfo completed");
                return result;
            }
        }
        catch (error) {
            ui.showErrorMessage(dagId + ' System Error !!!', error);
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
                headers: await Api.getHeaders()
            };
            let response = await (0, node_fetch_1.default)(Api.apiUrl + '/dags/' + dagId + '/tasks', params);
            result.result = await response.json();
            if (response.status === 200) {
                result.isSuccessful = true;
                ui.logToOutput("api.getDagTasks completed");
                return result;
            }
            else {
                ui.showApiErrorMessage(dagId + ' Api Call Error !!!', result.result);
                result.isSuccessful = false;
                ui.logToOutput("api.getDagTasks completed");
                return result;
            }
        }
        catch (error) {
            ui.showErrorMessage(dagId + ' System Error !!!', error);
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
                headers: await Api.getHeaders()
            };
            let response = await (0, node_fetch_1.default)(Api.apiUrl + '/dags/' + dagId + '/dagRuns?order_by=-start_date&limit=' + limit, params);
            result.result = await response.json();
            if (response.status === 200) {
                result.isSuccessful = true;
                ui.logToOutput("api.getDagRunHistory completed");
                return result;
            }
            else {
                ui.showApiErrorMessage(dagId + ' Api Call Error !!!', result.result);
                result.isSuccessful = false;
                ui.logToOutput("api.getDagRunHistory completed");
                return result;
            }
        }
        catch (error) {
            ui.showErrorMessage(dagId + ' System Error !!!', error);
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
                headers: await Api.getHeaders()
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
                ui.showApiErrorMessage(dagId + ' Api Call Error !!!', result.result);
                result.isSuccessful = false;
                ui.logToOutput("api.getTaskInstances completed");
                return result;
            }
        }
        catch (error) {
            ui.showErrorMessage(dagId + ' System Error !!!', error);
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
                headers: await Api.getHeaders()
            };
            ui.showInfoMessage('Fecthing Latest DAG Run Logs, wait please ...');
            let response = await (0, node_fetch_1.default)(Api.apiUrl + '/dags/' + dagId + '/dagRuns?order_by=-start_date&limit=1', params);
            if (response.status === 200) {
                let dagRunResponse = await response.json();
                let dagRunId = dagRunResponse['dag_runs'][0]['dag_run_id'];
                let responseTaskInstances = await (await (0, node_fetch_1.default)(Api.apiUrl + '/dags/' + dagId + '/dagRuns/' + dagRunId + '/taskInstances', params));
                let responseTaskInstancesJson = await responseTaskInstances.json();
                result.result = '###################### BEGINING OF DAG RUN ######################\n\n';
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
                result.result += '\n\n###################### END OF DAG RUN ######################\n\n';
                result.isSuccessful = true;
                ui.logToOutput("api.getLastDagRunLog completed");
                return result;
            }
            else {
                ui.showErrorMessage('Error !!!\n' + response.statusText);
                result.isSuccessful = false;
                ui.logToOutput("api.getLastDagRunLog completed");
                return result;
            }
        }
        catch (error) {
            ui.showErrorMessage(dagId + ' System Error !!!', error);
            result.isSuccessful = false;
            result.error = error;
            ui.logToOutput("api.getLastDagRunLog Error !!!", error);
            return result;
        }
    }
    static async getTaskInstanceLog(dagId, dagRunId, taskId) {
        ui.logToOutput("api.getTaskInstanceLog started");
        let result = new methodResult_1.MethodResult();
        try {
            let params = {
                method: 'GET',
                headers: await Api.getHeaders()
            };
            ui.showInfoMessage('Fecthing Latest DAG Run Logs, wait please ...');
            let responseTaskInstances = await (await (0, node_fetch_1.default)(Api.apiUrl + '/dags/' + dagId + '/dagRuns/' + dagRunId + '/taskInstances', params));
            let responseTaskInstancesJson = await responseTaskInstances.json();
            result.result = '';
            for (var taskInstance of responseTaskInstancesJson['task_instances']) {
                if (taskInstance['task_id'] !== taskId) {
                    continue;
                }
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
            result.result += '';
            result.isSuccessful = true;
            ui.logToOutput("api.getTaskInstanceLog completed");
            return result;
        }
        catch (error) {
            ui.showErrorMessage(dagId + ' System Error !!!', error);
            result.isSuccessful = false;
            result.error = error;
            ui.logToOutput("api.getTaskInstanceLog Error !!!", error);
            return result;
        }
    }
    static async getDagList() {
        ui.logToOutput("api.getDagList started");
        let result = new methodResult_1.MethodResult();
        let allDags = [];
        let offset = 0;
        const limit = 100;
        try {
            while (true) {
                let params = {
                    method: 'GET',
                    headers: await Api.getHeaders()
                };
                let response = await (0, node_fetch_1.default)(`${Api.apiUrl}/dags?limit=${limit}&offset=${offset}`, params);
                let data = await response.json();
                if (response.status === 200) {
                    allDags.push(...data["dags"]);
                    if (data["dags"].length < limit) {
                        break; // Stop fetching if fewer than 100 DAGs are returned
                    }
                    offset += limit; // Move to the next batch
                }
                else {
                    ui.showApiErrorMessage('Api Call Error !!!', data);
                    result.isSuccessful = false;
                    ui.logToOutput("api.getDagList completed with error");
                    return result;
                }
            }
            result.result = allDags;
            result.isSuccessful = true;
            ui.logToOutput("api.getDagList completed successfully");
            return result;
        }
        catch (error) {
            ui.showErrorMessage('Can not connect to Airflow. Please check URL, Username, and Password.\n', error);
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
    static async getImportErrors() {
        ui.logToOutput("api.getImportErrors started");
        let result = new methodResult_1.MethodResult();
        try {
            let params = {
                method: 'GET',
                headers: await Api.getHeaders()
            };
            let response = await (0, node_fetch_1.default)(Api.apiUrl + '/importErrors', params);
            result.result = await response.json();
            if (response.status === 200) {
                result.isSuccessful = true;
                ui.logToOutput("api.getImportErrors completed");
                return result;
            }
            else {
                ui.showApiErrorMessage('Api Call Error !!!', result.result);
                result.isSuccessful = false;
                ui.logToOutput("api.getImportErrors completed");
                return result;
            }
        }
        catch (error) {
            ui.showErrorMessage('System Error !!!', error);
            result.isSuccessful = false;
            result.error = error;
            ui.logToOutput("api.getImportErrors Error !!!", error);
            return result;
        }
    }
}
exports.Api = Api;
Api.apiUrl = '';
Api.apiUserName = '';
Api.apiPassword = '';
Api.jwtToken = undefined;
//# sourceMappingURL=api.js.map