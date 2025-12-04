/******/ (() => { // webpackBootstrap
/******/ 	var __webpack_modules__ = ([
/* 0 */,
/* 1 */
/***/ ((module) => {

"use strict";
module.exports = require("vscode");

/***/ }),
/* 2 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.DagTreeView = void 0;
/* eslint-disable @typescript-eslint/naming-convention */
const vscode = __webpack_require__(1);
const DagView_1 = __webpack_require__(3);
const DagTreeDataProvider_1 = __webpack_require__(10);
const DagRunView_1 = __webpack_require__(12);
const ui = __webpack_require__(4);
const Api_1 = __webpack_require__(13);
class DagTreeView {
    constructor(context) {
        this.filterString = '';
        this.ShowOnlyActive = true;
        this.ShowOnlyFavorite = false;
        this.ServerList = [];
        ui.logToOutput('DagTreeView.constructor Started');
        this.context = context;
        this.treeDataProvider = new DagTreeDataProvider_1.DagTreeDataProvider();
        this.view = vscode.window.createTreeView('dagTreeView', { treeDataProvider: this.treeDataProvider, showCollapseAll: true });
        this.loadState();
        context.subscriptions.push(this.view);
        context.subscriptions.push({ dispose: () => this.dispose() });
        DagTreeView.Current = this;
        this.setFilterMessage();
        this.refresh();
    }
    dispose() {
        ui.logToOutput('DagTreeView.dispose Started');
        if (this.dagStatusInterval) {
            clearInterval(this.dagStatusInterval);
        }
    }
    async refresh() {
        ui.logToOutput('DagTreeView.refresh Started');
        if (!this.api) {
            this.treeDataProvider.dagList = [];
            this.treeDataProvider.refresh();
            return;
        }
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Window,
            title: "Airflow: Loading...",
        }, async (progress) => {
            progress.report({ increment: 0 });
            await this.loadDags();
        });
        await this.getImportErrors();
    }
    resetView() {
        ui.logToOutput('DagTreeView.resetView Started');
        this.api = undefined;
        this.currentServer = undefined;
        this.filterString = '';
        this.treeDataProvider.dagList = undefined;
        this.treeDataProvider.refresh();
        this.setViewTitle();
        this.saveState();
        this.refresh();
    }
    viewDagView(node) {
        ui.logToOutput('DagTreeView.viewDagView Started');
        if (this.api) {
            DagView_1.DagView.render(this.context.extensionUri, node.DagId, this.api);
        }
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
        if (!this.api) {
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
        const result = await this.api.triggerDag(node.DagId);
        if (result.isSuccessful) {
            const responseTrigger = result.result;
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
        if (!dagTreeView.api) {
            return;
        }
        let noDagIsRunning = true;
        for (const node of dagTreeView.treeDataProvider.visibleDagList) {
            if (node.isDagRunning()) {
                noDagIsRunning = false;
                const result = await dagTreeView.api.getDagRun(node.DagId, node.LatestDagRunId);
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
            dagTreeView.dagStatusInterval = undefined;
            ui.showInfoMessage('All Dag Run(s) Completed');
            ui.logToOutput('All Dag Run(s) Completed');
        }
    }
    async triggerDagWConfig(node) {
        ui.logToOutput('DagTreeView.triggerDagWConfig Started');
        if (!this.api) {
            return;
        }
        let triggerDagConfig = await vscode.window.showInputBox({ placeHolder: 'Enter Configuration JSON (Optional, must be a dict object) or Press Enter' });
        if (!triggerDagConfig) {
            triggerDagConfig = "{}";
        }
        if (triggerDagConfig !== undefined) {
            const result = await this.api.triggerDag(node.DagId, triggerDagConfig);
            if (result.isSuccessful) {
                const responseTrigger = result.result;
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
        for (const node of this.treeDataProvider.visibleDagList) {
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
        for (const node of this.treeDataProvider.visibleDagList) {
            if (node.DagId === dagId) {
                this.checkDagRunState(node);
            }
        }
    }
    async checkDagRunState(node) {
        ui.logToOutput('DagTreeView.checkDagRunState Started');
        if (!this.api) {
            return;
        }
        if (!node) {
            return;
        }
        if (node.IsPaused) {
            ui.showWarningMessage(node.DagId + 'Dag is PAUSED');
            return;
        }
        const result = await this.api.getLastDagRun(node.DagId);
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
        if (!this.api) {
            return;
        }
        if (node.IsPaused) {
            ui.showWarningMessage(node.DagId + 'Dag is already PAUSED');
            return;
        }
        const result = await this.api.pauseDag(node.DagId, true);
        if (result.isSuccessful) {
            node.IsPaused = true;
            node.refreshUI();
            this.treeDataProvider.refresh();
        }
    }
    async notifyDagPaused(dagId) {
        ui.logToOutput('DagTreeView.notifyDagPaused Started');
        this.refresh();
    }
    async notifyDagUnPaused(dagId) {
        ui.logToOutput('DagTreeView.notifyDagPaused Started');
        this.refresh();
    }
    async unPauseDAG(node) {
        ui.logToOutput('DagTreeView.unPauseDAG Started');
        if (!this.api) {
            return;
        }
        if (!node.IsPaused) {
            ui.showInfoMessage(node.DagId + 'Dag is already UNPAUSED');
            return;
        }
        const result = await this.api.pauseDag(node.DagId, false);
        if (result.isSuccessful) {
            node.IsPaused = false;
            node.refreshUI();
            this.treeDataProvider.refresh();
        }
    }
    async lastDAGRunLog(node) {
        ui.logToOutput('DagTreeView.lastDAGRunLog Started');
        if (!this.api) {
            return;
        }
        const result = await this.api.getLastDagRunLog(node.DagId);
        if (result.isSuccessful) {
            const tmp = __webpack_require__(7);
            const fs = __webpack_require__(5);
            const tmpFile = tmp.fileSync({ mode: 0o644, prefix: node.DagId, postfix: '.log' });
            fs.appendFileSync(tmpFile.name, result.result);
            ui.openFile(tmpFile.name);
        }
    }
    async dagSourceCode(node) {
        ui.logToOutput('DagTreeView.dagSourceCode Started');
        if (!this.api) {
            return;
        }
        const result = await this.api.getSourceCode(node.DagId, node.FileToken);
        if (result.isSuccessful) {
            const tmp = __webpack_require__(7);
            const fs = __webpack_require__(5);
            const tmpFile = tmp.fileSync({ mode: 0o644, prefix: node.DagId, postfix: '.py' });
            fs.appendFileSync(tmpFile.name, result.result);
            ui.openFile(tmpFile.name);
        }
        else {
            ui.logToOutput(result.result);
            ui.showErrorMessage(result.result);
        }
    }
    async showDagInfo(node) {
        ui.logToOutput('DagTreeView.showDagInfo Started');
        if (!this.api) {
            return;
        }
        const result = await this.api.getDagInfo(node.DagId);
        if (result.isSuccessful) {
            const tmp = __webpack_require__(7);
            const fs = __webpack_require__(5);
            const tmpFile = tmp.fileSync({ mode: 0o644, prefix: node.DagId + '_info', postfix: '.json' });
            fs.appendFileSync(tmpFile.name, JSON.stringify(result.result, null, 2));
            ui.openFile(tmpFile.name);
        }
        else {
            ui.logToOutput(result.result);
            ui.showErrorMessage('Failed to fetch DAG info');
        }
    }
    async aIHandler(request, context, stream, token) {
        const aiContext = DagTreeView.Current?.askAIContext;
        // 1. Define the tools we want to expose to the model
        // These must match the definitions in package.json
        const tools = [
            {
                name: 'list_active_dags',
                description: 'Lists all Airflow DAGs that are currently active (not paused). Returns a list of DAG IDs and their details.',
                inputSchema: {
                    type: 'object',
                    properties: {},
                    required: []
                }
            },
            {
                name: 'list_paused_dags',
                description: 'Lists all Airflow DAGs that are currently paused. Returns a list of DAG IDs and their details.',
                inputSchema: {
                    type: 'object',
                    properties: {},
                    required: []
                }
            },
            {
                name: 'pause_dag',
                description: 'Pauses a specific Airflow DAG. Required input: dag_id (string).',
                inputSchema: {
                    type: 'object',
                    properties: {
                        dag_id: { type: 'string', description: 'The unique identifier (ID) of the DAG to pause' }
                    },
                    required: ['dag_id']
                }
            },
            {
                name: 'unpause_dag',
                description: 'Unpauses (activates) a specific Airflow DAG. Required input: dag_id (string).',
                inputSchema: {
                    type: 'object',
                    properties: {
                        dag_id: { type: 'string', description: 'The unique identifier (ID) of the DAG to unpause' }
                    },
                    required: ['dag_id']
                }
            },
            {
                name: 'trigger_dag_run',
                description: 'Triggers a DAG run. Inputs: dag_id (string), config_json (string, optional), date (string, optional).',
                inputSchema: {
                    type: 'object',
                    properties: {
                        dag_id: { type: 'string', description: 'The DAG ID' },
                        config_json: { type: 'string', description: 'JSON configuration or file path' },
                        date: { type: 'string', description: 'Logical date in ISO 8601 format' }
                    },
                    required: ['dag_id']
                }
            },
            {
                name: 'get_failed_runs',
                description: 'Gets failed DAG runs. Inputs: time_range_hours (number), dag_id_filter (string).',
                inputSchema: {
                    type: 'object',
                    properties: {
                        time_range_hours: { type: 'number' },
                        dag_id_filter: { type: 'string' }
                    },
                    required: []
                }
            },
            {
                name: 'get_dag_runs',
                description: 'Retrieves DAG runs for a given DAG. Optional date (YYYY-MM-DD). Returns run id, start time, duration, status.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        dag_id: { type: 'string', description: 'The DAG ID' },
                        date: { type: 'string', description: 'Optional date filter YYYY-MM-DD' }
                    },
                    required: ['dag_id']
                }
            },
            {
                name: 'get_dag_history',
                description: 'Retrieves DAG run history for a given date (defaults to today). Returns date/time, status, duration, note.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        dag_id: { type: 'string', description: 'The DAG ID' },
                        date: { type: 'string', description: 'Optional date filter YYYY-MM-DD' }
                    },
                    required: ['dag_id']
                }
            },
            {
                name: 'stop_dag_run',
                description: 'Stops the currently running DAG run for the given DAG. Required: dag_id.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        dag_id: { type: 'string', description: 'The DAG ID' }
                    },
                    required: ['dag_id']
                }
            },
            {
                name: 'analyse_dag_latest_run',
                description: 'Comprehensive analysis of the latest DAG run including tasks, source code, and logs. Required: dag_id.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        dag_id: { type: 'string', description: 'The DAG ID' }
                    },
                    required: ['dag_id']
                }
            }
        ];
        // 2. Construct the Initial Messages
        const messages = [
            vscode.LanguageModelChatMessage.User(`You are an expert in Apache Airflow. You have access to tools to manage DAGs, view logs, and check status. Use them when appropriate.`)
        ];
        // Add context if available
        if (aiContext) {
            messages.push(vscode.LanguageModelChatMessage.User(`Context:\nDAG: ${aiContext.dag || 'N/A'}\nLogs: ${aiContext.logs || 'N/A'}\nCode: ${aiContext.code || 'N/A'}`));
        }
        messages.push(vscode.LanguageModelChatMessage.User(request.prompt));
        // 3. Select Model and Send Request
        try {
            const [model] = await vscode.lm.selectChatModels({ family: 'gpt-4' });
            if (!model) {
                stream.markdown("No suitable AI model found.");
                return;
            }
            // Tool calling loop
            let keepGoing = true;
            while (keepGoing && !token.isCancellationRequested) {
                keepGoing = false; // Default to stop unless we get a tool call
                const chatResponse = await model.sendRequest(messages, { tools }, token);
                let toolCalls = [];
                for await (const fragment of chatResponse.text) {
                    stream.markdown(fragment);
                }
                // Collect tool calls from the response
                for await (const part of chatResponse.stream) {
                    if (part instanceof vscode.LanguageModelToolCallPart) {
                        toolCalls.push(part);
                    }
                }
                // Execute tools if any were called
                if (toolCalls.length > 0) {
                    keepGoing = true; // We need to send results back to the model
                    // Add the model's response (including tool calls) to history
                    messages.push(vscode.LanguageModelChatMessage.Assistant(toolCalls));
                    for (const toolCall of toolCalls) {
                        stream.progress(`Running tool: ${toolCall.name}...`);
                        try {
                            // Invoke the tool using VS Code LM API
                            const result = await vscode.lm.invokeTool(toolCall.name, { input: toolCall.input }, token);
                            // Convert result to string/text part
                            const resultText = result.content
                                .filter(part => part instanceof vscode.LanguageModelTextPart)
                                .map(part => part.value)
                                .join('\n');
                            // Add result to history
                            messages.push(vscode.LanguageModelChatMessage.User([
                                new vscode.LanguageModelToolResultPart(toolCall.callId, [new vscode.LanguageModelTextPart(resultText)])
                            ]));
                        }
                        catch (err) {
                            const errorMessage = `Tool execution failed: ${err instanceof Error ? err.message : String(err)}`;
                            messages.push(vscode.LanguageModelChatMessage.User([
                                new vscode.LanguageModelToolResultPart(toolCall.callId, [new vscode.LanguageModelTextPart(errorMessage)])
                            ]));
                        }
                    }
                }
            }
        }
        catch (err) {
            if (err instanceof Error) {
                stream.markdown(`I'm sorry, I couldn't connect to the AI model: ${err.message}`);
            }
            else {
                stream.markdown("I'm sorry, I couldn't connect to the AI model.");
            }
        }
    }
    ;
    async isChatCommandAvailable() {
        const commands = await vscode.commands.getCommands(true); // 'true' includes internal commands
        return commands.includes('workbench.action.chat.open');
    }
    async askAI(node) {
        ui.logToOutput('DagTreeView.askAI Started');
        if (!this.api) {
            return;
        }
        if (!await this.isChatCommandAvailable()) {
            ui.showErrorMessage('Chat command is not available. Please ensure you have access to VS Code AI features.');
            return;
        }
        let dagSourceCode = '';
        let latestDagLogs = '';
        // Fetch DAG Source Code
        const sourceResult = await this.api.getSourceCode(node.DagId, node.FileToken);
        if (sourceResult.isSuccessful) {
            dagSourceCode = sourceResult.result;
        }
        else {
            ui.showErrorMessage('Failed to fetch DAG source code for AI analysis.');
            return;
        }
        // Fetch Latest DAG Run Logs
        const logResult = await this.api.getLastDagRunLog(node.DagId);
        if (logResult.isSuccessful) {
            latestDagLogs = logResult.result;
        }
        else {
            ui.showErrorMessage('Failed to fetch latest DAG run logs for AI analysis.');
            return;
        }
        await this.askAIWithContext({ code: dagSourceCode, logs: latestDagLogs, dag: node.DagId, dagRun: node.LatestDagRunId, tasks: null, taskInstances: null });
    }
    async askAIWithContext(askAIContext) {
        this.askAIContext = askAIContext;
        const appName = vscode.env.appName;
        let commandId = '';
        if (appName.includes('Antigravity')) {
            // Antigravity replaces the Chat with an Agent workflow.
            // We must use the Agent Manager command instead.
            // **REPLACE WITH THE ACTUAL ANTIGRAVITY AGENT COMMAND ID**
            commandId = 'antigravity.startAgentTask';
        }
        else if (appName.includes('Code - OSS') || appName.includes('Visual Studio Code')) {
            // This is standard VS Code or VSCodium. Check for the legacy Chat command.
            commandId = 'workbench.action.chat.open';
        }
        else {
            // Unknown environment, default to checking if the command exists at all.
            commandId = 'workbench.action.chat.open';
        }
        await vscode.commands.executeCommand(commandId, {
            query: '@airflow Analyze the current logs'
        });
    }
    async filter() {
        ui.logToOutput('DagTreeView.filter Started');
        const filterStringTemp = await vscode.window.showInputBox({ value: this.filterString, placeHolder: 'Enter your filters seperated by comma' });
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
        const apiUrlTemp = await vscode.window.showInputBox({ value: 'http://localhost:8080/api/v2', placeHolder: 'API Full URL (Exp:http://localhost:8080/api/v1)' });
        if (!apiUrlTemp) {
            return;
        }
        const userNameTemp = await vscode.window.showInputBox({ placeHolder: 'User Name' });
        if (!userNameTemp) {
            return;
        }
        const passwordTemp = await vscode.window.showInputBox({ placeHolder: 'Password' });
        if (!passwordTemp) {
            return;
        }
        const newServer = { apiUrl: apiUrlTemp, apiUserName: userNameTemp, apiPassword: passwordTemp };
        this.ServerList.push(newServer);
        let api = new Api_1.AirflowApi(newServer);
        let result = await api.checkConnection();
        if (!result) {
            ui.showErrorMessage("Failed to connect to server.");
            return;
        }
        this.currentServer = newServer;
        this.api = api;
        this.saveState();
        this.refresh();
    }
    async removeServer() {
        ui.logToOutput('DagTreeView.removeServer Started');
        if (this.ServerList.length === 0) {
            return;
        }
        const items = this.ServerList.map(s => `${s.apiUrl} - ${s.apiUserName}`);
        const selected = await vscode.window.showQuickPick(items, { canPickMany: false, placeHolder: 'Select To Remove' });
        if (!selected) {
            return;
        }
        const selectedItems = selected.split(' - ');
        if (selectedItems[0]) {
            this.ServerList = this.ServerList.filter(item => !(item.apiUrl === selectedItems[0] && item.apiUserName === selectedItems[1]));
            // If we removed the current server, reset
            if (this.currentServer && this.currentServer.apiUrl === selectedItems[0] && this.currentServer.apiUserName === selectedItems[1]) {
                this.currentServer = undefined;
                this.api = undefined;
                this.treeDataProvider.dagList = undefined;
                this.treeDataProvider.refresh();
            }
            this.saveState();
            ui.showInfoMessage("Server removed.");
        }
    }
    async connectServer() {
        ui.logToOutput('DagTreeView.connectServer Started');
        if (this.ServerList.length === 0) {
            this.addServer();
            return;
        }
        const items = [];
        for (const s of this.ServerList) {
            items.push(s.apiUrl + " - " + s.apiUserName);
        }
        const selected = await vscode.window.showQuickPick(items, { canPickMany: false, placeHolder: 'Select To Connect' });
        if (!selected) {
            return;
        }
        const selectedItems = selected.split(' - ');
        if (selectedItems[0]) {
            const item = this.ServerList.find(item => item.apiUrl === selectedItems[0] && item.apiUserName === selectedItems[1]);
            if (item) {
                let api = new Api_1.AirflowApi(item);
                let result = await api.checkConnection();
                if (result) {
                    this.currentServer = item;
                    this.api = new Api_1.AirflowApi(this.currentServer);
                    this.saveState();
                    this.refresh();
                }
                else {
                    ui.showErrorMessage("Failed to connect to server.");
                }
            }
        }
    }
    async clearServers() {
        ui.logToOutput('DagTreeView.clearServers Started');
        this.ServerList = [];
        this.currentServer = undefined;
        this.api = undefined;
        this.treeDataProvider.dagList = undefined;
        this.treeDataProvider.refresh();
        this.saveState();
        ui.showInfoMessage("Server List Cleared");
    }
    async loadDags() {
        ui.logToOutput('DagTreeView.loadDags Started');
        if (!this.api) {
            return;
        }
        this.treeDataProvider.dagList = undefined;
        const result = await this.api.getDagList();
        if (result.isSuccessful) {
            this.treeDataProvider.dagList = result.result;
            this.treeDataProvider.loadDagTreeItemsFromApiResponse();
            // Fetch latest run status for each DAG
            await this.loadLatestRunStatusForAllDags();
        }
        this.treeDataProvider.refresh();
        this.setViewTitle();
    }
    async loadLatestRunStatusForAllDags() {
        ui.logToOutput('DagTreeView.loadLatestRunStatusForAllDags Started');
        if (!this.api) {
            return;
        }
        // Fetch latest run status for each visible DAG (limit to avoid too many API calls)
        const visibleDags = this.treeDataProvider.visibleDagList.slice(0, 50); // Limit to first 50 DAGs
        for (const dagItem of visibleDags) {
            if (!dagItem.IsPaused) {
                try {
                    const runResult = await this.api.getLastDagRun(dagItem.DagId);
                    if (runResult.isSuccessful && runResult.result) {
                        dagItem.LatestDagRunId = runResult.result.dag_run_id;
                        dagItem.LatestDagState = runResult.result.state;
                        dagItem.refreshUI();
                    }
                }
                catch (error) {
                    // Silently continue if a DAG's last run can't be fetched
                    ui.logToOutput(`Failed to fetch last run for ${dagItem.DagId}`, error);
                }
            }
        }
        this.treeDataProvider.refresh();
    }
    async setViewTitle() {
        if (this.currentServer) {
            this.view.title = this.currentServer.apiUrl + " - " + this.currentServer.apiUserName;
        }
        else {
            this.view.title = "Airflow";
        }
    }
    async getImportErrors() {
        ui.logToOutput('DagTreeView.getImportErrors Started');
        if (!this.api) {
            return;
        }
        const result = await this.api.getImportErrors();
        if (result.isSuccessful) {
            const importErrors = result.result;
            if (importErrors.total_entries > 0) {
                ui.showOutputMessage(result.result, "Import Dag Errors! Check Output Panel");
            }
        }
    }
    saveState() {
        ui.logToOutput('DagTreeView.saveState Started');
        try {
            if (this.currentServer) {
                this.context.globalState.update('apiUrl', this.currentServer.apiUrl);
                this.context.globalState.update('apiUserName', this.currentServer.apiUserName);
                this.context.globalState.update('apiPassword', this.currentServer.apiPassword);
            }
            else {
                this.context.globalState.update('apiUrl', undefined);
                this.context.globalState.update('apiUserName', undefined);
                this.context.globalState.update('apiPassword', undefined);
            }
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
        if (this.currentServer) {
            this.view.message = this.getBoolenSign(this.ShowOnlyFavorite) + 'Fav, ' + this.getBoolenSign(this.ShowOnlyActive) + 'Active, Filter : ' + this.filterString;
        }
    }
    getBoolenSign(variable) {
        return variable ? "✓" : "𐄂";
    }
    loadState() {
        ui.logToOutput('DagTreeView.loadState Started');
        try {
            const apiUrlTemp = this.context.globalState.get('apiUrl') || '';
            const apiUserNameTemp = this.context.globalState.get('apiUserName') || '';
            const apiPasswordTemp = this.context.globalState.get('apiPassword') || '';
            if (apiUrlTemp && apiUserNameTemp) {
                this.currentServer = { apiUrl: apiUrlTemp, apiUserName: apiUserNameTemp, apiPassword: apiPasswordTemp };
                this.api = new Api_1.AirflowApi(this.currentServer);
            }
            const filterStringTemp = this.context.globalState.get('filterString') || '';
            if (filterStringTemp) {
                this.filterString = filterStringTemp;
                this.setFilterMessage();
            }
            const ShowOnlyActiveTemp = this.context.globalState.get('ShowOnlyActive');
            if (ShowOnlyActiveTemp !== undefined) {
                this.ShowOnlyActive = ShowOnlyActiveTemp;
            }
            const ShowOnlyFavoriteTemp = this.context.globalState.get('ShowOnlyFavorite');
            if (ShowOnlyFavoriteTemp !== undefined) {
                this.ShowOnlyFavorite = ShowOnlyFavoriteTemp;
            }
            const ServerListTemp = this.context.globalState.get('ServerList') || [];
            if (ServerListTemp) {
                this.ServerList = ServerListTemp;
            }
            // Ensure current server is in the list
            if (this.currentServer && !this.ServerList.find(e => e.apiUrl === this.currentServer?.apiUrl && e.apiUserName === this.currentServer?.apiUserName)) {
                this.ServerList.push(this.currentServer);
            }
        }
        catch (error) {
            ui.logToOutput("dagTreeView.loadState Error !!!", error);
        }
    }
    async viewConnections() {
        ui.logToOutput('DagTreeView.viewConnections Started');
        if (this.api) {
            const { ConnectionsView } = await Promise.resolve().then(() => __webpack_require__(50));
            ConnectionsView.render(this.context.extensionUri, this.api);
        }
    }
    async viewVariables() {
        ui.logToOutput('DagTreeView.viewVariables Started');
        if (this.api) {
            const { VariablesView } = await Promise.resolve().then(() => __webpack_require__(51));
            VariablesView.render(this.context.extensionUri, this.api);
        }
    }
    async viewProviders() {
        ui.logToOutput('DagTreeView.viewProviders Started');
        if (this.api) {
            const { ProvidersView } = await Promise.resolve().then(() => __webpack_require__(52));
            ProvidersView.render(this.context.extensionUri, this.api);
        }
    }
    async viewDagRuns() {
        ui.logToOutput('DagTreeView.viewDagRuns Started');
        if (this.api) {
            DagRunView_1.DagRunView.render(this.context.extensionUri, this.api);
        }
    }
}
exports.DagTreeView = DagTreeView;


/***/ }),
/* 3 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.DagView = void 0;
/* eslint-disable @typescript-eslint/naming-convention */
const vscode = __webpack_require__(1);
const ui = __webpack_require__(4);
const DagTreeView_1 = __webpack_require__(2);
class DagView {
    constructor(panel, extensionUri, dagId, api, dagRunId) {
        this._disposables = [];
        this.dagHistorySelectedDate = ui.toISODateString(new Date());
        this.activetabid = "tab-1";
        ui.logToOutput('DagView.constructor Started');
        this.dagId = dagId;
        this.extensionUri = extensionUri;
        this.api = api;
        this.dagRunId = dagRunId;
        this._panel = panel;
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        this._setWebviewMessageListener(this._panel.webview);
        this.loadAllDagData();
        ui.logToOutput('DagView.constructor Completed');
    }
    resetDagData() {
        this.activetabid = "tab-1";
        this.dagJson = undefined;
        this.dagRunJson = undefined;
        this.dagRunHistoryJson = undefined;
        this.dagTaskInstancesJson = undefined;
        this.dagTasksJson = undefined;
        this.stopCheckingDagRunStatus();
    }
    async loadAllDagData() {
        ui.logToOutput('DagView.loadAllDagData Started');
        await this.getDagInfo();
        if (this.dagRunId) {
            await this.getDagRun(this.dagId, this.dagRunId);
        }
        else {
            await this.getLastRun();
        }
        await this.getDagTasks();
        //await this.getRunHistory();
        await this.renderHmtl();
    }
    async loadDagDataOnly() {
        ui.logToOutput('DagView.loadDagDataOnly Started');
        await this.getDagInfo();
        await this.renderHmtl();
    }
    async renderHmtl() {
        ui.logToOutput('DagView.renderHmtl Started');
        this._panel.webview.html = this._getWebviewContent(this._panel.webview, this.extensionUri);
        //ui.showOutputMessage(this._panel.webview.html);
        ui.logToOutput('DagView.renderHmtl Completed');
    }
    static render(extensionUri, dagId, api, dagRunId) {
        ui.logToOutput('DagView.render Started');
        if (DagView.Current) {
            DagView.Current.api = api;
            DagView.Current.dagId = dagId;
            DagView.Current.dagRunId = dagRunId;
            DagView.Current._panel.reveal(vscode.ViewColumn.Two);
            DagView.Current.resetDagData();
            DagView.Current.loadAllDagData();
        }
        else {
            const panel = vscode.window.createWebviewPanel("dagView", "Dag View", vscode.ViewColumn.Two, {
                enableScripts: true,
            });
            DagView.Current = new DagView(panel, extensionUri, dagId, api, dagRunId);
        }
    }
    async getLastRun() {
        ui.logToOutput('DagView.getLastRun Started');
        let result = await this.api.getLastDagRun(this.dagId);
        if (result.isSuccessful) {
            this.dagRunJson = result.result;
            this.dagRunId = this.dagRunJson.dag_run_id;
            this.getTaskInstances(this.dagRunId);
            if (this.dagRunJson && this.dagRunJson.state === "running") {
                this.startCheckingDagRunStatus(this.dagRunId);
            }
        }
    }
    async getDagRun(dagId, dagRunId) {
        ui.logToOutput('DagView.getDagRun Started');
        let result = await this.api.getDagRun(dagId, dagRunId);
        if (result.isSuccessful) {
            this.dagRunJson = result.result;
            this.dagRunId = this.dagRunJson.dag_run_id;
            this.getTaskInstances(this.dagRunId);
        }
        await this.renderHmtl();
    }
    async getRunHistory(date) {
        ui.logToOutput('DagView.getRunHistory Started');
        let result = await this.api.getDagRunHistory(this.dagId, date);
        if (result.isSuccessful) {
            this.dagRunHistoryJson = result.result;
        }
    }
    async getTaskInstances(dagRunId) {
        ui.logToOutput('DagView.getTaskInstances Started');
        let result = await this.api.getTaskInstances(this.dagId, dagRunId); // Note: api.getTaskInstances was not implemented in my previous step, I need to check if I missed it.
        // Wait, I missed getTaskInstances in AirflowApi. I need to add it.
        // I'll add it to AirflowApi later or assume I added it.
        // Actually I should check api.ts again. I added getLastDagRunLog but maybe not getTaskInstances explicitly as public.
        // I will add it to api.ts in a subsequent step if missing.
        if (result.isSuccessful) {
            this.dagTaskInstancesJson = result.result;
        }
    }
    async getDagInfo() {
        ui.logToOutput('DagView.getDagInfo Started');
        let result = await this.api.getDagInfo(this.dagId); // Also need to check if this exists in new api.ts
        if (result.isSuccessful) {
            this.dagJson = result.result;
        }
    }
    async getDagTasks() {
        ui.logToOutput('DagView.getDagTasks Started');
        let result = await this.api.getDagTasks(this.dagId); // Need to check
        if (result.isSuccessful) {
            this.dagTasksJson = result.result;
        }
    }
    dispose() {
        ui.logToOutput('DagView.dispose Started');
        DagView.Current = undefined;
        // stop any running interval checks
        this.stopCheckingDagRunStatus();
        this._panel.dispose();
        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }
    _getWebviewContent(webview, extensionUri) {
        ui.logToOutput('DagView._getWebviewContent Started');
        //file URIs
        const toolkitUri = ui.getUri(webview, extensionUri, [
            "node_modules",
            "@vscode-elements",
            "elements",
            "dist",
            "bundled.js",
        ]);
        const mainUri = ui.getUri(webview, extensionUri, ["media", "main.js"]);
        const styleUri = ui.getUri(webview, extensionUri, ["media", "style.css"]);
        //LATEST DAG RUN
        let state = "";
        let logical_date = undefined;
        let start_date = undefined;
        let end_date = undefined;
        let logical_date_string = "";
        let start_date_string = "";
        let duration = "";
        let isDagRunning = false;
        let hasDagRun = false;
        if (this.dagRunJson) {
            state = this.dagRunJson.state;
            logical_date = this.dagRunJson.logical_date;
            start_date = this.dagRunJson.start_date;
            end_date = this.dagRunJson.end_date;
            logical_date_string = logical_date ? ui.toISODateString(new Date(logical_date)) : "";
            start_date_string = start_date ? ui.toISODateTimeString(new Date(start_date)) : "";
            duration = start_date ? ui.getDuration(new Date(start_date), end_date ? new Date(end_date) : new Date()) : "";
            isDagRunning = (state === "queued" || state === "running") ? true : false;
            hasDagRun = true;
        }
        let runningOrFailedTasks = "";
        if (this.dagTaskInstancesJson) {
            for (const t of this.dagTaskInstancesJson["task_instances"]) {
                if (t.state === "running" || t.state === "failed" || t.state === "up_for_retry" || t.state === "up_for_reschedule" || t.state === "deferred") {
                    runningOrFailedTasks += t.task_id + ", ";
                }
            }
        }
        //INFO TAB
        let owners = (this.dagJson && Array.isArray(this.dagJson["owners"])) ? this.dagJson["owners"].join(", ") : "";
        let tags = "";
        if (this.dagJson && Array.isArray(this.dagJson["tags"])) {
            this.dagJson["tags"].forEach((item) => { tags += item.name + ", "; });
        }
        let schedule_interval = (this.dagJson && this.dagJson["schedule_interval"] && this.dagJson["schedule_interval"].value) ? this.dagJson["schedule_interval"].value : "";
        let isPausedText = (this.dagJson) ? (this.dagJson.is_paused ? "true" : "false") : "unknown";
        let isPaused = isPausedText === "true";
        //TASKS TAB
        let taskRows = "";
        if (this.dagTaskInstancesJson) {
            for (const t of this.dagTaskInstancesJson["task_instances"].sort((a, b) => (a.start_date > b.start_date) ? 1 : -1)) {
                taskRows += `
                <tr>
                    <td>
                        <div style="display: flex; align-items: center;">
                            <div class="state-${t.state}" title="${t.state}" ></div>
                            &nbsp; ${t.task_id} (${t.try_number})
                        </div>
                    </td>
                    <td>
                        <a href="#" id="task-log-link-${t.task_id}">Log</a> | 
                        <a href="#" id="task-xcom-link-${t.task_id}">XCom</a>
                    </td>
                    <td>${ui.getDuration(new Date(t.start_date), new Date(t.end_date))}</td>
                    <td>${t.operator}</td>
                </tr>
                `;
            }
        }
        // BUILD TASK DEPENDENCY TREE
        let taskDependencyTree = "";
        if (this.dagTasksJson && this.dagTasksJson.tasks && this.dagTasksJson.tasks.length > 0) {
            taskDependencyTree = this.buildTaskDependencyTree(this.dagTasksJson.tasks);
        }
        //HISTORY TAB
        let runHistoryRows = "";
        if (this.dagRunHistoryJson) {
            for (const t of this.dagRunHistoryJson["dag_runs"]) {
                runHistoryRows += `
                <tr>
                    <td>
                        <div style="display: flex; align-items: center;">
                            <div class="state-${t.state}" title="${t.state}"></div>
                            &nbsp; ${t.state}
                        </div>
                    </td>
                    <td><a href="#" id="history-dag-run-id-${t.dag_run_id}">${ui.toISODateTimeString(new Date(t.start_date))}</a></td>
                    <td>${ui.getDuration(new Date(t.start_date), new Date(t.end_date))}</td>
                    <td>${t.note}</td>
                </tr>
                `;
            }
        }
        let result = /*html*/ `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width,initial-scale=1.0">
        <script type="module" src="${toolkitUri}"></script>
        <script type="module" src="${mainUri}"></script>
        <link rel="stylesheet" href="${styleUri}">
        <title>DAG</title>
      </head>
      <body>  


        <div style="display: flex; align-items: center;">
            <div class="dag-paused-${isPausedText}"></div>
            &nbsp; &nbsp; <h2>${this.dagId}</h2>
            <div style="visibility: ${isDagRunning ? "visible" : "hidden"}; display: flex; align-items: center;">
            &nbsp; &nbsp; <vscode-progress-ring></vscode-progress-ring>
            </div>
        </div>
                    

        <vscode-tabs id="tab-control" selected-index="${this.activetabid === 'tab-1' ? 0 : this.activetabid === 'tab-2' ? 1 : this.activetabid === 'tab-3' ? 2 : 3}">
            <vscode-tab-header slot="header">RUN</vscode-tab-header>
            <vscode-tab-header slot="header">TASKS</vscode-tab-header>
            <vscode-tab-header slot="header">INFO</vscode-tab-header>
            <vscode-tab-header slot="header">HISTORY</vscode-tab-header>
            
            <vscode-tab-panel>
                
            <section>

                    <table class="dag-run-details-table">
                        <tr>
                            <th colspan=3>Dag Run Details</th>
                        </tr>
                        <tr>
                            <td>State</td>
                            <td>:</td>
                            <td>
                                <div style="display: flex; align-items: center;">
                                    <div class="state-${state}"></div> &nbsp; ${state}
                                </div>
                            </td>
                        </tr>
                        <tr>
                            <td>Tasks</td>
                            <td>:</td>
                            <td>${runningOrFailedTasks}</td>
                        </tr>
                        <tr>
                            <td>Date</td>
                            <td>:</td>
                            <td>${logical_date_string}</td>
                        </tr>
                        <tr>
                            <td>StartDate</td>
                            <td>:</td>
                            <td>${start_date_string}</td>
                        </tr>
                        <tr>
                            <td>Duration</td>
                            <td>:</td>
                            <td>${duration}</td>
                        </tr>
                        <tr>
                            <td>Note</td>
                            <td>:</td>
                            <td><a href="#" id="run-update-note-link" title="Update Note">${this.dagRunJson?.note || '(No note)'}</a></td>
                        </tr>
                        <tr>
                            <td>Config</td>
                            <td>:</td>
                            <td>${this.dagRunJson?.conf ? JSON.stringify(this.dagRunJson.conf, null, 2) : '(No config)'}</td>
                        </tr>
                        <tr>
                            <td colspan="3">
                                <vscode-button appearance="secondary" id="run-ask-ai" ${!hasDagRun ? "disabled" : ""}>Ask AI</vscode-button>    
                                <vscode-button appearance="secondary" id="run-view-log" ${!hasDagRun ? "disabled" : ""}>Log</vscode-button> 
                                <vscode-button appearance="secondary" id="run-lastrun-check" ${isPaused ? "disabled" : ""}>Refresh</vscode-button>  
                                <vscode-button appearance="secondary" id="run-more-dagrun-detail" ${!hasDagRun ? "disabled" : ""}>More</vscode-button>
                            </td>
                        </tr>
                    </table>
            
                    <br>
            
                    <table>
                        <tr>
                            <th colspan="3">Trigger</th>
                        </tr>
                        <tr>
                            <td>Date</td>
                            <td>:</td>
                            <td><vscode-textfield id="run_date" placeholder="YYYY-MM-DD (Optional)" maxlength="10" pattern="\d{4}-\d{2}-\d{2}"></vscode-textfield></td>
                        </tr>
                        <tr>
                            <td>Config</td>
                            <td>:</td>
                            <td><vscode-textarea id="run_config" cols="50" placeholder="Config in JSON Format (Optional)"></vscode-textarea></td>
                        </tr>
                        <tr>           
                            <td colspan="3">
                            <vscode-button appearance="secondary" id="run-trigger-dag" ${isPaused ? "disabled" : ""}>Run</vscode-button>
                            <vscode-button appearance="secondary" id="run-lastrun-cancel" ${isPaused || !isDagRunning ? "disabled" : ""}>Cancel</vscode-button>  
                            </td>
                        </tr>
                    </table>

                    <br>

                    <table>
                        <tr>
                            <th colspan="3">
                            <vscode-button appearance="secondary" id="run-pause-dag" ${isPaused ? "disabled" : ""}>
                            Pause
                            </vscode-button>
                            <vscode-button appearance="secondary" id="run-unpause-dag" ${!isPaused ? "disabled" : ""}>
                            Un Pause
                            </vscode-button>
                            </th>
                        </tr>
                    </table>

                    <br>
                    <br>
                    <br>
                    
                    <table>
                        <tr>
                            <td colspan="3">
                                <a href="https://github.com/necatiarslan/airflow-vscode-extension/issues/new">Bug Report & Feature Request</a>
                            </td>
                        </tr>
                    </table>
                    <table>
                        <tr>
                            <td colspan="3">
                                <a href="https://bit.ly/airflow-extension-survey">New Feature Survey</a>
                            </td>
                        </tr>
                    </table>
                    <table>
                        <tr>
                            <td colspan="3">
                                <a href="https://github.com/sponsors/necatiarslan">Donate to support this extension</a>
                            </td>
                        </tr>
                    </table>
            </section>
            </vscode-tab-panel>


            <vscode-tab-panel>

            <section>

                    ${taskDependencyTree ? `
                    <table>
                        <tr>
                            <th>Task Dependencies</th>
                        </tr>
                        <tr>
                            <td>
                                <vscode-tree>
                                ${taskDependencyTree}
                                </vscode-tree>
                            </td>
                        </tr>
                    </table>
                    <br>
                    ` : ''}

                    <table>
                        <tr>
                            <th colspan="4">Tasks</th>
                        </tr>
                        <tr>
                            <td>Task</td>
                            <td></td>
                            <td>Duration</td>            
                            <td>Operator</td>
                        </tr>

                        ${taskRows}

                        <tr>          
                            <td colspan="4">
                                <vscode-button appearance="secondary" id="tasks-refresh">Refresh</vscode-button>
                                <vscode-button appearance="secondary" id="tasks-more-detail" ${!this.dagTaskInstancesJson ? "disabled" : ""}>More</vscode-button>
                            </td>
                        </tr>
                    </table>

            </section>
            </vscode-tab-panel>
            
            <vscode-tab-panel>
            <section>

                    <table>
                    <tr>
                        <th colspan=3>Other</th>
                    </tr>
                    <tr>
                        <td>Owners</td>
                        <td>:</td>
                        <td>${owners}</td>
                    </tr>
                    <tr>
                        <td>Tags</td>
                        <td>:</td>
                        <td>${tags}</td>
                    </tr>
                    <tr>
                        <td>Schedule</td>
                        <td>:</td>
                        <td>${schedule_interval}</td>
                    </tr>
                    <tr>           
                        <td colspan="3"><vscode-button appearance="secondary" id="info-source-code">Source Code</vscode-button> <vscode-button appearance="secondary" id="other-dag-detail">More</vscode-button></td>
                    </tr>
                    </table>

            </section>
            </vscode-tab-panel>

            <vscode-tab-panel>

            <section>
    
                    <table>
                        <tr>
                            <th colspan=4>HISTORY</th>
                        </tr>
                        <tr>
                            <td>Date</td>
                            <td>:</td>
                            <td>
                            <vscode-textfield id="history_date" value="${this.dagHistorySelectedDate}" placeholder="YYYY-MM-DD" pattern="\d{4}-\d{2}-\d{2}" maxlength="10"></vscode-textfield>
                            </td>
                            <td><vscode-button appearance="secondary" id="history-load-runs">Load Runs</vscode-button></td>
                        </tr>
                    </table>

                    <table>
                        <tr>
                            <th colspan=4>DAG RUNS</th>
                        </tr>
                        <tr>
                            <td></td>
                            <td>Start Time</td>            
                            <td>Duration</td>
                            <td>Notes</td>
                        </tr>
                        ${runHistoryRows}
                    </table>   
    
            </section>
            </vscode-tab-panel>

        </vscode-tabs>
      </body>
    </html>
    `;
        ui.logToOutput('DagView._getWebviewContent Completed');
        return result;
    }
    _setWebviewMessageListener(webview) {
        ui.logToOutput('DagView._setWebviewMessageListener Started');
        webview.onDidReceiveMessage((message) => {
            const command = message.command;
            let activetabid = message.activetabid;
            if (["tab-1", "tab-2", "tab-3", "tab-4"].includes(activetabid)) {
                this.activetabid = message.activetabid;
            }
            ui.logToOutput('DagView._setWebviewMessageListener Message Received ' + message.command);
            switch (command) {
                case "run-trigger-dag":
                    this.triggerDagWConfig(message.config, message.date);
                    return;
                case "run-view-log":
                    this.showDAGRunLog();
                    return;
                case "run-more-dagrun-detail":
                    ui.showOutputMessage(this.dagRunJson);
                    return;
                case "other-dag-detail":
                    ui.showOutputMessage(this.dagJson);
                    return;
                case "tasks-more-detail":
                    ui.showOutputMessage(this.dagTaskInstancesJson);
                    return;
                case "history-load-runs":
                    this.getRunHistoryAndRenderHtml(message.date);
                    return;
                case "info-source-code":
                    this.showSourceCode();
                    return;
                case "run-pause-dag":
                    this.pauseDAG(true);
                    return;
                case "run-unpause-dag":
                    this.pauseDAG(false);
                    return;
                case "run-ask-ai":
                    this.askAI();
                    return;
                case "run-lastrun-check":
                    this.getLastRun();
                    if (this.dagRunJson) {
                        this.startCheckingDagRunStatus(this.dagRunId);
                    }
                    return;
                case "run-lastrun-cancel":
                    if (this.dagRunJson) {
                        this.cancelDagRun(this.dagRunId);
                    }
                    return;
                case "run-update-note":
                    if (this.dagRunJson) {
                        this.updateDagRunNote("");
                    }
                    return;
                case "history-dag-run-id":
                    let dagRunId = message.id;
                    dagRunId = dagRunId.replace("history-dag-run-id-", "");
                    this.activetabid = "tab-1";
                    this.getDagRun(this.dagId, dagRunId);
                    return;
                case "task-log-link":
                    let taskId = message.id;
                    taskId = taskId.replace("task-log-link-", "");
                    this.showTaskInstanceLog(this.dagId, this.dagRunId, taskId);
                    return;
                case "task-xcom-link":
                    let xcomTaskId = message.id;
                    xcomTaskId = xcomTaskId.replace("task-xcom-link-", "");
                    this.showTaskXComs(this.dagId, this.dagRunId, xcomTaskId);
                    return;
                case "tasks-refresh":
                    this.getTasksAndRenderHtml();
                    return;
                case "tabControlChanged":
                    this.activetabid = message.activeid;
                    ui.logToOutput("tab changed to " + message.activeid);
                    return;
            }
        }, undefined, this._disposables);
    }
    async getTasksAndRenderHtml() {
        await this.getDagTasks();
        await this.renderHmtl();
    }
    async cancelDagRun(dagRunId) {
        ui.logToOutput('DagView.cancelDagRun Started');
        // Note: cancelDagRun is missing in AirflowApi, need to add it.
        // I will add it to AirflowApi in the next step.
        // For now I will comment it out or assume it exists.
        // let result = await this.api.cancelDagRun(this.dagId, dagRunId);
        // if (result.isSuccessful) {
        // }
    }
    async updateDagRunNote(note) {
        ui.logToOutput('DagView.updateDagRunNote Started');
        if (!this.api || !this.dagRunJson) {
            return;
        }
        // Show input box with current note as default value
        const newNote = await vscode.window.showInputBox({
            prompt: 'Enter note for this DAG run',
            value: this.dagRunJson.note || '',
            placeHolder: 'Add a note for this DAG run'
        });
        // User cancelled the input
        if (newNote === undefined) {
            return;
        }
        const result = await this.api.updateDagRunNote(this.dagId, this.dagRunId, newNote);
        if (result.isSuccessful) {
            // Refresh the DAG run to get the updated note
            await this.getDagRun(this.dagId, this.dagRunId);
        }
    }
    async pauseDAG(is_paused) {
        ui.logToOutput('DagTreeView.pauseDAG Started');
        if (is_paused && this.dagJson.is_paused) {
            ui.showWarningMessage(this.dagId + 'Dag is already PAUSED');
            return;
        }
        if (!is_paused && !this.dagJson.is_paused) {
            ui.showWarningMessage(this.dagId + 'Dag is already ACTIVE');
            return;
        }
        let result = await this.api.pauseDag(this.dagId, is_paused);
        if (result.isSuccessful) {
            this.loadDagDataOnly();
            is_paused ? DagTreeView_1.DagTreeView.Current?.notifyDagPaused(this.dagId) : DagTreeView_1.DagTreeView.Current?.notifyDagUnPaused(this.dagId);
        }
    }
    async askAI() {
        ui.logToOutput('DagView.askAI Started');
        if (!DagTreeView_1.DagTreeView.Current) {
            ui.showErrorMessage('DagTreeView is not available');
            return;
        }
        if (!this.dagJson) {
            ui.showErrorMessage('DAG information is not available');
            return;
        }
        let code = await this.api.getSourceCode(this.dagId, this.dagJson.file_token);
        if (!code.isSuccessful) {
            ui.showErrorMessage('Failed to retrieve DAG source code for AI context');
            return;
        }
        let logs = await this.api.getDagRunLog(this.dagId, this.dagRunId);
        if (!logs.isSuccessful) {
            ui.showErrorMessage('Failed to retrieve DAG logs for AI context');
            return;
        }
        // Call the askAI function from DagTreeView
        await DagTreeView_1.DagTreeView.Current?.askAIWithContext({ code: code.result, logs: logs.result, dag: this.dagJson, dagRun: this.dagRunJson, tasks: this.dagTasksJson, taskInstances: this.dagTaskInstancesJson });
    }
    async showSourceCode() {
        ui.logToOutput('DagView.showSourceCode Started');
        let result = await this.api.getSourceCode(this.dagId, this.dagJson.file_token);
        if (result.isSuccessful) {
            const tmp = __webpack_require__(7);
            const fs = __webpack_require__(5);
            const tmpFile = tmp.fileSync({ mode: 0o644, prefix: this.dagId, postfix: '.py' });
            fs.appendFileSync(tmpFile.name, result.result);
            ui.openFile(tmpFile.name);
        }
        else {
            ui.logToOutput(result.result);
            ui.showErrorMessage(result.result);
        }
    }
    async getRunHistoryAndRenderHtml(date) {
        ui.logToOutput('DagView.getRunHistoryAndRenderHtml Started');
        this.dagHistorySelectedDate = date;
        await this.getRunHistory(date);
        await this.renderHmtl();
    }
    async showDAGRunLog() {
        ui.logToOutput('DagView.DAGRunLog Started');
        let result = await this.api.getDagRunLog(this.dagId, this.dagRunId);
        if (result.isSuccessful) {
            const tmp = __webpack_require__(7);
            const fs = __webpack_require__(5);
            const tmpFile = tmp.fileSync({ mode: 0o644, prefix: this.dagId, postfix: '.log' });
            fs.appendFileSync(tmpFile.name, result.result);
            ui.openFile(tmpFile.name);
        }
    }
    async showTaskInstanceLog(dagId, dagRunId, taskId) {
        ui.logToOutput('DagView.showTaskInstanceLog Started');
        let result = await this.api.getTaskInstanceLog(dagId, dagRunId, taskId);
        if (result.isSuccessful) {
            const tmp = __webpack_require__(7);
            const fs = __webpack_require__(5);
            const tmpFile = tmp.fileSync({ mode: 0o644, prefix: dagId + '-' + taskId, postfix: '.log' });
            fs.appendFileSync(tmpFile.name, result.result);
            ui.openFile(tmpFile.name);
        }
    }
    async showTaskXComs(dagId, dagRunId, taskId) {
        ui.logToOutput('DagView.showTaskXComs Started');
        let result = await this.api.getTaskXComs(dagId, dagRunId, taskId);
        if (result.isSuccessful) {
            const tmp = __webpack_require__(7);
            const fs = __webpack_require__(5);
            const tmpFile = tmp.fileSync({ mode: 0o644, prefix: dagId + '-' + taskId + '_xcom', postfix: '.json' });
            fs.appendFileSync(tmpFile.name, JSON.stringify(result.result, null, 2));
            ui.openFile(tmpFile.name);
        }
        else {
            ui.showInfoMessage(`No XCom entries found for task: ${taskId}`);
        }
    }
    async triggerDagWConfig(config = "", date = "") {
        ui.logToOutput('DagView.triggerDagWConfig Started');
        if (config && !ui.isJsonString(config)) {
            ui.showWarningMessage("Config is not a valid JSON");
            return;
        }
        if (date && !ui.isValidDate(date)) {
            ui.showWarningMessage("Date is not a valid DATE");
            return;
        }
        if (!config) {
            config = "{}";
        }
        if (config !== undefined) {
            let result = await this.api.triggerDag(this.dagId, config, date);
            if (result.isSuccessful) {
                this.startCheckingDagRunStatus(result.result["dag_run_id"]);
                DagTreeView_1.DagTreeView.Current?.notifyDagStateWithDagId(this.dagId);
            }
        }
    }
    async startCheckingDagRunStatus(dagRunId) {
        ui.logToOutput('DagView.startCheckingDagRunStatus Started');
        this.dagRunId = dagRunId;
        await this.refreshRunningDagState(this);
        if (this.dagStatusInterval) {
            clearInterval(this.dagStatusInterval); //stop prev checking
        }
        this.dagStatusInterval = setInterval(() => {
            void this.refreshRunningDagState(this).catch((err) => ui.logToOutput('refreshRunningDagState Error', err));
        }, 5 * 1000);
    }
    async stopCheckingDagRunStatus() {
        ui.logToOutput('DagView.stopCheckingDagRunStatus Started');
        if (this.dagStatusInterval) {
            clearInterval(this.dagStatusInterval); //stop prev checking
        }
    }
    async refreshRunningDagState(dagView) {
        ui.logToOutput('DagView.refreshRunningDagState Started');
        if (!dagView.dagId || !dagView.dagRunId) {
            dagView.stopCheckingDagRunStatus();
            return;
        }
        let result = await this.api.getDagRun(dagView.dagId, dagView.dagRunId);
        if (result.isSuccessful) {
            dagView.dagRunJson = result.result;
            let resultTasks = await this.api.getTaskInstances(dagView.dagId, dagView.dagRunId);
            if (resultTasks.isSuccessful) {
                dagView.dagTaskInstancesJson = resultTasks.result;
            }
        }
        else {
            dagView.stopCheckingDagRunStatus();
            return;
        }
        let state = (dagView.dagRunJson) ? dagView.dagRunJson.state : "";
        //"queued" "running" "success" "failed"
        if (state === "queued" || state === "running") {
            //go on for the next check
        }
        else {
            dagView.stopCheckingDagRunStatus();
        }
        dagView.renderHmtl();
    }
    buildTaskDependencyTree(tasks) {
        ui.logToOutput('DagView.buildTaskDependencyTree Started');
        // Create a map for quick task lookup
        const taskMap = new Map();
        tasks.forEach(task => {
            taskMap.set(task.task_id, task);
        });
        // Find root tasks (tasks with no upstream dependencies)
        const rootTasks = tasks.filter(task => !task.upstream_task_ids || task.upstream_task_ids.length === 0);
        if (rootTasks.length === 0) {
            return "No task dependencies found or circular dependencies detected.";
        }
        // Build tree recursively
        const visited = new Set();
        let treeHtml = "";
        const buildTree = (taskId) => {
            if (visited.has(taskId)) {
                return ""; // Prevent infinite loops and duplicates in this spanning tree view
            }
            visited.add(taskId);
            const task = taskMap.get(taskId);
            if (!task) {
                return "";
            }
            let itemHtml = `<vscode-tree-item>\n`;
            itemHtml += `${task.task_id} (${task.operator || ''})\n`;
            // Get downstream tasks
            const downstreamIds = task.downstream_task_ids || [];
            if (downstreamIds.length > 0) {
                downstreamIds.forEach((downstreamId) => {
                    itemHtml += buildTree(downstreamId);
                });
            }
            itemHtml += `</vscode-tree-item>\n`;
            return itemHtml;
        };
        // Build tree for each root task
        rootTasks.forEach((rootTask) => {
            treeHtml += buildTree(rootTask.task_id);
        });
        return treeHtml || "No tasks to display.";
    }
}
exports.DagView = DagView;


/***/ }),
/* 4 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.toISODateString = toISODateString;
exports.toISODateTimeString = toISODateTimeString;
exports.getUri = getUri;
exports.showOutputMessage = showOutputMessage;
exports.logToOutput = logToOutput;
exports.showInfoMessage = showInfoMessage;
exports.showWarningMessage = showWarningMessage;
exports.showErrorMessage = showErrorMessage;
exports.showApiErrorMessage = showApiErrorMessage;
exports.getExtensionVersion = getExtensionVersion;
exports.openFile = openFile;
exports.getDuration = getDuration;
exports.convertMsToTime = convertMsToTime;
exports.isJsonString = isJsonString;
exports.isValidDate = isValidDate;
const vscode = __webpack_require__(1);
const vscode_1 = __webpack_require__(1);
const fs_1 = __webpack_require__(5);
const path_1 = __webpack_require__(6);
let outputChannel;
let logsOutputChannel;
const NEW_LINE = "\n\n";
function toISODateString(date) {
    if (!date) {
        return "";
    }
    return date.toISOString().split('T')[0];
}
function toISODateTimeString(date) {
    if (!date) {
        return "";
    }
    return date.toISOString().replace('T', ' ').substring(0, 19);
}
function getUri(webview, extensionUri, pathList) {
    return webview.asWebviewUri(vscode_1.Uri.joinPath(extensionUri, ...pathList));
}
function showOutputMessage(message, popupMessage = "Results are printed to OUTPUT / Airflow-Extension") {
    if (!outputChannel) {
        outputChannel = vscode.window.createOutputChannel("Airflow-Extension");
    }
    outputChannel.clear();
    if (typeof message === "object") {
        outputChannel.appendLine(JSON.stringify(message, null, 4));
    }
    else {
        outputChannel.appendLine(message);
    }
    outputChannel.show();
    showInfoMessage(popupMessage);
}
function logToOutput(message, error = undefined) {
    const now = new Date().toLocaleString();
    if (!logsOutputChannel) {
        logsOutputChannel = vscode.window.createOutputChannel("Airflow-Log");
    }
    if (typeof message === "object") {
        logsOutputChannel.appendLine("[" + now + "] " + JSON.stringify(message, null, 4));
    }
    else {
        logsOutputChannel.appendLine("[" + now + "] " + message);
    }
    if (error) {
        logsOutputChannel.appendLine(error.name);
        logsOutputChannel.appendLine(error.message);
        if (error.stack) {
            logsOutputChannel.appendLine(error.stack);
        }
    }
}
function showInfoMessage(message) {
    vscode.window.showInformationMessage(message);
}
function showWarningMessage(message) {
    vscode.window.showWarningMessage(message);
}
function showErrorMessage(message, error = undefined) {
    if (error) {
        vscode.window.showErrorMessage(message + NEW_LINE + error.name + NEW_LINE + error.message);
    }
    else {
        vscode.window.showErrorMessage(message);
    }
}
function showApiErrorMessage(message, jsonResult) {
    let preText = "";
    if (jsonResult) {
        if (jsonResult.status === 403) {
            preText = "Permission Denied !!!";
            vscode.window.showErrorMessage(preText);
        }
        else if (jsonResult.status === 401) {
            preText = "Invalid Authentication Info !!!";
            vscode.window.showErrorMessage(preText);
        }
        else if (jsonResult.status === 404) {
            preText = "Resource Not Found !!!";
            vscode.window.showErrorMessage(preText);
        }
        else {
            vscode.window.showErrorMessage(preText);
        }
    }
    else {
        vscode.window.showErrorMessage(message);
    }
}
function getExtensionVersion() {
    const { version: extVersion } = JSON.parse((0, fs_1.readFileSync)((0, path_1.join)(__dirname, '..', 'package.json'), { encoding: 'utf8' }));
    return extVersion;
}
function openFile(file) {
    // Use workspace API to open file in editor and show it in column one
    (async () => {
        try {
            const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(file));
            await vscode.window.showTextDocument(doc, { viewColumn: vscode.ViewColumn.One, preview: false });
        }
        catch (err) {
            logToOutput('openFile Error', err);
        }
    })();
}
function padTo2Digits(num) {
    return num.toString().padStart(2, '0');
}
function getDuration(startDate, endDate) {
    if (!startDate) {
        return "";
    }
    if (!endDate || endDate < startDate) {
        endDate = new Date(); //now
    }
    const duration = endDate.valueOf() - startDate.valueOf();
    return (convertMsToTime(duration));
}
function convertMsToTime(milliseconds) {
    let seconds = Math.floor(milliseconds / 1000);
    let minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    seconds = seconds % 60;
    minutes = minutes % 60;
    return `${padTo2Digits(hours)}:${padTo2Digits(minutes)}:${padTo2Digits(seconds)}`;
}
function isJsonString(jsonString) {
    try {
        const json = JSON.parse(jsonString);
        return (typeof json === 'object');
    }
    catch (e) {
        return false;
    }
}
function isValidDate(dateString) {
    const regEx = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateString.match(regEx)) {
        return false; // Invalid format
    }
    const d = new Date(dateString);
    const dNum = d.getTime();
    if (!dNum && dNum !== 0) {
        return false; // NaN value, Invalid date
    }
    return d.toISOString().slice(0, 10) === dateString;
}


/***/ }),
/* 5 */
/***/ ((module) => {

"use strict";
module.exports = require("fs");

/***/ }),
/* 6 */
/***/ ((module) => {

"use strict";
module.exports = require("path");

/***/ }),
/* 7 */
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

/*!
 * Tmp
 *
 * Copyright (c) 2011-2017 KARASZI Istvan <github@spam.raszi.hu>
 *
 * MIT Licensed
 */

/*
 * Module dependencies.
 */
const fs = __webpack_require__(5);
const os = __webpack_require__(8);
const path = __webpack_require__(6);
const crypto = __webpack_require__(9);
const _c = { fs: fs.constants, os: os.constants };

/*
 * The working inner variables.
 */
const // the random characters to choose from
  RANDOM_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
  TEMPLATE_PATTERN = /XXXXXX/,
  DEFAULT_TRIES = 3,
  CREATE_FLAGS = (_c.O_CREAT || _c.fs.O_CREAT) | (_c.O_EXCL || _c.fs.O_EXCL) | (_c.O_RDWR || _c.fs.O_RDWR),
  // constants are off on the windows platform and will not match the actual errno codes
  IS_WIN32 = os.platform() === 'win32',
  EBADF = _c.EBADF || _c.os.errno.EBADF,
  ENOENT = _c.ENOENT || _c.os.errno.ENOENT,
  DIR_MODE = 0o700 /* 448 */,
  FILE_MODE = 0o600 /* 384 */,
  EXIT = 'exit',
  // this will hold the objects need to be removed on exit
  _removeObjects = [],
  // API change in fs.rmdirSync leads to error when passing in a second parameter, e.g. the callback
  FN_RMDIR_SYNC = fs.rmdirSync.bind(fs);

let _gracefulCleanup = false;

/**
 * Recursively remove a directory and its contents.
 *
 * @param {string} dirPath path of directory to remove
 * @param {Function} callback
 * @private
 */
function rimraf(dirPath, callback) {
  return fs.rm(dirPath, { recursive: true }, callback);
}

/**
 * Recursively remove a directory and its contents, synchronously.
 *
 * @param {string} dirPath path of directory to remove
 * @private
 */
function FN_RIMRAF_SYNC(dirPath) {
  return fs.rmSync(dirPath, { recursive: true });
}

/**
 * Gets a temporary file name.
 *
 * @param {(Options|tmpNameCallback)} options options or callback
 * @param {?tmpNameCallback} callback the callback function
 */
function tmpName(options, callback) {
  const args = _parseArguments(options, callback),
    opts = args[0],
    cb = args[1];

  _assertAndSanitizeOptions(opts, function (err, sanitizedOptions) {
    if (err) return cb(err);

    let tries = sanitizedOptions.tries;
    (function _getUniqueName() {
      try {
        const name = _generateTmpName(sanitizedOptions);

        // check whether the path exists then retry if needed
        fs.stat(name, function (err) {
          /* istanbul ignore else */
          if (!err) {
            /* istanbul ignore else */
            if (tries-- > 0) return _getUniqueName();

            return cb(new Error('Could not get a unique tmp filename, max tries reached ' + name));
          }

          cb(null, name);
        });
      } catch (err) {
        cb(err);
      }
    })();
  });
}

/**
 * Synchronous version of tmpName.
 *
 * @param {Object} options
 * @returns {string} the generated random name
 * @throws {Error} if the options are invalid or could not generate a filename
 */
function tmpNameSync(options) {
  const args = _parseArguments(options),
    opts = args[0];

  const sanitizedOptions = _assertAndSanitizeOptionsSync(opts);

  let tries = sanitizedOptions.tries;
  do {
    const name = _generateTmpName(sanitizedOptions);
    try {
      fs.statSync(name);
    } catch (e) {
      return name;
    }
  } while (tries-- > 0);

  throw new Error('Could not get a unique tmp filename, max tries reached');
}

/**
 * Creates and opens a temporary file.
 *
 * @param {(Options|null|undefined|fileCallback)} options the config options or the callback function or null or undefined
 * @param {?fileCallback} callback
 */
function file(options, callback) {
  const args = _parseArguments(options, callback),
    opts = args[0],
    cb = args[1];

  // gets a temporary filename
  tmpName(opts, function _tmpNameCreated(err, name) {
    /* istanbul ignore else */
    if (err) return cb(err);

    // create and open the file
    fs.open(name, CREATE_FLAGS, opts.mode || FILE_MODE, function _fileCreated(err, fd) {
      /* istanbu ignore else */
      if (err) return cb(err);

      if (opts.discardDescriptor) {
        return fs.close(fd, function _discardCallback(possibleErr) {
          // the chance of getting an error on close here is rather low and might occur in the most edgiest cases only
          return cb(possibleErr, name, undefined, _prepareTmpFileRemoveCallback(name, -1, opts, false));
        });
      } else {
        // detachDescriptor passes the descriptor whereas discardDescriptor closes it, either way, we no longer care
        // about the descriptor
        const discardOrDetachDescriptor = opts.discardDescriptor || opts.detachDescriptor;
        cb(null, name, fd, _prepareTmpFileRemoveCallback(name, discardOrDetachDescriptor ? -1 : fd, opts, false));
      }
    });
  });
}

/**
 * Synchronous version of file.
 *
 * @param {Options} options
 * @returns {FileSyncObject} object consists of name, fd and removeCallback
 * @throws {Error} if cannot create a file
 */
function fileSync(options) {
  const args = _parseArguments(options),
    opts = args[0];

  const discardOrDetachDescriptor = opts.discardDescriptor || opts.detachDescriptor;
  const name = tmpNameSync(opts);
  let fd = fs.openSync(name, CREATE_FLAGS, opts.mode || FILE_MODE);
  /* istanbul ignore else */
  if (opts.discardDescriptor) {
    fs.closeSync(fd);
    fd = undefined;
  }

  return {
    name: name,
    fd: fd,
    removeCallback: _prepareTmpFileRemoveCallback(name, discardOrDetachDescriptor ? -1 : fd, opts, true)
  };
}

/**
 * Creates a temporary directory.
 *
 * @param {(Options|dirCallback)} options the options or the callback function
 * @param {?dirCallback} callback
 */
function dir(options, callback) {
  const args = _parseArguments(options, callback),
    opts = args[0],
    cb = args[1];

  // gets a temporary filename
  tmpName(opts, function _tmpNameCreated(err, name) {
    /* istanbul ignore else */
    if (err) return cb(err);

    // create the directory
    fs.mkdir(name, opts.mode || DIR_MODE, function _dirCreated(err) {
      /* istanbul ignore else */
      if (err) return cb(err);

      cb(null, name, _prepareTmpDirRemoveCallback(name, opts, false));
    });
  });
}

/**
 * Synchronous version of dir.
 *
 * @param {Options} options
 * @returns {DirSyncObject} object consists of name and removeCallback
 * @throws {Error} if it cannot create a directory
 */
function dirSync(options) {
  const args = _parseArguments(options),
    opts = args[0];

  const name = tmpNameSync(opts);
  fs.mkdirSync(name, opts.mode || DIR_MODE);

  return {
    name: name,
    removeCallback: _prepareTmpDirRemoveCallback(name, opts, true)
  };
}

/**
 * Removes files asynchronously.
 *
 * @param {Object} fdPath
 * @param {Function} next
 * @private
 */
function _removeFileAsync(fdPath, next) {
  const _handler = function (err) {
    if (err && !_isENOENT(err)) {
      // reraise any unanticipated error
      return next(err);
    }
    next();
  };

  if (0 <= fdPath[0])
    fs.close(fdPath[0], function () {
      fs.unlink(fdPath[1], _handler);
    });
  else fs.unlink(fdPath[1], _handler);
}

/**
 * Removes files synchronously.
 *
 * @param {Object} fdPath
 * @private
 */
function _removeFileSync(fdPath) {
  let rethrownException = null;
  try {
    if (0 <= fdPath[0]) fs.closeSync(fdPath[0]);
  } catch (e) {
    // reraise any unanticipated error
    if (!_isEBADF(e) && !_isENOENT(e)) throw e;
  } finally {
    try {
      fs.unlinkSync(fdPath[1]);
    } catch (e) {
      // reraise any unanticipated error
      if (!_isENOENT(e)) rethrownException = e;
    }
  }
  if (rethrownException !== null) {
    throw rethrownException;
  }
}

/**
 * Prepares the callback for removal of the temporary file.
 *
 * Returns either a sync callback or a async callback depending on whether
 * fileSync or file was called, which is expressed by the sync parameter.
 *
 * @param {string} name the path of the file
 * @param {number} fd file descriptor
 * @param {Object} opts
 * @param {boolean} sync
 * @returns {fileCallback | fileCallbackSync}
 * @private
 */
function _prepareTmpFileRemoveCallback(name, fd, opts, sync) {
  const removeCallbackSync = _prepareRemoveCallback(_removeFileSync, [fd, name], sync);
  const removeCallback = _prepareRemoveCallback(_removeFileAsync, [fd, name], sync, removeCallbackSync);

  if (!opts.keep) _removeObjects.unshift(removeCallbackSync);

  return sync ? removeCallbackSync : removeCallback;
}

/**
 * Prepares the callback for removal of the temporary directory.
 *
 * Returns either a sync callback or a async callback depending on whether
 * tmpFileSync or tmpFile was called, which is expressed by the sync parameter.
 *
 * @param {string} name
 * @param {Object} opts
 * @param {boolean} sync
 * @returns {Function} the callback
 * @private
 */
function _prepareTmpDirRemoveCallback(name, opts, sync) {
  const removeFunction = opts.unsafeCleanup ? rimraf : fs.rmdir.bind(fs);
  const removeFunctionSync = opts.unsafeCleanup ? FN_RIMRAF_SYNC : FN_RMDIR_SYNC;
  const removeCallbackSync = _prepareRemoveCallback(removeFunctionSync, name, sync);
  const removeCallback = _prepareRemoveCallback(removeFunction, name, sync, removeCallbackSync);
  if (!opts.keep) _removeObjects.unshift(removeCallbackSync);

  return sync ? removeCallbackSync : removeCallback;
}

/**
 * Creates a guarded function wrapping the removeFunction call.
 *
 * The cleanup callback is save to be called multiple times.
 * Subsequent invocations will be ignored.
 *
 * @param {Function} removeFunction
 * @param {string} fileOrDirName
 * @param {boolean} sync
 * @param {cleanupCallbackSync?} cleanupCallbackSync
 * @returns {cleanupCallback | cleanupCallbackSync}
 * @private
 */
function _prepareRemoveCallback(removeFunction, fileOrDirName, sync, cleanupCallbackSync) {
  let called = false;

  // if sync is true, the next parameter will be ignored
  return function _cleanupCallback(next) {
    /* istanbul ignore else */
    if (!called) {
      // remove cleanupCallback from cache
      const toRemove = cleanupCallbackSync || _cleanupCallback;
      const index = _removeObjects.indexOf(toRemove);
      /* istanbul ignore else */
      if (index >= 0) _removeObjects.splice(index, 1);

      called = true;
      if (sync || removeFunction === FN_RMDIR_SYNC || removeFunction === FN_RIMRAF_SYNC) {
        return removeFunction(fileOrDirName);
      } else {
        return removeFunction(fileOrDirName, next || function () {});
      }
    }
  };
}

/**
 * The garbage collector.
 *
 * @private
 */
function _garbageCollector() {
  /* istanbul ignore else */
  if (!_gracefulCleanup) return;

  // the function being called removes itself from _removeObjects,
  // loop until _removeObjects is empty
  while (_removeObjects.length) {
    try {
      _removeObjects[0]();
    } catch (e) {
      // already removed?
    }
  }
}

/**
 * Random name generator based on crypto.
 * Adapted from http://blog.tompawlak.org/how-to-generate-random-values-nodejs-javascript
 *
 * @param {number} howMany
 * @returns {string} the generated random name
 * @private
 */
function _randomChars(howMany) {
  let value = [],
    rnd = null;

  // make sure that we do not fail because we ran out of entropy
  try {
    rnd = crypto.randomBytes(howMany);
  } catch (e) {
    rnd = crypto.pseudoRandomBytes(howMany);
  }

  for (let i = 0; i < howMany; i++) {
    value.push(RANDOM_CHARS[rnd[i] % RANDOM_CHARS.length]);
  }

  return value.join('');
}

/**
 * Checks whether the `obj` parameter is defined or not.
 *
 * @param {Object} obj
 * @returns {boolean} true if the object is undefined
 * @private
 */
function _isUndefined(obj) {
  return typeof obj === 'undefined';
}

/**
 * Parses the function arguments.
 *
 * This function helps to have optional arguments.
 *
 * @param {(Options|null|undefined|Function)} options
 * @param {?Function} callback
 * @returns {Array} parsed arguments
 * @private
 */
function _parseArguments(options, callback) {
  /* istanbul ignore else */
  if (typeof options === 'function') {
    return [{}, options];
  }

  /* istanbul ignore else */
  if (_isUndefined(options)) {
    return [{}, callback];
  }

  // copy options so we do not leak the changes we make internally
  const actualOptions = {};
  for (const key of Object.getOwnPropertyNames(options)) {
    actualOptions[key] = options[key];
  }

  return [actualOptions, callback];
}

/**
 * Resolve the specified path name in respect to tmpDir.
 *
 * The specified name might include relative path components, e.g. ../
 * so we need to resolve in order to be sure that is is located inside tmpDir
 *
 * @private
 */
function _resolvePath(name, tmpDir, cb) {
  const pathToResolve = path.isAbsolute(name) ? name : path.join(tmpDir, name);

  fs.stat(pathToResolve, function (err) {
    if (err) {
      fs.realpath(path.dirname(pathToResolve), function (err, parentDir) {
        if (err) return cb(err);

        cb(null, path.join(parentDir, path.basename(pathToResolve)));
      });
    } else {
      fs.realpath(pathToResolve, cb);
    }
  });
}

/**
 * Resolve the specified path name in respect to tmpDir.
 *
 * The specified name might include relative path components, e.g. ../
 * so we need to resolve in order to be sure that is is located inside tmpDir
 *
 * @private
 */
function _resolvePathSync(name, tmpDir) {
  const pathToResolve = path.isAbsolute(name) ? name : path.join(tmpDir, name);

  try {
    fs.statSync(pathToResolve);
    return fs.realpathSync(pathToResolve);
  } catch (_err) {
    const parentDir = fs.realpathSync(path.dirname(pathToResolve));

    return path.join(parentDir, path.basename(pathToResolve));
  }
}

/**
 * Generates a new temporary name.
 *
 * @param {Object} opts
 * @returns {string} the new random name according to opts
 * @private
 */
function _generateTmpName(opts) {
  const tmpDir = opts.tmpdir;

  /* istanbul ignore else */
  if (!_isUndefined(opts.name)) {
    return path.join(tmpDir, opts.dir, opts.name);
  }

  /* istanbul ignore else */
  if (!_isUndefined(opts.template)) {
    return path.join(tmpDir, opts.dir, opts.template).replace(TEMPLATE_PATTERN, _randomChars(6));
  }

  // prefix and postfix
  const name = [
    opts.prefix ? opts.prefix : 'tmp',
    '-',
    process.pid,
    '-',
    _randomChars(12),
    opts.postfix ? '-' + opts.postfix : ''
  ].join('');

  return path.join(tmpDir, opts.dir, name);
}

/**
 * Asserts and sanitizes the basic options.
 *
 * @private
 */
function _assertOptionsBase(options) {
  if (!_isUndefined(options.name)) {
    const name = options.name;

    // assert that name is not absolute and does not contain a path
    if (path.isAbsolute(name)) throw new Error(`name option must not contain an absolute path, found "${name}".`);

    // must not fail on valid .<name> or ..<name> or similar such constructs
    const basename = path.basename(name);
    if (basename === '..' || basename === '.' || basename !== name)
      throw new Error(`name option must not contain a path, found "${name}".`);
  }

  /* istanbul ignore else */
  if (!_isUndefined(options.template) && !options.template.match(TEMPLATE_PATTERN)) {
    throw new Error(`Invalid template, found "${options.template}".`);
  }

  /* istanbul ignore else */
  if ((!_isUndefined(options.tries) && isNaN(options.tries)) || options.tries < 0) {
    throw new Error(`Invalid tries, found "${options.tries}".`);
  }

  // if a name was specified we will try once
  options.tries = _isUndefined(options.name) ? options.tries || DEFAULT_TRIES : 1;
  options.keep = !!options.keep;
  options.detachDescriptor = !!options.detachDescriptor;
  options.discardDescriptor = !!options.discardDescriptor;
  options.unsafeCleanup = !!options.unsafeCleanup;

  // for completeness' sake only, also keep (multiple) blanks if the user, purportedly sane, requests us to
  options.prefix = _isUndefined(options.prefix) ? '' : options.prefix;
  options.postfix = _isUndefined(options.postfix) ? '' : options.postfix;
}

/**
 * Gets the relative directory to tmpDir.
 *
 * @private
 */
function _getRelativePath(option, name, tmpDir, cb) {
  if (_isUndefined(name)) return cb(null);

  _resolvePath(name, tmpDir, function (err, resolvedPath) {
    if (err) return cb(err);

    const relativePath = path.relative(tmpDir, resolvedPath);

    if (!resolvedPath.startsWith(tmpDir)) {
      return cb(new Error(`${option} option must be relative to "${tmpDir}", found "${relativePath}".`));
    }

    cb(null, relativePath);
  });
}

/**
 * Gets the relative path to tmpDir.
 *
 * @private
 */
function _getRelativePathSync(option, name, tmpDir) {
  if (_isUndefined(name)) return;

  const resolvedPath = _resolvePathSync(name, tmpDir);
  const relativePath = path.relative(tmpDir, resolvedPath);

  if (!resolvedPath.startsWith(tmpDir)) {
    throw new Error(`${option} option must be relative to "${tmpDir}", found "${relativePath}".`);
  }

  return relativePath;
}

/**
 * Asserts whether the specified options are valid, also sanitizes options and provides sane defaults for missing
 * options.
 *
 * @private
 */
function _assertAndSanitizeOptions(options, cb) {
  _getTmpDir(options, function (err, tmpDir) {
    if (err) return cb(err);

    options.tmpdir = tmpDir;

    try {
      _assertOptionsBase(options, tmpDir);
    } catch (err) {
      return cb(err);
    }

    // sanitize dir, also keep (multiple) blanks if the user, purportedly sane, requests us to
    _getRelativePath('dir', options.dir, tmpDir, function (err, dir) {
      if (err) return cb(err);

      options.dir = _isUndefined(dir) ? '' : dir;

      // sanitize further if template is relative to options.dir
      _getRelativePath('template', options.template, tmpDir, function (err, template) {
        if (err) return cb(err);

        options.template = template;

        cb(null, options);
      });
    });
  });
}

/**
 * Asserts whether the specified options are valid, also sanitizes options and provides sane defaults for missing
 * options.
 *
 * @private
 */
function _assertAndSanitizeOptionsSync(options) {
  const tmpDir = (options.tmpdir = _getTmpDirSync(options));

  _assertOptionsBase(options, tmpDir);

  const dir = _getRelativePathSync('dir', options.dir, tmpDir);
  options.dir = _isUndefined(dir) ? '' : dir;

  options.template = _getRelativePathSync('template', options.template, tmpDir);

  return options;
}

/**
 * Helper for testing against EBADF to compensate changes made to Node 7.x under Windows.
 *
 * @private
 */
function _isEBADF(error) {
  return _isExpectedError(error, -EBADF, 'EBADF');
}

/**
 * Helper for testing against ENOENT to compensate changes made to Node 7.x under Windows.
 *
 * @private
 */
function _isENOENT(error) {
  return _isExpectedError(error, -ENOENT, 'ENOENT');
}

/**
 * Helper to determine whether the expected error code matches the actual code and errno,
 * which will differ between the supported node versions.
 *
 * - Node >= 7.0:
 *   error.code {string}
 *   error.errno {number} any numerical value will be negated
 *
 * CAVEAT
 *
 * On windows, the errno for EBADF is -4083 but os.constants.errno.EBADF is different and we must assume that ENOENT
 * is no different here.
 *
 * @param {SystemError} error
 * @param {number} errno
 * @param {string} code
 * @private
 */
function _isExpectedError(error, errno, code) {
  return IS_WIN32 ? error.code === code : error.code === code && error.errno === errno;
}

/**
 * Sets the graceful cleanup.
 *
 * If graceful cleanup is set, tmp will remove all controlled temporary objects on process exit, otherwise the
 * temporary objects will remain in place, waiting to be cleaned up on system restart or otherwise scheduled temporary
 * object removals.
 */
function setGracefulCleanup() {
  _gracefulCleanup = true;
}

/**
 * Returns the currently configured tmp dir from os.tmpdir().
 *
 * @private
 */
function _getTmpDir(options, cb) {
  return fs.realpath((options && options.tmpdir) || os.tmpdir(), cb);
}

/**
 * Returns the currently configured tmp dir from os.tmpdir().
 *
 * @private
 */
function _getTmpDirSync(options) {
  return fs.realpathSync((options && options.tmpdir) || os.tmpdir());
}

// Install process exit listener
process.addListener(EXIT, _garbageCollector);

/**
 * Configuration options.
 *
 * @typedef {Object} Options
 * @property {?boolean} keep the temporary object (file or dir) will not be garbage collected
 * @property {?number} tries the number of tries before give up the name generation
 * @property (?int) mode the access mode, defaults are 0o700 for directories and 0o600 for files
 * @property {?string} template the "mkstemp" like filename template
 * @property {?string} name fixed name relative to tmpdir or the specified dir option
 * @property {?string} dir tmp directory relative to the root tmp directory in use
 * @property {?string} prefix prefix for the generated name
 * @property {?string} postfix postfix for the generated name
 * @property {?string} tmpdir the root tmp directory which overrides the os tmpdir
 * @property {?boolean} unsafeCleanup recursively removes the created temporary directory, even when it's not empty
 * @property {?boolean} detachDescriptor detaches the file descriptor, caller is responsible for closing the file, tmp will no longer try closing the file during garbage collection
 * @property {?boolean} discardDescriptor discards the file descriptor (closes file, fd is -1), tmp will no longer try closing the file during garbage collection
 */

/**
 * @typedef {Object} FileSyncObject
 * @property {string} name the name of the file
 * @property {string} fd the file descriptor or -1 if the fd has been discarded
 * @property {fileCallback} removeCallback the callback function to remove the file
 */

/**
 * @typedef {Object} DirSyncObject
 * @property {string} name the name of the directory
 * @property {fileCallback} removeCallback the callback function to remove the directory
 */

/**
 * @callback tmpNameCallback
 * @param {?Error} err the error object if anything goes wrong
 * @param {string} name the temporary file name
 */

/**
 * @callback fileCallback
 * @param {?Error} err the error object if anything goes wrong
 * @param {string} name the temporary file name
 * @param {number} fd the file descriptor or -1 if the fd had been discarded
 * @param {cleanupCallback} fn the cleanup callback function
 */

/**
 * @callback fileCallbackSync
 * @param {?Error} err the error object if anything goes wrong
 * @param {string} name the temporary file name
 * @param {number} fd the file descriptor or -1 if the fd had been discarded
 * @param {cleanupCallbackSync} fn the cleanup callback function
 */

/**
 * @callback dirCallback
 * @param {?Error} err the error object if anything goes wrong
 * @param {string} name the temporary file name
 * @param {cleanupCallback} fn the cleanup callback function
 */

/**
 * @callback dirCallbackSync
 * @param {?Error} err the error object if anything goes wrong
 * @param {string} name the temporary file name
 * @param {cleanupCallbackSync} fn the cleanup callback function
 */

/**
 * Removes the temporary created file or directory.
 *
 * @callback cleanupCallback
 * @param {simpleCallback} [next] function to call whenever the tmp object needs to be removed
 */

/**
 * Removes the temporary created file or directory.
 *
 * @callback cleanupCallbackSync
 */

/**
 * Callback function for function composition.
 * @see {@link https://github.com/raszi/node-tmp/issues/57|raszi/node-tmp#57}
 *
 * @callback simpleCallback
 */

// exporting all the needed methods

// evaluate _getTmpDir() lazily, mainly for simplifying testing but it also will
// allow users to reconfigure the temporary directory
Object.defineProperty(module.exports, "tmpdir", ({
  enumerable: true,
  configurable: false,
  get: function () {
    return _getTmpDirSync();
  }
}));

module.exports.dir = dir;
module.exports.dirSync = dirSync;

module.exports.file = file;
module.exports.fileSync = fileSync;

module.exports.tmpName = tmpName;
module.exports.tmpNameSync = tmpNameSync;

module.exports.setGracefulCleanup = setGracefulCleanup;


/***/ }),
/* 8 */
/***/ ((module) => {

"use strict";
module.exports = require("os");

/***/ }),
/* 9 */
/***/ ((module) => {

"use strict";
module.exports = require("crypto");

/***/ }),
/* 10 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.DagTreeDataProvider = void 0;
/* eslint-disable @typescript-eslint/naming-convention */
const vscode = __webpack_require__(1);
const DagTreeItem_1 = __webpack_require__(11);
const DagTreeView_1 = __webpack_require__(2);
class DagTreeDataProvider {
    constructor() {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.dagTreeItemList = [];
        this.visibleDagList = [];
    }
    refresh() {
        this._onDidChangeTreeData.fire();
    }
    loadDagTreeItemsFromApiResponse() {
        this.dagTreeItemList = [];
        if (this.dagList) {
            for (var dag of this.dagList) {
                if (dag) {
                    let treeItem = new DagTreeItem_1.DagTreeItem(dag);
                    this.dagTreeItemList.push(treeItem);
                }
            }
        }
    }
    getChildren(element) {
        if (!element) {
            this.visibleDagList = this.getVisibleDagList();
            return Promise.resolve(this.visibleDagList);
        }
        return Promise.resolve([]);
    }
    getVisibleDagList() {
        var result = [];
        for (var node of this.dagTreeItemList) {
            if (DagTreeView_1.DagTreeView.Current.filterString && !node.doesFilterMatch(DagTreeView_1.DagTreeView.Current.filterString)) {
                continue;
            }
            if (DagTreeView_1.DagTreeView.Current.ShowOnlyActive && node.IsPaused) {
                continue;
            }
            if (DagTreeView_1.DagTreeView.Current.ShowOnlyFavorite && !node.IsFav) {
                continue;
            }
            result.push(node);
        }
        return result;
    }
    getTreeItem(element) {
        return element;
    }
}
exports.DagTreeDataProvider = DagTreeDataProvider;


/***/ }),
/* 11 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.DagTreeItem = void 0;
/* eslint-disable @typescript-eslint/naming-convention */
const vscode = __webpack_require__(1);
class DagTreeItem extends vscode.TreeItem {
    constructor(apiResponse) {
        super(apiResponse.dag_id);
        this.LatestDagRunId = '';
        this.LatestDagState = '';
        this._IsFav = false;
        this.IsFiltered = false;
        this.ApiResponse = apiResponse;
        this.DagId = apiResponse.dag_id;
        this.IsActive = apiResponse.is_active;
        this.IsPaused = apiResponse.is_paused;
        this.Owners = apiResponse.owners;
        this.Tags = apiResponse.tags;
        this.FileToken = apiResponse.file_token;
        this.setContextValue();
        this.refreshUI();
    }
    set IsFav(value) {
        this._IsFav = value;
        this.setContextValue();
    }
    get IsFav() {
        return this._IsFav;
    }
    isDagRunning() {
        return (this.LatestDagState === 'queued' || this.LatestDagState === 'running');
    }
    setContextValue() {
        let contextValue = "#";
        contextValue += this.IsFav ? "IsFav#" : "!IsFav#";
        contextValue += this.IsPaused ? "IsPaused#" : "!IsPaused#";
        contextValue += this.IsActive ? "IsActive#" : "!IsActive#";
        contextValue += this.IsFiltered ? "IsFiltered#" : "!IsFiltered#";
        this.contextValue = contextValue;
    }
    refreshUI() {
        if (this.IsPaused) {
            this.iconPath = new vscode.ThemeIcon('circle-outline');
            this.ApiResponse.is_paused = true;
        }
        else {
            //"queued" "running" "success" "failed"
            if (this.LatestDagState === 'queued') {
                this.iconPath = new vscode.ThemeIcon('loading~spin');
            }
            else if (this.LatestDagState === 'running') {
                this.iconPath = new vscode.ThemeIcon('loading~spin');
            }
            else if (this.LatestDagState === 'success') {
                this.iconPath = new vscode.ThemeIcon('check');
            }
            else if (this.LatestDagState === 'failed') {
                this.iconPath = new vscode.ThemeIcon('error');
            }
            else {
                this.iconPath = new vscode.ThemeIcon('circle-filled');
            }
            this.ApiResponse.is_paused = false;
        }
    }
    doesFilterMatch(filterString) {
        const words = filterString.split(',');
        const matchingWords = [];
        for (const word of words) {
            if (word === 'active' && !this.IsPaused) {
                matchingWords.push(word);
                continue;
            }
            if (word === 'paused' && this.IsPaused) {
                matchingWords.push(word);
                continue;
            }
            if (this.DagId.includes(word)) {
                matchingWords.push(word);
                continue;
            }
            if (this.Owners.includes(word)) {
                matchingWords.push(word);
                continue;
            }
            if (word === 'fav' && this.IsFav) {
                matchingWords.push(word);
                continue;
            }
            for (const t of this.Tags) {
                if (t.name.includes(word)) {
                    matchingWords.push(word);
                    continue;
                }
            }
        }
        this.IsFiltered = (words.length === matchingWords.length);
        return this.IsFiltered;
    }
}
exports.DagTreeItem = DagTreeItem;


/***/ }),
/* 12 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.DagRunView = void 0;
/* eslint-disable @typescript-eslint/naming-convention */
const vscode = __webpack_require__(1);
const ui = __webpack_require__(4);
const DagView_1 = __webpack_require__(3);
class DagRunView {
    constructor(panel, extensionUri, api) {
        this._disposables = [];
        // Filters
        this.selectedDate = ui.toISODateString(new Date());
        this.selectedStatus = '';
        this.selectedDagId = '';
        this.allDagIds = [];
        ui.logToOutput('DagRunView.constructor Started');
        this.extensionUri = extensionUri;
        this._panel = panel;
        this.api = api;
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        this._setWebviewMessageListener(this._panel.webview);
        this.loadData();
        ui.logToOutput('DagRunView.constructor Completed');
    }
    async loadData() {
        ui.logToOutput('DagRunView.loadData Started');
        // Fetch all DAGs to populate dag_id filter
        const dagsResult = await this.api.getDagList();
        if (dagsResult.isSuccessful && Array.isArray(dagsResult.result)) {
            this.allDagIds = dagsResult.result.map((dag) => dag.dag_id).sort();
        }
        // Fetch DAG runs for the selected date
        // If a specific DAG is selected, query that DAG, otherwise query all
        if (this.selectedDagId) {
            const result = await this.api.getDagRunHistory(this.selectedDagId, this.selectedDate);
            if (result.isSuccessful && result.result && result.result.dag_runs) {
                this.dagRunsJson = result.result.dag_runs;
            }
        }
        else {
            // Query all DAGs for runs on the selected date
            const allRuns = [];
            for (const dagId of this.allDagIds) {
                const result = await this.api.getDagRunHistory(dagId, this.selectedDate);
                if (result.isSuccessful && result.result && result.result.dag_runs) {
                    allRuns.push(...result.result.dag_runs);
                }
            }
            this.dagRunsJson = allRuns;
        }
        await this.renderHtml();
    }
    async renderHtml() {
        ui.logToOutput('DagRunView.renderHtml Started');
        this._panel.webview.html = this._getWebviewContent(this._panel.webview, this.extensionUri);
        ui.logToOutput('DagRunView.renderHtml Completed');
    }
    static render(extensionUri, api) {
        ui.logToOutput('DagRunView.render Started');
        if (DagRunView.Current) {
            DagRunView.Current.api = api;
            DagRunView.Current._panel.reveal(vscode.ViewColumn.One);
            DagRunView.Current.loadData();
        }
        else {
            const panel = vscode.window.createWebviewPanel("dagRunView", "DAG Runs", vscode.ViewColumn.One, {
                enableScripts: true,
            });
            DagRunView.Current = new DagRunView(panel, extensionUri, api);
        }
    }
    dispose() {
        ui.logToOutput('DagRunView.dispose Started');
        DagRunView.Current = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }
    _getWebviewContent(webview, extensionUri) {
        ui.logToOutput('DagRunView._getWebviewContent Started');
        const elementsUri = ui.getUri(webview, extensionUri, [
            "node_modules",
            "@vscode-elements",
            "elements",
            "dist",
            "bundled.js",
        ]);
        const mainUri = ui.getUri(webview, extensionUri, ["media", "main.js"]);
        const styleUri = ui.getUri(webview, extensionUri, ["media", "style.css"]);
        // Filter DAG runs based on selected filters
        let filteredRuns = [];
        if (this.dagRunsJson && Array.isArray(this.dagRunsJson)) {
            filteredRuns = this.dagRunsJson.filter((run) => {
                // Filter by status
                if (this.selectedStatus && run.state !== this.selectedStatus) {
                    return false;
                }
                return true;
            });
        }
        // Build table rows
        let tableRows = '';
        filteredRuns.forEach((run) => {
            const dagId = run.dag_id || 'N/A';
            const status = run.state || 'N/A';
            const startDate = run.start_date ? ui.toISODateTimeString(new Date(run.start_date)) : 'N/A';
            const duration = run.start_date && run.end_date ? ui.getDuration(new Date(run.start_date), new Date(run.end_date)) : 'Running';
            const config = run.conf ? JSON.stringify(run.conf) : '{}';
            const note = run.note || '';
            const dagRunId = run.dag_run_id || '';
            const statusEmoji = this._getStatusEmoji(status);
            tableRows += `
            <vscode-table-row>
                <vscode-table-cell><a href="#" data-dag-id="${this._escapeHtml(dagId)}" data-dag-run-id="${this._escapeHtml(dagRunId)}" class="dag-link">${this._escapeHtml(dagId)}</a></vscode-table-cell>
                <vscode-table-cell>${statusEmoji} ${this._escapeHtml(status)}</vscode-table-cell>
                <vscode-table-cell>${this._escapeHtml(startDate)}</vscode-table-cell>
                <vscode-table-cell>${this._escapeHtml(duration)}</vscode-table-cell>
                <vscode-table-cell><code>${this._escapeHtml(config.substring(0, 50))}${config.length > 50 ? '...' : ''}</code></vscode-table-cell>
                <vscode-table-cell>${this._escapeHtml(note)}</vscode-table-cell>
            </vscode-table-row>`;
        });
        // Build dag_id filter options
        const dagIdOptions = this.allDagIds.map(id => `<option value="${this._escapeHtml(id)}">${this._escapeHtml(id)}</option>`).join('');
        const result = /*html*/ `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width,initial-scale=1.0">
        <script type="module" src="${elementsUri}"></script>
        <script type="module" src="${mainUri}"></script>
        <link rel="stylesheet" href="${styleUri}">
        <style>
            body {
                padding: 16px;
            }
            h2 {
                margin-top: 0;
            }
            .filters {
                display: flex;
                gap: 12px;
                margin-bottom: 16px;
                flex-wrap: wrap;
                align-items: center;
            }
            .filter-group {
                display: flex;
                flex-direction: column;
                gap: 4px;
            }
            .filter-group label {
                font-size: 12px;
                font-weight: 600;
                text-transform: uppercase;
                opacity: 0.8;
            }
            .filter-group select,
            .filter-group input {
                padding: 6px 8px;
                border: 1px solid var(--vscode-input-border);
                background-color: var(--vscode-input-background);
                color: var(--vscode-input-foreground);
                border-radius: 4px;
                font-size: 13px;
            }
            vscode-table {
                width: 100%;
                max-height: 600px;
                overflow-y: auto;
            }
            vscode-table-cell {
                word-wrap: break-word;
                white-space: normal;
            }
            vscode-table-cell:first-child {
                white-space: nowrap;
            }
            code {
                background-color: var(--vscode-editor-background);
                color: var(--vscode-editor-foreground);
                padding: 2px 4px;
                border-radius: 3px;
                font-family: monospace;
                font-size: 11px;
            }
            a {
                color: var(--vscode-textLink-foreground);
                text-decoration: none;
                cursor: pointer;
            }
            a:hover {
                text-decoration: underline;
            }
        </style>
        <title>DAG Runs</title>
      </head>
      <body>  
        <h2>DAG Runs</h2>
        
        <div class="filters">
            <div class="filter-group">
                <label>Date</label>
                <input type="date" id="filter-date" value="${this.selectedDate}">
            </div>
            <div class="filter-group">
                <label>Status</label>
                <select id="filter-status">
                    <option value="">All</option>
                    <option value="success">Success</option>
                    <option value="failed">Failed</option>
                    <option value="running">Running</option>
                    <option value="queued">Queued</option>
                    <option value="upstream_failed">Upstream Failed</option>
                </select>
            </div>
            <div class="filter-group">
                <label>DAG ID</label>
                <select id="filter-dag-id">
                    <option value="">All DAGs</option>
                    ${dagIdOptions}
                </select>
            </div>
        </div>
        
        <vscode-table zebra bordered-columns resizable>
            <vscode-table-header  slot="header">
                <vscode-table-header-cell>DAG ID</vscode-table-header-cell>
                <vscode-table-header-cell>Status</vscode-table-header-cell>
                <vscode-table-header-cell>Start Date</vscode-table-header-cell>
                <vscode-table-header-cell>Duration</vscode-table-header-cell>
                <vscode-table-header-cell>Config</vscode-table-header-cell>
                <vscode-table-header-cell>Note</vscode-table-header-cell>
            </vscode-table-header>
            <vscode-table-body slot="body">
            ${tableRows || '<vscode-table-row><vscode-table-cell colspan="6">No runs found for the selected filters</vscode-table-cell></vscode-table-row>'}        
            </vscode-table-body>
        </vscode-table>

        <script>
            const vscode = acquireVsCodeApi();

            document.getElementById('filter-date').addEventListener('change', (e) => {
                vscode.postMessage({ command: 'filter-date', date: e.target.value });
            });

            document.getElementById('filter-status').addEventListener('change', (e) => {
                vscode.postMessage({ command: 'filter-status', status: e.target.value });
            });

            document.getElementById('filter-dag-id').addEventListener('change', (e) => {
                vscode.postMessage({ command: 'filter-dag-id', dagId: e.target.value });
            });

            // Handle dag-link clicks
            document.querySelectorAll('.dag-link').forEach(link => {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    const dagId = e.target.getAttribute('data-dag-id');
                    const dagRunId = e.target.getAttribute('data-dag-run-id');
                    vscode.postMessage({ command: 'open-dag-view', dagId, dagRunId });
                });
            });
        </script>
      </body>
    </html>
    `;
        return result;
    }
    _escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return String(text).replace(/[&<>"']/g, m => map[m]);
    }
    _getStatusEmoji(status) {
        const statusMap = {
            'success': '✅',
            'failed': '❌',
            'running': '▶️',
            'queued': '⏳',
            'upstream_failed': '⚠️',
            'skipped': '⏭️',
            'deferred': '🔄'
        };
        return statusMap[status.toLowerCase()] || '📅';
    }
    _setWebviewMessageListener(webview) {
        ui.logToOutput('DagRunView._setWebviewMessageListener Started');
        webview.onDidReceiveMessage((message) => {
            ui.logToOutput('DagRunView._setWebviewMessageListener Message Received ' + message.command);
            switch (message.command) {
                case "filter-date":
                    this.selectedDate = message.date;
                    this.loadData();
                    return;
                case "filter-status":
                    this.selectedStatus = message.status;
                    this.renderHtml();
                    return;
                case "filter-dag-id":
                    this.selectedDagId = message.dagId;
                    this.loadData();
                    return;
                case "open-dag-view":
                    // Open DagView with specific dag and run
                    if (this.api && message.dagId) {
                        DagView_1.DagView.render(this.extensionUri, message.dagId, this.api, message.dagRunId);
                    }
                    return;
            }
        }, undefined, this._disposables);
    }
}
exports.DagRunView = DagRunView;


/***/ }),
/* 13 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.AirflowApi = void 0;
/* eslint-disable @typescript-eslint/naming-convention */
const base_64_1 = __webpack_require__(14);
const ui = __webpack_require__(4);
const MethodResult_1 = __webpack_require__(15);
// Wrapper for fetch to handle ESM node-fetch in CommonJS
const fetch = async (url, init) => {
    const module = await Promise.resolve().then(() => __webpack_require__(16));
    return module.default(url, init);
};
class AirflowApi {
    constructor(config) {
        this.config = config;
    }
    get version() {
        if (this.config.apiUrl.includes('v1')) {
            return 'v1';
        }
        if (this.config.apiUrl.includes('v2')) {
            return 'v2';
        }
        return 'unknown';
    }
    async getJwtToken() {
        if (this.jwtToken) {
            return this.jwtToken;
        }
        try {
            const response = await fetch(this.config.apiUrl.replace("/api/v2", "") + '/auth/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: this.config.apiUserName, password: this.config.apiPassword }),
            });
            const result = await response.json();
            if (response.status === 201 || response.status === 200) {
                this.jwtToken = result['access_token'];
                return this.jwtToken;
            }
            else {
                ui.logToOutput(`getJwtToken failed: ${response.status} - ${JSON.stringify(result)}`);
            }
        }
        catch (error) {
            ui.logToOutput("getJwtToken Error", error);
        }
        return undefined;
    }
    async getHeaders() {
        const headers = {
            'Content-Type': 'application/json'
        };
        if (this.version === 'v1') {
            headers['Authorization'] = 'Basic ' + (0, base_64_1.encode)(`${this.config.apiUserName}:${this.config.apiPassword}`);
        }
        else if (this.version === 'v2') {
            const token = await this.getJwtToken();
            if (token) {
                headers['Authorization'] = 'Bearer ' + token;
            }
            else {
                ui.showWarningMessage('Unable to obtain JWT token for Airflow API v2.');
            }
        }
        return headers;
    }
    async checkConnection() {
        try {
            const headers = await this.getHeaders();
            const response = await fetch(`${this.config.apiUrl}/dags?limit=1`, { method: 'GET', headers });
            return response.status === 200;
        }
        catch (e) {
            return false;
        }
    }
    async getDagList() {
        const result = new MethodResult_1.MethodResult();
        const allDags = [];
        let offset = 0;
        const limit = 100;
        try {
            while (true) {
                const headers = await this.getHeaders();
                const response = await fetch(`${this.config.apiUrl}/dags?limit=${limit}&offset=${offset}`, { method: 'GET', headers });
                const data = await response.json();
                if (response.status === 200) {
                    allDags.push(...data["dags"]);
                    if (data["dags"].length < limit) {
                        break;
                    }
                    offset += limit;
                }
                else {
                    ui.showApiErrorMessage('Api Call Error', data);
                    result.isSuccessful = false;
                    return result;
                }
            }
            result.result = allDags;
            result.isSuccessful = true;
        }
        catch (error) {
            ui.showErrorMessage('Cannot connect to Airflow.', error);
            result.isSuccessful = false;
            result.error = error;
        }
        return result;
    }
    async triggerDag(dagId, config = "{}", date) {
        const result = new MethodResult_1.MethodResult();
        try {
            const headers = await this.getHeaders();
            let body = { conf: JSON.parse(config) };
            if (this.version === 'v1' && date) {
                body.logical_date = date + "T00:00:00Z";
            }
            else if (this.version === 'v2') {
                body.logical_date = date ? (date + "T00:00:00Z") : new Date().toISOString();
            }
            const response = await fetch(`${this.config.apiUrl}/dags/${dagId}/dagRuns`, {
                method: 'POST',
                headers,
                body: JSON.stringify(body),
            });
            const data = await response.json();
            if (response.status === 200 || response.status === 201) { // 201 Created is typical for POST
                ui.showInfoMessage(`${dagId} Triggered.`);
                result.result = data;
                result.isSuccessful = true;
            }
            else {
                ui.showApiErrorMessage(`${dagId} Trigger Error`, data);
                result.isSuccessful = false;
            }
        }
        catch (error) {
            ui.showErrorMessage(`${dagId} Trigger Error`, error);
            result.isSuccessful = false;
            result.error = error;
        }
        return result;
    }
    async getDagRun(dagId, dagRunId) {
        const result = new MethodResult_1.MethodResult();
        try {
            const headers = await this.getHeaders();
            const response = await fetch(`${this.config.apiUrl}/dags/${dagId}/dagRuns/${dagRunId}`, { method: 'GET', headers });
            const data = await response.json();
            if (response.status === 200) {
                result.result = data;
                result.isSuccessful = true;
            }
            else {
                result.isSuccessful = false;
            }
        }
        catch (error) {
            result.isSuccessful = false;
            result.error = error;
        }
        return result;
    }
    async getLastDagRun(dagId) {
        const history = await this.getDagRunHistory(dagId);
        if (history.isSuccessful && history.result && history.result.dag_runs && history.result.dag_runs.length > 0) {
            return this.getDagRun(dagId, history.result.dag_runs[0].dag_run_id);
        }
        const res = new MethodResult_1.MethodResult();
        res.isSuccessful = false;
        return res;
    }
    async getDagRunHistory(dagId, date) {
        const result = new MethodResult_1.MethodResult();
        try {
            const headers = await this.getHeaders();
            let url = `${this.config.apiUrl}/dags/${dagId}/dagRuns?order_by=-start_date`;
            // If date is provided, filter runs for that specific day
            if (date) {
                const startDate = `${date}T00:00:00Z`;
                const endDate = `${date}T23:59:59Z`;
                url += `&start_date_gte=${encodeURIComponent(startDate)}&start_date_lte=${encodeURIComponent(endDate)}`;
            }
            const response = await fetch(url, { method: 'GET', headers });
            const data = await response.json();
            if (response.status === 200) {
                result.result = data;
                result.isSuccessful = true;
            }
            else {
                result.isSuccessful = false;
            }
        }
        catch (error) {
            result.isSuccessful = false;
            result.error = error;
        }
        return result;
    }
    async pauseDag(dagId, isPaused) {
        const result = new MethodResult_1.MethodResult();
        try {
            const headers = await this.getHeaders();
            const response = await fetch(`${this.config.apiUrl}/dags/${dagId}`, {
                method: 'PATCH',
                headers,
                body: JSON.stringify({ is_paused: isPaused })
            });
            const data = await response.json();
            if (response.status === 200) {
                ui.showInfoMessage(`${dagId} ${isPaused ? "PAUSED" : "UN-PAUSED"}`);
                result.result = data;
                result.isSuccessful = true;
            }
            else {
                ui.showApiErrorMessage(`${dagId} Pause Error`, data);
                result.isSuccessful = false;
            }
        }
        catch (error) {
            ui.showErrorMessage(`${dagId} Pause Error`, error);
            result.isSuccessful = false;
            result.error = error;
        }
        return result;
    }
    async stopDagRun(dagId, dagRunId) {
        const result = new MethodResult_1.MethodResult();
        try {
            const headers = await this.getHeaders();
            const response = await fetch(`${this.config.apiUrl}/dags/${dagId}/dagRuns/${dagRunId}`, {
                method: 'PATCH',
                headers,
                body: JSON.stringify({ state: 'failed' })
            });
            const data = await response.json();
            if (response.status === 200) {
                ui.showInfoMessage(`DAG Run ${dagRunId} stopped.`);
                result.result = data;
                result.isSuccessful = true;
            }
            else {
                ui.showApiErrorMessage(`Stop DAG Run Error`, data);
                result.isSuccessful = false;
            }
        }
        catch (error) {
            ui.showErrorMessage(`Stop DAG Run Error`, error);
            result.isSuccessful = false;
            result.error = error;
        }
        return result;
    }
    async getSourceCode(dagId, fileToken) {
        const result = new MethodResult_1.MethodResult();
        try {
            const headers = await this.getHeaders();
            let url = "";
            if (this.version === 'v1' && fileToken) {
                url = `${this.config.apiUrl}/dagSources/${fileToken}`;
            }
            else if (this.version === 'v2') {
                url = `${this.config.apiUrl}/dagSources/${dagId}`;
            }
            else {
                throw new Error("Unknown Airflow Version or missing file token");
            }
            const response = await fetch(url, { method: 'GET', headers });
            if (response.status === 200) {
                if (this.version === 'v2') {
                    const json = await response.json();
                    result.result = json.content;
                }
                else {
                    result.result = await response.text();
                }
                result.isSuccessful = true;
            }
            else {
                const data = await response.json();
                ui.showApiErrorMessage(`${dagId} Source Code Error`, data);
                result.isSuccessful = false;
            }
        }
        catch (error) {
            ui.showErrorMessage(`${dagId} Source Code Error`, error);
            result.isSuccessful = false;
            result.error = error;
        }
        return result;
    }
    async getImportErrors() {
        const result = new MethodResult_1.MethodResult();
        try {
            const headers = await this.getHeaders();
            const response = await fetch(`${this.config.apiUrl}/importErrors`, { method: 'GET', headers });
            const data = await response.json();
            if (response.status === 200) {
                result.result = data;
                result.isSuccessful = true;
            }
            else {
                result.isSuccessful = false;
            }
        }
        catch (error) {
            result.isSuccessful = false;
            result.error = error;
        }
        return result;
    }
    async getLastDagRunLog(dagId) {
        const result = new MethodResult_1.MethodResult();
        try {
            ui.showInfoMessage('Fetching Latest DAG Run Logs...');
            const history = await this.getDagRunHistory(dagId);
            if (!history.isSuccessful || !history.result.dag_runs.length) {
                throw new Error("No DAG runs found");
            }
            const dagRunId = history.result.dag_runs[0].dag_run_id;
            let logContent = await this.getDagRunLog(dagId, dagRunId);
            if (!logContent.isSuccessful) {
                result.isSuccessful = false;
                result.error = logContent.error;
                return result;
            }
            result.result = logContent.result;
            result.isSuccessful = true;
        }
        catch (error) {
            ui.showErrorMessage(`${dagId} Log Error`, error);
            result.isSuccessful = false;
            result.error = error;
        }
        return result;
    }
    async getDagRunLog(dagId, dagRunId) {
        const result = new MethodResult_1.MethodResult();
        ui.showInfoMessage('Fetching DAG Run Logs...');
        try {
            const headers = await this.getHeaders();
            const tasksResponse = await fetch(`${this.config.apiUrl}/dags/${dagId}/dagRuns/${dagRunId}/taskInstances`, { method: 'GET', headers });
            const tasksData = await tasksResponse.json();
            let logContent = '###################### BEGINNING OF DAG RUN ######################\n\n';
            for (const task of tasksData.task_instances || []) {
                const logRes = await fetch(`${this.config.apiUrl}/dags/${dagId}/dagRuns/${dagRunId}/taskInstances/${task.task_id}/logs/${task.try_number}`, { method: 'GET', headers });
                const logText = await logRes.text();
                logContent += `############################################################\n`;
                logContent += `Dag=${dagId}\nDagRun=${dagRunId}\nTaskId=${task.task_id}\nTry=${task.try_number}\n`;
                logContent += `############################################################\n\n`;
                logContent += logText + "\n\n";
            }
            logContent += '###################### END OF DAG RUN ######################\n';
            result.result = logContent;
            result.isSuccessful = true;
            return result;
        }
        catch (error) {
            ui.showErrorMessage(`${dagId} Log Error`, error);
            result.isSuccessful = false;
            result.error = error;
        }
    }
    async getDagInfo(dagId) {
        return this.genericGet(`/dags/${dagId}`);
    }
    async getDagTasks(dagId) {
        return this.genericGet(`/dags/${dagId}/tasks`);
    }
    async getTaskInstances(dagId, dagRunId) {
        return this.genericGet(`/dags/${dagId}/dagRuns/${dagRunId}/taskInstances`);
    }
    async cancelDagRun(dagId, dagRunId) {
        const result = new MethodResult_1.MethodResult();
        try {
            const headers = await this.getHeaders();
            const response = await fetch(`${this.config.apiUrl}/dags/${dagId}/dagRuns/${dagRunId}`, {
                method: 'PATCH',
                headers,
                body: JSON.stringify({ state: 'failed' })
            });
            const data = await response.json();
            if (response.status === 200) {
                result.result = data;
                result.isSuccessful = true;
            }
            else {
                ui.showApiErrorMessage(`${dagId} Cancel Error`, data);
                result.isSuccessful = false;
            }
        }
        catch (error) {
            result.isSuccessful = false;
            result.error = error;
        }
        return result;
    }
    async getTaskInstanceLog(dagId, dagRunId, taskId) {
        const result = new MethodResult_1.MethodResult();
        try {
            ui.showInfoMessage('Fetching Task Logs...');
            const headers = await this.getHeaders();
            // First get the try number from task instance details
            // Or just try fetching logs for try 1, 2, etc?
            // The original code fetched all task instances to find the try number.
            const tasksResponse = await fetch(`${this.config.apiUrl}/dags/${dagId}/dagRuns/${dagRunId}/taskInstances`, { method: 'GET', headers });
            const tasksData = await tasksResponse.json();
            const taskInstance = tasksData.task_instances?.find((t) => t.task_id === taskId);
            if (!taskInstance) {
                throw new Error("Task instance not found");
            }
            const logRes = await fetch(`${this.config.apiUrl}/dags/${dagId}/dagRuns/${dagRunId}/taskInstances/${taskId}/logs/${taskInstance.try_number}`, { method: 'GET', headers });
            const logText = await logRes.text();
            let logContent = `############################################################\n`;
            logContent += `Dag=${dagId}\nDagRun=${dagRunId}\nTaskId=${taskId}\nTry=${taskInstance.try_number}\n`;
            logContent += `############################################################\n\n`;
            logContent += logText;
            result.result = logContent;
            result.isSuccessful = true;
        }
        catch (error) {
            ui.showErrorMessage(`${dagId} Log Error`, error);
            result.isSuccessful = false;
            result.error = error;
        }
        return result;
    }
    async getTaskXComs(dagId, dagRunId, taskId) {
        const result = new MethodResult_1.MethodResult();
        try {
            const headers = await this.getHeaders();
            const response = await fetch(`${this.config.apiUrl}/dags/${dagId}/dagRuns/${dagRunId}/taskInstances/${taskId}/xcomEntries`, { method: 'GET', headers });
            if (response.status === 200) {
                const data = await response.json();
                result.result = data;
                result.isSuccessful = true;
            }
            else {
                const data = await response.json();
                ui.showApiErrorMessage(`XCom fetch error for ${taskId}`, data);
                result.isSuccessful = false;
            }
        }
        catch (error) {
            ui.showErrorMessage(`XCom fetch error for ${taskId}`, error);
            result.isSuccessful = false;
            result.error = error;
        }
        return result;
    }
    async updateDagRunNote(dagId, dagRunId, note) {
        const result = new MethodResult_1.MethodResult();
        try {
            const headers = await this.getHeaders();
            const response = await fetch(`${this.config.apiUrl}/dags/${dagId}/dagRuns/${dagRunId}`, {
                method: 'PATCH',
                headers,
                body: JSON.stringify({ note: note })
            });
            const data = await response.json();
            if (response.status === 200) {
                ui.showInfoMessage('DAG run note updated successfully');
                result.result = data;
                result.isSuccessful = true;
            }
            else {
                ui.showApiErrorMessage(`Failed to update note`, data);
                result.isSuccessful = false;
            }
        }
        catch (error) {
            ui.showErrorMessage(`Failed to update note`, error);
            result.isSuccessful = false;
            result.error = error;
        }
        return result;
    }
    // Add other methods as needed (getConnections, getVariables, getProviders)
    async getConnections() {
        return this.genericGet('/connections');
    }
    async getVariables() {
        return this.genericGet('/variables');
    }
    async getProviders() {
        return this.genericGet('/providers');
    }
    async genericGet(endpoint) {
        const result = new MethodResult_1.MethodResult();
        try {
            const headers = await this.getHeaders();
            const response = await fetch(`${this.config.apiUrl}${endpoint}`, { method: 'GET', headers });
            const data = await response.json();
            if (response.status === 200) {
                result.result = data;
                result.isSuccessful = true;
            }
            else {
                ui.showApiErrorMessage(`Error fetching ${endpoint}`, data);
                result.isSuccessful = false;
            }
        }
        catch (error) {
            ui.showErrorMessage(`Error fetching ${endpoint}`, error);
            result.isSuccessful = false;
            result.error = error;
        }
        return result;
    }
}
exports.AirflowApi = AirflowApi;


/***/ }),
/* 14 */
/***/ (function(module, exports, __webpack_require__) {

/* module decorator */ module = __webpack_require__.nmd(module);
var __WEBPACK_AMD_DEFINE_RESULT__;/*! https://mths.be/base64 v1.0.0 by @mathias | MIT license */
;(function(root) {

	// Detect free variables `exports`.
	var freeExports =  true && exports;

	// Detect free variable `module`.
	var freeModule =  true && module &&
		module.exports == freeExports && module;

	// Detect free variable `global`, from Node.js or Browserified code, and use
	// it as `root`.
	var freeGlobal = typeof global == 'object' && global;
	if (freeGlobal.global === freeGlobal || freeGlobal.window === freeGlobal) {
		root = freeGlobal;
	}

	/*--------------------------------------------------------------------------*/

	var InvalidCharacterError = function(message) {
		this.message = message;
	};
	InvalidCharacterError.prototype = new Error;
	InvalidCharacterError.prototype.name = 'InvalidCharacterError';

	var error = function(message) {
		// Note: the error messages used throughout this file match those used by
		// the native `atob`/`btoa` implementation in Chromium.
		throw new InvalidCharacterError(message);
	};

	var TABLE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
	// http://whatwg.org/html/common-microsyntaxes.html#space-character
	var REGEX_SPACE_CHARACTERS = /[\t\n\f\r ]/g;

	// `decode` is designed to be fully compatible with `atob` as described in the
	// HTML Standard. http://whatwg.org/html/webappapis.html#dom-windowbase64-atob
	// The optimized base64-decoding algorithm used is based on @atk’s excellent
	// implementation. https://gist.github.com/atk/1020396
	var decode = function(input) {
		input = String(input)
			.replace(REGEX_SPACE_CHARACTERS, '');
		var length = input.length;
		if (length % 4 == 0) {
			input = input.replace(/==?$/, '');
			length = input.length;
		}
		if (
			length % 4 == 1 ||
			// http://whatwg.org/C#alphanumeric-ascii-characters
			/[^+a-zA-Z0-9/]/.test(input)
		) {
			error(
				'Invalid character: the string to be decoded is not correctly encoded.'
			);
		}
		var bitCounter = 0;
		var bitStorage;
		var buffer;
		var output = '';
		var position = -1;
		while (++position < length) {
			buffer = TABLE.indexOf(input.charAt(position));
			bitStorage = bitCounter % 4 ? bitStorage * 64 + buffer : buffer;
			// Unless this is the first of a group of 4 characters…
			if (bitCounter++ % 4) {
				// …convert the first 8 bits to a single ASCII character.
				output += String.fromCharCode(
					0xFF & bitStorage >> (-2 * bitCounter & 6)
				);
			}
		}
		return output;
	};

	// `encode` is designed to be fully compatible with `btoa` as described in the
	// HTML Standard: http://whatwg.org/html/webappapis.html#dom-windowbase64-btoa
	var encode = function(input) {
		input = String(input);
		if (/[^\0-\xFF]/.test(input)) {
			// Note: no need to special-case astral symbols here, as surrogates are
			// matched, and the input is supposed to only contain ASCII anyway.
			error(
				'The string to be encoded contains characters outside of the ' +
				'Latin1 range.'
			);
		}
		var padding = input.length % 3;
		var output = '';
		var position = -1;
		var a;
		var b;
		var c;
		var buffer;
		// Make sure any padding is handled outside of the loop.
		var length = input.length - padding;

		while (++position < length) {
			// Read three bytes, i.e. 24 bits.
			a = input.charCodeAt(position) << 16;
			b = input.charCodeAt(++position) << 8;
			c = input.charCodeAt(++position);
			buffer = a + b + c;
			// Turn the 24 bits into four chunks of 6 bits each, and append the
			// matching character for each of them to the output.
			output += (
				TABLE.charAt(buffer >> 18 & 0x3F) +
				TABLE.charAt(buffer >> 12 & 0x3F) +
				TABLE.charAt(buffer >> 6 & 0x3F) +
				TABLE.charAt(buffer & 0x3F)
			);
		}

		if (padding == 2) {
			a = input.charCodeAt(position) << 8;
			b = input.charCodeAt(++position);
			buffer = a + b;
			output += (
				TABLE.charAt(buffer >> 10) +
				TABLE.charAt((buffer >> 4) & 0x3F) +
				TABLE.charAt((buffer << 2) & 0x3F) +
				'='
			);
		} else if (padding == 1) {
			buffer = input.charCodeAt(position);
			output += (
				TABLE.charAt(buffer >> 2) +
				TABLE.charAt((buffer << 4) & 0x3F) +
				'=='
			);
		}

		return output;
	};

	var base64 = {
		'encode': encode,
		'decode': decode,
		'version': '1.0.0'
	};

	// Some AMD build optimizers, like r.js, check for specific condition patterns
	// like the following:
	if (
		true
	) {
		!(__WEBPACK_AMD_DEFINE_RESULT__ = (function() {
			return base64;
		}).call(exports, __webpack_require__, exports, module),
		__WEBPACK_AMD_DEFINE_RESULT__ !== undefined && (module.exports = __WEBPACK_AMD_DEFINE_RESULT__));
	}	else // removed by dead control flow
{ var key; }

}(this));


/***/ }),
/* 15 */
/***/ ((__unused_webpack_module, exports) => {

"use strict";

/* eslint-disable @typescript-eslint/naming-convention */
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.MethodResult = void 0;
class MethodResult {
    constructor() {
        this.result = undefined;
        this.isSuccessful = false;
        this.error = undefined;
    }
}
exports.MethodResult = MethodResult;


/***/ }),
/* 16 */
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   AbortError: () => (/* reexport safe */ _errors_abort_error_js__WEBPACK_IMPORTED_MODULE_11__.AbortError),
/* harmony export */   Blob: () => (/* reexport safe */ fetch_blob_from_js__WEBPACK_IMPORTED_MODULE_16__.Blob),
/* harmony export */   FetchError: () => (/* reexport safe */ _errors_fetch_error_js__WEBPACK_IMPORTED_MODULE_10__.FetchError),
/* harmony export */   File: () => (/* reexport safe */ fetch_blob_from_js__WEBPACK_IMPORTED_MODULE_16__.File),
/* harmony export */   FormData: () => (/* reexport safe */ formdata_polyfill_esm_min_js__WEBPACK_IMPORTED_MODULE_13__.FormData),
/* harmony export */   Headers: () => (/* reexport safe */ _headers_js__WEBPACK_IMPORTED_MODULE_8__["default"]),
/* harmony export */   Request: () => (/* reexport safe */ _request_js__WEBPACK_IMPORTED_MODULE_9__["default"]),
/* harmony export */   Response: () => (/* reexport safe */ _response_js__WEBPACK_IMPORTED_MODULE_7__["default"]),
/* harmony export */   blobFrom: () => (/* reexport safe */ fetch_blob_from_js__WEBPACK_IMPORTED_MODULE_16__.blobFrom),
/* harmony export */   blobFromSync: () => (/* reexport safe */ fetch_blob_from_js__WEBPACK_IMPORTED_MODULE_16__.blobFromSync),
/* harmony export */   "default": () => (/* binding */ fetch),
/* harmony export */   fileFrom: () => (/* reexport safe */ fetch_blob_from_js__WEBPACK_IMPORTED_MODULE_16__.fileFrom),
/* harmony export */   fileFromSync: () => (/* reexport safe */ fetch_blob_from_js__WEBPACK_IMPORTED_MODULE_16__.fileFromSync),
/* harmony export */   isRedirect: () => (/* reexport safe */ _utils_is_redirect_js__WEBPACK_IMPORTED_MODULE_12__.isRedirect)
/* harmony export */ });
/* harmony import */ var node_http__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(17);
/* harmony import */ var node_https__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(18);
/* harmony import */ var node_zlib__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(19);
/* harmony import */ var node_stream__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(20);
/* harmony import */ var node_buffer__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(21);
/* harmony import */ var data_uri_to_buffer__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(22);
/* harmony import */ var _body_js__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(23);
/* harmony import */ var _response_js__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(36);
/* harmony import */ var _headers_js__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(37);
/* harmony import */ var _request_js__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(39);
/* harmony import */ var _errors_fetch_error_js__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(33);
/* harmony import */ var _errors_abort_error_js__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(44);
/* harmony import */ var _utils_is_redirect_js__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(38);
/* harmony import */ var formdata_polyfill_esm_min_js__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(31);
/* harmony import */ var _utils_is_js__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(35);
/* harmony import */ var _utils_referrer_js__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(42);
/* harmony import */ var fetch_blob_from_js__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(45);
/**
 * Index.js
 *
 * a request API compatible with window.fetch
 *
 * All spec algorithm step numbers are based on https://fetch.spec.whatwg.org/commit-snapshots/ae716822cb3a61843226cd090eefc6589446c1d2/.
 */
























const supportedSchemas = new Set(['data:', 'http:', 'https:']);

/**
 * Fetch function
 *
 * @param   {string | URL | import('./request').default} url - Absolute url or Request instance
 * @param   {*} [options_] - Fetch options
 * @return  {Promise<import('./response').default>}
 */
async function fetch(url, options_) {
	return new Promise((resolve, reject) => {
		// Build request object
		const request = new _request_js__WEBPACK_IMPORTED_MODULE_9__["default"](url, options_);
		const {parsedURL, options} = (0,_request_js__WEBPACK_IMPORTED_MODULE_9__.getNodeRequestOptions)(request);
		if (!supportedSchemas.has(parsedURL.protocol)) {
			throw new TypeError(`node-fetch cannot load ${url}. URL scheme "${parsedURL.protocol.replace(/:$/, '')}" is not supported.`);
		}

		if (parsedURL.protocol === 'data:') {
			const data = (0,data_uri_to_buffer__WEBPACK_IMPORTED_MODULE_5__["default"])(request.url);
			const response = new _response_js__WEBPACK_IMPORTED_MODULE_7__["default"](data, {headers: {'Content-Type': data.typeFull}});
			resolve(response);
			return;
		}

		// Wrap http.request into fetch
		const send = (parsedURL.protocol === 'https:' ? node_https__WEBPACK_IMPORTED_MODULE_1__ : node_http__WEBPACK_IMPORTED_MODULE_0__).request;
		const {signal} = request;
		let response = null;

		const abort = () => {
			const error = new _errors_abort_error_js__WEBPACK_IMPORTED_MODULE_11__.AbortError('The operation was aborted.');
			reject(error);
			if (request.body && request.body instanceof node_stream__WEBPACK_IMPORTED_MODULE_3__.Readable) {
				request.body.destroy(error);
			}

			if (!response || !response.body) {
				return;
			}

			response.body.emit('error', error);
		};

		if (signal && signal.aborted) {
			abort();
			return;
		}

		const abortAndFinalize = () => {
			abort();
			finalize();
		};

		// Send request
		const request_ = send(parsedURL.toString(), options);

		if (signal) {
			signal.addEventListener('abort', abortAndFinalize);
		}

		const finalize = () => {
			request_.abort();
			if (signal) {
				signal.removeEventListener('abort', abortAndFinalize);
			}
		};

		request_.on('error', error => {
			reject(new _errors_fetch_error_js__WEBPACK_IMPORTED_MODULE_10__.FetchError(`request to ${request.url} failed, reason: ${error.message}`, 'system', error));
			finalize();
		});

		fixResponseChunkedTransferBadEnding(request_, error => {
			if (response && response.body) {
				response.body.destroy(error);
			}
		});

		/* c8 ignore next 18 */
		if (process.version < 'v14') {
			// Before Node.js 14, pipeline() does not fully support async iterators and does not always
			// properly handle when the socket close/end events are out of order.
			request_.on('socket', s => {
				let endedWithEventsCount;
				s.prependListener('end', () => {
					endedWithEventsCount = s._eventsCount;
				});
				s.prependListener('close', hadError => {
					// if end happened before close but the socket didn't emit an error, do it now
					if (response && endedWithEventsCount < s._eventsCount && !hadError) {
						const error = new Error('Premature close');
						error.code = 'ERR_STREAM_PREMATURE_CLOSE';
						response.body.emit('error', error);
					}
				});
			});
		}

		request_.on('response', response_ => {
			request_.setTimeout(0);
			const headers = (0,_headers_js__WEBPACK_IMPORTED_MODULE_8__.fromRawHeaders)(response_.rawHeaders);

			// HTTP fetch step 5
			if ((0,_utils_is_redirect_js__WEBPACK_IMPORTED_MODULE_12__.isRedirect)(response_.statusCode)) {
				// HTTP fetch step 5.2
				const location = headers.get('Location');

				// HTTP fetch step 5.3
				let locationURL = null;
				try {
					locationURL = location === null ? null : new URL(location, request.url);
				} catch {
					// error here can only be invalid URL in Location: header
					// do not throw when options.redirect == manual
					// let the user extract the errorneous redirect URL
					if (request.redirect !== 'manual') {
						reject(new _errors_fetch_error_js__WEBPACK_IMPORTED_MODULE_10__.FetchError(`uri requested responds with an invalid redirect URL: ${location}`, 'invalid-redirect'));
						finalize();
						return;
					}
				}

				// HTTP fetch step 5.5
				switch (request.redirect) {
					case 'error':
						reject(new _errors_fetch_error_js__WEBPACK_IMPORTED_MODULE_10__.FetchError(`uri requested responds with a redirect, redirect mode is set to error: ${request.url}`, 'no-redirect'));
						finalize();
						return;
					case 'manual':
						// Nothing to do
						break;
					case 'follow': {
						// HTTP-redirect fetch step 2
						if (locationURL === null) {
							break;
						}

						// HTTP-redirect fetch step 5
						if (request.counter >= request.follow) {
							reject(new _errors_fetch_error_js__WEBPACK_IMPORTED_MODULE_10__.FetchError(`maximum redirect reached at: ${request.url}`, 'max-redirect'));
							finalize();
							return;
						}

						// HTTP-redirect fetch step 6 (counter increment)
						// Create a new Request object.
						const requestOptions = {
							headers: new _headers_js__WEBPACK_IMPORTED_MODULE_8__["default"](request.headers),
							follow: request.follow,
							counter: request.counter + 1,
							agent: request.agent,
							compress: request.compress,
							method: request.method,
							body: (0,_body_js__WEBPACK_IMPORTED_MODULE_6__.clone)(request),
							signal: request.signal,
							size: request.size,
							referrer: request.referrer,
							referrerPolicy: request.referrerPolicy
						};

						// when forwarding sensitive headers like "Authorization",
						// "WWW-Authenticate", and "Cookie" to untrusted targets,
						// headers will be ignored when following a redirect to a domain
						// that is not a subdomain match or exact match of the initial domain.
						// For example, a redirect from "foo.com" to either "foo.com" or "sub.foo.com"
						// will forward the sensitive headers, but a redirect to "bar.com" will not.
						// headers will also be ignored when following a redirect to a domain using
						// a different protocol. For example, a redirect from "https://foo.com" to "http://foo.com"
						// will not forward the sensitive headers
						if (!(0,_utils_is_js__WEBPACK_IMPORTED_MODULE_14__.isDomainOrSubdomain)(request.url, locationURL) || !(0,_utils_is_js__WEBPACK_IMPORTED_MODULE_14__.isSameProtocol)(request.url, locationURL)) {
							for (const name of ['authorization', 'www-authenticate', 'cookie', 'cookie2']) {
								requestOptions.headers.delete(name);
							}
						}

						// HTTP-redirect fetch step 9
						if (response_.statusCode !== 303 && request.body && options_.body instanceof node_stream__WEBPACK_IMPORTED_MODULE_3__.Readable) {
							reject(new _errors_fetch_error_js__WEBPACK_IMPORTED_MODULE_10__.FetchError('Cannot follow redirect with body being a readable stream', 'unsupported-redirect'));
							finalize();
							return;
						}

						// HTTP-redirect fetch step 11
						if (response_.statusCode === 303 || ((response_.statusCode === 301 || response_.statusCode === 302) && request.method === 'POST')) {
							requestOptions.method = 'GET';
							requestOptions.body = undefined;
							requestOptions.headers.delete('content-length');
						}

						// HTTP-redirect fetch step 14
						const responseReferrerPolicy = (0,_utils_referrer_js__WEBPACK_IMPORTED_MODULE_15__.parseReferrerPolicyFromHeader)(headers);
						if (responseReferrerPolicy) {
							requestOptions.referrerPolicy = responseReferrerPolicy;
						}

						// HTTP-redirect fetch step 15
						resolve(fetch(new _request_js__WEBPACK_IMPORTED_MODULE_9__["default"](locationURL, requestOptions)));
						finalize();
						return;
					}

					default:
						return reject(new TypeError(`Redirect option '${request.redirect}' is not a valid value of RequestRedirect`));
				}
			}

			// Prepare response
			if (signal) {
				response_.once('end', () => {
					signal.removeEventListener('abort', abortAndFinalize);
				});
			}

			let body = (0,node_stream__WEBPACK_IMPORTED_MODULE_3__.pipeline)(response_, new node_stream__WEBPACK_IMPORTED_MODULE_3__.PassThrough(), error => {
				if (error) {
					reject(error);
				}
			});
			// see https://github.com/nodejs/node/pull/29376
			/* c8 ignore next 3 */
			if (process.version < 'v12.10') {
				response_.on('aborted', abortAndFinalize);
			}

			const responseOptions = {
				url: request.url,
				status: response_.statusCode,
				statusText: response_.statusMessage,
				headers,
				size: request.size,
				counter: request.counter,
				highWaterMark: request.highWaterMark
			};

			// HTTP-network fetch step 12.1.1.3
			const codings = headers.get('Content-Encoding');

			// HTTP-network fetch step 12.1.1.4: handle content codings

			// in following scenarios we ignore compression support
			// 1. compression support is disabled
			// 2. HEAD request
			// 3. no Content-Encoding header
			// 4. no content response (204)
			// 5. content not modified response (304)
			if (!request.compress || request.method === 'HEAD' || codings === null || response_.statusCode === 204 || response_.statusCode === 304) {
				response = new _response_js__WEBPACK_IMPORTED_MODULE_7__["default"](body, responseOptions);
				resolve(response);
				return;
			}

			// For Node v6+
			// Be less strict when decoding compressed responses, since sometimes
			// servers send slightly invalid responses that are still accepted
			// by common browsers.
			// Always using Z_SYNC_FLUSH is what cURL does.
			const zlibOptions = {
				flush: node_zlib__WEBPACK_IMPORTED_MODULE_2__.Z_SYNC_FLUSH,
				finishFlush: node_zlib__WEBPACK_IMPORTED_MODULE_2__.Z_SYNC_FLUSH
			};

			// For gzip
			if (codings === 'gzip' || codings === 'x-gzip') {
				body = (0,node_stream__WEBPACK_IMPORTED_MODULE_3__.pipeline)(body, node_zlib__WEBPACK_IMPORTED_MODULE_2__.createGunzip(zlibOptions), error => {
					if (error) {
						reject(error);
					}
				});
				response = new _response_js__WEBPACK_IMPORTED_MODULE_7__["default"](body, responseOptions);
				resolve(response);
				return;
			}

			// For deflate
			if (codings === 'deflate' || codings === 'x-deflate') {
				// Handle the infamous raw deflate response from old servers
				// a hack for old IIS and Apache servers
				const raw = (0,node_stream__WEBPACK_IMPORTED_MODULE_3__.pipeline)(response_, new node_stream__WEBPACK_IMPORTED_MODULE_3__.PassThrough(), error => {
					if (error) {
						reject(error);
					}
				});
				raw.once('data', chunk => {
					// See http://stackoverflow.com/questions/37519828
					if ((chunk[0] & 0x0F) === 0x08) {
						body = (0,node_stream__WEBPACK_IMPORTED_MODULE_3__.pipeline)(body, node_zlib__WEBPACK_IMPORTED_MODULE_2__.createInflate(), error => {
							if (error) {
								reject(error);
							}
						});
					} else {
						body = (0,node_stream__WEBPACK_IMPORTED_MODULE_3__.pipeline)(body, node_zlib__WEBPACK_IMPORTED_MODULE_2__.createInflateRaw(), error => {
							if (error) {
								reject(error);
							}
						});
					}

					response = new _response_js__WEBPACK_IMPORTED_MODULE_7__["default"](body, responseOptions);
					resolve(response);
				});
				raw.once('end', () => {
					// Some old IIS servers return zero-length OK deflate responses, so
					// 'data' is never emitted. See https://github.com/node-fetch/node-fetch/pull/903
					if (!response) {
						response = new _response_js__WEBPACK_IMPORTED_MODULE_7__["default"](body, responseOptions);
						resolve(response);
					}
				});
				return;
			}

			// For br
			if (codings === 'br') {
				body = (0,node_stream__WEBPACK_IMPORTED_MODULE_3__.pipeline)(body, node_zlib__WEBPACK_IMPORTED_MODULE_2__.createBrotliDecompress(), error => {
					if (error) {
						reject(error);
					}
				});
				response = new _response_js__WEBPACK_IMPORTED_MODULE_7__["default"](body, responseOptions);
				resolve(response);
				return;
			}

			// Otherwise, use response as-is
			response = new _response_js__WEBPACK_IMPORTED_MODULE_7__["default"](body, responseOptions);
			resolve(response);
		});

		// eslint-disable-next-line promise/prefer-await-to-then
		(0,_body_js__WEBPACK_IMPORTED_MODULE_6__.writeToStream)(request_, request).catch(reject);
	});
}

function fixResponseChunkedTransferBadEnding(request, errorCallback) {
	const LAST_CHUNK = node_buffer__WEBPACK_IMPORTED_MODULE_4__.Buffer.from('0\r\n\r\n');

	let isChunkedTransfer = false;
	let properLastChunkReceived = false;
	let previousChunk;

	request.on('response', response => {
		const {headers} = response;
		isChunkedTransfer = headers['transfer-encoding'] === 'chunked' && !headers['content-length'];
	});

	request.on('socket', socket => {
		const onSocketClose = () => {
			if (isChunkedTransfer && !properLastChunkReceived) {
				const error = new Error('Premature close');
				error.code = 'ERR_STREAM_PREMATURE_CLOSE';
				errorCallback(error);
			}
		};

		const onData = buf => {
			properLastChunkReceived = node_buffer__WEBPACK_IMPORTED_MODULE_4__.Buffer.compare(buf.slice(-5), LAST_CHUNK) === 0;

			// Sometimes final 0-length chunk and end of message code are in separate packets
			if (!properLastChunkReceived && previousChunk) {
				properLastChunkReceived = (
					node_buffer__WEBPACK_IMPORTED_MODULE_4__.Buffer.compare(previousChunk.slice(-3), LAST_CHUNK.slice(0, 3)) === 0 &&
					node_buffer__WEBPACK_IMPORTED_MODULE_4__.Buffer.compare(buf.slice(-2), LAST_CHUNK.slice(3)) === 0
				);
			}

			previousChunk = buf;
		};

		socket.prependListener('close', onSocketClose);
		socket.on('data', onData);

		request.on('close', () => {
			socket.removeListener('close', onSocketClose);
			socket.removeListener('data', onData);
		});
	});
}


/***/ }),
/* 17 */
/***/ ((module) => {

"use strict";
module.exports = require("node:http");

/***/ }),
/* 18 */
/***/ ((module) => {

"use strict";
module.exports = require("node:https");

/***/ }),
/* 19 */
/***/ ((module) => {

"use strict";
module.exports = require("node:zlib");

/***/ }),
/* 20 */
/***/ ((module) => {

"use strict";
module.exports = require("node:stream");

/***/ }),
/* 21 */
/***/ ((module) => {

"use strict";
module.exports = require("node:buffer");

/***/ }),
/* 22 */
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   dataUriToBuffer: () => (/* binding */ dataUriToBuffer),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/**
 * Returns a `Buffer` instance from the given data URI `uri`.
 *
 * @param {String} uri Data URI to turn into a Buffer instance
 * @returns {Buffer} Buffer instance from Data URI
 * @api public
 */
function dataUriToBuffer(uri) {
    if (!/^data:/i.test(uri)) {
        throw new TypeError('`uri` does not appear to be a Data URI (must begin with "data:")');
    }
    // strip newlines
    uri = uri.replace(/\r?\n/g, '');
    // split the URI up into the "metadata" and the "data" portions
    const firstComma = uri.indexOf(',');
    if (firstComma === -1 || firstComma <= 4) {
        throw new TypeError('malformed data: URI');
    }
    // remove the "data:" scheme and parse the metadata
    const meta = uri.substring(5, firstComma).split(';');
    let charset = '';
    let base64 = false;
    const type = meta[0] || 'text/plain';
    let typeFull = type;
    for (let i = 1; i < meta.length; i++) {
        if (meta[i] === 'base64') {
            base64 = true;
        }
        else {
            typeFull += `;${meta[i]}`;
            if (meta[i].indexOf('charset=') === 0) {
                charset = meta[i].substring(8);
            }
        }
    }
    // defaults to US-ASCII only if type is not provided
    if (!meta[0] && !charset.length) {
        typeFull += ';charset=US-ASCII';
        charset = 'US-ASCII';
    }
    // get the encoded data portion and decode URI-encoded chars
    const encoding = base64 ? 'base64' : 'ascii';
    const data = unescape(uri.substring(firstComma + 1));
    const buffer = Buffer.from(data, encoding);
    // set `.type` and `.typeFull` properties to MIME type
    buffer.type = type;
    buffer.typeFull = typeFull;
    // set the `.charset` property
    buffer.charset = charset;
    return buffer;
}
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (dataUriToBuffer);
//# sourceMappingURL=index.js.map

/***/ }),
/* 23 */
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   clone: () => (/* binding */ clone),
/* harmony export */   "default": () => (/* binding */ Body),
/* harmony export */   extractContentType: () => (/* binding */ extractContentType),
/* harmony export */   getTotalBytes: () => (/* binding */ getTotalBytes),
/* harmony export */   writeToStream: () => (/* binding */ writeToStream)
/* harmony export */ });
/* harmony import */ var node_stream__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(20);
/* harmony import */ var node_util__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(24);
/* harmony import */ var node_buffer__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(21);
/* harmony import */ var fetch_blob__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(25);
/* harmony import */ var formdata_polyfill_esm_min_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(31);
/* harmony import */ var _errors_fetch_error_js__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(33);
/* harmony import */ var _errors_base_js__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(34);
/* harmony import */ var _utils_is_js__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(35);

/**
 * Body.js
 *
 * Body interface provides common methods for Request and Response
 */












const pipeline = (0,node_util__WEBPACK_IMPORTED_MODULE_1__.promisify)(node_stream__WEBPACK_IMPORTED_MODULE_0__.pipeline);
const INTERNALS = Symbol('Body internals');

/**
 * Body mixin
 *
 * Ref: https://fetch.spec.whatwg.org/#body
 *
 * @param   Stream  body  Readable stream
 * @param   Object  opts  Response options
 * @return  Void
 */
class Body {
	constructor(body, {
		size = 0
	} = {}) {
		let boundary = null;

		if (body === null) {
			// Body is undefined or null
			body = null;
		} else if ((0,_utils_is_js__WEBPACK_IMPORTED_MODULE_7__.isURLSearchParameters)(body)) {
			// Body is a URLSearchParams
			body = node_buffer__WEBPACK_IMPORTED_MODULE_2__.Buffer.from(body.toString());
		} else if ((0,_utils_is_js__WEBPACK_IMPORTED_MODULE_7__.isBlob)(body)) {
			// Body is blob
		} else if (node_buffer__WEBPACK_IMPORTED_MODULE_2__.Buffer.isBuffer(body)) {
			// Body is Buffer
		} else if (node_util__WEBPACK_IMPORTED_MODULE_1__.types.isAnyArrayBuffer(body)) {
			// Body is ArrayBuffer
			body = node_buffer__WEBPACK_IMPORTED_MODULE_2__.Buffer.from(body);
		} else if (ArrayBuffer.isView(body)) {
			// Body is ArrayBufferView
			body = node_buffer__WEBPACK_IMPORTED_MODULE_2__.Buffer.from(body.buffer, body.byteOffset, body.byteLength);
		} else if (body instanceof node_stream__WEBPACK_IMPORTED_MODULE_0__) {
			// Body is stream
		} else if (body instanceof formdata_polyfill_esm_min_js__WEBPACK_IMPORTED_MODULE_4__.FormData) {
			// Body is FormData
			body = (0,formdata_polyfill_esm_min_js__WEBPACK_IMPORTED_MODULE_4__.formDataToBlob)(body);
			boundary = body.type.split('=')[1];
		} else {
			// None of the above
			// coerce to string then buffer
			body = node_buffer__WEBPACK_IMPORTED_MODULE_2__.Buffer.from(String(body));
		}

		let stream = body;

		if (node_buffer__WEBPACK_IMPORTED_MODULE_2__.Buffer.isBuffer(body)) {
			stream = node_stream__WEBPACK_IMPORTED_MODULE_0__.Readable.from(body);
		} else if ((0,_utils_is_js__WEBPACK_IMPORTED_MODULE_7__.isBlob)(body)) {
			stream = node_stream__WEBPACK_IMPORTED_MODULE_0__.Readable.from(body.stream());
		}

		this[INTERNALS] = {
			body,
			stream,
			boundary,
			disturbed: false,
			error: null
		};
		this.size = size;

		if (body instanceof node_stream__WEBPACK_IMPORTED_MODULE_0__) {
			body.on('error', error_ => {
				const error = error_ instanceof _errors_base_js__WEBPACK_IMPORTED_MODULE_6__.FetchBaseError ?
					error_ :
					new _errors_fetch_error_js__WEBPACK_IMPORTED_MODULE_5__.FetchError(`Invalid response body while trying to fetch ${this.url}: ${error_.message}`, 'system', error_);
				this[INTERNALS].error = error;
			});
		}
	}

	get body() {
		return this[INTERNALS].stream;
	}

	get bodyUsed() {
		return this[INTERNALS].disturbed;
	}

	/**
	 * Decode response as ArrayBuffer
	 *
	 * @return  Promise
	 */
	async arrayBuffer() {
		const {buffer, byteOffset, byteLength} = await consumeBody(this);
		return buffer.slice(byteOffset, byteOffset + byteLength);
	}

	async formData() {
		const ct = this.headers.get('content-type');

		if (ct.startsWith('application/x-www-form-urlencoded')) {
			const formData = new formdata_polyfill_esm_min_js__WEBPACK_IMPORTED_MODULE_4__.FormData();
			const parameters = new URLSearchParams(await this.text());

			for (const [name, value] of parameters) {
				formData.append(name, value);
			}

			return formData;
		}

		const {toFormData} = await __webpack_require__.e(/* import() */ 1).then(__webpack_require__.bind(__webpack_require__, 64));
		return toFormData(this.body, ct);
	}

	/**
	 * Return raw response as Blob
	 *
	 * @return Promise
	 */
	async blob() {
		const ct = (this.headers && this.headers.get('content-type')) || (this[INTERNALS].body && this[INTERNALS].body.type) || '';
		const buf = await this.arrayBuffer();

		return new fetch_blob__WEBPACK_IMPORTED_MODULE_3__["default"]([buf], {
			type: ct
		});
	}

	/**
	 * Decode response as json
	 *
	 * @return  Promise
	 */
	async json() {
		const text = await this.text();
		return JSON.parse(text);
	}

	/**
	 * Decode response as text
	 *
	 * @return  Promise
	 */
	async text() {
		const buffer = await consumeBody(this);
		return new TextDecoder().decode(buffer);
	}

	/**
	 * Decode response as buffer (non-spec api)
	 *
	 * @return  Promise
	 */
	buffer() {
		return consumeBody(this);
	}
}

Body.prototype.buffer = (0,node_util__WEBPACK_IMPORTED_MODULE_1__.deprecate)(Body.prototype.buffer, 'Please use \'response.arrayBuffer()\' instead of \'response.buffer()\'', 'node-fetch#buffer');

// In browsers, all properties are enumerable.
Object.defineProperties(Body.prototype, {
	body: {enumerable: true},
	bodyUsed: {enumerable: true},
	arrayBuffer: {enumerable: true},
	blob: {enumerable: true},
	json: {enumerable: true},
	text: {enumerable: true},
	data: {get: (0,node_util__WEBPACK_IMPORTED_MODULE_1__.deprecate)(() => {},
		'data doesn\'t exist, use json(), text(), arrayBuffer(), or body instead',
		'https://github.com/node-fetch/node-fetch/issues/1000 (response)')}
});

/**
 * Consume and convert an entire Body to a Buffer.
 *
 * Ref: https://fetch.spec.whatwg.org/#concept-body-consume-body
 *
 * @return Promise
 */
async function consumeBody(data) {
	if (data[INTERNALS].disturbed) {
		throw new TypeError(`body used already for: ${data.url}`);
	}

	data[INTERNALS].disturbed = true;

	if (data[INTERNALS].error) {
		throw data[INTERNALS].error;
	}

	const {body} = data;

	// Body is null
	if (body === null) {
		return node_buffer__WEBPACK_IMPORTED_MODULE_2__.Buffer.alloc(0);
	}

	/* c8 ignore next 3 */
	if (!(body instanceof node_stream__WEBPACK_IMPORTED_MODULE_0__)) {
		return node_buffer__WEBPACK_IMPORTED_MODULE_2__.Buffer.alloc(0);
	}

	// Body is stream
	// get ready to actually consume the body
	const accum = [];
	let accumBytes = 0;

	try {
		for await (const chunk of body) {
			if (data.size > 0 && accumBytes + chunk.length > data.size) {
				const error = new _errors_fetch_error_js__WEBPACK_IMPORTED_MODULE_5__.FetchError(`content size at ${data.url} over limit: ${data.size}`, 'max-size');
				body.destroy(error);
				throw error;
			}

			accumBytes += chunk.length;
			accum.push(chunk);
		}
	} catch (error) {
		const error_ = error instanceof _errors_base_js__WEBPACK_IMPORTED_MODULE_6__.FetchBaseError ? error : new _errors_fetch_error_js__WEBPACK_IMPORTED_MODULE_5__.FetchError(`Invalid response body while trying to fetch ${data.url}: ${error.message}`, 'system', error);
		throw error_;
	}

	if (body.readableEnded === true || body._readableState.ended === true) {
		try {
			if (accum.every(c => typeof c === 'string')) {
				return node_buffer__WEBPACK_IMPORTED_MODULE_2__.Buffer.from(accum.join(''));
			}

			return node_buffer__WEBPACK_IMPORTED_MODULE_2__.Buffer.concat(accum, accumBytes);
		} catch (error) {
			throw new _errors_fetch_error_js__WEBPACK_IMPORTED_MODULE_5__.FetchError(`Could not create Buffer from response body for ${data.url}: ${error.message}`, 'system', error);
		}
	} else {
		throw new _errors_fetch_error_js__WEBPACK_IMPORTED_MODULE_5__.FetchError(`Premature close of server response while trying to fetch ${data.url}`);
	}
}

/**
 * Clone body given Res/Req instance
 *
 * @param   Mixed   instance       Response or Request instance
 * @param   String  highWaterMark  highWaterMark for both PassThrough body streams
 * @return  Mixed
 */
const clone = (instance, highWaterMark) => {
	let p1;
	let p2;
	let {body} = instance[INTERNALS];

	// Don't allow cloning a used body
	if (instance.bodyUsed) {
		throw new Error('cannot clone body after it is used');
	}

	// Check that body is a stream and not form-data object
	// note: we can't clone the form-data object without having it as a dependency
	if ((body instanceof node_stream__WEBPACK_IMPORTED_MODULE_0__) && (typeof body.getBoundary !== 'function')) {
		// Tee instance body
		p1 = new node_stream__WEBPACK_IMPORTED_MODULE_0__.PassThrough({highWaterMark});
		p2 = new node_stream__WEBPACK_IMPORTED_MODULE_0__.PassThrough({highWaterMark});
		body.pipe(p1);
		body.pipe(p2);
		// Set instance body to teed body and return the other teed body
		instance[INTERNALS].stream = p1;
		body = p2;
	}

	return body;
};

const getNonSpecFormDataBoundary = (0,node_util__WEBPACK_IMPORTED_MODULE_1__.deprecate)(
	body => body.getBoundary(),
	'form-data doesn\'t follow the spec and requires special treatment. Use alternative package',
	'https://github.com/node-fetch/node-fetch/issues/1167'
);

/**
 * Performs the operation "extract a `Content-Type` value from |object|" as
 * specified in the specification:
 * https://fetch.spec.whatwg.org/#concept-bodyinit-extract
 *
 * This function assumes that instance.body is present.
 *
 * @param {any} body Any options.body input
 * @returns {string | null}
 */
const extractContentType = (body, request) => {
	// Body is null or undefined
	if (body === null) {
		return null;
	}

	// Body is string
	if (typeof body === 'string') {
		return 'text/plain;charset=UTF-8';
	}

	// Body is a URLSearchParams
	if ((0,_utils_is_js__WEBPACK_IMPORTED_MODULE_7__.isURLSearchParameters)(body)) {
		return 'application/x-www-form-urlencoded;charset=UTF-8';
	}

	// Body is blob
	if ((0,_utils_is_js__WEBPACK_IMPORTED_MODULE_7__.isBlob)(body)) {
		return body.type || null;
	}

	// Body is a Buffer (Buffer, ArrayBuffer or ArrayBufferView)
	if (node_buffer__WEBPACK_IMPORTED_MODULE_2__.Buffer.isBuffer(body) || node_util__WEBPACK_IMPORTED_MODULE_1__.types.isAnyArrayBuffer(body) || ArrayBuffer.isView(body)) {
		return null;
	}

	if (body instanceof formdata_polyfill_esm_min_js__WEBPACK_IMPORTED_MODULE_4__.FormData) {
		return `multipart/form-data; boundary=${request[INTERNALS].boundary}`;
	}

	// Detect form data input from form-data module
	if (body && typeof body.getBoundary === 'function') {
		return `multipart/form-data;boundary=${getNonSpecFormDataBoundary(body)}`;
	}

	// Body is stream - can't really do much about this
	if (body instanceof node_stream__WEBPACK_IMPORTED_MODULE_0__) {
		return null;
	}

	// Body constructor defaults other things to string
	return 'text/plain;charset=UTF-8';
};

/**
 * The Fetch Standard treats this as if "total bytes" is a property on the body.
 * For us, we have to explicitly get it with a function.
 *
 * ref: https://fetch.spec.whatwg.org/#concept-body-total-bytes
 *
 * @param {any} obj.body Body object from the Body instance.
 * @returns {number | null}
 */
const getTotalBytes = request => {
	const {body} = request[INTERNALS];

	// Body is null or undefined
	if (body === null) {
		return 0;
	}

	// Body is Blob
	if ((0,_utils_is_js__WEBPACK_IMPORTED_MODULE_7__.isBlob)(body)) {
		return body.size;
	}

	// Body is Buffer
	if (node_buffer__WEBPACK_IMPORTED_MODULE_2__.Buffer.isBuffer(body)) {
		return body.length;
	}

	// Detect form data input from form-data module
	if (body && typeof body.getLengthSync === 'function') {
		return body.hasKnownLength && body.hasKnownLength() ? body.getLengthSync() : null;
	}

	// Body is stream
	return null;
};

/**
 * Write a Body to a Node.js WritableStream (e.g. http.Request) object.
 *
 * @param {Stream.Writable} dest The stream to write to.
 * @param obj.body Body object from the Body instance.
 * @returns {Promise<void>}
 */
const writeToStream = async (dest, {body}) => {
	if (body === null) {
		// Body is null
		dest.end();
	} else {
		// Body is stream
		await pipeline(body, dest);
	}
};


/***/ }),
/* 24 */
/***/ ((module) => {

"use strict";
module.exports = require("node:util");

/***/ }),
/* 25 */
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Blob: () => (/* binding */ Blob),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _streams_cjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(26);
/*! fetch-blob. MIT License. Jimmy Wärting <https://jimmy.warting.se/opensource> */

// TODO (jimmywarting): in the feature use conditional loading with top level await (requires 14.x)
// Node has recently added whatwg stream into core



// 64 KiB (same size chrome slice theirs blob into Uint8array's)
const POOL_SIZE = 65536

/** @param {(Blob | Uint8Array)[]} parts */
async function * toIterator (parts, clone = true) {
  for (const part of parts) {
    if ('stream' in part) {
      yield * (/** @type {AsyncIterableIterator<Uint8Array>} */ (part.stream()))
    } else if (ArrayBuffer.isView(part)) {
      if (clone) {
        let position = part.byteOffset
        const end = part.byteOffset + part.byteLength
        while (position !== end) {
          const size = Math.min(end - position, POOL_SIZE)
          const chunk = part.buffer.slice(position, position + size)
          position += chunk.byteLength
          yield new Uint8Array(chunk)
        }
      } else {
        yield part
      }
    /* c8 ignore next 10 */
    } else {
      // For blobs that have arrayBuffer but no stream method (nodes buffer.Blob)
      let position = 0, b = (/** @type {Blob} */ (part))
      while (position !== b.size) {
        const chunk = b.slice(position, Math.min(b.size, position + POOL_SIZE))
        const buffer = await chunk.arrayBuffer()
        position += buffer.byteLength
        yield new Uint8Array(buffer)
      }
    }
  }
}

const _Blob = class Blob {
  /** @type {Array.<(Blob|Uint8Array)>} */
  #parts = []
  #type = ''
  #size = 0
  #endings = 'transparent'

  /**
   * The Blob() constructor returns a new Blob object. The content
   * of the blob consists of the concatenation of the values given
   * in the parameter array.
   *
   * @param {*} blobParts
   * @param {{ type?: string, endings?: string }} [options]
   */
  constructor (blobParts = [], options = {}) {
    if (typeof blobParts !== 'object' || blobParts === null) {
      throw new TypeError('Failed to construct \'Blob\': The provided value cannot be converted to a sequence.')
    }

    if (typeof blobParts[Symbol.iterator] !== 'function') {
      throw new TypeError('Failed to construct \'Blob\': The object must have a callable @@iterator property.')
    }

    if (typeof options !== 'object' && typeof options !== 'function') {
      throw new TypeError('Failed to construct \'Blob\': parameter 2 cannot convert to dictionary.')
    }

    if (options === null) options = {}

    const encoder = new TextEncoder()
    for (const element of blobParts) {
      let part
      if (ArrayBuffer.isView(element)) {
        part = new Uint8Array(element.buffer.slice(element.byteOffset, element.byteOffset + element.byteLength))
      } else if (element instanceof ArrayBuffer) {
        part = new Uint8Array(element.slice(0))
      } else if (element instanceof Blob) {
        part = element
      } else {
        part = encoder.encode(`${element}`)
      }

      this.#size += ArrayBuffer.isView(part) ? part.byteLength : part.size
      this.#parts.push(part)
    }

    this.#endings = `${options.endings === undefined ? 'transparent' : options.endings}`
    const type = options.type === undefined ? '' : String(options.type)
    this.#type = /^[\x20-\x7E]*$/.test(type) ? type : ''
  }

  /**
   * The Blob interface's size property returns the
   * size of the Blob in bytes.
   */
  get size () {
    return this.#size
  }

  /**
   * The type property of a Blob object returns the MIME type of the file.
   */
  get type () {
    return this.#type
  }

  /**
   * The text() method in the Blob interface returns a Promise
   * that resolves with a string containing the contents of
   * the blob, interpreted as UTF-8.
   *
   * @return {Promise<string>}
   */
  async text () {
    // More optimized than using this.arrayBuffer()
    // that requires twice as much ram
    const decoder = new TextDecoder()
    let str = ''
    for await (const part of toIterator(this.#parts, false)) {
      str += decoder.decode(part, { stream: true })
    }
    // Remaining
    str += decoder.decode()
    return str
  }

  /**
   * The arrayBuffer() method in the Blob interface returns a
   * Promise that resolves with the contents of the blob as
   * binary data contained in an ArrayBuffer.
   *
   * @return {Promise<ArrayBuffer>}
   */
  async arrayBuffer () {
    // Easier way... Just a unnecessary overhead
    // const view = new Uint8Array(this.size);
    // await this.stream().getReader({mode: 'byob'}).read(view);
    // return view.buffer;

    const data = new Uint8Array(this.size)
    let offset = 0
    for await (const chunk of toIterator(this.#parts, false)) {
      data.set(chunk, offset)
      offset += chunk.length
    }

    return data.buffer
  }

  stream () {
    const it = toIterator(this.#parts, true)

    return new globalThis.ReadableStream({
      // @ts-ignore
      type: 'bytes',
      async pull (ctrl) {
        const chunk = await it.next()
        chunk.done ? ctrl.close() : ctrl.enqueue(chunk.value)
      },

      async cancel () {
        await it.return()
      }
    })
  }

  /**
   * The Blob interface's slice() method creates and returns a
   * new Blob object which contains data from a subset of the
   * blob on which it's called.
   *
   * @param {number} [start]
   * @param {number} [end]
   * @param {string} [type]
   */
  slice (start = 0, end = this.size, type = '') {
    const { size } = this

    let relativeStart = start < 0 ? Math.max(size + start, 0) : Math.min(start, size)
    let relativeEnd = end < 0 ? Math.max(size + end, 0) : Math.min(end, size)

    const span = Math.max(relativeEnd - relativeStart, 0)
    const parts = this.#parts
    const blobParts = []
    let added = 0

    for (const part of parts) {
      // don't add the overflow to new blobParts
      if (added >= span) {
        break
      }

      const size = ArrayBuffer.isView(part) ? part.byteLength : part.size
      if (relativeStart && size <= relativeStart) {
        // Skip the beginning and change the relative
        // start & end position as we skip the unwanted parts
        relativeStart -= size
        relativeEnd -= size
      } else {
        let chunk
        if (ArrayBuffer.isView(part)) {
          chunk = part.subarray(relativeStart, Math.min(size, relativeEnd))
          added += chunk.byteLength
        } else {
          chunk = part.slice(relativeStart, Math.min(size, relativeEnd))
          added += chunk.size
        }
        relativeEnd -= size
        blobParts.push(chunk)
        relativeStart = 0 // All next sequential parts should start at 0
      }
    }

    const blob = new Blob([], { type: String(type).toLowerCase() })
    blob.#size = span
    blob.#parts = blobParts

    return blob
  }

  get [Symbol.toStringTag] () {
    return 'Blob'
  }

  static [Symbol.hasInstance] (object) {
    return (
      object &&
      typeof object === 'object' &&
      typeof object.constructor === 'function' &&
      (
        typeof object.stream === 'function' ||
        typeof object.arrayBuffer === 'function'
      ) &&
      /^(Blob|File)$/.test(object[Symbol.toStringTag])
    )
  }
}

Object.defineProperties(_Blob.prototype, {
  size: { enumerable: true },
  type: { enumerable: true },
  slice: { enumerable: true }
})

/** @type {typeof globalThis.Blob} */
const Blob = _Blob
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Blob);


/***/ }),
/* 26 */
/***/ ((__unused_webpack_module, __unused_webpack_exports, __webpack_require__) => {

/* c8 ignore start */
// 64 KiB (same size chrome slice theirs blob into Uint8array's)
const POOL_SIZE = 65536

if (!globalThis.ReadableStream) {
  // `node:stream/web` got introduced in v16.5.0 as experimental
  // and it's preferred over the polyfilled version. So we also
  // suppress the warning that gets emitted by NodeJS for using it.
  try {
    const process = __webpack_require__(27)
    const { emitWarning } = process
    try {
      process.emitWarning = () => {}
      Object.assign(globalThis, __webpack_require__(28))
      process.emitWarning = emitWarning
    } catch (error) {
      process.emitWarning = emitWarning
      throw error
    }
  } catch (error) {
    // fallback to polyfill implementation
    Object.assign(globalThis, __webpack_require__(29))
  }
}

try {
  // Don't use node: prefix for this, require+node: is not supported until node v14.14
  // Only `import()` can use prefix in 12.20 and later
  const { Blob } = __webpack_require__(30)
  if (Blob && !Blob.prototype.stream) {
    Blob.prototype.stream = function name (params) {
      let position = 0
      const blob = this

      return new ReadableStream({
        type: 'bytes',
        async pull (ctrl) {
          const chunk = blob.slice(position, Math.min(blob.size, position + POOL_SIZE))
          const buffer = await chunk.arrayBuffer()
          position += buffer.byteLength
          ctrl.enqueue(new Uint8Array(buffer))

          if (position === blob.size) {
            ctrl.close()
          }
        }
      })
    }
  }
} catch (error) {}
/* c8 ignore end */


/***/ }),
/* 27 */
/***/ ((module) => {

"use strict";
module.exports = require("node:process");

/***/ }),
/* 28 */
/***/ ((module) => {

"use strict";
module.exports = require("node:stream/web");

/***/ }),
/* 29 */
/***/ (function(__unused_webpack_module, exports) {

/**
 * web-streams-polyfill v3.2.1
 */
(function (global, factory) {
     true ? factory(exports) :
    0;
}(this, (function (exports) { 'use strict';

    /// <reference lib="es2015.symbol" />
    const SymbolPolyfill = typeof Symbol === 'function' && typeof Symbol.iterator === 'symbol' ?
        Symbol :
        description => `Symbol(${description})`;

    /// <reference lib="dom" />
    function noop() {
        return undefined;
    }
    function getGlobals() {
        if (typeof self !== 'undefined') {
            return self;
        }
        else if (typeof window !== 'undefined') {
            return window;
        }
        else if (typeof global !== 'undefined') {
            return global;
        }
        return undefined;
    }
    const globals = getGlobals();

    function typeIsObject(x) {
        return (typeof x === 'object' && x !== null) || typeof x === 'function';
    }
    const rethrowAssertionErrorRejection = noop;

    const originalPromise = Promise;
    const originalPromiseThen = Promise.prototype.then;
    const originalPromiseResolve = Promise.resolve.bind(originalPromise);
    const originalPromiseReject = Promise.reject.bind(originalPromise);
    function newPromise(executor) {
        return new originalPromise(executor);
    }
    function promiseResolvedWith(value) {
        return originalPromiseResolve(value);
    }
    function promiseRejectedWith(reason) {
        return originalPromiseReject(reason);
    }
    function PerformPromiseThen(promise, onFulfilled, onRejected) {
        // There doesn't appear to be any way to correctly emulate the behaviour from JavaScript, so this is just an
        // approximation.
        return originalPromiseThen.call(promise, onFulfilled, onRejected);
    }
    function uponPromise(promise, onFulfilled, onRejected) {
        PerformPromiseThen(PerformPromiseThen(promise, onFulfilled, onRejected), undefined, rethrowAssertionErrorRejection);
    }
    function uponFulfillment(promise, onFulfilled) {
        uponPromise(promise, onFulfilled);
    }
    function uponRejection(promise, onRejected) {
        uponPromise(promise, undefined, onRejected);
    }
    function transformPromiseWith(promise, fulfillmentHandler, rejectionHandler) {
        return PerformPromiseThen(promise, fulfillmentHandler, rejectionHandler);
    }
    function setPromiseIsHandledToTrue(promise) {
        PerformPromiseThen(promise, undefined, rethrowAssertionErrorRejection);
    }
    const queueMicrotask = (() => {
        const globalQueueMicrotask = globals && globals.queueMicrotask;
        if (typeof globalQueueMicrotask === 'function') {
            return globalQueueMicrotask;
        }
        const resolvedPromise = promiseResolvedWith(undefined);
        return (fn) => PerformPromiseThen(resolvedPromise, fn);
    })();
    function reflectCall(F, V, args) {
        if (typeof F !== 'function') {
            throw new TypeError('Argument is not a function');
        }
        return Function.prototype.apply.call(F, V, args);
    }
    function promiseCall(F, V, args) {
        try {
            return promiseResolvedWith(reflectCall(F, V, args));
        }
        catch (value) {
            return promiseRejectedWith(value);
        }
    }

    // Original from Chromium
    // https://chromium.googlesource.com/chromium/src/+/0aee4434a4dba42a42abaea9bfbc0cd196a63bc1/third_party/blink/renderer/core/streams/SimpleQueue.js
    const QUEUE_MAX_ARRAY_SIZE = 16384;
    /**
     * Simple queue structure.
     *
     * Avoids scalability issues with using a packed array directly by using
     * multiple arrays in a linked list and keeping the array size bounded.
     */
    class SimpleQueue {
        constructor() {
            this._cursor = 0;
            this._size = 0;
            // _front and _back are always defined.
            this._front = {
                _elements: [],
                _next: undefined
            };
            this._back = this._front;
            // The cursor is used to avoid calling Array.shift().
            // It contains the index of the front element of the array inside the
            // front-most node. It is always in the range [0, QUEUE_MAX_ARRAY_SIZE).
            this._cursor = 0;
            // When there is only one node, size === elements.length - cursor.
            this._size = 0;
        }
        get length() {
            return this._size;
        }
        // For exception safety, this method is structured in order:
        // 1. Read state
        // 2. Calculate required state mutations
        // 3. Perform state mutations
        push(element) {
            const oldBack = this._back;
            let newBack = oldBack;
            if (oldBack._elements.length === QUEUE_MAX_ARRAY_SIZE - 1) {
                newBack = {
                    _elements: [],
                    _next: undefined
                };
            }
            // push() is the mutation most likely to throw an exception, so it
            // goes first.
            oldBack._elements.push(element);
            if (newBack !== oldBack) {
                this._back = newBack;
                oldBack._next = newBack;
            }
            ++this._size;
        }
        // Like push(), shift() follows the read -> calculate -> mutate pattern for
        // exception safety.
        shift() { // must not be called on an empty queue
            const oldFront = this._front;
            let newFront = oldFront;
            const oldCursor = this._cursor;
            let newCursor = oldCursor + 1;
            const elements = oldFront._elements;
            const element = elements[oldCursor];
            if (newCursor === QUEUE_MAX_ARRAY_SIZE) {
                newFront = oldFront._next;
                newCursor = 0;
            }
            // No mutations before this point.
            --this._size;
            this._cursor = newCursor;
            if (oldFront !== newFront) {
                this._front = newFront;
            }
            // Permit shifted element to be garbage collected.
            elements[oldCursor] = undefined;
            return element;
        }
        // The tricky thing about forEach() is that it can be called
        // re-entrantly. The queue may be mutated inside the callback. It is easy to
        // see that push() within the callback has no negative effects since the end
        // of the queue is checked for on every iteration. If shift() is called
        // repeatedly within the callback then the next iteration may return an
        // element that has been removed. In this case the callback will be called
        // with undefined values until we either "catch up" with elements that still
        // exist or reach the back of the queue.
        forEach(callback) {
            let i = this._cursor;
            let node = this._front;
            let elements = node._elements;
            while (i !== elements.length || node._next !== undefined) {
                if (i === elements.length) {
                    node = node._next;
                    elements = node._elements;
                    i = 0;
                    if (elements.length === 0) {
                        break;
                    }
                }
                callback(elements[i]);
                ++i;
            }
        }
        // Return the element that would be returned if shift() was called now,
        // without modifying the queue.
        peek() { // must not be called on an empty queue
            const front = this._front;
            const cursor = this._cursor;
            return front._elements[cursor];
        }
    }

    function ReadableStreamReaderGenericInitialize(reader, stream) {
        reader._ownerReadableStream = stream;
        stream._reader = reader;
        if (stream._state === 'readable') {
            defaultReaderClosedPromiseInitialize(reader);
        }
        else if (stream._state === 'closed') {
            defaultReaderClosedPromiseInitializeAsResolved(reader);
        }
        else {
            defaultReaderClosedPromiseInitializeAsRejected(reader, stream._storedError);
        }
    }
    // A client of ReadableStreamDefaultReader and ReadableStreamBYOBReader may use these functions directly to bypass state
    // check.
    function ReadableStreamReaderGenericCancel(reader, reason) {
        const stream = reader._ownerReadableStream;
        return ReadableStreamCancel(stream, reason);
    }
    function ReadableStreamReaderGenericRelease(reader) {
        if (reader._ownerReadableStream._state === 'readable') {
            defaultReaderClosedPromiseReject(reader, new TypeError(`Reader was released and can no longer be used to monitor the stream's closedness`));
        }
        else {
            defaultReaderClosedPromiseResetToRejected(reader, new TypeError(`Reader was released and can no longer be used to monitor the stream's closedness`));
        }
        reader._ownerReadableStream._reader = undefined;
        reader._ownerReadableStream = undefined;
    }
    // Helper functions for the readers.
    function readerLockException(name) {
        return new TypeError('Cannot ' + name + ' a stream using a released reader');
    }
    // Helper functions for the ReadableStreamDefaultReader.
    function defaultReaderClosedPromiseInitialize(reader) {
        reader._closedPromise = newPromise((resolve, reject) => {
            reader._closedPromise_resolve = resolve;
            reader._closedPromise_reject = reject;
        });
    }
    function defaultReaderClosedPromiseInitializeAsRejected(reader, reason) {
        defaultReaderClosedPromiseInitialize(reader);
        defaultReaderClosedPromiseReject(reader, reason);
    }
    function defaultReaderClosedPromiseInitializeAsResolved(reader) {
        defaultReaderClosedPromiseInitialize(reader);
        defaultReaderClosedPromiseResolve(reader);
    }
    function defaultReaderClosedPromiseReject(reader, reason) {
        if (reader._closedPromise_reject === undefined) {
            return;
        }
        setPromiseIsHandledToTrue(reader._closedPromise);
        reader._closedPromise_reject(reason);
        reader._closedPromise_resolve = undefined;
        reader._closedPromise_reject = undefined;
    }
    function defaultReaderClosedPromiseResetToRejected(reader, reason) {
        defaultReaderClosedPromiseInitializeAsRejected(reader, reason);
    }
    function defaultReaderClosedPromiseResolve(reader) {
        if (reader._closedPromise_resolve === undefined) {
            return;
        }
        reader._closedPromise_resolve(undefined);
        reader._closedPromise_resolve = undefined;
        reader._closedPromise_reject = undefined;
    }

    const AbortSteps = SymbolPolyfill('[[AbortSteps]]');
    const ErrorSteps = SymbolPolyfill('[[ErrorSteps]]');
    const CancelSteps = SymbolPolyfill('[[CancelSteps]]');
    const PullSteps = SymbolPolyfill('[[PullSteps]]');

    /// <reference lib="es2015.core" />
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/isFinite#Polyfill
    const NumberIsFinite = Number.isFinite || function (x) {
        return typeof x === 'number' && isFinite(x);
    };

    /// <reference lib="es2015.core" />
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/trunc#Polyfill
    const MathTrunc = Math.trunc || function (v) {
        return v < 0 ? Math.ceil(v) : Math.floor(v);
    };

    // https://heycam.github.io/webidl/#idl-dictionaries
    function isDictionary(x) {
        return typeof x === 'object' || typeof x === 'function';
    }
    function assertDictionary(obj, context) {
        if (obj !== undefined && !isDictionary(obj)) {
            throw new TypeError(`${context} is not an object.`);
        }
    }
    // https://heycam.github.io/webidl/#idl-callback-functions
    function assertFunction(x, context) {
        if (typeof x !== 'function') {
            throw new TypeError(`${context} is not a function.`);
        }
    }
    // https://heycam.github.io/webidl/#idl-object
    function isObject(x) {
        return (typeof x === 'object' && x !== null) || typeof x === 'function';
    }
    function assertObject(x, context) {
        if (!isObject(x)) {
            throw new TypeError(`${context} is not an object.`);
        }
    }
    function assertRequiredArgument(x, position, context) {
        if (x === undefined) {
            throw new TypeError(`Parameter ${position} is required in '${context}'.`);
        }
    }
    function assertRequiredField(x, field, context) {
        if (x === undefined) {
            throw new TypeError(`${field} is required in '${context}'.`);
        }
    }
    // https://heycam.github.io/webidl/#idl-unrestricted-double
    function convertUnrestrictedDouble(value) {
        return Number(value);
    }
    function censorNegativeZero(x) {
        return x === 0 ? 0 : x;
    }
    function integerPart(x) {
        return censorNegativeZero(MathTrunc(x));
    }
    // https://heycam.github.io/webidl/#idl-unsigned-long-long
    function convertUnsignedLongLongWithEnforceRange(value, context) {
        const lowerBound = 0;
        const upperBound = Number.MAX_SAFE_INTEGER;
        let x = Number(value);
        x = censorNegativeZero(x);
        if (!NumberIsFinite(x)) {
            throw new TypeError(`${context} is not a finite number`);
        }
        x = integerPart(x);
        if (x < lowerBound || x > upperBound) {
            throw new TypeError(`${context} is outside the accepted range of ${lowerBound} to ${upperBound}, inclusive`);
        }
        if (!NumberIsFinite(x) || x === 0) {
            return 0;
        }
        // TODO Use BigInt if supported?
        // let xBigInt = BigInt(integerPart(x));
        // xBigInt = BigInt.asUintN(64, xBigInt);
        // return Number(xBigInt);
        return x;
    }

    function assertReadableStream(x, context) {
        if (!IsReadableStream(x)) {
            throw new TypeError(`${context} is not a ReadableStream.`);
        }
    }

    // Abstract operations for the ReadableStream.
    function AcquireReadableStreamDefaultReader(stream) {
        return new ReadableStreamDefaultReader(stream);
    }
    // ReadableStream API exposed for controllers.
    function ReadableStreamAddReadRequest(stream, readRequest) {
        stream._reader._readRequests.push(readRequest);
    }
    function ReadableStreamFulfillReadRequest(stream, chunk, done) {
        const reader = stream._reader;
        const readRequest = reader._readRequests.shift();
        if (done) {
            readRequest._closeSteps();
        }
        else {
            readRequest._chunkSteps(chunk);
        }
    }
    function ReadableStreamGetNumReadRequests(stream) {
        return stream._reader._readRequests.length;
    }
    function ReadableStreamHasDefaultReader(stream) {
        const reader = stream._reader;
        if (reader === undefined) {
            return false;
        }
        if (!IsReadableStreamDefaultReader(reader)) {
            return false;
        }
        return true;
    }
    /**
     * A default reader vended by a {@link ReadableStream}.
     *
     * @public
     */
    class ReadableStreamDefaultReader {
        constructor(stream) {
            assertRequiredArgument(stream, 1, 'ReadableStreamDefaultReader');
            assertReadableStream(stream, 'First parameter');
            if (IsReadableStreamLocked(stream)) {
                throw new TypeError('This stream has already been locked for exclusive reading by another reader');
            }
            ReadableStreamReaderGenericInitialize(this, stream);
            this._readRequests = new SimpleQueue();
        }
        /**
         * Returns a promise that will be fulfilled when the stream becomes closed,
         * or rejected if the stream ever errors or the reader's lock is released before the stream finishes closing.
         */
        get closed() {
            if (!IsReadableStreamDefaultReader(this)) {
                return promiseRejectedWith(defaultReaderBrandCheckException('closed'));
            }
            return this._closedPromise;
        }
        /**
         * If the reader is active, behaves the same as {@link ReadableStream.cancel | stream.cancel(reason)}.
         */
        cancel(reason = undefined) {
            if (!IsReadableStreamDefaultReader(this)) {
                return promiseRejectedWith(defaultReaderBrandCheckException('cancel'));
            }
            if (this._ownerReadableStream === undefined) {
                return promiseRejectedWith(readerLockException('cancel'));
            }
            return ReadableStreamReaderGenericCancel(this, reason);
        }
        /**
         * Returns a promise that allows access to the next chunk from the stream's internal queue, if available.
         *
         * If reading a chunk causes the queue to become empty, more data will be pulled from the underlying source.
         */
        read() {
            if (!IsReadableStreamDefaultReader(this)) {
                return promiseRejectedWith(defaultReaderBrandCheckException('read'));
            }
            if (this._ownerReadableStream === undefined) {
                return promiseRejectedWith(readerLockException('read from'));
            }
            let resolvePromise;
            let rejectPromise;
            const promise = newPromise((resolve, reject) => {
                resolvePromise = resolve;
                rejectPromise = reject;
            });
            const readRequest = {
                _chunkSteps: chunk => resolvePromise({ value: chunk, done: false }),
                _closeSteps: () => resolvePromise({ value: undefined, done: true }),
                _errorSteps: e => rejectPromise(e)
            };
            ReadableStreamDefaultReaderRead(this, readRequest);
            return promise;
        }
        /**
         * Releases the reader's lock on the corresponding stream. After the lock is released, the reader is no longer active.
         * If the associated stream is errored when the lock is released, the reader will appear errored in the same way
         * from now on; otherwise, the reader will appear closed.
         *
         * A reader's lock cannot be released while it still has a pending read request, i.e., if a promise returned by
         * the reader's {@link ReadableStreamDefaultReader.read | read()} method has not yet been settled. Attempting to
         * do so will throw a `TypeError` and leave the reader locked to the stream.
         */
        releaseLock() {
            if (!IsReadableStreamDefaultReader(this)) {
                throw defaultReaderBrandCheckException('releaseLock');
            }
            if (this._ownerReadableStream === undefined) {
                return;
            }
            if (this._readRequests.length > 0) {
                throw new TypeError('Tried to release a reader lock when that reader has pending read() calls un-settled');
            }
            ReadableStreamReaderGenericRelease(this);
        }
    }
    Object.defineProperties(ReadableStreamDefaultReader.prototype, {
        cancel: { enumerable: true },
        read: { enumerable: true },
        releaseLock: { enumerable: true },
        closed: { enumerable: true }
    });
    if (typeof SymbolPolyfill.toStringTag === 'symbol') {
        Object.defineProperty(ReadableStreamDefaultReader.prototype, SymbolPolyfill.toStringTag, {
            value: 'ReadableStreamDefaultReader',
            configurable: true
        });
    }
    // Abstract operations for the readers.
    function IsReadableStreamDefaultReader(x) {
        if (!typeIsObject(x)) {
            return false;
        }
        if (!Object.prototype.hasOwnProperty.call(x, '_readRequests')) {
            return false;
        }
        return x instanceof ReadableStreamDefaultReader;
    }
    function ReadableStreamDefaultReaderRead(reader, readRequest) {
        const stream = reader._ownerReadableStream;
        stream._disturbed = true;
        if (stream._state === 'closed') {
            readRequest._closeSteps();
        }
        else if (stream._state === 'errored') {
            readRequest._errorSteps(stream._storedError);
        }
        else {
            stream._readableStreamController[PullSteps](readRequest);
        }
    }
    // Helper functions for the ReadableStreamDefaultReader.
    function defaultReaderBrandCheckException(name) {
        return new TypeError(`ReadableStreamDefaultReader.prototype.${name} can only be used on a ReadableStreamDefaultReader`);
    }

    /// <reference lib="es2018.asynciterable" />
    /* eslint-disable @typescript-eslint/no-empty-function */
    const AsyncIteratorPrototype = Object.getPrototypeOf(Object.getPrototypeOf(async function* () { }).prototype);

    /// <reference lib="es2018.asynciterable" />
    class ReadableStreamAsyncIteratorImpl {
        constructor(reader, preventCancel) {
            this._ongoingPromise = undefined;
            this._isFinished = false;
            this._reader = reader;
            this._preventCancel = preventCancel;
        }
        next() {
            const nextSteps = () => this._nextSteps();
            this._ongoingPromise = this._ongoingPromise ?
                transformPromiseWith(this._ongoingPromise, nextSteps, nextSteps) :
                nextSteps();
            return this._ongoingPromise;
        }
        return(value) {
            const returnSteps = () => this._returnSteps(value);
            return this._ongoingPromise ?
                transformPromiseWith(this._ongoingPromise, returnSteps, returnSteps) :
                returnSteps();
        }
        _nextSteps() {
            if (this._isFinished) {
                return Promise.resolve({ value: undefined, done: true });
            }
            const reader = this._reader;
            if (reader._ownerReadableStream === undefined) {
                return promiseRejectedWith(readerLockException('iterate'));
            }
            let resolvePromise;
            let rejectPromise;
            const promise = newPromise((resolve, reject) => {
                resolvePromise = resolve;
                rejectPromise = reject;
            });
            const readRequest = {
                _chunkSteps: chunk => {
                    this._ongoingPromise = undefined;
                    // This needs to be delayed by one microtask, otherwise we stop pulling too early which breaks a test.
                    // FIXME Is this a bug in the specification, or in the test?
                    queueMicrotask(() => resolvePromise({ value: chunk, done: false }));
                },
                _closeSteps: () => {
                    this._ongoingPromise = undefined;
                    this._isFinished = true;
                    ReadableStreamReaderGenericRelease(reader);
                    resolvePromise({ value: undefined, done: true });
                },
                _errorSteps: reason => {
                    this._ongoingPromise = undefined;
                    this._isFinished = true;
                    ReadableStreamReaderGenericRelease(reader);
                    rejectPromise(reason);
                }
            };
            ReadableStreamDefaultReaderRead(reader, readRequest);
            return promise;
        }
        _returnSteps(value) {
            if (this._isFinished) {
                return Promise.resolve({ value, done: true });
            }
            this._isFinished = true;
            const reader = this._reader;
            if (reader._ownerReadableStream === undefined) {
                return promiseRejectedWith(readerLockException('finish iterating'));
            }
            if (!this._preventCancel) {
                const result = ReadableStreamReaderGenericCancel(reader, value);
                ReadableStreamReaderGenericRelease(reader);
                return transformPromiseWith(result, () => ({ value, done: true }));
            }
            ReadableStreamReaderGenericRelease(reader);
            return promiseResolvedWith({ value, done: true });
        }
    }
    const ReadableStreamAsyncIteratorPrototype = {
        next() {
            if (!IsReadableStreamAsyncIterator(this)) {
                return promiseRejectedWith(streamAsyncIteratorBrandCheckException('next'));
            }
            return this._asyncIteratorImpl.next();
        },
        return(value) {
            if (!IsReadableStreamAsyncIterator(this)) {
                return promiseRejectedWith(streamAsyncIteratorBrandCheckException('return'));
            }
            return this._asyncIteratorImpl.return(value);
        }
    };
    if (AsyncIteratorPrototype !== undefined) {
        Object.setPrototypeOf(ReadableStreamAsyncIteratorPrototype, AsyncIteratorPrototype);
    }
    // Abstract operations for the ReadableStream.
    function AcquireReadableStreamAsyncIterator(stream, preventCancel) {
        const reader = AcquireReadableStreamDefaultReader(stream);
        const impl = new ReadableStreamAsyncIteratorImpl(reader, preventCancel);
        const iterator = Object.create(ReadableStreamAsyncIteratorPrototype);
        iterator._asyncIteratorImpl = impl;
        return iterator;
    }
    function IsReadableStreamAsyncIterator(x) {
        if (!typeIsObject(x)) {
            return false;
        }
        if (!Object.prototype.hasOwnProperty.call(x, '_asyncIteratorImpl')) {
            return false;
        }
        try {
            // noinspection SuspiciousTypeOfGuard
            return x._asyncIteratorImpl instanceof
                ReadableStreamAsyncIteratorImpl;
        }
        catch (_a) {
            return false;
        }
    }
    // Helper functions for the ReadableStream.
    function streamAsyncIteratorBrandCheckException(name) {
        return new TypeError(`ReadableStreamAsyncIterator.${name} can only be used on a ReadableSteamAsyncIterator`);
    }

    /// <reference lib="es2015.core" />
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/isNaN#Polyfill
    const NumberIsNaN = Number.isNaN || function (x) {
        // eslint-disable-next-line no-self-compare
        return x !== x;
    };

    function CreateArrayFromList(elements) {
        // We use arrays to represent lists, so this is basically a no-op.
        // Do a slice though just in case we happen to depend on the unique-ness.
        return elements.slice();
    }
    function CopyDataBlockBytes(dest, destOffset, src, srcOffset, n) {
        new Uint8Array(dest).set(new Uint8Array(src, srcOffset, n), destOffset);
    }
    // Not implemented correctly
    function TransferArrayBuffer(O) {
        return O;
    }
    // Not implemented correctly
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    function IsDetachedBuffer(O) {
        return false;
    }
    function ArrayBufferSlice(buffer, begin, end) {
        // ArrayBuffer.prototype.slice is not available on IE10
        // https://www.caniuse.com/mdn-javascript_builtins_arraybuffer_slice
        if (buffer.slice) {
            return buffer.slice(begin, end);
        }
        const length = end - begin;
        const slice = new ArrayBuffer(length);
        CopyDataBlockBytes(slice, 0, buffer, begin, length);
        return slice;
    }

    function IsNonNegativeNumber(v) {
        if (typeof v !== 'number') {
            return false;
        }
        if (NumberIsNaN(v)) {
            return false;
        }
        if (v < 0) {
            return false;
        }
        return true;
    }
    function CloneAsUint8Array(O) {
        const buffer = ArrayBufferSlice(O.buffer, O.byteOffset, O.byteOffset + O.byteLength);
        return new Uint8Array(buffer);
    }

    function DequeueValue(container) {
        const pair = container._queue.shift();
        container._queueTotalSize -= pair.size;
        if (container._queueTotalSize < 0) {
            container._queueTotalSize = 0;
        }
        return pair.value;
    }
    function EnqueueValueWithSize(container, value, size) {
        if (!IsNonNegativeNumber(size) || size === Infinity) {
            throw new RangeError('Size must be a finite, non-NaN, non-negative number.');
        }
        container._queue.push({ value, size });
        container._queueTotalSize += size;
    }
    function PeekQueueValue(container) {
        const pair = container._queue.peek();
        return pair.value;
    }
    function ResetQueue(container) {
        container._queue = new SimpleQueue();
        container._queueTotalSize = 0;
    }

    /**
     * A pull-into request in a {@link ReadableByteStreamController}.
     *
     * @public
     */
    class ReadableStreamBYOBRequest {
        constructor() {
            throw new TypeError('Illegal constructor');
        }
        /**
         * Returns the view for writing in to, or `null` if the BYOB request has already been responded to.
         */
        get view() {
            if (!IsReadableStreamBYOBRequest(this)) {
                throw byobRequestBrandCheckException('view');
            }
            return this._view;
        }
        respond(bytesWritten) {
            if (!IsReadableStreamBYOBRequest(this)) {
                throw byobRequestBrandCheckException('respond');
            }
            assertRequiredArgument(bytesWritten, 1, 'respond');
            bytesWritten = convertUnsignedLongLongWithEnforceRange(bytesWritten, 'First parameter');
            if (this._associatedReadableByteStreamController === undefined) {
                throw new TypeError('This BYOB request has been invalidated');
            }
            if (IsDetachedBuffer(this._view.buffer)) ;
            ReadableByteStreamControllerRespond(this._associatedReadableByteStreamController, bytesWritten);
        }
        respondWithNewView(view) {
            if (!IsReadableStreamBYOBRequest(this)) {
                throw byobRequestBrandCheckException('respondWithNewView');
            }
            assertRequiredArgument(view, 1, 'respondWithNewView');
            if (!ArrayBuffer.isView(view)) {
                throw new TypeError('You can only respond with array buffer views');
            }
            if (this._associatedReadableByteStreamController === undefined) {
                throw new TypeError('This BYOB request has been invalidated');
            }
            if (IsDetachedBuffer(view.buffer)) ;
            ReadableByteStreamControllerRespondWithNewView(this._associatedReadableByteStreamController, view);
        }
    }
    Object.defineProperties(ReadableStreamBYOBRequest.prototype, {
        respond: { enumerable: true },
        respondWithNewView: { enumerable: true },
        view: { enumerable: true }
    });
    if (typeof SymbolPolyfill.toStringTag === 'symbol') {
        Object.defineProperty(ReadableStreamBYOBRequest.prototype, SymbolPolyfill.toStringTag, {
            value: 'ReadableStreamBYOBRequest',
            configurable: true
        });
    }
    /**
     * Allows control of a {@link ReadableStream | readable byte stream}'s state and internal queue.
     *
     * @public
     */
    class ReadableByteStreamController {
        constructor() {
            throw new TypeError('Illegal constructor');
        }
        /**
         * Returns the current BYOB pull request, or `null` if there isn't one.
         */
        get byobRequest() {
            if (!IsReadableByteStreamController(this)) {
                throw byteStreamControllerBrandCheckException('byobRequest');
            }
            return ReadableByteStreamControllerGetBYOBRequest(this);
        }
        /**
         * Returns the desired size to fill the controlled stream's internal queue. It can be negative, if the queue is
         * over-full. An underlying byte source ought to use this information to determine when and how to apply backpressure.
         */
        get desiredSize() {
            if (!IsReadableByteStreamController(this)) {
                throw byteStreamControllerBrandCheckException('desiredSize');
            }
            return ReadableByteStreamControllerGetDesiredSize(this);
        }
        /**
         * Closes the controlled readable stream. Consumers will still be able to read any previously-enqueued chunks from
         * the stream, but once those are read, the stream will become closed.
         */
        close() {
            if (!IsReadableByteStreamController(this)) {
                throw byteStreamControllerBrandCheckException('close');
            }
            if (this._closeRequested) {
                throw new TypeError('The stream has already been closed; do not close it again!');
            }
            const state = this._controlledReadableByteStream._state;
            if (state !== 'readable') {
                throw new TypeError(`The stream (in ${state} state) is not in the readable state and cannot be closed`);
            }
            ReadableByteStreamControllerClose(this);
        }
        enqueue(chunk) {
            if (!IsReadableByteStreamController(this)) {
                throw byteStreamControllerBrandCheckException('enqueue');
            }
            assertRequiredArgument(chunk, 1, 'enqueue');
            if (!ArrayBuffer.isView(chunk)) {
                throw new TypeError('chunk must be an array buffer view');
            }
            if (chunk.byteLength === 0) {
                throw new TypeError('chunk must have non-zero byteLength');
            }
            if (chunk.buffer.byteLength === 0) {
                throw new TypeError(`chunk's buffer must have non-zero byteLength`);
            }
            if (this._closeRequested) {
                throw new TypeError('stream is closed or draining');
            }
            const state = this._controlledReadableByteStream._state;
            if (state !== 'readable') {
                throw new TypeError(`The stream (in ${state} state) is not in the readable state and cannot be enqueued to`);
            }
            ReadableByteStreamControllerEnqueue(this, chunk);
        }
        /**
         * Errors the controlled readable stream, making all future interactions with it fail with the given error `e`.
         */
        error(e = undefined) {
            if (!IsReadableByteStreamController(this)) {
                throw byteStreamControllerBrandCheckException('error');
            }
            ReadableByteStreamControllerError(this, e);
        }
        /** @internal */
        [CancelSteps](reason) {
            ReadableByteStreamControllerClearPendingPullIntos(this);
            ResetQueue(this);
            const result = this._cancelAlgorithm(reason);
            ReadableByteStreamControllerClearAlgorithms(this);
            return result;
        }
        /** @internal */
        [PullSteps](readRequest) {
            const stream = this._controlledReadableByteStream;
            if (this._queueTotalSize > 0) {
                const entry = this._queue.shift();
                this._queueTotalSize -= entry.byteLength;
                ReadableByteStreamControllerHandleQueueDrain(this);
                const view = new Uint8Array(entry.buffer, entry.byteOffset, entry.byteLength);
                readRequest._chunkSteps(view);
                return;
            }
            const autoAllocateChunkSize = this._autoAllocateChunkSize;
            if (autoAllocateChunkSize !== undefined) {
                let buffer;
                try {
                    buffer = new ArrayBuffer(autoAllocateChunkSize);
                }
                catch (bufferE) {
                    readRequest._errorSteps(bufferE);
                    return;
                }
                const pullIntoDescriptor = {
                    buffer,
                    bufferByteLength: autoAllocateChunkSize,
                    byteOffset: 0,
                    byteLength: autoAllocateChunkSize,
                    bytesFilled: 0,
                    elementSize: 1,
                    viewConstructor: Uint8Array,
                    readerType: 'default'
                };
                this._pendingPullIntos.push(pullIntoDescriptor);
            }
            ReadableStreamAddReadRequest(stream, readRequest);
            ReadableByteStreamControllerCallPullIfNeeded(this);
        }
    }
    Object.defineProperties(ReadableByteStreamController.prototype, {
        close: { enumerable: true },
        enqueue: { enumerable: true },
        error: { enumerable: true },
        byobRequest: { enumerable: true },
        desiredSize: { enumerable: true }
    });
    if (typeof SymbolPolyfill.toStringTag === 'symbol') {
        Object.defineProperty(ReadableByteStreamController.prototype, SymbolPolyfill.toStringTag, {
            value: 'ReadableByteStreamController',
            configurable: true
        });
    }
    // Abstract operations for the ReadableByteStreamController.
    function IsReadableByteStreamController(x) {
        if (!typeIsObject(x)) {
            return false;
        }
        if (!Object.prototype.hasOwnProperty.call(x, '_controlledReadableByteStream')) {
            return false;
        }
        return x instanceof ReadableByteStreamController;
    }
    function IsReadableStreamBYOBRequest(x) {
        if (!typeIsObject(x)) {
            return false;
        }
        if (!Object.prototype.hasOwnProperty.call(x, '_associatedReadableByteStreamController')) {
            return false;
        }
        return x instanceof ReadableStreamBYOBRequest;
    }
    function ReadableByteStreamControllerCallPullIfNeeded(controller) {
        const shouldPull = ReadableByteStreamControllerShouldCallPull(controller);
        if (!shouldPull) {
            return;
        }
        if (controller._pulling) {
            controller._pullAgain = true;
            return;
        }
        controller._pulling = true;
        // TODO: Test controller argument
        const pullPromise = controller._pullAlgorithm();
        uponPromise(pullPromise, () => {
            controller._pulling = false;
            if (controller._pullAgain) {
                controller._pullAgain = false;
                ReadableByteStreamControllerCallPullIfNeeded(controller);
            }
        }, e => {
            ReadableByteStreamControllerError(controller, e);
        });
    }
    function ReadableByteStreamControllerClearPendingPullIntos(controller) {
        ReadableByteStreamControllerInvalidateBYOBRequest(controller);
        controller._pendingPullIntos = new SimpleQueue();
    }
    function ReadableByteStreamControllerCommitPullIntoDescriptor(stream, pullIntoDescriptor) {
        let done = false;
        if (stream._state === 'closed') {
            done = true;
        }
        const filledView = ReadableByteStreamControllerConvertPullIntoDescriptor(pullIntoDescriptor);
        if (pullIntoDescriptor.readerType === 'default') {
            ReadableStreamFulfillReadRequest(stream, filledView, done);
        }
        else {
            ReadableStreamFulfillReadIntoRequest(stream, filledView, done);
        }
    }
    function ReadableByteStreamControllerConvertPullIntoDescriptor(pullIntoDescriptor) {
        const bytesFilled = pullIntoDescriptor.bytesFilled;
        const elementSize = pullIntoDescriptor.elementSize;
        return new pullIntoDescriptor.viewConstructor(pullIntoDescriptor.buffer, pullIntoDescriptor.byteOffset, bytesFilled / elementSize);
    }
    function ReadableByteStreamControllerEnqueueChunkToQueue(controller, buffer, byteOffset, byteLength) {
        controller._queue.push({ buffer, byteOffset, byteLength });
        controller._queueTotalSize += byteLength;
    }
    function ReadableByteStreamControllerFillPullIntoDescriptorFromQueue(controller, pullIntoDescriptor) {
        const elementSize = pullIntoDescriptor.elementSize;
        const currentAlignedBytes = pullIntoDescriptor.bytesFilled - pullIntoDescriptor.bytesFilled % elementSize;
        const maxBytesToCopy = Math.min(controller._queueTotalSize, pullIntoDescriptor.byteLength - pullIntoDescriptor.bytesFilled);
        const maxBytesFilled = pullIntoDescriptor.bytesFilled + maxBytesToCopy;
        const maxAlignedBytes = maxBytesFilled - maxBytesFilled % elementSize;
        let totalBytesToCopyRemaining = maxBytesToCopy;
        let ready = false;
        if (maxAlignedBytes > currentAlignedBytes) {
            totalBytesToCopyRemaining = maxAlignedBytes - pullIntoDescriptor.bytesFilled;
            ready = true;
        }
        const queue = controller._queue;
        while (totalBytesToCopyRemaining > 0) {
            const headOfQueue = queue.peek();
            const bytesToCopy = Math.min(totalBytesToCopyRemaining, headOfQueue.byteLength);
            const destStart = pullIntoDescriptor.byteOffset + pullIntoDescriptor.bytesFilled;
            CopyDataBlockBytes(pullIntoDescriptor.buffer, destStart, headOfQueue.buffer, headOfQueue.byteOffset, bytesToCopy);
            if (headOfQueue.byteLength === bytesToCopy) {
                queue.shift();
            }
            else {
                headOfQueue.byteOffset += bytesToCopy;
                headOfQueue.byteLength -= bytesToCopy;
            }
            controller._queueTotalSize -= bytesToCopy;
            ReadableByteStreamControllerFillHeadPullIntoDescriptor(controller, bytesToCopy, pullIntoDescriptor);
            totalBytesToCopyRemaining -= bytesToCopy;
        }
        return ready;
    }
    function ReadableByteStreamControllerFillHeadPullIntoDescriptor(controller, size, pullIntoDescriptor) {
        pullIntoDescriptor.bytesFilled += size;
    }
    function ReadableByteStreamControllerHandleQueueDrain(controller) {
        if (controller._queueTotalSize === 0 && controller._closeRequested) {
            ReadableByteStreamControllerClearAlgorithms(controller);
            ReadableStreamClose(controller._controlledReadableByteStream);
        }
        else {
            ReadableByteStreamControllerCallPullIfNeeded(controller);
        }
    }
    function ReadableByteStreamControllerInvalidateBYOBRequest(controller) {
        if (controller._byobRequest === null) {
            return;
        }
        controller._byobRequest._associatedReadableByteStreamController = undefined;
        controller._byobRequest._view = null;
        controller._byobRequest = null;
    }
    function ReadableByteStreamControllerProcessPullIntoDescriptorsUsingQueue(controller) {
        while (controller._pendingPullIntos.length > 0) {
            if (controller._queueTotalSize === 0) {
                return;
            }
            const pullIntoDescriptor = controller._pendingPullIntos.peek();
            if (ReadableByteStreamControllerFillPullIntoDescriptorFromQueue(controller, pullIntoDescriptor)) {
                ReadableByteStreamControllerShiftPendingPullInto(controller);
                ReadableByteStreamControllerCommitPullIntoDescriptor(controller._controlledReadableByteStream, pullIntoDescriptor);
            }
        }
    }
    function ReadableByteStreamControllerPullInto(controller, view, readIntoRequest) {
        const stream = controller._controlledReadableByteStream;
        let elementSize = 1;
        if (view.constructor !== DataView) {
            elementSize = view.constructor.BYTES_PER_ELEMENT;
        }
        const ctor = view.constructor;
        // try {
        const buffer = TransferArrayBuffer(view.buffer);
        // } catch (e) {
        //   readIntoRequest._errorSteps(e);
        //   return;
        // }
        const pullIntoDescriptor = {
            buffer,
            bufferByteLength: buffer.byteLength,
            byteOffset: view.byteOffset,
            byteLength: view.byteLength,
            bytesFilled: 0,
            elementSize,
            viewConstructor: ctor,
            readerType: 'byob'
        };
        if (controller._pendingPullIntos.length > 0) {
            controller._pendingPullIntos.push(pullIntoDescriptor);
            // No ReadableByteStreamControllerCallPullIfNeeded() call since:
            // - No change happens on desiredSize
            // - The source has already been notified of that there's at least 1 pending read(view)
            ReadableStreamAddReadIntoRequest(stream, readIntoRequest);
            return;
        }
        if (stream._state === 'closed') {
            const emptyView = new ctor(pullIntoDescriptor.buffer, pullIntoDescriptor.byteOffset, 0);
            readIntoRequest._closeSteps(emptyView);
            return;
        }
        if (controller._queueTotalSize > 0) {
            if (ReadableByteStreamControllerFillPullIntoDescriptorFromQueue(controller, pullIntoDescriptor)) {
                const filledView = ReadableByteStreamControllerConvertPullIntoDescriptor(pullIntoDescriptor);
                ReadableByteStreamControllerHandleQueueDrain(controller);
                readIntoRequest._chunkSteps(filledView);
                return;
            }
            if (controller._closeRequested) {
                const e = new TypeError('Insufficient bytes to fill elements in the given buffer');
                ReadableByteStreamControllerError(controller, e);
                readIntoRequest._errorSteps(e);
                return;
            }
        }
        controller._pendingPullIntos.push(pullIntoDescriptor);
        ReadableStreamAddReadIntoRequest(stream, readIntoRequest);
        ReadableByteStreamControllerCallPullIfNeeded(controller);
    }
    function ReadableByteStreamControllerRespondInClosedState(controller, firstDescriptor) {
        const stream = controller._controlledReadableByteStream;
        if (ReadableStreamHasBYOBReader(stream)) {
            while (ReadableStreamGetNumReadIntoRequests(stream) > 0) {
                const pullIntoDescriptor = ReadableByteStreamControllerShiftPendingPullInto(controller);
                ReadableByteStreamControllerCommitPullIntoDescriptor(stream, pullIntoDescriptor);
            }
        }
    }
    function ReadableByteStreamControllerRespondInReadableState(controller, bytesWritten, pullIntoDescriptor) {
        ReadableByteStreamControllerFillHeadPullIntoDescriptor(controller, bytesWritten, pullIntoDescriptor);
        if (pullIntoDescriptor.bytesFilled < pullIntoDescriptor.elementSize) {
            return;
        }
        ReadableByteStreamControllerShiftPendingPullInto(controller);
        const remainderSize = pullIntoDescriptor.bytesFilled % pullIntoDescriptor.elementSize;
        if (remainderSize > 0) {
            const end = pullIntoDescriptor.byteOffset + pullIntoDescriptor.bytesFilled;
            const remainder = ArrayBufferSlice(pullIntoDescriptor.buffer, end - remainderSize, end);
            ReadableByteStreamControllerEnqueueChunkToQueue(controller, remainder, 0, remainder.byteLength);
        }
        pullIntoDescriptor.bytesFilled -= remainderSize;
        ReadableByteStreamControllerCommitPullIntoDescriptor(controller._controlledReadableByteStream, pullIntoDescriptor);
        ReadableByteStreamControllerProcessPullIntoDescriptorsUsingQueue(controller);
    }
    function ReadableByteStreamControllerRespondInternal(controller, bytesWritten) {
        const firstDescriptor = controller._pendingPullIntos.peek();
        ReadableByteStreamControllerInvalidateBYOBRequest(controller);
        const state = controller._controlledReadableByteStream._state;
        if (state === 'closed') {
            ReadableByteStreamControllerRespondInClosedState(controller);
        }
        else {
            ReadableByteStreamControllerRespondInReadableState(controller, bytesWritten, firstDescriptor);
        }
        ReadableByteStreamControllerCallPullIfNeeded(controller);
    }
    function ReadableByteStreamControllerShiftPendingPullInto(controller) {
        const descriptor = controller._pendingPullIntos.shift();
        return descriptor;
    }
    function ReadableByteStreamControllerShouldCallPull(controller) {
        const stream = controller._controlledReadableByteStream;
        if (stream._state !== 'readable') {
            return false;
        }
        if (controller._closeRequested) {
            return false;
        }
        if (!controller._started) {
            return false;
        }
        if (ReadableStreamHasDefaultReader(stream) && ReadableStreamGetNumReadRequests(stream) > 0) {
            return true;
        }
        if (ReadableStreamHasBYOBReader(stream) && ReadableStreamGetNumReadIntoRequests(stream) > 0) {
            return true;
        }
        const desiredSize = ReadableByteStreamControllerGetDesiredSize(controller);
        if (desiredSize > 0) {
            return true;
        }
        return false;
    }
    function ReadableByteStreamControllerClearAlgorithms(controller) {
        controller._pullAlgorithm = undefined;
        controller._cancelAlgorithm = undefined;
    }
    // A client of ReadableByteStreamController may use these functions directly to bypass state check.
    function ReadableByteStreamControllerClose(controller) {
        const stream = controller._controlledReadableByteStream;
        if (controller._closeRequested || stream._state !== 'readable') {
            return;
        }
        if (controller._queueTotalSize > 0) {
            controller._closeRequested = true;
            return;
        }
        if (controller._pendingPullIntos.length > 0) {
            const firstPendingPullInto = controller._pendingPullIntos.peek();
            if (firstPendingPullInto.bytesFilled > 0) {
                const e = new TypeError('Insufficient bytes to fill elements in the given buffer');
                ReadableByteStreamControllerError(controller, e);
                throw e;
            }
        }
        ReadableByteStreamControllerClearAlgorithms(controller);
        ReadableStreamClose(stream);
    }
    function ReadableByteStreamControllerEnqueue(controller, chunk) {
        const stream = controller._controlledReadableByteStream;
        if (controller._closeRequested || stream._state !== 'readable') {
            return;
        }
        const buffer = chunk.buffer;
        const byteOffset = chunk.byteOffset;
        const byteLength = chunk.byteLength;
        const transferredBuffer = TransferArrayBuffer(buffer);
        if (controller._pendingPullIntos.length > 0) {
            const firstPendingPullInto = controller._pendingPullIntos.peek();
            if (IsDetachedBuffer(firstPendingPullInto.buffer)) ;
            firstPendingPullInto.buffer = TransferArrayBuffer(firstPendingPullInto.buffer);
        }
        ReadableByteStreamControllerInvalidateBYOBRequest(controller);
        if (ReadableStreamHasDefaultReader(stream)) {
            if (ReadableStreamGetNumReadRequests(stream) === 0) {
                ReadableByteStreamControllerEnqueueChunkToQueue(controller, transferredBuffer, byteOffset, byteLength);
            }
            else {
                if (controller._pendingPullIntos.length > 0) {
                    ReadableByteStreamControllerShiftPendingPullInto(controller);
                }
                const transferredView = new Uint8Array(transferredBuffer, byteOffset, byteLength);
                ReadableStreamFulfillReadRequest(stream, transferredView, false);
            }
        }
        else if (ReadableStreamHasBYOBReader(stream)) {
            // TODO: Ideally in this branch detaching should happen only if the buffer is not consumed fully.
            ReadableByteStreamControllerEnqueueChunkToQueue(controller, transferredBuffer, byteOffset, byteLength);
            ReadableByteStreamControllerProcessPullIntoDescriptorsUsingQueue(controller);
        }
        else {
            ReadableByteStreamControllerEnqueueChunkToQueue(controller, transferredBuffer, byteOffset, byteLength);
        }
        ReadableByteStreamControllerCallPullIfNeeded(controller);
    }
    function ReadableByteStreamControllerError(controller, e) {
        const stream = controller._controlledReadableByteStream;
        if (stream._state !== 'readable') {
            return;
        }
        ReadableByteStreamControllerClearPendingPullIntos(controller);
        ResetQueue(controller);
        ReadableByteStreamControllerClearAlgorithms(controller);
        ReadableStreamError(stream, e);
    }
    function ReadableByteStreamControllerGetBYOBRequest(controller) {
        if (controller._byobRequest === null && controller._pendingPullIntos.length > 0) {
            const firstDescriptor = controller._pendingPullIntos.peek();
            const view = new Uint8Array(firstDescriptor.buffer, firstDescriptor.byteOffset + firstDescriptor.bytesFilled, firstDescriptor.byteLength - firstDescriptor.bytesFilled);
            const byobRequest = Object.create(ReadableStreamBYOBRequest.prototype);
            SetUpReadableStreamBYOBRequest(byobRequest, controller, view);
            controller._byobRequest = byobRequest;
        }
        return controller._byobRequest;
    }
    function ReadableByteStreamControllerGetDesiredSize(controller) {
        const state = controller._controlledReadableByteStream._state;
        if (state === 'errored') {
            return null;
        }
        if (state === 'closed') {
            return 0;
        }
        return controller._strategyHWM - controller._queueTotalSize;
    }
    function ReadableByteStreamControllerRespond(controller, bytesWritten) {
        const firstDescriptor = controller._pendingPullIntos.peek();
        const state = controller._controlledReadableByteStream._state;
        if (state === 'closed') {
            if (bytesWritten !== 0) {
                throw new TypeError('bytesWritten must be 0 when calling respond() on a closed stream');
            }
        }
        else {
            if (bytesWritten === 0) {
                throw new TypeError('bytesWritten must be greater than 0 when calling respond() on a readable stream');
            }
            if (firstDescriptor.bytesFilled + bytesWritten > firstDescriptor.byteLength) {
                throw new RangeError('bytesWritten out of range');
            }
        }
        firstDescriptor.buffer = TransferArrayBuffer(firstDescriptor.buffer);
        ReadableByteStreamControllerRespondInternal(controller, bytesWritten);
    }
    function ReadableByteStreamControllerRespondWithNewView(controller, view) {
        const firstDescriptor = controller._pendingPullIntos.peek();
        const state = controller._controlledReadableByteStream._state;
        if (state === 'closed') {
            if (view.byteLength !== 0) {
                throw new TypeError('The view\'s length must be 0 when calling respondWithNewView() on a closed stream');
            }
        }
        else {
            if (view.byteLength === 0) {
                throw new TypeError('The view\'s length must be greater than 0 when calling respondWithNewView() on a readable stream');
            }
        }
        if (firstDescriptor.byteOffset + firstDescriptor.bytesFilled !== view.byteOffset) {
            throw new RangeError('The region specified by view does not match byobRequest');
        }
        if (firstDescriptor.bufferByteLength !== view.buffer.byteLength) {
            throw new RangeError('The buffer of view has different capacity than byobRequest');
        }
        if (firstDescriptor.bytesFilled + view.byteLength > firstDescriptor.byteLength) {
            throw new RangeError('The region specified by view is larger than byobRequest');
        }
        const viewByteLength = view.byteLength;
        firstDescriptor.buffer = TransferArrayBuffer(view.buffer);
        ReadableByteStreamControllerRespondInternal(controller, viewByteLength);
    }
    function SetUpReadableByteStreamController(stream, controller, startAlgorithm, pullAlgorithm, cancelAlgorithm, highWaterMark, autoAllocateChunkSize) {
        controller._controlledReadableByteStream = stream;
        controller._pullAgain = false;
        controller._pulling = false;
        controller._byobRequest = null;
        // Need to set the slots so that the assert doesn't fire. In the spec the slots already exist implicitly.
        controller._queue = controller._queueTotalSize = undefined;
        ResetQueue(controller);
        controller._closeRequested = false;
        controller._started = false;
        controller._strategyHWM = highWaterMark;
        controller._pullAlgorithm = pullAlgorithm;
        controller._cancelAlgorithm = cancelAlgorithm;
        controller._autoAllocateChunkSize = autoAllocateChunkSize;
        controller._pendingPullIntos = new SimpleQueue();
        stream._readableStreamController = controller;
        const startResult = startAlgorithm();
        uponPromise(promiseResolvedWith(startResult), () => {
            controller._started = true;
            ReadableByteStreamControllerCallPullIfNeeded(controller);
        }, r => {
            ReadableByteStreamControllerError(controller, r);
        });
    }
    function SetUpReadableByteStreamControllerFromUnderlyingSource(stream, underlyingByteSource, highWaterMark) {
        const controller = Object.create(ReadableByteStreamController.prototype);
        let startAlgorithm = () => undefined;
        let pullAlgorithm = () => promiseResolvedWith(undefined);
        let cancelAlgorithm = () => promiseResolvedWith(undefined);
        if (underlyingByteSource.start !== undefined) {
            startAlgorithm = () => underlyingByteSource.start(controller);
        }
        if (underlyingByteSource.pull !== undefined) {
            pullAlgorithm = () => underlyingByteSource.pull(controller);
        }
        if (underlyingByteSource.cancel !== undefined) {
            cancelAlgorithm = reason => underlyingByteSource.cancel(reason);
        }
        const autoAllocateChunkSize = underlyingByteSource.autoAllocateChunkSize;
        if (autoAllocateChunkSize === 0) {
            throw new TypeError('autoAllocateChunkSize must be greater than 0');
        }
        SetUpReadableByteStreamController(stream, controller, startAlgorithm, pullAlgorithm, cancelAlgorithm, highWaterMark, autoAllocateChunkSize);
    }
    function SetUpReadableStreamBYOBRequest(request, controller, view) {
        request._associatedReadableByteStreamController = controller;
        request._view = view;
    }
    // Helper functions for the ReadableStreamBYOBRequest.
    function byobRequestBrandCheckException(name) {
        return new TypeError(`ReadableStreamBYOBRequest.prototype.${name} can only be used on a ReadableStreamBYOBRequest`);
    }
    // Helper functions for the ReadableByteStreamController.
    function byteStreamControllerBrandCheckException(name) {
        return new TypeError(`ReadableByteStreamController.prototype.${name} can only be used on a ReadableByteStreamController`);
    }

    // Abstract operations for the ReadableStream.
    function AcquireReadableStreamBYOBReader(stream) {
        return new ReadableStreamBYOBReader(stream);
    }
    // ReadableStream API exposed for controllers.
    function ReadableStreamAddReadIntoRequest(stream, readIntoRequest) {
        stream._reader._readIntoRequests.push(readIntoRequest);
    }
    function ReadableStreamFulfillReadIntoRequest(stream, chunk, done) {
        const reader = stream._reader;
        const readIntoRequest = reader._readIntoRequests.shift();
        if (done) {
            readIntoRequest._closeSteps(chunk);
        }
        else {
            readIntoRequest._chunkSteps(chunk);
        }
    }
    function ReadableStreamGetNumReadIntoRequests(stream) {
        return stream._reader._readIntoRequests.length;
    }
    function ReadableStreamHasBYOBReader(stream) {
        const reader = stream._reader;
        if (reader === undefined) {
            return false;
        }
        if (!IsReadableStreamBYOBReader(reader)) {
            return false;
        }
        return true;
    }
    /**
     * A BYOB reader vended by a {@link ReadableStream}.
     *
     * @public
     */
    class ReadableStreamBYOBReader {
        constructor(stream) {
            assertRequiredArgument(stream, 1, 'ReadableStreamBYOBReader');
            assertReadableStream(stream, 'First parameter');
            if (IsReadableStreamLocked(stream)) {
                throw new TypeError('This stream has already been locked for exclusive reading by another reader');
            }
            if (!IsReadableByteStreamController(stream._readableStreamController)) {
                throw new TypeError('Cannot construct a ReadableStreamBYOBReader for a stream not constructed with a byte ' +
                    'source');
            }
            ReadableStreamReaderGenericInitialize(this, stream);
            this._readIntoRequests = new SimpleQueue();
        }
        /**
         * Returns a promise that will be fulfilled when the stream becomes closed, or rejected if the stream ever errors or
         * the reader's lock is released before the stream finishes closing.
         */
        get closed() {
            if (!IsReadableStreamBYOBReader(this)) {
                return promiseRejectedWith(byobReaderBrandCheckException('closed'));
            }
            return this._closedPromise;
        }
        /**
         * If the reader is active, behaves the same as {@link ReadableStream.cancel | stream.cancel(reason)}.
         */
        cancel(reason = undefined) {
            if (!IsReadableStreamBYOBReader(this)) {
                return promiseRejectedWith(byobReaderBrandCheckException('cancel'));
            }
            if (this._ownerReadableStream === undefined) {
                return promiseRejectedWith(readerLockException('cancel'));
            }
            return ReadableStreamReaderGenericCancel(this, reason);
        }
        /**
         * Attempts to reads bytes into view, and returns a promise resolved with the result.
         *
         * If reading a chunk causes the queue to become empty, more data will be pulled from the underlying source.
         */
        read(view) {
            if (!IsReadableStreamBYOBReader(this)) {
                return promiseRejectedWith(byobReaderBrandCheckException('read'));
            }
            if (!ArrayBuffer.isView(view)) {
                return promiseRejectedWith(new TypeError('view must be an array buffer view'));
            }
            if (view.byteLength === 0) {
                return promiseRejectedWith(new TypeError('view must have non-zero byteLength'));
            }
            if (view.buffer.byteLength === 0) {
                return promiseRejectedWith(new TypeError(`view's buffer must have non-zero byteLength`));
            }
            if (IsDetachedBuffer(view.buffer)) ;
            if (this._ownerReadableStream === undefined) {
                return promiseRejectedWith(readerLockException('read from'));
            }
            let resolvePromise;
            let rejectPromise;
            const promise = newPromise((resolve, reject) => {
                resolvePromise = resolve;
                rejectPromise = reject;
            });
            const readIntoRequest = {
                _chunkSteps: chunk => resolvePromise({ value: chunk, done: false }),
                _closeSteps: chunk => resolvePromise({ value: chunk, done: true }),
                _errorSteps: e => rejectPromise(e)
            };
            ReadableStreamBYOBReaderRead(this, view, readIntoRequest);
            return promise;
        }
        /**
         * Releases the reader's lock on the corresponding stream. After the lock is released, the reader is no longer active.
         * If the associated stream is errored when the lock is released, the reader will appear errored in the same way
         * from now on; otherwise, the reader will appear closed.
         *
         * A reader's lock cannot be released while it still has a pending read request, i.e., if a promise returned by
         * the reader's {@link ReadableStreamBYOBReader.read | read()} method has not yet been settled. Attempting to
         * do so will throw a `TypeError` and leave the reader locked to the stream.
         */
        releaseLock() {
            if (!IsReadableStreamBYOBReader(this)) {
                throw byobReaderBrandCheckException('releaseLock');
            }
            if (this._ownerReadableStream === undefined) {
                return;
            }
            if (this._readIntoRequests.length > 0) {
                throw new TypeError('Tried to release a reader lock when that reader has pending read() calls un-settled');
            }
            ReadableStreamReaderGenericRelease(this);
        }
    }
    Object.defineProperties(ReadableStreamBYOBReader.prototype, {
        cancel: { enumerable: true },
        read: { enumerable: true },
        releaseLock: { enumerable: true },
        closed: { enumerable: true }
    });
    if (typeof SymbolPolyfill.toStringTag === 'symbol') {
        Object.defineProperty(ReadableStreamBYOBReader.prototype, SymbolPolyfill.toStringTag, {
            value: 'ReadableStreamBYOBReader',
            configurable: true
        });
    }
    // Abstract operations for the readers.
    function IsReadableStreamBYOBReader(x) {
        if (!typeIsObject(x)) {
            return false;
        }
        if (!Object.prototype.hasOwnProperty.call(x, '_readIntoRequests')) {
            return false;
        }
        return x instanceof ReadableStreamBYOBReader;
    }
    function ReadableStreamBYOBReaderRead(reader, view, readIntoRequest) {
        const stream = reader._ownerReadableStream;
        stream._disturbed = true;
        if (stream._state === 'errored') {
            readIntoRequest._errorSteps(stream._storedError);
        }
        else {
            ReadableByteStreamControllerPullInto(stream._readableStreamController, view, readIntoRequest);
        }
    }
    // Helper functions for the ReadableStreamBYOBReader.
    function byobReaderBrandCheckException(name) {
        return new TypeError(`ReadableStreamBYOBReader.prototype.${name} can only be used on a ReadableStreamBYOBReader`);
    }

    function ExtractHighWaterMark(strategy, defaultHWM) {
        const { highWaterMark } = strategy;
        if (highWaterMark === undefined) {
            return defaultHWM;
        }
        if (NumberIsNaN(highWaterMark) || highWaterMark < 0) {
            throw new RangeError('Invalid highWaterMark');
        }
        return highWaterMark;
    }
    function ExtractSizeAlgorithm(strategy) {
        const { size } = strategy;
        if (!size) {
            return () => 1;
        }
        return size;
    }

    function convertQueuingStrategy(init, context) {
        assertDictionary(init, context);
        const highWaterMark = init === null || init === void 0 ? void 0 : init.highWaterMark;
        const size = init === null || init === void 0 ? void 0 : init.size;
        return {
            highWaterMark: highWaterMark === undefined ? undefined : convertUnrestrictedDouble(highWaterMark),
            size: size === undefined ? undefined : convertQueuingStrategySize(size, `${context} has member 'size' that`)
        };
    }
    function convertQueuingStrategySize(fn, context) {
        assertFunction(fn, context);
        return chunk => convertUnrestrictedDouble(fn(chunk));
    }

    function convertUnderlyingSink(original, context) {
        assertDictionary(original, context);
        const abort = original === null || original === void 0 ? void 0 : original.abort;
        const close = original === null || original === void 0 ? void 0 : original.close;
        const start = original === null || original === void 0 ? void 0 : original.start;
        const type = original === null || original === void 0 ? void 0 : original.type;
        const write = original === null || original === void 0 ? void 0 : original.write;
        return {
            abort: abort === undefined ?
                undefined :
                convertUnderlyingSinkAbortCallback(abort, original, `${context} has member 'abort' that`),
            close: close === undefined ?
                undefined :
                convertUnderlyingSinkCloseCallback(close, original, `${context} has member 'close' that`),
            start: start === undefined ?
                undefined :
                convertUnderlyingSinkStartCallback(start, original, `${context} has member 'start' that`),
            write: write === undefined ?
                undefined :
                convertUnderlyingSinkWriteCallback(write, original, `${context} has member 'write' that`),
            type
        };
    }
    function convertUnderlyingSinkAbortCallback(fn, original, context) {
        assertFunction(fn, context);
        return (reason) => promiseCall(fn, original, [reason]);
    }
    function convertUnderlyingSinkCloseCallback(fn, original, context) {
        assertFunction(fn, context);
        return () => promiseCall(fn, original, []);
    }
    function convertUnderlyingSinkStartCallback(fn, original, context) {
        assertFunction(fn, context);
        return (controller) => reflectCall(fn, original, [controller]);
    }
    function convertUnderlyingSinkWriteCallback(fn, original, context) {
        assertFunction(fn, context);
        return (chunk, controller) => promiseCall(fn, original, [chunk, controller]);
    }

    function assertWritableStream(x, context) {
        if (!IsWritableStream(x)) {
            throw new TypeError(`${context} is not a WritableStream.`);
        }
    }

    function isAbortSignal(value) {
        if (typeof value !== 'object' || value === null) {
            return false;
        }
        try {
            return typeof value.aborted === 'boolean';
        }
        catch (_a) {
            // AbortSignal.prototype.aborted throws if its brand check fails
            return false;
        }
    }
    const supportsAbortController = typeof AbortController === 'function';
    /**
     * Construct a new AbortController, if supported by the platform.
     *
     * @internal
     */
    function createAbortController() {
        if (supportsAbortController) {
            return new AbortController();
        }
        return undefined;
    }

    /**
     * A writable stream represents a destination for data, into which you can write.
     *
     * @public
     */
    class WritableStream {
        constructor(rawUnderlyingSink = {}, rawStrategy = {}) {
            if (rawUnderlyingSink === undefined) {
                rawUnderlyingSink = null;
            }
            else {
                assertObject(rawUnderlyingSink, 'First parameter');
            }
            const strategy = convertQueuingStrategy(rawStrategy, 'Second parameter');
            const underlyingSink = convertUnderlyingSink(rawUnderlyingSink, 'First parameter');
            InitializeWritableStream(this);
            const type = underlyingSink.type;
            if (type !== undefined) {
                throw new RangeError('Invalid type is specified');
            }
            const sizeAlgorithm = ExtractSizeAlgorithm(strategy);
            const highWaterMark = ExtractHighWaterMark(strategy, 1);
            SetUpWritableStreamDefaultControllerFromUnderlyingSink(this, underlyingSink, highWaterMark, sizeAlgorithm);
        }
        /**
         * Returns whether or not the writable stream is locked to a writer.
         */
        get locked() {
            if (!IsWritableStream(this)) {
                throw streamBrandCheckException$2('locked');
            }
            return IsWritableStreamLocked(this);
        }
        /**
         * Aborts the stream, signaling that the producer can no longer successfully write to the stream and it is to be
         * immediately moved to an errored state, with any queued-up writes discarded. This will also execute any abort
         * mechanism of the underlying sink.
         *
         * The returned promise will fulfill if the stream shuts down successfully, or reject if the underlying sink signaled
         * that there was an error doing so. Additionally, it will reject with a `TypeError` (without attempting to cancel
         * the stream) if the stream is currently locked.
         */
        abort(reason = undefined) {
            if (!IsWritableStream(this)) {
                return promiseRejectedWith(streamBrandCheckException$2('abort'));
            }
            if (IsWritableStreamLocked(this)) {
                return promiseRejectedWith(new TypeError('Cannot abort a stream that already has a writer'));
            }
            return WritableStreamAbort(this, reason);
        }
        /**
         * Closes the stream. The underlying sink will finish processing any previously-written chunks, before invoking its
         * close behavior. During this time any further attempts to write will fail (without erroring the stream).
         *
         * The method returns a promise that will fulfill if all remaining chunks are successfully written and the stream
         * successfully closes, or rejects if an error is encountered during this process. Additionally, it will reject with
         * a `TypeError` (without attempting to cancel the stream) if the stream is currently locked.
         */
        close() {
            if (!IsWritableStream(this)) {
                return promiseRejectedWith(streamBrandCheckException$2('close'));
            }
            if (IsWritableStreamLocked(this)) {
                return promiseRejectedWith(new TypeError('Cannot close a stream that already has a writer'));
            }
            if (WritableStreamCloseQueuedOrInFlight(this)) {
                return promiseRejectedWith(new TypeError('Cannot close an already-closing stream'));
            }
            return WritableStreamClose(this);
        }
        /**
         * Creates a {@link WritableStreamDefaultWriter | writer} and locks the stream to the new writer. While the stream
         * is locked, no other writer can be acquired until this one is released.
         *
         * This functionality is especially useful for creating abstractions that desire the ability to write to a stream
         * without interruption or interleaving. By getting a writer for the stream, you can ensure nobody else can write at
         * the same time, which would cause the resulting written data to be unpredictable and probably useless.
         */
        getWriter() {
            if (!IsWritableStream(this)) {
                throw streamBrandCheckException$2('getWriter');
            }
            return AcquireWritableStreamDefaultWriter(this);
        }
    }
    Object.defineProperties(WritableStream.prototype, {
        abort: { enumerable: true },
        close: { enumerable: true },
        getWriter: { enumerable: true },
        locked: { enumerable: true }
    });
    if (typeof SymbolPolyfill.toStringTag === 'symbol') {
        Object.defineProperty(WritableStream.prototype, SymbolPolyfill.toStringTag, {
            value: 'WritableStream',
            configurable: true
        });
    }
    // Abstract operations for the WritableStream.
    function AcquireWritableStreamDefaultWriter(stream) {
        return new WritableStreamDefaultWriter(stream);
    }
    // Throws if and only if startAlgorithm throws.
    function CreateWritableStream(startAlgorithm, writeAlgorithm, closeAlgorithm, abortAlgorithm, highWaterMark = 1, sizeAlgorithm = () => 1) {
        const stream = Object.create(WritableStream.prototype);
        InitializeWritableStream(stream);
        const controller = Object.create(WritableStreamDefaultController.prototype);
        SetUpWritableStreamDefaultController(stream, controller, startAlgorithm, writeAlgorithm, closeAlgorithm, abortAlgorithm, highWaterMark, sizeAlgorithm);
        return stream;
    }
    function InitializeWritableStream(stream) {
        stream._state = 'writable';
        // The error that will be reported by new method calls once the state becomes errored. Only set when [[state]] is
        // 'erroring' or 'errored'. May be set to an undefined value.
        stream._storedError = undefined;
        stream._writer = undefined;
        // Initialize to undefined first because the constructor of the controller checks this
        // variable to validate the caller.
        stream._writableStreamController = undefined;
        // This queue is placed here instead of the writer class in order to allow for passing a writer to the next data
        // producer without waiting for the queued writes to finish.
        stream._writeRequests = new SimpleQueue();
        // Write requests are removed from _writeRequests when write() is called on the underlying sink. This prevents
        // them from being erroneously rejected on error. If a write() call is in-flight, the request is stored here.
        stream._inFlightWriteRequest = undefined;
        // The promise that was returned from writer.close(). Stored here because it may be fulfilled after the writer
        // has been detached.
        stream._closeRequest = undefined;
        // Close request is removed from _closeRequest when close() is called on the underlying sink. This prevents it
        // from being erroneously rejected on error. If a close() call is in-flight, the request is stored here.
        stream._inFlightCloseRequest = undefined;
        // The promise that was returned from writer.abort(). This may also be fulfilled after the writer has detached.
        stream._pendingAbortRequest = undefined;
        // The backpressure signal set by the controller.
        stream._backpressure = false;
    }
    function IsWritableStream(x) {
        if (!typeIsObject(x)) {
            return false;
        }
        if (!Object.prototype.hasOwnProperty.call(x, '_writableStreamController')) {
            return false;
        }
        return x instanceof WritableStream;
    }
    function IsWritableStreamLocked(stream) {
        if (stream._writer === undefined) {
            return false;
        }
        return true;
    }
    function WritableStreamAbort(stream, reason) {
        var _a;
        if (stream._state === 'closed' || stream._state === 'errored') {
            return promiseResolvedWith(undefined);
        }
        stream._writableStreamController._abortReason = reason;
        (_a = stream._writableStreamController._abortController) === null || _a === void 0 ? void 0 : _a.abort();
        // TypeScript narrows the type of `stream._state` down to 'writable' | 'erroring',
        // but it doesn't know that signaling abort runs author code that might have changed the state.
        // Widen the type again by casting to WritableStreamState.
        const state = stream._state;
        if (state === 'closed' || state === 'errored') {
            return promiseResolvedWith(undefined);
        }
        if (stream._pendingAbortRequest !== undefined) {
            return stream._pendingAbortRequest._promise;
        }
        let wasAlreadyErroring = false;
        if (state === 'erroring') {
            wasAlreadyErroring = true;
            // reason will not be used, so don't keep a reference to it.
            reason = undefined;
        }
        const promise = newPromise((resolve, reject) => {
            stream._pendingAbortRequest = {
                _promise: undefined,
                _resolve: resolve,
                _reject: reject,
                _reason: reason,
                _wasAlreadyErroring: wasAlreadyErroring
            };
        });
        stream._pendingAbortRequest._promise = promise;
        if (!wasAlreadyErroring) {
            WritableStreamStartErroring(stream, reason);
        }
        return promise;
    }
    function WritableStreamClose(stream) {
        const state = stream._state;
        if (state === 'closed' || state === 'errored') {
            return promiseRejectedWith(new TypeError(`The stream (in ${state} state) is not in the writable state and cannot be closed`));
        }
        const promise = newPromise((resolve, reject) => {
            const closeRequest = {
                _resolve: resolve,
                _reject: reject
            };
            stream._closeRequest = closeRequest;
        });
        const writer = stream._writer;
        if (writer !== undefined && stream._backpressure && state === 'writable') {
            defaultWriterReadyPromiseResolve(writer);
        }
        WritableStreamDefaultControllerClose(stream._writableStreamController);
        return promise;
    }
    // WritableStream API exposed for controllers.
    function WritableStreamAddWriteRequest(stream) {
        const promise = newPromise((resolve, reject) => {
            const writeRequest = {
                _resolve: resolve,
                _reject: reject
            };
            stream._writeRequests.push(writeRequest);
        });
        return promise;
    }
    function WritableStreamDealWithRejection(stream, error) {
        const state = stream._state;
        if (state === 'writable') {
            WritableStreamStartErroring(stream, error);
            return;
        }
        WritableStreamFinishErroring(stream);
    }
    function WritableStreamStartErroring(stream, reason) {
        const controller = stream._writableStreamController;
        stream._state = 'erroring';
        stream._storedError = reason;
        const writer = stream._writer;
        if (writer !== undefined) {
            WritableStreamDefaultWriterEnsureReadyPromiseRejected(writer, reason);
        }
        if (!WritableStreamHasOperationMarkedInFlight(stream) && controller._started) {
            WritableStreamFinishErroring(stream);
        }
    }
    function WritableStreamFinishErroring(stream) {
        stream._state = 'errored';
        stream._writableStreamController[ErrorSteps]();
        const storedError = stream._storedError;
        stream._writeRequests.forEach(writeRequest => {
            writeRequest._reject(storedError);
        });
        stream._writeRequests = new SimpleQueue();
        if (stream._pendingAbortRequest === undefined) {
            WritableStreamRejectCloseAndClosedPromiseIfNeeded(stream);
            return;
        }
        const abortRequest = stream._pendingAbortRequest;
        stream._pendingAbortRequest = undefined;
        if (abortRequest._wasAlreadyErroring) {
            abortRequest._reject(storedError);
            WritableStreamRejectCloseAndClosedPromiseIfNeeded(stream);
            return;
        }
        const promise = stream._writableStreamController[AbortSteps](abortRequest._reason);
        uponPromise(promise, () => {
            abortRequest._resolve();
            WritableStreamRejectCloseAndClosedPromiseIfNeeded(stream);
        }, (reason) => {
            abortRequest._reject(reason);
            WritableStreamRejectCloseAndClosedPromiseIfNeeded(stream);
        });
    }
    function WritableStreamFinishInFlightWrite(stream) {
        stream._inFlightWriteRequest._resolve(undefined);
        stream._inFlightWriteRequest = undefined;
    }
    function WritableStreamFinishInFlightWriteWithError(stream, error) {
        stream._inFlightWriteRequest._reject(error);
        stream._inFlightWriteRequest = undefined;
        WritableStreamDealWithRejection(stream, error);
    }
    function WritableStreamFinishInFlightClose(stream) {
        stream._inFlightCloseRequest._resolve(undefined);
        stream._inFlightCloseRequest = undefined;
        const state = stream._state;
        if (state === 'erroring') {
            // The error was too late to do anything, so it is ignored.
            stream._storedError = undefined;
            if (stream._pendingAbortRequest !== undefined) {
                stream._pendingAbortRequest._resolve();
                stream._pendingAbortRequest = undefined;
            }
        }
        stream._state = 'closed';
        const writer = stream._writer;
        if (writer !== undefined) {
            defaultWriterClosedPromiseResolve(writer);
        }
    }
    function WritableStreamFinishInFlightCloseWithError(stream, error) {
        stream._inFlightCloseRequest._reject(error);
        stream._inFlightCloseRequest = undefined;
        // Never execute sink abort() after sink close().
        if (stream._pendingAbortRequest !== undefined) {
            stream._pendingAbortRequest._reject(error);
            stream._pendingAbortRequest = undefined;
        }
        WritableStreamDealWithRejection(stream, error);
    }
    // TODO(ricea): Fix alphabetical order.
    function WritableStreamCloseQueuedOrInFlight(stream) {
        if (stream._closeRequest === undefined && stream._inFlightCloseRequest === undefined) {
            return false;
        }
        return true;
    }
    function WritableStreamHasOperationMarkedInFlight(stream) {
        if (stream._inFlightWriteRequest === undefined && stream._inFlightCloseRequest === undefined) {
            return false;
        }
        return true;
    }
    function WritableStreamMarkCloseRequestInFlight(stream) {
        stream._inFlightCloseRequest = stream._closeRequest;
        stream._closeRequest = undefined;
    }
    function WritableStreamMarkFirstWriteRequestInFlight(stream) {
        stream._inFlightWriteRequest = stream._writeRequests.shift();
    }
    function WritableStreamRejectCloseAndClosedPromiseIfNeeded(stream) {
        if (stream._closeRequest !== undefined) {
            stream._closeRequest._reject(stream._storedError);
            stream._closeRequest = undefined;
        }
        const writer = stream._writer;
        if (writer !== undefined) {
            defaultWriterClosedPromiseReject(writer, stream._storedError);
        }
    }
    function WritableStreamUpdateBackpressure(stream, backpressure) {
        const writer = stream._writer;
        if (writer !== undefined && backpressure !== stream._backpressure) {
            if (backpressure) {
                defaultWriterReadyPromiseReset(writer);
            }
            else {
                defaultWriterReadyPromiseResolve(writer);
            }
        }
        stream._backpressure = backpressure;
    }
    /**
     * A default writer vended by a {@link WritableStream}.
     *
     * @public
     */
    class WritableStreamDefaultWriter {
        constructor(stream) {
            assertRequiredArgument(stream, 1, 'WritableStreamDefaultWriter');
            assertWritableStream(stream, 'First parameter');
            if (IsWritableStreamLocked(stream)) {
                throw new TypeError('This stream has already been locked for exclusive writing by another writer');
            }
            this._ownerWritableStream = stream;
            stream._writer = this;
            const state = stream._state;
            if (state === 'writable') {
                if (!WritableStreamCloseQueuedOrInFlight(stream) && stream._backpressure) {
                    defaultWriterReadyPromiseInitialize(this);
                }
                else {
                    defaultWriterReadyPromiseInitializeAsResolved(this);
                }
                defaultWriterClosedPromiseInitialize(this);
            }
            else if (state === 'erroring') {
                defaultWriterReadyPromiseInitializeAsRejected(this, stream._storedError);
                defaultWriterClosedPromiseInitialize(this);
            }
            else if (state === 'closed') {
                defaultWriterReadyPromiseInitializeAsResolved(this);
                defaultWriterClosedPromiseInitializeAsResolved(this);
            }
            else {
                const storedError = stream._storedError;
                defaultWriterReadyPromiseInitializeAsRejected(this, storedError);
                defaultWriterClosedPromiseInitializeAsRejected(this, storedError);
            }
        }
        /**
         * Returns a promise that will be fulfilled when the stream becomes closed, or rejected if the stream ever errors or
         * the writer’s lock is released before the stream finishes closing.
         */
        get closed() {
            if (!IsWritableStreamDefaultWriter(this)) {
                return promiseRejectedWith(defaultWriterBrandCheckException('closed'));
            }
            return this._closedPromise;
        }
        /**
         * Returns the desired size to fill the stream’s internal queue. It can be negative, if the queue is over-full.
         * A producer can use this information to determine the right amount of data to write.
         *
         * It will be `null` if the stream cannot be successfully written to (due to either being errored, or having an abort
         * queued up). It will return zero if the stream is closed. And the getter will throw an exception if invoked when
         * the writer’s lock is released.
         */
        get desiredSize() {
            if (!IsWritableStreamDefaultWriter(this)) {
                throw defaultWriterBrandCheckException('desiredSize');
            }
            if (this._ownerWritableStream === undefined) {
                throw defaultWriterLockException('desiredSize');
            }
            return WritableStreamDefaultWriterGetDesiredSize(this);
        }
        /**
         * Returns a promise that will be fulfilled when the desired size to fill the stream’s internal queue transitions
         * from non-positive to positive, signaling that it is no longer applying backpressure. Once the desired size dips
         * back to zero or below, the getter will return a new promise that stays pending until the next transition.
         *
         * If the stream becomes errored or aborted, or the writer’s lock is released, the returned promise will become
         * rejected.
         */
        get ready() {
            if (!IsWritableStreamDefaultWriter(this)) {
                return promiseRejectedWith(defaultWriterBrandCheckException('ready'));
            }
            return this._readyPromise;
        }
        /**
         * If the reader is active, behaves the same as {@link WritableStream.abort | stream.abort(reason)}.
         */
        abort(reason = undefined) {
            if (!IsWritableStreamDefaultWriter(this)) {
                return promiseRejectedWith(defaultWriterBrandCheckException('abort'));
            }
            if (this._ownerWritableStream === undefined) {
                return promiseRejectedWith(defaultWriterLockException('abort'));
            }
            return WritableStreamDefaultWriterAbort(this, reason);
        }
        /**
         * If the reader is active, behaves the same as {@link WritableStream.close | stream.close()}.
         */
        close() {
            if (!IsWritableStreamDefaultWriter(this)) {
                return promiseRejectedWith(defaultWriterBrandCheckException('close'));
            }
            const stream = this._ownerWritableStream;
            if (stream === undefined) {
                return promiseRejectedWith(defaultWriterLockException('close'));
            }
            if (WritableStreamCloseQueuedOrInFlight(stream)) {
                return promiseRejectedWith(new TypeError('Cannot close an already-closing stream'));
            }
            return WritableStreamDefaultWriterClose(this);
        }
        /**
         * Releases the writer’s lock on the corresponding stream. After the lock is released, the writer is no longer active.
         * If the associated stream is errored when the lock is released, the writer will appear errored in the same way from
         * now on; otherwise, the writer will appear closed.
         *
         * Note that the lock can still be released even if some ongoing writes have not yet finished (i.e. even if the
         * promises returned from previous calls to {@link WritableStreamDefaultWriter.write | write()} have not yet settled).
         * It’s not necessary to hold the lock on the writer for the duration of the write; the lock instead simply prevents
         * other producers from writing in an interleaved manner.
         */
        releaseLock() {
            if (!IsWritableStreamDefaultWriter(this)) {
                throw defaultWriterBrandCheckException('releaseLock');
            }
            const stream = this._ownerWritableStream;
            if (stream === undefined) {
                return;
            }
            WritableStreamDefaultWriterRelease(this);
        }
        write(chunk = undefined) {
            if (!IsWritableStreamDefaultWriter(this)) {
                return promiseRejectedWith(defaultWriterBrandCheckException('write'));
            }
            if (this._ownerWritableStream === undefined) {
                return promiseRejectedWith(defaultWriterLockException('write to'));
            }
            return WritableStreamDefaultWriterWrite(this, chunk);
        }
    }
    Object.defineProperties(WritableStreamDefaultWriter.prototype, {
        abort: { enumerable: true },
        close: { enumerable: true },
        releaseLock: { enumerable: true },
        write: { enumerable: true },
        closed: { enumerable: true },
        desiredSize: { enumerable: true },
        ready: { enumerable: true }
    });
    if (typeof SymbolPolyfill.toStringTag === 'symbol') {
        Object.defineProperty(WritableStreamDefaultWriter.prototype, SymbolPolyfill.toStringTag, {
            value: 'WritableStreamDefaultWriter',
            configurable: true
        });
    }
    // Abstract operations for the WritableStreamDefaultWriter.
    function IsWritableStreamDefaultWriter(x) {
        if (!typeIsObject(x)) {
            return false;
        }
        if (!Object.prototype.hasOwnProperty.call(x, '_ownerWritableStream')) {
            return false;
        }
        return x instanceof WritableStreamDefaultWriter;
    }
    // A client of WritableStreamDefaultWriter may use these functions directly to bypass state check.
    function WritableStreamDefaultWriterAbort(writer, reason) {
        const stream = writer._ownerWritableStream;
        return WritableStreamAbort(stream, reason);
    }
    function WritableStreamDefaultWriterClose(writer) {
        const stream = writer._ownerWritableStream;
        return WritableStreamClose(stream);
    }
    function WritableStreamDefaultWriterCloseWithErrorPropagation(writer) {
        const stream = writer._ownerWritableStream;
        const state = stream._state;
        if (WritableStreamCloseQueuedOrInFlight(stream) || state === 'closed') {
            return promiseResolvedWith(undefined);
        }
        if (state === 'errored') {
            return promiseRejectedWith(stream._storedError);
        }
        return WritableStreamDefaultWriterClose(writer);
    }
    function WritableStreamDefaultWriterEnsureClosedPromiseRejected(writer, error) {
        if (writer._closedPromiseState === 'pending') {
            defaultWriterClosedPromiseReject(writer, error);
        }
        else {
            defaultWriterClosedPromiseResetToRejected(writer, error);
        }
    }
    function WritableStreamDefaultWriterEnsureReadyPromiseRejected(writer, error) {
        if (writer._readyPromiseState === 'pending') {
            defaultWriterReadyPromiseReject(writer, error);
        }
        else {
            defaultWriterReadyPromiseResetToRejected(writer, error);
        }
    }
    function WritableStreamDefaultWriterGetDesiredSize(writer) {
        const stream = writer._ownerWritableStream;
        const state = stream._state;
        if (state === 'errored' || state === 'erroring') {
            return null;
        }
        if (state === 'closed') {
            return 0;
        }
        return WritableStreamDefaultControllerGetDesiredSize(stream._writableStreamController);
    }
    function WritableStreamDefaultWriterRelease(writer) {
        const stream = writer._ownerWritableStream;
        const releasedError = new TypeError(`Writer was released and can no longer be used to monitor the stream's closedness`);
        WritableStreamDefaultWriterEnsureReadyPromiseRejected(writer, releasedError);
        // The state transitions to "errored" before the sink abort() method runs, but the writer.closed promise is not
        // rejected until afterwards. This means that simply testing state will not work.
        WritableStreamDefaultWriterEnsureClosedPromiseRejected(writer, releasedError);
        stream._writer = undefined;
        writer._ownerWritableStream = undefined;
    }
    function WritableStreamDefaultWriterWrite(writer, chunk) {
        const stream = writer._ownerWritableStream;
        const controller = stream._writableStreamController;
        const chunkSize = WritableStreamDefaultControllerGetChunkSize(controller, chunk);
        if (stream !== writer._ownerWritableStream) {
            return promiseRejectedWith(defaultWriterLockException('write to'));
        }
        const state = stream._state;
        if (state === 'errored') {
            return promiseRejectedWith(stream._storedError);
        }
        if (WritableStreamCloseQueuedOrInFlight(stream) || state === 'closed') {
            return promiseRejectedWith(new TypeError('The stream is closing or closed and cannot be written to'));
        }
        if (state === 'erroring') {
            return promiseRejectedWith(stream._storedError);
        }
        const promise = WritableStreamAddWriteRequest(stream);
        WritableStreamDefaultControllerWrite(controller, chunk, chunkSize);
        return promise;
    }
    const closeSentinel = {};
    /**
     * Allows control of a {@link WritableStream | writable stream}'s state and internal queue.
     *
     * @public
     */
    class WritableStreamDefaultController {
        constructor() {
            throw new TypeError('Illegal constructor');
        }
        /**
         * The reason which was passed to `WritableStream.abort(reason)` when the stream was aborted.
         *
         * @deprecated
         *  This property has been removed from the specification, see https://github.com/whatwg/streams/pull/1177.
         *  Use {@link WritableStreamDefaultController.signal}'s `reason` instead.
         */
        get abortReason() {
            if (!IsWritableStreamDefaultController(this)) {
                throw defaultControllerBrandCheckException$2('abortReason');
            }
            return this._abortReason;
        }
        /**
         * An `AbortSignal` that can be used to abort the pending write or close operation when the stream is aborted.
         */
        get signal() {
            if (!IsWritableStreamDefaultController(this)) {
                throw defaultControllerBrandCheckException$2('signal');
            }
            if (this._abortController === undefined) {
                // Older browsers or older Node versions may not support `AbortController` or `AbortSignal`.
                // We don't want to bundle and ship an `AbortController` polyfill together with our polyfill,
                // so instead we only implement support for `signal` if we find a global `AbortController` constructor.
                throw new TypeError('WritableStreamDefaultController.prototype.signal is not supported');
            }
            return this._abortController.signal;
        }
        /**
         * Closes the controlled writable stream, making all future interactions with it fail with the given error `e`.
         *
         * This method is rarely used, since usually it suffices to return a rejected promise from one of the underlying
         * sink's methods. However, it can be useful for suddenly shutting down a stream in response to an event outside the
         * normal lifecycle of interactions with the underlying sink.
         */
        error(e = undefined) {
            if (!IsWritableStreamDefaultController(this)) {
                throw defaultControllerBrandCheckException$2('error');
            }
            const state = this._controlledWritableStream._state;
            if (state !== 'writable') {
                // The stream is closed, errored or will be soon. The sink can't do anything useful if it gets an error here, so
                // just treat it as a no-op.
                return;
            }
            WritableStreamDefaultControllerError(this, e);
        }
        /** @internal */
        [AbortSteps](reason) {
            const result = this._abortAlgorithm(reason);
            WritableStreamDefaultControllerClearAlgorithms(this);
            return result;
        }
        /** @internal */
        [ErrorSteps]() {
            ResetQueue(this);
        }
    }
    Object.defineProperties(WritableStreamDefaultController.prototype, {
        abortReason: { enumerable: true },
        signal: { enumerable: true },
        error: { enumerable: true }
    });
    if (typeof SymbolPolyfill.toStringTag === 'symbol') {
        Object.defineProperty(WritableStreamDefaultController.prototype, SymbolPolyfill.toStringTag, {
            value: 'WritableStreamDefaultController',
            configurable: true
        });
    }
    // Abstract operations implementing interface required by the WritableStream.
    function IsWritableStreamDefaultController(x) {
        if (!typeIsObject(x)) {
            return false;
        }
        if (!Object.prototype.hasOwnProperty.call(x, '_controlledWritableStream')) {
            return false;
        }
        return x instanceof WritableStreamDefaultController;
    }
    function SetUpWritableStreamDefaultController(stream, controller, startAlgorithm, writeAlgorithm, closeAlgorithm, abortAlgorithm, highWaterMark, sizeAlgorithm) {
        controller._controlledWritableStream = stream;
        stream._writableStreamController = controller;
        // Need to set the slots so that the assert doesn't fire. In the spec the slots already exist implicitly.
        controller._queue = undefined;
        controller._queueTotalSize = undefined;
        ResetQueue(controller);
        controller._abortReason = undefined;
        controller._abortController = createAbortController();
        controller._started = false;
        controller._strategySizeAlgorithm = sizeAlgorithm;
        controller._strategyHWM = highWaterMark;
        controller._writeAlgorithm = writeAlgorithm;
        controller._closeAlgorithm = closeAlgorithm;
        controller._abortAlgorithm = abortAlgorithm;
        const backpressure = WritableStreamDefaultControllerGetBackpressure(controller);
        WritableStreamUpdateBackpressure(stream, backpressure);
        const startResult = startAlgorithm();
        const startPromise = promiseResolvedWith(startResult);
        uponPromise(startPromise, () => {
            controller._started = true;
            WritableStreamDefaultControllerAdvanceQueueIfNeeded(controller);
        }, r => {
            controller._started = true;
            WritableStreamDealWithRejection(stream, r);
        });
    }
    function SetUpWritableStreamDefaultControllerFromUnderlyingSink(stream, underlyingSink, highWaterMark, sizeAlgorithm) {
        const controller = Object.create(WritableStreamDefaultController.prototype);
        let startAlgorithm = () => undefined;
        let writeAlgorithm = () => promiseResolvedWith(undefined);
        let closeAlgorithm = () => promiseResolvedWith(undefined);
        let abortAlgorithm = () => promiseResolvedWith(undefined);
        if (underlyingSink.start !== undefined) {
            startAlgorithm = () => underlyingSink.start(controller);
        }
        if (underlyingSink.write !== undefined) {
            writeAlgorithm = chunk => underlyingSink.write(chunk, controller);
        }
        if (underlyingSink.close !== undefined) {
            closeAlgorithm = () => underlyingSink.close();
        }
        if (underlyingSink.abort !== undefined) {
            abortAlgorithm = reason => underlyingSink.abort(reason);
        }
        SetUpWritableStreamDefaultController(stream, controller, startAlgorithm, writeAlgorithm, closeAlgorithm, abortAlgorithm, highWaterMark, sizeAlgorithm);
    }
    // ClearAlgorithms may be called twice. Erroring the same stream in multiple ways will often result in redundant calls.
    function WritableStreamDefaultControllerClearAlgorithms(controller) {
        controller._writeAlgorithm = undefined;
        controller._closeAlgorithm = undefined;
        controller._abortAlgorithm = undefined;
        controller._strategySizeAlgorithm = undefined;
    }
    function WritableStreamDefaultControllerClose(controller) {
        EnqueueValueWithSize(controller, closeSentinel, 0);
        WritableStreamDefaultControllerAdvanceQueueIfNeeded(controller);
    }
    function WritableStreamDefaultControllerGetChunkSize(controller, chunk) {
        try {
            return controller._strategySizeAlgorithm(chunk);
        }
        catch (chunkSizeE) {
            WritableStreamDefaultControllerErrorIfNeeded(controller, chunkSizeE);
            return 1;
        }
    }
    function WritableStreamDefaultControllerGetDesiredSize(controller) {
        return controller._strategyHWM - controller._queueTotalSize;
    }
    function WritableStreamDefaultControllerWrite(controller, chunk, chunkSize) {
        try {
            EnqueueValueWithSize(controller, chunk, chunkSize);
        }
        catch (enqueueE) {
            WritableStreamDefaultControllerErrorIfNeeded(controller, enqueueE);
            return;
        }
        const stream = controller._controlledWritableStream;
        if (!WritableStreamCloseQueuedOrInFlight(stream) && stream._state === 'writable') {
            const backpressure = WritableStreamDefaultControllerGetBackpressure(controller);
            WritableStreamUpdateBackpressure(stream, backpressure);
        }
        WritableStreamDefaultControllerAdvanceQueueIfNeeded(controller);
    }
    // Abstract operations for the WritableStreamDefaultController.
    function WritableStreamDefaultControllerAdvanceQueueIfNeeded(controller) {
        const stream = controller._controlledWritableStream;
        if (!controller._started) {
            return;
        }
        if (stream._inFlightWriteRequest !== undefined) {
            return;
        }
        const state = stream._state;
        if (state === 'erroring') {
            WritableStreamFinishErroring(stream);
            return;
        }
        if (controller._queue.length === 0) {
            return;
        }
        const value = PeekQueueValue(controller);
        if (value === closeSentinel) {
            WritableStreamDefaultControllerProcessClose(controller);
        }
        else {
            WritableStreamDefaultControllerProcessWrite(controller, value);
        }
    }
    function WritableStreamDefaultControllerErrorIfNeeded(controller, error) {
        if (controller._controlledWritableStream._state === 'writable') {
            WritableStreamDefaultControllerError(controller, error);
        }
    }
    function WritableStreamDefaultControllerProcessClose(controller) {
        const stream = controller._controlledWritableStream;
        WritableStreamMarkCloseRequestInFlight(stream);
        DequeueValue(controller);
        const sinkClosePromise = controller._closeAlgorithm();
        WritableStreamDefaultControllerClearAlgorithms(controller);
        uponPromise(sinkClosePromise, () => {
            WritableStreamFinishInFlightClose(stream);
        }, reason => {
            WritableStreamFinishInFlightCloseWithError(stream, reason);
        });
    }
    function WritableStreamDefaultControllerProcessWrite(controller, chunk) {
        const stream = controller._controlledWritableStream;
        WritableStreamMarkFirstWriteRequestInFlight(stream);
        const sinkWritePromise = controller._writeAlgorithm(chunk);
        uponPromise(sinkWritePromise, () => {
            WritableStreamFinishInFlightWrite(stream);
            const state = stream._state;
            DequeueValue(controller);
            if (!WritableStreamCloseQueuedOrInFlight(stream) && state === 'writable') {
                const backpressure = WritableStreamDefaultControllerGetBackpressure(controller);
                WritableStreamUpdateBackpressure(stream, backpressure);
            }
            WritableStreamDefaultControllerAdvanceQueueIfNeeded(controller);
        }, reason => {
            if (stream._state === 'writable') {
                WritableStreamDefaultControllerClearAlgorithms(controller);
            }
            WritableStreamFinishInFlightWriteWithError(stream, reason);
        });
    }
    function WritableStreamDefaultControllerGetBackpressure(controller) {
        const desiredSize = WritableStreamDefaultControllerGetDesiredSize(controller);
        return desiredSize <= 0;
    }
    // A client of WritableStreamDefaultController may use these functions directly to bypass state check.
    function WritableStreamDefaultControllerError(controller, error) {
        const stream = controller._controlledWritableStream;
        WritableStreamDefaultControllerClearAlgorithms(controller);
        WritableStreamStartErroring(stream, error);
    }
    // Helper functions for the WritableStream.
    function streamBrandCheckException$2(name) {
        return new TypeError(`WritableStream.prototype.${name} can only be used on a WritableStream`);
    }
    // Helper functions for the WritableStreamDefaultController.
    function defaultControllerBrandCheckException$2(name) {
        return new TypeError(`WritableStreamDefaultController.prototype.${name} can only be used on a WritableStreamDefaultController`);
    }
    // Helper functions for the WritableStreamDefaultWriter.
    function defaultWriterBrandCheckException(name) {
        return new TypeError(`WritableStreamDefaultWriter.prototype.${name} can only be used on a WritableStreamDefaultWriter`);
    }
    function defaultWriterLockException(name) {
        return new TypeError('Cannot ' + name + ' a stream using a released writer');
    }
    function defaultWriterClosedPromiseInitialize(writer) {
        writer._closedPromise = newPromise((resolve, reject) => {
            writer._closedPromise_resolve = resolve;
            writer._closedPromise_reject = reject;
            writer._closedPromiseState = 'pending';
        });
    }
    function defaultWriterClosedPromiseInitializeAsRejected(writer, reason) {
        defaultWriterClosedPromiseInitialize(writer);
        defaultWriterClosedPromiseReject(writer, reason);
    }
    function defaultWriterClosedPromiseInitializeAsResolved(writer) {
        defaultWriterClosedPromiseInitialize(writer);
        defaultWriterClosedPromiseResolve(writer);
    }
    function defaultWriterClosedPromiseReject(writer, reason) {
        if (writer._closedPromise_reject === undefined) {
            return;
        }
        setPromiseIsHandledToTrue(writer._closedPromise);
        writer._closedPromise_reject(reason);
        writer._closedPromise_resolve = undefined;
        writer._closedPromise_reject = undefined;
        writer._closedPromiseState = 'rejected';
    }
    function defaultWriterClosedPromiseResetToRejected(writer, reason) {
        defaultWriterClosedPromiseInitializeAsRejected(writer, reason);
    }
    function defaultWriterClosedPromiseResolve(writer) {
        if (writer._closedPromise_resolve === undefined) {
            return;
        }
        writer._closedPromise_resolve(undefined);
        writer._closedPromise_resolve = undefined;
        writer._closedPromise_reject = undefined;
        writer._closedPromiseState = 'resolved';
    }
    function defaultWriterReadyPromiseInitialize(writer) {
        writer._readyPromise = newPromise((resolve, reject) => {
            writer._readyPromise_resolve = resolve;
            writer._readyPromise_reject = reject;
        });
        writer._readyPromiseState = 'pending';
    }
    function defaultWriterReadyPromiseInitializeAsRejected(writer, reason) {
        defaultWriterReadyPromiseInitialize(writer);
        defaultWriterReadyPromiseReject(writer, reason);
    }
    function defaultWriterReadyPromiseInitializeAsResolved(writer) {
        defaultWriterReadyPromiseInitialize(writer);
        defaultWriterReadyPromiseResolve(writer);
    }
    function defaultWriterReadyPromiseReject(writer, reason) {
        if (writer._readyPromise_reject === undefined) {
            return;
        }
        setPromiseIsHandledToTrue(writer._readyPromise);
        writer._readyPromise_reject(reason);
        writer._readyPromise_resolve = undefined;
        writer._readyPromise_reject = undefined;
        writer._readyPromiseState = 'rejected';
    }
    function defaultWriterReadyPromiseReset(writer) {
        defaultWriterReadyPromiseInitialize(writer);
    }
    function defaultWriterReadyPromiseResetToRejected(writer, reason) {
        defaultWriterReadyPromiseInitializeAsRejected(writer, reason);
    }
    function defaultWriterReadyPromiseResolve(writer) {
        if (writer._readyPromise_resolve === undefined) {
            return;
        }
        writer._readyPromise_resolve(undefined);
        writer._readyPromise_resolve = undefined;
        writer._readyPromise_reject = undefined;
        writer._readyPromiseState = 'fulfilled';
    }

    /// <reference lib="dom" />
    const NativeDOMException = typeof DOMException !== 'undefined' ? DOMException : undefined;

    /// <reference types="node" />
    function isDOMExceptionConstructor(ctor) {
        if (!(typeof ctor === 'function' || typeof ctor === 'object')) {
            return false;
        }
        try {
            new ctor();
            return true;
        }
        catch (_a) {
            return false;
        }
    }
    function createDOMExceptionPolyfill() {
        // eslint-disable-next-line no-shadow
        const ctor = function DOMException(message, name) {
            this.message = message || '';
            this.name = name || 'Error';
            if (Error.captureStackTrace) {
                Error.captureStackTrace(this, this.constructor);
            }
        };
        ctor.prototype = Object.create(Error.prototype);
        Object.defineProperty(ctor.prototype, 'constructor', { value: ctor, writable: true, configurable: true });
        return ctor;
    }
    // eslint-disable-next-line no-redeclare
    const DOMException$1 = isDOMExceptionConstructor(NativeDOMException) ? NativeDOMException : createDOMExceptionPolyfill();

    function ReadableStreamPipeTo(source, dest, preventClose, preventAbort, preventCancel, signal) {
        const reader = AcquireReadableStreamDefaultReader(source);
        const writer = AcquireWritableStreamDefaultWriter(dest);
        source._disturbed = true;
        let shuttingDown = false;
        // This is used to keep track of the spec's requirement that we wait for ongoing writes during shutdown.
        let currentWrite = promiseResolvedWith(undefined);
        return newPromise((resolve, reject) => {
            let abortAlgorithm;
            if (signal !== undefined) {
                abortAlgorithm = () => {
                    const error = new DOMException$1('Aborted', 'AbortError');
                    const actions = [];
                    if (!preventAbort) {
                        actions.push(() => {
                            if (dest._state === 'writable') {
                                return WritableStreamAbort(dest, error);
                            }
                            return promiseResolvedWith(undefined);
                        });
                    }
                    if (!preventCancel) {
                        actions.push(() => {
                            if (source._state === 'readable') {
                                return ReadableStreamCancel(source, error);
                            }
                            return promiseResolvedWith(undefined);
                        });
                    }
                    shutdownWithAction(() => Promise.all(actions.map(action => action())), true, error);
                };
                if (signal.aborted) {
                    abortAlgorithm();
                    return;
                }
                signal.addEventListener('abort', abortAlgorithm);
            }
            // Using reader and writer, read all chunks from this and write them to dest
            // - Backpressure must be enforced
            // - Shutdown must stop all activity
            function pipeLoop() {
                return newPromise((resolveLoop, rejectLoop) => {
                    function next(done) {
                        if (done) {
                            resolveLoop();
                        }
                        else {
                            // Use `PerformPromiseThen` instead of `uponPromise` to avoid
                            // adding unnecessary `.catch(rethrowAssertionErrorRejection)` handlers
                            PerformPromiseThen(pipeStep(), next, rejectLoop);
                        }
                    }
                    next(false);
                });
            }
            function pipeStep() {
                if (shuttingDown) {
                    return promiseResolvedWith(true);
                }
                return PerformPromiseThen(writer._readyPromise, () => {
                    return newPromise((resolveRead, rejectRead) => {
                        ReadableStreamDefaultReaderRead(reader, {
                            _chunkSteps: chunk => {
                                currentWrite = PerformPromiseThen(WritableStreamDefaultWriterWrite(writer, chunk), undefined, noop);
                                resolveRead(false);
                            },
                            _closeSteps: () => resolveRead(true),
                            _errorSteps: rejectRead
                        });
                    });
                });
            }
            // Errors must be propagated forward
            isOrBecomesErrored(source, reader._closedPromise, storedError => {
                if (!preventAbort) {
                    shutdownWithAction(() => WritableStreamAbort(dest, storedError), true, storedError);
                }
                else {
                    shutdown(true, storedError);
                }
            });
            // Errors must be propagated backward
            isOrBecomesErrored(dest, writer._closedPromise, storedError => {
                if (!preventCancel) {
                    shutdownWithAction(() => ReadableStreamCancel(source, storedError), true, storedError);
                }
                else {
                    shutdown(true, storedError);
                }
            });
            // Closing must be propagated forward
            isOrBecomesClosed(source, reader._closedPromise, () => {
                if (!preventClose) {
                    shutdownWithAction(() => WritableStreamDefaultWriterCloseWithErrorPropagation(writer));
                }
                else {
                    shutdown();
                }
            });
            // Closing must be propagated backward
            if (WritableStreamCloseQueuedOrInFlight(dest) || dest._state === 'closed') {
                const destClosed = new TypeError('the destination writable stream closed before all data could be piped to it');
                if (!preventCancel) {
                    shutdownWithAction(() => ReadableStreamCancel(source, destClosed), true, destClosed);
                }
                else {
                    shutdown(true, destClosed);
                }
            }
            setPromiseIsHandledToTrue(pipeLoop());
            function waitForWritesToFinish() {
                // Another write may have started while we were waiting on this currentWrite, so we have to be sure to wait
                // for that too.
                const oldCurrentWrite = currentWrite;
                return PerformPromiseThen(currentWrite, () => oldCurrentWrite !== currentWrite ? waitForWritesToFinish() : undefined);
            }
            function isOrBecomesErrored(stream, promise, action) {
                if (stream._state === 'errored') {
                    action(stream._storedError);
                }
                else {
                    uponRejection(promise, action);
                }
            }
            function isOrBecomesClosed(stream, promise, action) {
                if (stream._state === 'closed') {
                    action();
                }
                else {
                    uponFulfillment(promise, action);
                }
            }
            function shutdownWithAction(action, originalIsError, originalError) {
                if (shuttingDown) {
                    return;
                }
                shuttingDown = true;
                if (dest._state === 'writable' && !WritableStreamCloseQueuedOrInFlight(dest)) {
                    uponFulfillment(waitForWritesToFinish(), doTheRest);
                }
                else {
                    doTheRest();
                }
                function doTheRest() {
                    uponPromise(action(), () => finalize(originalIsError, originalError), newError => finalize(true, newError));
                }
            }
            function shutdown(isError, error) {
                if (shuttingDown) {
                    return;
                }
                shuttingDown = true;
                if (dest._state === 'writable' && !WritableStreamCloseQueuedOrInFlight(dest)) {
                    uponFulfillment(waitForWritesToFinish(), () => finalize(isError, error));
                }
                else {
                    finalize(isError, error);
                }
            }
            function finalize(isError, error) {
                WritableStreamDefaultWriterRelease(writer);
                ReadableStreamReaderGenericRelease(reader);
                if (signal !== undefined) {
                    signal.removeEventListener('abort', abortAlgorithm);
                }
                if (isError) {
                    reject(error);
                }
                else {
                    resolve(undefined);
                }
            }
        });
    }

    /**
     * Allows control of a {@link ReadableStream | readable stream}'s state and internal queue.
     *
     * @public
     */
    class ReadableStreamDefaultController {
        constructor() {
            throw new TypeError('Illegal constructor');
        }
        /**
         * Returns the desired size to fill the controlled stream's internal queue. It can be negative, if the queue is
         * over-full. An underlying source ought to use this information to determine when and how to apply backpressure.
         */
        get desiredSize() {
            if (!IsReadableStreamDefaultController(this)) {
                throw defaultControllerBrandCheckException$1('desiredSize');
            }
            return ReadableStreamDefaultControllerGetDesiredSize(this);
        }
        /**
         * Closes the controlled readable stream. Consumers will still be able to read any previously-enqueued chunks from
         * the stream, but once those are read, the stream will become closed.
         */
        close() {
            if (!IsReadableStreamDefaultController(this)) {
                throw defaultControllerBrandCheckException$1('close');
            }
            if (!ReadableStreamDefaultControllerCanCloseOrEnqueue(this)) {
                throw new TypeError('The stream is not in a state that permits close');
            }
            ReadableStreamDefaultControllerClose(this);
        }
        enqueue(chunk = undefined) {
            if (!IsReadableStreamDefaultController(this)) {
                throw defaultControllerBrandCheckException$1('enqueue');
            }
            if (!ReadableStreamDefaultControllerCanCloseOrEnqueue(this)) {
                throw new TypeError('The stream is not in a state that permits enqueue');
            }
            return ReadableStreamDefaultControllerEnqueue(this, chunk);
        }
        /**
         * Errors the controlled readable stream, making all future interactions with it fail with the given error `e`.
         */
        error(e = undefined) {
            if (!IsReadableStreamDefaultController(this)) {
                throw defaultControllerBrandCheckException$1('error');
            }
            ReadableStreamDefaultControllerError(this, e);
        }
        /** @internal */
        [CancelSteps](reason) {
            ResetQueue(this);
            const result = this._cancelAlgorithm(reason);
            ReadableStreamDefaultControllerClearAlgorithms(this);
            return result;
        }
        /** @internal */
        [PullSteps](readRequest) {
            const stream = this._controlledReadableStream;
            if (this._queue.length > 0) {
                const chunk = DequeueValue(this);
                if (this._closeRequested && this._queue.length === 0) {
                    ReadableStreamDefaultControllerClearAlgorithms(this);
                    ReadableStreamClose(stream);
                }
                else {
                    ReadableStreamDefaultControllerCallPullIfNeeded(this);
                }
                readRequest._chunkSteps(chunk);
            }
            else {
                ReadableStreamAddReadRequest(stream, readRequest);
                ReadableStreamDefaultControllerCallPullIfNeeded(this);
            }
        }
    }
    Object.defineProperties(ReadableStreamDefaultController.prototype, {
        close: { enumerable: true },
        enqueue: { enumerable: true },
        error: { enumerable: true },
        desiredSize: { enumerable: true }
    });
    if (typeof SymbolPolyfill.toStringTag === 'symbol') {
        Object.defineProperty(ReadableStreamDefaultController.prototype, SymbolPolyfill.toStringTag, {
            value: 'ReadableStreamDefaultController',
            configurable: true
        });
    }
    // Abstract operations for the ReadableStreamDefaultController.
    function IsReadableStreamDefaultController(x) {
        if (!typeIsObject(x)) {
            return false;
        }
        if (!Object.prototype.hasOwnProperty.call(x, '_controlledReadableStream')) {
            return false;
        }
        return x instanceof ReadableStreamDefaultController;
    }
    function ReadableStreamDefaultControllerCallPullIfNeeded(controller) {
        const shouldPull = ReadableStreamDefaultControllerShouldCallPull(controller);
        if (!shouldPull) {
            return;
        }
        if (controller._pulling) {
            controller._pullAgain = true;
            return;
        }
        controller._pulling = true;
        const pullPromise = controller._pullAlgorithm();
        uponPromise(pullPromise, () => {
            controller._pulling = false;
            if (controller._pullAgain) {
                controller._pullAgain = false;
                ReadableStreamDefaultControllerCallPullIfNeeded(controller);
            }
        }, e => {
            ReadableStreamDefaultControllerError(controller, e);
        });
    }
    function ReadableStreamDefaultControllerShouldCallPull(controller) {
        const stream = controller._controlledReadableStream;
        if (!ReadableStreamDefaultControllerCanCloseOrEnqueue(controller)) {
            return false;
        }
        if (!controller._started) {
            return false;
        }
        if (IsReadableStreamLocked(stream) && ReadableStreamGetNumReadRequests(stream) > 0) {
            return true;
        }
        const desiredSize = ReadableStreamDefaultControllerGetDesiredSize(controller);
        if (desiredSize > 0) {
            return true;
        }
        return false;
    }
    function ReadableStreamDefaultControllerClearAlgorithms(controller) {
        controller._pullAlgorithm = undefined;
        controller._cancelAlgorithm = undefined;
        controller._strategySizeAlgorithm = undefined;
    }
    // A client of ReadableStreamDefaultController may use these functions directly to bypass state check.
    function ReadableStreamDefaultControllerClose(controller) {
        if (!ReadableStreamDefaultControllerCanCloseOrEnqueue(controller)) {
            return;
        }
        const stream = controller._controlledReadableStream;
        controller._closeRequested = true;
        if (controller._queue.length === 0) {
            ReadableStreamDefaultControllerClearAlgorithms(controller);
            ReadableStreamClose(stream);
        }
    }
    function ReadableStreamDefaultControllerEnqueue(controller, chunk) {
        if (!ReadableStreamDefaultControllerCanCloseOrEnqueue(controller)) {
            return;
        }
        const stream = controller._controlledReadableStream;
        if (IsReadableStreamLocked(stream) && ReadableStreamGetNumReadRequests(stream) > 0) {
            ReadableStreamFulfillReadRequest(stream, chunk, false);
        }
        else {
            let chunkSize;
            try {
                chunkSize = controller._strategySizeAlgorithm(chunk);
            }
            catch (chunkSizeE) {
                ReadableStreamDefaultControllerError(controller, chunkSizeE);
                throw chunkSizeE;
            }
            try {
                EnqueueValueWithSize(controller, chunk, chunkSize);
            }
            catch (enqueueE) {
                ReadableStreamDefaultControllerError(controller, enqueueE);
                throw enqueueE;
            }
        }
        ReadableStreamDefaultControllerCallPullIfNeeded(controller);
    }
    function ReadableStreamDefaultControllerError(controller, e) {
        const stream = controller._controlledReadableStream;
        if (stream._state !== 'readable') {
            return;
        }
        ResetQueue(controller);
        ReadableStreamDefaultControllerClearAlgorithms(controller);
        ReadableStreamError(stream, e);
    }
    function ReadableStreamDefaultControllerGetDesiredSize(controller) {
        const state = controller._controlledReadableStream._state;
        if (state === 'errored') {
            return null;
        }
        if (state === 'closed') {
            return 0;
        }
        return controller._strategyHWM - controller._queueTotalSize;
    }
    // This is used in the implementation of TransformStream.
    function ReadableStreamDefaultControllerHasBackpressure(controller) {
        if (ReadableStreamDefaultControllerShouldCallPull(controller)) {
            return false;
        }
        return true;
    }
    function ReadableStreamDefaultControllerCanCloseOrEnqueue(controller) {
        const state = controller._controlledReadableStream._state;
        if (!controller._closeRequested && state === 'readable') {
            return true;
        }
        return false;
    }
    function SetUpReadableStreamDefaultController(stream, controller, startAlgorithm, pullAlgorithm, cancelAlgorithm, highWaterMark, sizeAlgorithm) {
        controller._controlledReadableStream = stream;
        controller._queue = undefined;
        controller._queueTotalSize = undefined;
        ResetQueue(controller);
        controller._started = false;
        controller._closeRequested = false;
        controller._pullAgain = false;
        controller._pulling = false;
        controller._strategySizeAlgorithm = sizeAlgorithm;
        controller._strategyHWM = highWaterMark;
        controller._pullAlgorithm = pullAlgorithm;
        controller._cancelAlgorithm = cancelAlgorithm;
        stream._readableStreamController = controller;
        const startResult = startAlgorithm();
        uponPromise(promiseResolvedWith(startResult), () => {
            controller._started = true;
            ReadableStreamDefaultControllerCallPullIfNeeded(controller);
        }, r => {
            ReadableStreamDefaultControllerError(controller, r);
        });
    }
    function SetUpReadableStreamDefaultControllerFromUnderlyingSource(stream, underlyingSource, highWaterMark, sizeAlgorithm) {
        const controller = Object.create(ReadableStreamDefaultController.prototype);
        let startAlgorithm = () => undefined;
        let pullAlgorithm = () => promiseResolvedWith(undefined);
        let cancelAlgorithm = () => promiseResolvedWith(undefined);
        if (underlyingSource.start !== undefined) {
            startAlgorithm = () => underlyingSource.start(controller);
        }
        if (underlyingSource.pull !== undefined) {
            pullAlgorithm = () => underlyingSource.pull(controller);
        }
        if (underlyingSource.cancel !== undefined) {
            cancelAlgorithm = reason => underlyingSource.cancel(reason);
        }
        SetUpReadableStreamDefaultController(stream, controller, startAlgorithm, pullAlgorithm, cancelAlgorithm, highWaterMark, sizeAlgorithm);
    }
    // Helper functions for the ReadableStreamDefaultController.
    function defaultControllerBrandCheckException$1(name) {
        return new TypeError(`ReadableStreamDefaultController.prototype.${name} can only be used on a ReadableStreamDefaultController`);
    }

    function ReadableStreamTee(stream, cloneForBranch2) {
        if (IsReadableByteStreamController(stream._readableStreamController)) {
            return ReadableByteStreamTee(stream);
        }
        return ReadableStreamDefaultTee(stream);
    }
    function ReadableStreamDefaultTee(stream, cloneForBranch2) {
        const reader = AcquireReadableStreamDefaultReader(stream);
        let reading = false;
        let readAgain = false;
        let canceled1 = false;
        let canceled2 = false;
        let reason1;
        let reason2;
        let branch1;
        let branch2;
        let resolveCancelPromise;
        const cancelPromise = newPromise(resolve => {
            resolveCancelPromise = resolve;
        });
        function pullAlgorithm() {
            if (reading) {
                readAgain = true;
                return promiseResolvedWith(undefined);
            }
            reading = true;
            const readRequest = {
                _chunkSteps: chunk => {
                    // This needs to be delayed a microtask because it takes at least a microtask to detect errors (using
                    // reader._closedPromise below), and we want errors in stream to error both branches immediately. We cannot let
                    // successful synchronously-available reads get ahead of asynchronously-available errors.
                    queueMicrotask(() => {
                        readAgain = false;
                        const chunk1 = chunk;
                        const chunk2 = chunk;
                        // There is no way to access the cloning code right now in the reference implementation.
                        // If we add one then we'll need an implementation for serializable objects.
                        // if (!canceled2 && cloneForBranch2) {
                        //   chunk2 = StructuredDeserialize(StructuredSerialize(chunk2));
                        // }
                        if (!canceled1) {
                            ReadableStreamDefaultControllerEnqueue(branch1._readableStreamController, chunk1);
                        }
                        if (!canceled2) {
                            ReadableStreamDefaultControllerEnqueue(branch2._readableStreamController, chunk2);
                        }
                        reading = false;
                        if (readAgain) {
                            pullAlgorithm();
                        }
                    });
                },
                _closeSteps: () => {
                    reading = false;
                    if (!canceled1) {
                        ReadableStreamDefaultControllerClose(branch1._readableStreamController);
                    }
                    if (!canceled2) {
                        ReadableStreamDefaultControllerClose(branch2._readableStreamController);
                    }
                    if (!canceled1 || !canceled2) {
                        resolveCancelPromise(undefined);
                    }
                },
                _errorSteps: () => {
                    reading = false;
                }
            };
            ReadableStreamDefaultReaderRead(reader, readRequest);
            return promiseResolvedWith(undefined);
        }
        function cancel1Algorithm(reason) {
            canceled1 = true;
            reason1 = reason;
            if (canceled2) {
                const compositeReason = CreateArrayFromList([reason1, reason2]);
                const cancelResult = ReadableStreamCancel(stream, compositeReason);
                resolveCancelPromise(cancelResult);
            }
            return cancelPromise;
        }
        function cancel2Algorithm(reason) {
            canceled2 = true;
            reason2 = reason;
            if (canceled1) {
                const compositeReason = CreateArrayFromList([reason1, reason2]);
                const cancelResult = ReadableStreamCancel(stream, compositeReason);
                resolveCancelPromise(cancelResult);
            }
            return cancelPromise;
        }
        function startAlgorithm() {
            // do nothing
        }
        branch1 = CreateReadableStream(startAlgorithm, pullAlgorithm, cancel1Algorithm);
        branch2 = CreateReadableStream(startAlgorithm, pullAlgorithm, cancel2Algorithm);
        uponRejection(reader._closedPromise, (r) => {
            ReadableStreamDefaultControllerError(branch1._readableStreamController, r);
            ReadableStreamDefaultControllerError(branch2._readableStreamController, r);
            if (!canceled1 || !canceled2) {
                resolveCancelPromise(undefined);
            }
        });
        return [branch1, branch2];
    }
    function ReadableByteStreamTee(stream) {
        let reader = AcquireReadableStreamDefaultReader(stream);
        let reading = false;
        let readAgainForBranch1 = false;
        let readAgainForBranch2 = false;
        let canceled1 = false;
        let canceled2 = false;
        let reason1;
        let reason2;
        let branch1;
        let branch2;
        let resolveCancelPromise;
        const cancelPromise = newPromise(resolve => {
            resolveCancelPromise = resolve;
        });
        function forwardReaderError(thisReader) {
            uponRejection(thisReader._closedPromise, r => {
                if (thisReader !== reader) {
                    return;
                }
                ReadableByteStreamControllerError(branch1._readableStreamController, r);
                ReadableByteStreamControllerError(branch2._readableStreamController, r);
                if (!canceled1 || !canceled2) {
                    resolveCancelPromise(undefined);
                }
            });
        }
        function pullWithDefaultReader() {
            if (IsReadableStreamBYOBReader(reader)) {
                ReadableStreamReaderGenericRelease(reader);
                reader = AcquireReadableStreamDefaultReader(stream);
                forwardReaderError(reader);
            }
            const readRequest = {
                _chunkSteps: chunk => {
                    // This needs to be delayed a microtask because it takes at least a microtask to detect errors (using
                    // reader._closedPromise below), and we want errors in stream to error both branches immediately. We cannot let
                    // successful synchronously-available reads get ahead of asynchronously-available errors.
                    queueMicrotask(() => {
                        readAgainForBranch1 = false;
                        readAgainForBranch2 = false;
                        const chunk1 = chunk;
                        let chunk2 = chunk;
                        if (!canceled1 && !canceled2) {
                            try {
                                chunk2 = CloneAsUint8Array(chunk);
                            }
                            catch (cloneE) {
                                ReadableByteStreamControllerError(branch1._readableStreamController, cloneE);
                                ReadableByteStreamControllerError(branch2._readableStreamController, cloneE);
                                resolveCancelPromise(ReadableStreamCancel(stream, cloneE));
                                return;
                            }
                        }
                        if (!canceled1) {
                            ReadableByteStreamControllerEnqueue(branch1._readableStreamController, chunk1);
                        }
                        if (!canceled2) {
                            ReadableByteStreamControllerEnqueue(branch2._readableStreamController, chunk2);
                        }
                        reading = false;
                        if (readAgainForBranch1) {
                            pull1Algorithm();
                        }
                        else if (readAgainForBranch2) {
                            pull2Algorithm();
                        }
                    });
                },
                _closeSteps: () => {
                    reading = false;
                    if (!canceled1) {
                        ReadableByteStreamControllerClose(branch1._readableStreamController);
                    }
                    if (!canceled2) {
                        ReadableByteStreamControllerClose(branch2._readableStreamController);
                    }
                    if (branch1._readableStreamController._pendingPullIntos.length > 0) {
                        ReadableByteStreamControllerRespond(branch1._readableStreamController, 0);
                    }
                    if (branch2._readableStreamController._pendingPullIntos.length > 0) {
                        ReadableByteStreamControllerRespond(branch2._readableStreamController, 0);
                    }
                    if (!canceled1 || !canceled2) {
                        resolveCancelPromise(undefined);
                    }
                },
                _errorSteps: () => {
                    reading = false;
                }
            };
            ReadableStreamDefaultReaderRead(reader, readRequest);
        }
        function pullWithBYOBReader(view, forBranch2) {
            if (IsReadableStreamDefaultReader(reader)) {
                ReadableStreamReaderGenericRelease(reader);
                reader = AcquireReadableStreamBYOBReader(stream);
                forwardReaderError(reader);
            }
            const byobBranch = forBranch2 ? branch2 : branch1;
            const otherBranch = forBranch2 ? branch1 : branch2;
            const readIntoRequest = {
                _chunkSteps: chunk => {
                    // This needs to be delayed a microtask because it takes at least a microtask to detect errors (using
                    // reader._closedPromise below), and we want errors in stream to error both branches immediately. We cannot let
                    // successful synchronously-available reads get ahead of asynchronously-available errors.
                    queueMicrotask(() => {
                        readAgainForBranch1 = false;
                        readAgainForBranch2 = false;
                        const byobCanceled = forBranch2 ? canceled2 : canceled1;
                        const otherCanceled = forBranch2 ? canceled1 : canceled2;
                        if (!otherCanceled) {
                            let clonedChunk;
                            try {
                                clonedChunk = CloneAsUint8Array(chunk);
                            }
                            catch (cloneE) {
                                ReadableByteStreamControllerError(byobBranch._readableStreamController, cloneE);
                                ReadableByteStreamControllerError(otherBranch._readableStreamController, cloneE);
                                resolveCancelPromise(ReadableStreamCancel(stream, cloneE));
                                return;
                            }
                            if (!byobCanceled) {
                                ReadableByteStreamControllerRespondWithNewView(byobBranch._readableStreamController, chunk);
                            }
                            ReadableByteStreamControllerEnqueue(otherBranch._readableStreamController, clonedChunk);
                        }
                        else if (!byobCanceled) {
                            ReadableByteStreamControllerRespondWithNewView(byobBranch._readableStreamController, chunk);
                        }
                        reading = false;
                        if (readAgainForBranch1) {
                            pull1Algorithm();
                        }
                        else if (readAgainForBranch2) {
                            pull2Algorithm();
                        }
                    });
                },
                _closeSteps: chunk => {
                    reading = false;
                    const byobCanceled = forBranch2 ? canceled2 : canceled1;
                    const otherCanceled = forBranch2 ? canceled1 : canceled2;
                    if (!byobCanceled) {
                        ReadableByteStreamControllerClose(byobBranch._readableStreamController);
                    }
                    if (!otherCanceled) {
                        ReadableByteStreamControllerClose(otherBranch._readableStreamController);
                    }
                    if (chunk !== undefined) {
                        if (!byobCanceled) {
                            ReadableByteStreamControllerRespondWithNewView(byobBranch._readableStreamController, chunk);
                        }
                        if (!otherCanceled && otherBranch._readableStreamController._pendingPullIntos.length > 0) {
                            ReadableByteStreamControllerRespond(otherBranch._readableStreamController, 0);
                        }
                    }
                    if (!byobCanceled || !otherCanceled) {
                        resolveCancelPromise(undefined);
                    }
                },
                _errorSteps: () => {
                    reading = false;
                }
            };
            ReadableStreamBYOBReaderRead(reader, view, readIntoRequest);
        }
        function pull1Algorithm() {
            if (reading) {
                readAgainForBranch1 = true;
                return promiseResolvedWith(undefined);
            }
            reading = true;
            const byobRequest = ReadableByteStreamControllerGetBYOBRequest(branch1._readableStreamController);
            if (byobRequest === null) {
                pullWithDefaultReader();
            }
            else {
                pullWithBYOBReader(byobRequest._view, false);
            }
            return promiseResolvedWith(undefined);
        }
        function pull2Algorithm() {
            if (reading) {
                readAgainForBranch2 = true;
                return promiseResolvedWith(undefined);
            }
            reading = true;
            const byobRequest = ReadableByteStreamControllerGetBYOBRequest(branch2._readableStreamController);
            if (byobRequest === null) {
                pullWithDefaultReader();
            }
            else {
                pullWithBYOBReader(byobRequest._view, true);
            }
            return promiseResolvedWith(undefined);
        }
        function cancel1Algorithm(reason) {
            canceled1 = true;
            reason1 = reason;
            if (canceled2) {
                const compositeReason = CreateArrayFromList([reason1, reason2]);
                const cancelResult = ReadableStreamCancel(stream, compositeReason);
                resolveCancelPromise(cancelResult);
            }
            return cancelPromise;
        }
        function cancel2Algorithm(reason) {
            canceled2 = true;
            reason2 = reason;
            if (canceled1) {
                const compositeReason = CreateArrayFromList([reason1, reason2]);
                const cancelResult = ReadableStreamCancel(stream, compositeReason);
                resolveCancelPromise(cancelResult);
            }
            return cancelPromise;
        }
        function startAlgorithm() {
            return;
        }
        branch1 = CreateReadableByteStream(startAlgorithm, pull1Algorithm, cancel1Algorithm);
        branch2 = CreateReadableByteStream(startAlgorithm, pull2Algorithm, cancel2Algorithm);
        forwardReaderError(reader);
        return [branch1, branch2];
    }

    function convertUnderlyingDefaultOrByteSource(source, context) {
        assertDictionary(source, context);
        const original = source;
        const autoAllocateChunkSize = original === null || original === void 0 ? void 0 : original.autoAllocateChunkSize;
        const cancel = original === null || original === void 0 ? void 0 : original.cancel;
        const pull = original === null || original === void 0 ? void 0 : original.pull;
        const start = original === null || original === void 0 ? void 0 : original.start;
        const type = original === null || original === void 0 ? void 0 : original.type;
        return {
            autoAllocateChunkSize: autoAllocateChunkSize === undefined ?
                undefined :
                convertUnsignedLongLongWithEnforceRange(autoAllocateChunkSize, `${context} has member 'autoAllocateChunkSize' that`),
            cancel: cancel === undefined ?
                undefined :
                convertUnderlyingSourceCancelCallback(cancel, original, `${context} has member 'cancel' that`),
            pull: pull === undefined ?
                undefined :
                convertUnderlyingSourcePullCallback(pull, original, `${context} has member 'pull' that`),
            start: start === undefined ?
                undefined :
                convertUnderlyingSourceStartCallback(start, original, `${context} has member 'start' that`),
            type: type === undefined ? undefined : convertReadableStreamType(type, `${context} has member 'type' that`)
        };
    }
    function convertUnderlyingSourceCancelCallback(fn, original, context) {
        assertFunction(fn, context);
        return (reason) => promiseCall(fn, original, [reason]);
    }
    function convertUnderlyingSourcePullCallback(fn, original, context) {
        assertFunction(fn, context);
        return (controller) => promiseCall(fn, original, [controller]);
    }
    function convertUnderlyingSourceStartCallback(fn, original, context) {
        assertFunction(fn, context);
        return (controller) => reflectCall(fn, original, [controller]);
    }
    function convertReadableStreamType(type, context) {
        type = `${type}`;
        if (type !== 'bytes') {
            throw new TypeError(`${context} '${type}' is not a valid enumeration value for ReadableStreamType`);
        }
        return type;
    }

    function convertReaderOptions(options, context) {
        assertDictionary(options, context);
        const mode = options === null || options === void 0 ? void 0 : options.mode;
        return {
            mode: mode === undefined ? undefined : convertReadableStreamReaderMode(mode, `${context} has member 'mode' that`)
        };
    }
    function convertReadableStreamReaderMode(mode, context) {
        mode = `${mode}`;
        if (mode !== 'byob') {
            throw new TypeError(`${context} '${mode}' is not a valid enumeration value for ReadableStreamReaderMode`);
        }
        return mode;
    }

    function convertIteratorOptions(options, context) {
        assertDictionary(options, context);
        const preventCancel = options === null || options === void 0 ? void 0 : options.preventCancel;
        return { preventCancel: Boolean(preventCancel) };
    }

    function convertPipeOptions(options, context) {
        assertDictionary(options, context);
        const preventAbort = options === null || options === void 0 ? void 0 : options.preventAbort;
        const preventCancel = options === null || options === void 0 ? void 0 : options.preventCancel;
        const preventClose = options === null || options === void 0 ? void 0 : options.preventClose;
        const signal = options === null || options === void 0 ? void 0 : options.signal;
        if (signal !== undefined) {
            assertAbortSignal(signal, `${context} has member 'signal' that`);
        }
        return {
            preventAbort: Boolean(preventAbort),
            preventCancel: Boolean(preventCancel),
            preventClose: Boolean(preventClose),
            signal
        };
    }
    function assertAbortSignal(signal, context) {
        if (!isAbortSignal(signal)) {
            throw new TypeError(`${context} is not an AbortSignal.`);
        }
    }

    function convertReadableWritablePair(pair, context) {
        assertDictionary(pair, context);
        const readable = pair === null || pair === void 0 ? void 0 : pair.readable;
        assertRequiredField(readable, 'readable', 'ReadableWritablePair');
        assertReadableStream(readable, `${context} has member 'readable' that`);
        const writable = pair === null || pair === void 0 ? void 0 : pair.writable;
        assertRequiredField(writable, 'writable', 'ReadableWritablePair');
        assertWritableStream(writable, `${context} has member 'writable' that`);
        return { readable, writable };
    }

    /**
     * A readable stream represents a source of data, from which you can read.
     *
     * @public
     */
    class ReadableStream {
        constructor(rawUnderlyingSource = {}, rawStrategy = {}) {
            if (rawUnderlyingSource === undefined) {
                rawUnderlyingSource = null;
            }
            else {
                assertObject(rawUnderlyingSource, 'First parameter');
            }
            const strategy = convertQueuingStrategy(rawStrategy, 'Second parameter');
            const underlyingSource = convertUnderlyingDefaultOrByteSource(rawUnderlyingSource, 'First parameter');
            InitializeReadableStream(this);
            if (underlyingSource.type === 'bytes') {
                if (strategy.size !== undefined) {
                    throw new RangeError('The strategy for a byte stream cannot have a size function');
                }
                const highWaterMark = ExtractHighWaterMark(strategy, 0);
                SetUpReadableByteStreamControllerFromUnderlyingSource(this, underlyingSource, highWaterMark);
            }
            else {
                const sizeAlgorithm = ExtractSizeAlgorithm(strategy);
                const highWaterMark = ExtractHighWaterMark(strategy, 1);
                SetUpReadableStreamDefaultControllerFromUnderlyingSource(this, underlyingSource, highWaterMark, sizeAlgorithm);
            }
        }
        /**
         * Whether or not the readable stream is locked to a {@link ReadableStreamDefaultReader | reader}.
         */
        get locked() {
            if (!IsReadableStream(this)) {
                throw streamBrandCheckException$1('locked');
            }
            return IsReadableStreamLocked(this);
        }
        /**
         * Cancels the stream, signaling a loss of interest in the stream by a consumer.
         *
         * The supplied `reason` argument will be given to the underlying source's {@link UnderlyingSource.cancel | cancel()}
         * method, which might or might not use it.
         */
        cancel(reason = undefined) {
            if (!IsReadableStream(this)) {
                return promiseRejectedWith(streamBrandCheckException$1('cancel'));
            }
            if (IsReadableStreamLocked(this)) {
                return promiseRejectedWith(new TypeError('Cannot cancel a stream that already has a reader'));
            }
            return ReadableStreamCancel(this, reason);
        }
        getReader(rawOptions = undefined) {
            if (!IsReadableStream(this)) {
                throw streamBrandCheckException$1('getReader');
            }
            const options = convertReaderOptions(rawOptions, 'First parameter');
            if (options.mode === undefined) {
                return AcquireReadableStreamDefaultReader(this);
            }
            return AcquireReadableStreamBYOBReader(this);
        }
        pipeThrough(rawTransform, rawOptions = {}) {
            if (!IsReadableStream(this)) {
                throw streamBrandCheckException$1('pipeThrough');
            }
            assertRequiredArgument(rawTransform, 1, 'pipeThrough');
            const transform = convertReadableWritablePair(rawTransform, 'First parameter');
            const options = convertPipeOptions(rawOptions, 'Second parameter');
            if (IsReadableStreamLocked(this)) {
                throw new TypeError('ReadableStream.prototype.pipeThrough cannot be used on a locked ReadableStream');
            }
            if (IsWritableStreamLocked(transform.writable)) {
                throw new TypeError('ReadableStream.prototype.pipeThrough cannot be used on a locked WritableStream');
            }
            const promise = ReadableStreamPipeTo(this, transform.writable, options.preventClose, options.preventAbort, options.preventCancel, options.signal);
            setPromiseIsHandledToTrue(promise);
            return transform.readable;
        }
        pipeTo(destination, rawOptions = {}) {
            if (!IsReadableStream(this)) {
                return promiseRejectedWith(streamBrandCheckException$1('pipeTo'));
            }
            if (destination === undefined) {
                return promiseRejectedWith(`Parameter 1 is required in 'pipeTo'.`);
            }
            if (!IsWritableStream(destination)) {
                return promiseRejectedWith(new TypeError(`ReadableStream.prototype.pipeTo's first argument must be a WritableStream`));
            }
            let options;
            try {
                options = convertPipeOptions(rawOptions, 'Second parameter');
            }
            catch (e) {
                return promiseRejectedWith(e);
            }
            if (IsReadableStreamLocked(this)) {
                return promiseRejectedWith(new TypeError('ReadableStream.prototype.pipeTo cannot be used on a locked ReadableStream'));
            }
            if (IsWritableStreamLocked(destination)) {
                return promiseRejectedWith(new TypeError('ReadableStream.prototype.pipeTo cannot be used on a locked WritableStream'));
            }
            return ReadableStreamPipeTo(this, destination, options.preventClose, options.preventAbort, options.preventCancel, options.signal);
        }
        /**
         * Tees this readable stream, returning a two-element array containing the two resulting branches as
         * new {@link ReadableStream} instances.
         *
         * Teeing a stream will lock it, preventing any other consumer from acquiring a reader.
         * To cancel the stream, cancel both of the resulting branches; a composite cancellation reason will then be
         * propagated to the stream's underlying source.
         *
         * Note that the chunks seen in each branch will be the same object. If the chunks are not immutable,
         * this could allow interference between the two branches.
         */
        tee() {
            if (!IsReadableStream(this)) {
                throw streamBrandCheckException$1('tee');
            }
            const branches = ReadableStreamTee(this);
            return CreateArrayFromList(branches);
        }
        values(rawOptions = undefined) {
            if (!IsReadableStream(this)) {
                throw streamBrandCheckException$1('values');
            }
            const options = convertIteratorOptions(rawOptions, 'First parameter');
            return AcquireReadableStreamAsyncIterator(this, options.preventCancel);
        }
    }
    Object.defineProperties(ReadableStream.prototype, {
        cancel: { enumerable: true },
        getReader: { enumerable: true },
        pipeThrough: { enumerable: true },
        pipeTo: { enumerable: true },
        tee: { enumerable: true },
        values: { enumerable: true },
        locked: { enumerable: true }
    });
    if (typeof SymbolPolyfill.toStringTag === 'symbol') {
        Object.defineProperty(ReadableStream.prototype, SymbolPolyfill.toStringTag, {
            value: 'ReadableStream',
            configurable: true
        });
    }
    if (typeof SymbolPolyfill.asyncIterator === 'symbol') {
        Object.defineProperty(ReadableStream.prototype, SymbolPolyfill.asyncIterator, {
            value: ReadableStream.prototype.values,
            writable: true,
            configurable: true
        });
    }
    // Abstract operations for the ReadableStream.
    // Throws if and only if startAlgorithm throws.
    function CreateReadableStream(startAlgorithm, pullAlgorithm, cancelAlgorithm, highWaterMark = 1, sizeAlgorithm = () => 1) {
        const stream = Object.create(ReadableStream.prototype);
        InitializeReadableStream(stream);
        const controller = Object.create(ReadableStreamDefaultController.prototype);
        SetUpReadableStreamDefaultController(stream, controller, startAlgorithm, pullAlgorithm, cancelAlgorithm, highWaterMark, sizeAlgorithm);
        return stream;
    }
    // Throws if and only if startAlgorithm throws.
    function CreateReadableByteStream(startAlgorithm, pullAlgorithm, cancelAlgorithm) {
        const stream = Object.create(ReadableStream.prototype);
        InitializeReadableStream(stream);
        const controller = Object.create(ReadableByteStreamController.prototype);
        SetUpReadableByteStreamController(stream, controller, startAlgorithm, pullAlgorithm, cancelAlgorithm, 0, undefined);
        return stream;
    }
    function InitializeReadableStream(stream) {
        stream._state = 'readable';
        stream._reader = undefined;
        stream._storedError = undefined;
        stream._disturbed = false;
    }
    function IsReadableStream(x) {
        if (!typeIsObject(x)) {
            return false;
        }
        if (!Object.prototype.hasOwnProperty.call(x, '_readableStreamController')) {
            return false;
        }
        return x instanceof ReadableStream;
    }
    function IsReadableStreamLocked(stream) {
        if (stream._reader === undefined) {
            return false;
        }
        return true;
    }
    // ReadableStream API exposed for controllers.
    function ReadableStreamCancel(stream, reason) {
        stream._disturbed = true;
        if (stream._state === 'closed') {
            return promiseResolvedWith(undefined);
        }
        if (stream._state === 'errored') {
            return promiseRejectedWith(stream._storedError);
        }
        ReadableStreamClose(stream);
        const reader = stream._reader;
        if (reader !== undefined && IsReadableStreamBYOBReader(reader)) {
            reader._readIntoRequests.forEach(readIntoRequest => {
                readIntoRequest._closeSteps(undefined);
            });
            reader._readIntoRequests = new SimpleQueue();
        }
        const sourceCancelPromise = stream._readableStreamController[CancelSteps](reason);
        return transformPromiseWith(sourceCancelPromise, noop);
    }
    function ReadableStreamClose(stream) {
        stream._state = 'closed';
        const reader = stream._reader;
        if (reader === undefined) {
            return;
        }
        defaultReaderClosedPromiseResolve(reader);
        if (IsReadableStreamDefaultReader(reader)) {
            reader._readRequests.forEach(readRequest => {
                readRequest._closeSteps();
            });
            reader._readRequests = new SimpleQueue();
        }
    }
    function ReadableStreamError(stream, e) {
        stream._state = 'errored';
        stream._storedError = e;
        const reader = stream._reader;
        if (reader === undefined) {
            return;
        }
        defaultReaderClosedPromiseReject(reader, e);
        if (IsReadableStreamDefaultReader(reader)) {
            reader._readRequests.forEach(readRequest => {
                readRequest._errorSteps(e);
            });
            reader._readRequests = new SimpleQueue();
        }
        else {
            reader._readIntoRequests.forEach(readIntoRequest => {
                readIntoRequest._errorSteps(e);
            });
            reader._readIntoRequests = new SimpleQueue();
        }
    }
    // Helper functions for the ReadableStream.
    function streamBrandCheckException$1(name) {
        return new TypeError(`ReadableStream.prototype.${name} can only be used on a ReadableStream`);
    }

    function convertQueuingStrategyInit(init, context) {
        assertDictionary(init, context);
        const highWaterMark = init === null || init === void 0 ? void 0 : init.highWaterMark;
        assertRequiredField(highWaterMark, 'highWaterMark', 'QueuingStrategyInit');
        return {
            highWaterMark: convertUnrestrictedDouble(highWaterMark)
        };
    }

    // The size function must not have a prototype property nor be a constructor
    const byteLengthSizeFunction = (chunk) => {
        return chunk.byteLength;
    };
    try {
        Object.defineProperty(byteLengthSizeFunction, 'name', {
            value: 'size',
            configurable: true
        });
    }
    catch (_a) {
        // This property is non-configurable in older browsers, so ignore if this throws.
        // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/name#browser_compatibility
    }
    /**
     * A queuing strategy that counts the number of bytes in each chunk.
     *
     * @public
     */
    class ByteLengthQueuingStrategy {
        constructor(options) {
            assertRequiredArgument(options, 1, 'ByteLengthQueuingStrategy');
            options = convertQueuingStrategyInit(options, 'First parameter');
            this._byteLengthQueuingStrategyHighWaterMark = options.highWaterMark;
        }
        /**
         * Returns the high water mark provided to the constructor.
         */
        get highWaterMark() {
            if (!IsByteLengthQueuingStrategy(this)) {
                throw byteLengthBrandCheckException('highWaterMark');
            }
            return this._byteLengthQueuingStrategyHighWaterMark;
        }
        /**
         * Measures the size of `chunk` by returning the value of its `byteLength` property.
         */
        get size() {
            if (!IsByteLengthQueuingStrategy(this)) {
                throw byteLengthBrandCheckException('size');
            }
            return byteLengthSizeFunction;
        }
    }
    Object.defineProperties(ByteLengthQueuingStrategy.prototype, {
        highWaterMark: { enumerable: true },
        size: { enumerable: true }
    });
    if (typeof SymbolPolyfill.toStringTag === 'symbol') {
        Object.defineProperty(ByteLengthQueuingStrategy.prototype, SymbolPolyfill.toStringTag, {
            value: 'ByteLengthQueuingStrategy',
            configurable: true
        });
    }
    // Helper functions for the ByteLengthQueuingStrategy.
    function byteLengthBrandCheckException(name) {
        return new TypeError(`ByteLengthQueuingStrategy.prototype.${name} can only be used on a ByteLengthQueuingStrategy`);
    }
    function IsByteLengthQueuingStrategy(x) {
        if (!typeIsObject(x)) {
            return false;
        }
        if (!Object.prototype.hasOwnProperty.call(x, '_byteLengthQueuingStrategyHighWaterMark')) {
            return false;
        }
        return x instanceof ByteLengthQueuingStrategy;
    }

    // The size function must not have a prototype property nor be a constructor
    const countSizeFunction = () => {
        return 1;
    };
    try {
        Object.defineProperty(countSizeFunction, 'name', {
            value: 'size',
            configurable: true
        });
    }
    catch (_a) {
        // This property is non-configurable in older browsers, so ignore if this throws.
        // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/name#browser_compatibility
    }
    /**
     * A queuing strategy that counts the number of chunks.
     *
     * @public
     */
    class CountQueuingStrategy {
        constructor(options) {
            assertRequiredArgument(options, 1, 'CountQueuingStrategy');
            options = convertQueuingStrategyInit(options, 'First parameter');
            this._countQueuingStrategyHighWaterMark = options.highWaterMark;
        }
        /**
         * Returns the high water mark provided to the constructor.
         */
        get highWaterMark() {
            if (!IsCountQueuingStrategy(this)) {
                throw countBrandCheckException('highWaterMark');
            }
            return this._countQueuingStrategyHighWaterMark;
        }
        /**
         * Measures the size of `chunk` by always returning 1.
         * This ensures that the total queue size is a count of the number of chunks in the queue.
         */
        get size() {
            if (!IsCountQueuingStrategy(this)) {
                throw countBrandCheckException('size');
            }
            return countSizeFunction;
        }
    }
    Object.defineProperties(CountQueuingStrategy.prototype, {
        highWaterMark: { enumerable: true },
        size: { enumerable: true }
    });
    if (typeof SymbolPolyfill.toStringTag === 'symbol') {
        Object.defineProperty(CountQueuingStrategy.prototype, SymbolPolyfill.toStringTag, {
            value: 'CountQueuingStrategy',
            configurable: true
        });
    }
    // Helper functions for the CountQueuingStrategy.
    function countBrandCheckException(name) {
        return new TypeError(`CountQueuingStrategy.prototype.${name} can only be used on a CountQueuingStrategy`);
    }
    function IsCountQueuingStrategy(x) {
        if (!typeIsObject(x)) {
            return false;
        }
        if (!Object.prototype.hasOwnProperty.call(x, '_countQueuingStrategyHighWaterMark')) {
            return false;
        }
        return x instanceof CountQueuingStrategy;
    }

    function convertTransformer(original, context) {
        assertDictionary(original, context);
        const flush = original === null || original === void 0 ? void 0 : original.flush;
        const readableType = original === null || original === void 0 ? void 0 : original.readableType;
        const start = original === null || original === void 0 ? void 0 : original.start;
        const transform = original === null || original === void 0 ? void 0 : original.transform;
        const writableType = original === null || original === void 0 ? void 0 : original.writableType;
        return {
            flush: flush === undefined ?
                undefined :
                convertTransformerFlushCallback(flush, original, `${context} has member 'flush' that`),
            readableType,
            start: start === undefined ?
                undefined :
                convertTransformerStartCallback(start, original, `${context} has member 'start' that`),
            transform: transform === undefined ?
                undefined :
                convertTransformerTransformCallback(transform, original, `${context} has member 'transform' that`),
            writableType
        };
    }
    function convertTransformerFlushCallback(fn, original, context) {
        assertFunction(fn, context);
        return (controller) => promiseCall(fn, original, [controller]);
    }
    function convertTransformerStartCallback(fn, original, context) {
        assertFunction(fn, context);
        return (controller) => reflectCall(fn, original, [controller]);
    }
    function convertTransformerTransformCallback(fn, original, context) {
        assertFunction(fn, context);
        return (chunk, controller) => promiseCall(fn, original, [chunk, controller]);
    }

    // Class TransformStream
    /**
     * A transform stream consists of a pair of streams: a {@link WritableStream | writable stream},
     * known as its writable side, and a {@link ReadableStream | readable stream}, known as its readable side.
     * In a manner specific to the transform stream in question, writes to the writable side result in new data being
     * made available for reading from the readable side.
     *
     * @public
     */
    class TransformStream {
        constructor(rawTransformer = {}, rawWritableStrategy = {}, rawReadableStrategy = {}) {
            if (rawTransformer === undefined) {
                rawTransformer = null;
            }
            const writableStrategy = convertQueuingStrategy(rawWritableStrategy, 'Second parameter');
            const readableStrategy = convertQueuingStrategy(rawReadableStrategy, 'Third parameter');
            const transformer = convertTransformer(rawTransformer, 'First parameter');
            if (transformer.readableType !== undefined) {
                throw new RangeError('Invalid readableType specified');
            }
            if (transformer.writableType !== undefined) {
                throw new RangeError('Invalid writableType specified');
            }
            const readableHighWaterMark = ExtractHighWaterMark(readableStrategy, 0);
            const readableSizeAlgorithm = ExtractSizeAlgorithm(readableStrategy);
            const writableHighWaterMark = ExtractHighWaterMark(writableStrategy, 1);
            const writableSizeAlgorithm = ExtractSizeAlgorithm(writableStrategy);
            let startPromise_resolve;
            const startPromise = newPromise(resolve => {
                startPromise_resolve = resolve;
            });
            InitializeTransformStream(this, startPromise, writableHighWaterMark, writableSizeAlgorithm, readableHighWaterMark, readableSizeAlgorithm);
            SetUpTransformStreamDefaultControllerFromTransformer(this, transformer);
            if (transformer.start !== undefined) {
                startPromise_resolve(transformer.start(this._transformStreamController));
            }
            else {
                startPromise_resolve(undefined);
            }
        }
        /**
         * The readable side of the transform stream.
         */
        get readable() {
            if (!IsTransformStream(this)) {
                throw streamBrandCheckException('readable');
            }
            return this._readable;
        }
        /**
         * The writable side of the transform stream.
         */
        get writable() {
            if (!IsTransformStream(this)) {
                throw streamBrandCheckException('writable');
            }
            return this._writable;
        }
    }
    Object.defineProperties(TransformStream.prototype, {
        readable: { enumerable: true },
        writable: { enumerable: true }
    });
    if (typeof SymbolPolyfill.toStringTag === 'symbol') {
        Object.defineProperty(TransformStream.prototype, SymbolPolyfill.toStringTag, {
            value: 'TransformStream',
            configurable: true
        });
    }
    function InitializeTransformStream(stream, startPromise, writableHighWaterMark, writableSizeAlgorithm, readableHighWaterMark, readableSizeAlgorithm) {
        function startAlgorithm() {
            return startPromise;
        }
        function writeAlgorithm(chunk) {
            return TransformStreamDefaultSinkWriteAlgorithm(stream, chunk);
        }
        function abortAlgorithm(reason) {
            return TransformStreamDefaultSinkAbortAlgorithm(stream, reason);
        }
        function closeAlgorithm() {
            return TransformStreamDefaultSinkCloseAlgorithm(stream);
        }
        stream._writable = CreateWritableStream(startAlgorithm, writeAlgorithm, closeAlgorithm, abortAlgorithm, writableHighWaterMark, writableSizeAlgorithm);
        function pullAlgorithm() {
            return TransformStreamDefaultSourcePullAlgorithm(stream);
        }
        function cancelAlgorithm(reason) {
            TransformStreamErrorWritableAndUnblockWrite(stream, reason);
            return promiseResolvedWith(undefined);
        }
        stream._readable = CreateReadableStream(startAlgorithm, pullAlgorithm, cancelAlgorithm, readableHighWaterMark, readableSizeAlgorithm);
        // The [[backpressure]] slot is set to undefined so that it can be initialised by TransformStreamSetBackpressure.
        stream._backpressure = undefined;
        stream._backpressureChangePromise = undefined;
        stream._backpressureChangePromise_resolve = undefined;
        TransformStreamSetBackpressure(stream, true);
        stream._transformStreamController = undefined;
    }
    function IsTransformStream(x) {
        if (!typeIsObject(x)) {
            return false;
        }
        if (!Object.prototype.hasOwnProperty.call(x, '_transformStreamController')) {
            return false;
        }
        return x instanceof TransformStream;
    }
    // This is a no-op if both sides are already errored.
    function TransformStreamError(stream, e) {
        ReadableStreamDefaultControllerError(stream._readable._readableStreamController, e);
        TransformStreamErrorWritableAndUnblockWrite(stream, e);
    }
    function TransformStreamErrorWritableAndUnblockWrite(stream, e) {
        TransformStreamDefaultControllerClearAlgorithms(stream._transformStreamController);
        WritableStreamDefaultControllerErrorIfNeeded(stream._writable._writableStreamController, e);
        if (stream._backpressure) {
            // Pretend that pull() was called to permit any pending write() calls to complete. TransformStreamSetBackpressure()
            // cannot be called from enqueue() or pull() once the ReadableStream is errored, so this will will be the final time
            // _backpressure is set.
            TransformStreamSetBackpressure(stream, false);
        }
    }
    function TransformStreamSetBackpressure(stream, backpressure) {
        // Passes also when called during construction.
        if (stream._backpressureChangePromise !== undefined) {
            stream._backpressureChangePromise_resolve();
        }
        stream._backpressureChangePromise = newPromise(resolve => {
            stream._backpressureChangePromise_resolve = resolve;
        });
        stream._backpressure = backpressure;
    }
    // Class TransformStreamDefaultController
    /**
     * Allows control of the {@link ReadableStream} and {@link WritableStream} of the associated {@link TransformStream}.
     *
     * @public
     */
    class TransformStreamDefaultController {
        constructor() {
            throw new TypeError('Illegal constructor');
        }
        /**
         * Returns the desired size to fill the readable side’s internal queue. It can be negative, if the queue is over-full.
         */
        get desiredSize() {
            if (!IsTransformStreamDefaultController(this)) {
                throw defaultControllerBrandCheckException('desiredSize');
            }
            const readableController = this._controlledTransformStream._readable._readableStreamController;
            return ReadableStreamDefaultControllerGetDesiredSize(readableController);
        }
        enqueue(chunk = undefined) {
            if (!IsTransformStreamDefaultController(this)) {
                throw defaultControllerBrandCheckException('enqueue');
            }
            TransformStreamDefaultControllerEnqueue(this, chunk);
        }
        /**
         * Errors both the readable side and the writable side of the controlled transform stream, making all future
         * interactions with it fail with the given error `e`. Any chunks queued for transformation will be discarded.
         */
        error(reason = undefined) {
            if (!IsTransformStreamDefaultController(this)) {
                throw defaultControllerBrandCheckException('error');
            }
            TransformStreamDefaultControllerError(this, reason);
        }
        /**
         * Closes the readable side and errors the writable side of the controlled transform stream. This is useful when the
         * transformer only needs to consume a portion of the chunks written to the writable side.
         */
        terminate() {
            if (!IsTransformStreamDefaultController(this)) {
                throw defaultControllerBrandCheckException('terminate');
            }
            TransformStreamDefaultControllerTerminate(this);
        }
    }
    Object.defineProperties(TransformStreamDefaultController.prototype, {
        enqueue: { enumerable: true },
        error: { enumerable: true },
        terminate: { enumerable: true },
        desiredSize: { enumerable: true }
    });
    if (typeof SymbolPolyfill.toStringTag === 'symbol') {
        Object.defineProperty(TransformStreamDefaultController.prototype, SymbolPolyfill.toStringTag, {
            value: 'TransformStreamDefaultController',
            configurable: true
        });
    }
    // Transform Stream Default Controller Abstract Operations
    function IsTransformStreamDefaultController(x) {
        if (!typeIsObject(x)) {
            return false;
        }
        if (!Object.prototype.hasOwnProperty.call(x, '_controlledTransformStream')) {
            return false;
        }
        return x instanceof TransformStreamDefaultController;
    }
    function SetUpTransformStreamDefaultController(stream, controller, transformAlgorithm, flushAlgorithm) {
        controller._controlledTransformStream = stream;
        stream._transformStreamController = controller;
        controller._transformAlgorithm = transformAlgorithm;
        controller._flushAlgorithm = flushAlgorithm;
    }
    function SetUpTransformStreamDefaultControllerFromTransformer(stream, transformer) {
        const controller = Object.create(TransformStreamDefaultController.prototype);
        let transformAlgorithm = (chunk) => {
            try {
                TransformStreamDefaultControllerEnqueue(controller, chunk);
                return promiseResolvedWith(undefined);
            }
            catch (transformResultE) {
                return promiseRejectedWith(transformResultE);
            }
        };
        let flushAlgorithm = () => promiseResolvedWith(undefined);
        if (transformer.transform !== undefined) {
            transformAlgorithm = chunk => transformer.transform(chunk, controller);
        }
        if (transformer.flush !== undefined) {
            flushAlgorithm = () => transformer.flush(controller);
        }
        SetUpTransformStreamDefaultController(stream, controller, transformAlgorithm, flushAlgorithm);
    }
    function TransformStreamDefaultControllerClearAlgorithms(controller) {
        controller._transformAlgorithm = undefined;
        controller._flushAlgorithm = undefined;
    }
    function TransformStreamDefaultControllerEnqueue(controller, chunk) {
        const stream = controller._controlledTransformStream;
        const readableController = stream._readable._readableStreamController;
        if (!ReadableStreamDefaultControllerCanCloseOrEnqueue(readableController)) {
            throw new TypeError('Readable side is not in a state that permits enqueue');
        }
        // We throttle transform invocations based on the backpressure of the ReadableStream, but we still
        // accept TransformStreamDefaultControllerEnqueue() calls.
        try {
            ReadableStreamDefaultControllerEnqueue(readableController, chunk);
        }
        catch (e) {
            // This happens when readableStrategy.size() throws.
            TransformStreamErrorWritableAndUnblockWrite(stream, e);
            throw stream._readable._storedError;
        }
        const backpressure = ReadableStreamDefaultControllerHasBackpressure(readableController);
        if (backpressure !== stream._backpressure) {
            TransformStreamSetBackpressure(stream, true);
        }
    }
    function TransformStreamDefaultControllerError(controller, e) {
        TransformStreamError(controller._controlledTransformStream, e);
    }
    function TransformStreamDefaultControllerPerformTransform(controller, chunk) {
        const transformPromise = controller._transformAlgorithm(chunk);
        return transformPromiseWith(transformPromise, undefined, r => {
            TransformStreamError(controller._controlledTransformStream, r);
            throw r;
        });
    }
    function TransformStreamDefaultControllerTerminate(controller) {
        const stream = controller._controlledTransformStream;
        const readableController = stream._readable._readableStreamController;
        ReadableStreamDefaultControllerClose(readableController);
        const error = new TypeError('TransformStream terminated');
        TransformStreamErrorWritableAndUnblockWrite(stream, error);
    }
    // TransformStreamDefaultSink Algorithms
    function TransformStreamDefaultSinkWriteAlgorithm(stream, chunk) {
        const controller = stream._transformStreamController;
        if (stream._backpressure) {
            const backpressureChangePromise = stream._backpressureChangePromise;
            return transformPromiseWith(backpressureChangePromise, () => {
                const writable = stream._writable;
                const state = writable._state;
                if (state === 'erroring') {
                    throw writable._storedError;
                }
                return TransformStreamDefaultControllerPerformTransform(controller, chunk);
            });
        }
        return TransformStreamDefaultControllerPerformTransform(controller, chunk);
    }
    function TransformStreamDefaultSinkAbortAlgorithm(stream, reason) {
        // abort() is not called synchronously, so it is possible for abort() to be called when the stream is already
        // errored.
        TransformStreamError(stream, reason);
        return promiseResolvedWith(undefined);
    }
    function TransformStreamDefaultSinkCloseAlgorithm(stream) {
        // stream._readable cannot change after construction, so caching it across a call to user code is safe.
        const readable = stream._readable;
        const controller = stream._transformStreamController;
        const flushPromise = controller._flushAlgorithm();
        TransformStreamDefaultControllerClearAlgorithms(controller);
        // Return a promise that is fulfilled with undefined on success.
        return transformPromiseWith(flushPromise, () => {
            if (readable._state === 'errored') {
                throw readable._storedError;
            }
            ReadableStreamDefaultControllerClose(readable._readableStreamController);
        }, r => {
            TransformStreamError(stream, r);
            throw readable._storedError;
        });
    }
    // TransformStreamDefaultSource Algorithms
    function TransformStreamDefaultSourcePullAlgorithm(stream) {
        // Invariant. Enforced by the promises returned by start() and pull().
        TransformStreamSetBackpressure(stream, false);
        // Prevent the next pull() call until there is backpressure.
        return stream._backpressureChangePromise;
    }
    // Helper functions for the TransformStreamDefaultController.
    function defaultControllerBrandCheckException(name) {
        return new TypeError(`TransformStreamDefaultController.prototype.${name} can only be used on a TransformStreamDefaultController`);
    }
    // Helper functions for the TransformStream.
    function streamBrandCheckException(name) {
        return new TypeError(`TransformStream.prototype.${name} can only be used on a TransformStream`);
    }

    exports.ByteLengthQueuingStrategy = ByteLengthQueuingStrategy;
    exports.CountQueuingStrategy = CountQueuingStrategy;
    exports.ReadableByteStreamController = ReadableByteStreamController;
    exports.ReadableStream = ReadableStream;
    exports.ReadableStreamBYOBReader = ReadableStreamBYOBReader;
    exports.ReadableStreamBYOBRequest = ReadableStreamBYOBRequest;
    exports.ReadableStreamDefaultController = ReadableStreamDefaultController;
    exports.ReadableStreamDefaultReader = ReadableStreamDefaultReader;
    exports.TransformStream = TransformStream;
    exports.TransformStreamDefaultController = TransformStreamDefaultController;
    exports.WritableStream = WritableStream;
    exports.WritableStreamDefaultController = WritableStreamDefaultController;
    exports.WritableStreamDefaultWriter = WritableStreamDefaultWriter;

    Object.defineProperty(exports, '__esModule', { value: true });

})));
//# sourceMappingURL=ponyfill.es2018.js.map


/***/ }),
/* 30 */
/***/ ((module) => {

"use strict";
module.exports = require("buffer");

/***/ }),
/* 31 */
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   File: () => (/* binding */ File),
/* harmony export */   FormData: () => (/* binding */ FormData),
/* harmony export */   formDataToBlob: () => (/* binding */ formDataToBlob)
/* harmony export */ });
/* harmony import */ var fetch_blob__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(25);
/* harmony import */ var fetch_blob_file_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(32);
/*! formdata-polyfill. MIT License. Jimmy Wärting <https://jimmy.warting.se/opensource> */




var {toStringTag:t,iterator:i,hasInstance:h}=Symbol,
r=Math.random,
m='append,set,get,getAll,delete,keys,values,entries,forEach,constructor'.split(','),
f=(a,b,c)=>(a+='',/^(Blob|File)$/.test(b && b[t])?[(c=c!==void 0?c+'':b[t]=='File'?b.name:'blob',a),b.name!==c||b[t]=='blob'?new fetch_blob_file_js__WEBPACK_IMPORTED_MODULE_1__["default"]([b],c,b):b]:[a,b+'']),
e=(c,f)=>(f?c:c.replace(/\r?\n|\r/g,'\r\n')).replace(/\n/g,'%0A').replace(/\r/g,'%0D').replace(/"/g,'%22'),
x=(n, a, e)=>{if(a.length<e){throw new TypeError(`Failed to execute '${n}' on 'FormData': ${e} arguments required, but only ${a.length} present.`)}}

const File = fetch_blob_file_js__WEBPACK_IMPORTED_MODULE_1__["default"]

/** @type {typeof globalThis.FormData} */
const FormData = class FormData {
#d=[];
constructor(...a){if(a.length)throw new TypeError(`Failed to construct 'FormData': parameter 1 is not of type 'HTMLFormElement'.`)}
get [t]() {return 'FormData'}
[i](){return this.entries()}
static [h](o) {return o&&typeof o==='object'&&o[t]==='FormData'&&!m.some(m=>typeof o[m]!='function')}
append(...a){x('append',arguments,2);this.#d.push(f(...a))}
delete(a){x('delete',arguments,1);a+='';this.#d=this.#d.filter(([b])=>b!==a)}
get(a){x('get',arguments,1);a+='';for(var b=this.#d,l=b.length,c=0;c<l;c++)if(b[c][0]===a)return b[c][1];return null}
getAll(a,b){x('getAll',arguments,1);b=[];a+='';this.#d.forEach(c=>c[0]===a&&b.push(c[1]));return b}
has(a){x('has',arguments,1);a+='';return this.#d.some(b=>b[0]===a)}
forEach(a,b){x('forEach',arguments,1);for(var [c,d]of this)a.call(b,d,c,this)}
set(...a){x('set',arguments,2);var b=[],c=!0;a=f(...a);this.#d.forEach(d=>{d[0]===a[0]?c&&(c=!b.push(a)):b.push(d)});c&&b.push(a);this.#d=b}
*entries(){yield*this.#d}
*keys(){for(var[a]of this)yield a}
*values(){for(var[,a]of this)yield a}}

/** @param {FormData} F */
function formDataToBlob (F,B=fetch_blob__WEBPACK_IMPORTED_MODULE_0__["default"]){
var b=`${r()}${r()}`.replace(/\./g, '').slice(-28).padStart(32, '-'),c=[],p=`--${b}\r\nContent-Disposition: form-data; name="`
F.forEach((v,n)=>typeof v=='string'
?c.push(p+e(n)+`"\r\n\r\n${v.replace(/\r(?!\n)|(?<!\r)\n/g, '\r\n')}\r\n`)
:c.push(p+e(n)+`"; filename="${e(v.name, 1)}"\r\nContent-Type: ${v.type||"application/octet-stream"}\r\n\r\n`, v, '\r\n'))
c.push(`--${b}--`)
return new B(c,{type:"multipart/form-data; boundary="+b})}


/***/ }),
/* 32 */
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   File: () => (/* binding */ File),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _index_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(25);


const _File = class File extends _index_js__WEBPACK_IMPORTED_MODULE_0__["default"] {
  #lastModified = 0
  #name = ''

  /**
   * @param {*[]} fileBits
   * @param {string} fileName
   * @param {{lastModified?: number, type?: string}} options
   */// @ts-ignore
  constructor (fileBits, fileName, options = {}) {
    if (arguments.length < 2) {
      throw new TypeError(`Failed to construct 'File': 2 arguments required, but only ${arguments.length} present.`)
    }
    super(fileBits, options)

    if (options === null) options = {}

    // Simulate WebIDL type casting for NaN value in lastModified option.
    const lastModified = options.lastModified === undefined ? Date.now() : Number(options.lastModified)
    if (!Number.isNaN(lastModified)) {
      this.#lastModified = lastModified
    }

    this.#name = String(fileName)
  }

  get name () {
    return this.#name
  }

  get lastModified () {
    return this.#lastModified
  }

  get [Symbol.toStringTag] () {
    return 'File'
  }

  static [Symbol.hasInstance] (object) {
    return !!object && object instanceof _index_js__WEBPACK_IMPORTED_MODULE_0__["default"] &&
      /^(File)$/.test(object[Symbol.toStringTag])
  }
}

/** @type {typeof globalThis.File} */// @ts-ignore
const File = _File
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (File);


/***/ }),
/* 33 */
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   FetchError: () => (/* binding */ FetchError)
/* harmony export */ });
/* harmony import */ var _base_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(34);



/**
 * @typedef {{ address?: string, code: string, dest?: string, errno: number, info?: object, message: string, path?: string, port?: number, syscall: string}} SystemError
*/

/**
 * FetchError interface for operational errors
 */
class FetchError extends _base_js__WEBPACK_IMPORTED_MODULE_0__.FetchBaseError {
	/**
	 * @param  {string} message -      Error message for human
	 * @param  {string} [type] -        Error type for machine
	 * @param  {SystemError} [systemError] - For Node.js system error
	 */
	constructor(message, type, systemError) {
		super(message, type);
		// When err.type is `system`, err.erroredSysCall contains system error and err.code contains system error code
		if (systemError) {
			// eslint-disable-next-line no-multi-assign
			this.code = this.errno = systemError.code;
			this.erroredSysCall = systemError.syscall;
		}
	}
}


/***/ }),
/* 34 */
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   FetchBaseError: () => (/* binding */ FetchBaseError)
/* harmony export */ });
class FetchBaseError extends Error {
	constructor(message, type) {
		super(message);
		// Hide custom error implementation details from end-users
		Error.captureStackTrace(this, this.constructor);

		this.type = type;
	}

	get name() {
		return this.constructor.name;
	}

	get [Symbol.toStringTag]() {
		return this.constructor.name;
	}
}


/***/ }),
/* 35 */
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   isAbortSignal: () => (/* binding */ isAbortSignal),
/* harmony export */   isBlob: () => (/* binding */ isBlob),
/* harmony export */   isDomainOrSubdomain: () => (/* binding */ isDomainOrSubdomain),
/* harmony export */   isSameProtocol: () => (/* binding */ isSameProtocol),
/* harmony export */   isURLSearchParameters: () => (/* binding */ isURLSearchParameters)
/* harmony export */ });
/**
 * Is.js
 *
 * Object type checks.
 */

const NAME = Symbol.toStringTag;

/**
 * Check if `obj` is a URLSearchParams object
 * ref: https://github.com/node-fetch/node-fetch/issues/296#issuecomment-307598143
 * @param {*} object - Object to check for
 * @return {boolean}
 */
const isURLSearchParameters = object => {
	return (
		typeof object === 'object' &&
		typeof object.append === 'function' &&
		typeof object.delete === 'function' &&
		typeof object.get === 'function' &&
		typeof object.getAll === 'function' &&
		typeof object.has === 'function' &&
		typeof object.set === 'function' &&
		typeof object.sort === 'function' &&
		object[NAME] === 'URLSearchParams'
	);
};

/**
 * Check if `object` is a W3C `Blob` object (which `File` inherits from)
 * @param {*} object - Object to check for
 * @return {boolean}
 */
const isBlob = object => {
	return (
		object &&
		typeof object === 'object' &&
		typeof object.arrayBuffer === 'function' &&
		typeof object.type === 'string' &&
		typeof object.stream === 'function' &&
		typeof object.constructor === 'function' &&
		/^(Blob|File)$/.test(object[NAME])
	);
};

/**
 * Check if `obj` is an instance of AbortSignal.
 * @param {*} object - Object to check for
 * @return {boolean}
 */
const isAbortSignal = object => {
	return (
		typeof object === 'object' && (
			object[NAME] === 'AbortSignal' ||
			object[NAME] === 'EventTarget'
		)
	);
};

/**
 * isDomainOrSubdomain reports whether sub is a subdomain (or exact match) of
 * the parent domain.
 *
 * Both domains must already be in canonical form.
 * @param {string|URL} original
 * @param {string|URL} destination
 */
const isDomainOrSubdomain = (destination, original) => {
	const orig = new URL(original).hostname;
	const dest = new URL(destination).hostname;

	return orig === dest || orig.endsWith(`.${dest}`);
};

/**
 * isSameProtocol reports whether the two provided URLs use the same protocol.
 *
 * Both domains must already be in canonical form.
 * @param {string|URL} original
 * @param {string|URL} destination
 */
const isSameProtocol = (destination, original) => {
	const orig = new URL(original).protocol;
	const dest = new URL(destination).protocol;

	return orig === dest;
};


/***/ }),
/* 36 */
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ Response)
/* harmony export */ });
/* harmony import */ var _headers_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(37);
/* harmony import */ var _body_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(23);
/* harmony import */ var _utils_is_redirect_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(38);
/**
 * Response.js
 *
 * Response class provides content decoding
 */





const INTERNALS = Symbol('Response internals');

/**
 * Response class
 *
 * Ref: https://fetch.spec.whatwg.org/#response-class
 *
 * @param   Stream  body  Readable stream
 * @param   Object  opts  Response options
 * @return  Void
 */
class Response extends _body_js__WEBPACK_IMPORTED_MODULE_1__["default"] {
	constructor(body = null, options = {}) {
		super(body, options);

		// eslint-disable-next-line no-eq-null, eqeqeq, no-negated-condition
		const status = options.status != null ? options.status : 200;

		const headers = new _headers_js__WEBPACK_IMPORTED_MODULE_0__["default"](options.headers);

		if (body !== null && !headers.has('Content-Type')) {
			const contentType = (0,_body_js__WEBPACK_IMPORTED_MODULE_1__.extractContentType)(body, this);
			if (contentType) {
				headers.append('Content-Type', contentType);
			}
		}

		this[INTERNALS] = {
			type: 'default',
			url: options.url,
			status,
			statusText: options.statusText || '',
			headers,
			counter: options.counter,
			highWaterMark: options.highWaterMark
		};
	}

	get type() {
		return this[INTERNALS].type;
	}

	get url() {
		return this[INTERNALS].url || '';
	}

	get status() {
		return this[INTERNALS].status;
	}

	/**
	 * Convenience property representing if the request ended normally
	 */
	get ok() {
		return this[INTERNALS].status >= 200 && this[INTERNALS].status < 300;
	}

	get redirected() {
		return this[INTERNALS].counter > 0;
	}

	get statusText() {
		return this[INTERNALS].statusText;
	}

	get headers() {
		return this[INTERNALS].headers;
	}

	get highWaterMark() {
		return this[INTERNALS].highWaterMark;
	}

	/**
	 * Clone this response
	 *
	 * @return  Response
	 */
	clone() {
		return new Response((0,_body_js__WEBPACK_IMPORTED_MODULE_1__.clone)(this, this.highWaterMark), {
			type: this.type,
			url: this.url,
			status: this.status,
			statusText: this.statusText,
			headers: this.headers,
			ok: this.ok,
			redirected: this.redirected,
			size: this.size,
			highWaterMark: this.highWaterMark
		});
	}

	/**
	 * @param {string} url    The URL that the new response is to originate from.
	 * @param {number} status An optional status code for the response (e.g., 302.)
	 * @returns {Response}    A Response object.
	 */
	static redirect(url, status = 302) {
		if (!(0,_utils_is_redirect_js__WEBPACK_IMPORTED_MODULE_2__.isRedirect)(status)) {
			throw new RangeError('Failed to execute "redirect" on "response": Invalid status code');
		}

		return new Response(null, {
			headers: {
				location: new URL(url).toString()
			},
			status
		});
	}

	static error() {
		const response = new Response(null, {status: 0, statusText: ''});
		response[INTERNALS].type = 'error';
		return response;
	}

	static json(data = undefined, init = {}) {
		const body = JSON.stringify(data);

		if (body === undefined) {
			throw new TypeError('data is not JSON serializable');
		}

		const headers = new _headers_js__WEBPACK_IMPORTED_MODULE_0__["default"](init && init.headers);

		if (!headers.has('content-type')) {
			headers.set('content-type', 'application/json');
		}

		return new Response(body, {
			...init,
			headers
		});
	}

	get [Symbol.toStringTag]() {
		return 'Response';
	}
}

Object.defineProperties(Response.prototype, {
	type: {enumerable: true},
	url: {enumerable: true},
	status: {enumerable: true},
	ok: {enumerable: true},
	redirected: {enumerable: true},
	statusText: {enumerable: true},
	headers: {enumerable: true},
	clone: {enumerable: true}
});


/***/ }),
/* 37 */
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ Headers),
/* harmony export */   fromRawHeaders: () => (/* binding */ fromRawHeaders)
/* harmony export */ });
/* harmony import */ var node_util__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(24);
/* harmony import */ var node_http__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(17);
/**
 * Headers.js
 *
 * Headers class offers convenient helpers
 */




/* c8 ignore next 9 */
const validateHeaderName = typeof node_http__WEBPACK_IMPORTED_MODULE_1__.validateHeaderName === 'function' ?
	node_http__WEBPACK_IMPORTED_MODULE_1__.validateHeaderName :
	name => {
		if (!/^[\^`\-\w!#$%&'*+.|~]+$/.test(name)) {
			const error = new TypeError(`Header name must be a valid HTTP token [${name}]`);
			Object.defineProperty(error, 'code', {value: 'ERR_INVALID_HTTP_TOKEN'});
			throw error;
		}
	};

/* c8 ignore next 9 */
const validateHeaderValue = typeof node_http__WEBPACK_IMPORTED_MODULE_1__.validateHeaderValue === 'function' ?
	node_http__WEBPACK_IMPORTED_MODULE_1__.validateHeaderValue :
	(name, value) => {
		if (/[^\t\u0020-\u007E\u0080-\u00FF]/.test(value)) {
			const error = new TypeError(`Invalid character in header content ["${name}"]`);
			Object.defineProperty(error, 'code', {value: 'ERR_INVALID_CHAR'});
			throw error;
		}
	};

/**
 * @typedef {Headers | Record<string, string> | Iterable<readonly [string, string]> | Iterable<Iterable<string>>} HeadersInit
 */

/**
 * This Fetch API interface allows you to perform various actions on HTTP request and response headers.
 * These actions include retrieving, setting, adding to, and removing.
 * A Headers object has an associated header list, which is initially empty and consists of zero or more name and value pairs.
 * You can add to this using methods like append() (see Examples.)
 * In all methods of this interface, header names are matched by case-insensitive byte sequence.
 *
 */
class Headers extends URLSearchParams {
	/**
	 * Headers class
	 *
	 * @constructor
	 * @param {HeadersInit} [init] - Response headers
	 */
	constructor(init) {
		// Validate and normalize init object in [name, value(s)][]
		/** @type {string[][]} */
		let result = [];
		if (init instanceof Headers) {
			const raw = init.raw();
			for (const [name, values] of Object.entries(raw)) {
				result.push(...values.map(value => [name, value]));
			}
		} else if (init == null) { // eslint-disable-line no-eq-null, eqeqeq
			// No op
		} else if (typeof init === 'object' && !node_util__WEBPACK_IMPORTED_MODULE_0__.types.isBoxedPrimitive(init)) {
			const method = init[Symbol.iterator];
			// eslint-disable-next-line no-eq-null, eqeqeq
			if (method == null) {
				// Record<ByteString, ByteString>
				result.push(...Object.entries(init));
			} else {
				if (typeof method !== 'function') {
					throw new TypeError('Header pairs must be iterable');
				}

				// Sequence<sequence<ByteString>>
				// Note: per spec we have to first exhaust the lists then process them
				result = [...init]
					.map(pair => {
						if (
							typeof pair !== 'object' || node_util__WEBPACK_IMPORTED_MODULE_0__.types.isBoxedPrimitive(pair)
						) {
							throw new TypeError('Each header pair must be an iterable object');
						}

						return [...pair];
					}).map(pair => {
						if (pair.length !== 2) {
							throw new TypeError('Each header pair must be a name/value tuple');
						}

						return [...pair];
					});
			}
		} else {
			throw new TypeError('Failed to construct \'Headers\': The provided value is not of type \'(sequence<sequence<ByteString>> or record<ByteString, ByteString>)');
		}

		// Validate and lowercase
		result =
			result.length > 0 ?
				result.map(([name, value]) => {
					validateHeaderName(name);
					validateHeaderValue(name, String(value));
					return [String(name).toLowerCase(), String(value)];
				}) :
				undefined;

		super(result);

		// Returning a Proxy that will lowercase key names, validate parameters and sort keys
		// eslint-disable-next-line no-constructor-return
		return new Proxy(this, {
			get(target, p, receiver) {
				switch (p) {
					case 'append':
					case 'set':
						return (name, value) => {
							validateHeaderName(name);
							validateHeaderValue(name, String(value));
							return URLSearchParams.prototype[p].call(
								target,
								String(name).toLowerCase(),
								String(value)
							);
						};

					case 'delete':
					case 'has':
					case 'getAll':
						return name => {
							validateHeaderName(name);
							return URLSearchParams.prototype[p].call(
								target,
								String(name).toLowerCase()
							);
						};

					case 'keys':
						return () => {
							target.sort();
							return new Set(URLSearchParams.prototype.keys.call(target)).keys();
						};

					default:
						return Reflect.get(target, p, receiver);
				}
			}
		});
		/* c8 ignore next */
	}

	get [Symbol.toStringTag]() {
		return this.constructor.name;
	}

	toString() {
		return Object.prototype.toString.call(this);
	}

	get(name) {
		const values = this.getAll(name);
		if (values.length === 0) {
			return null;
		}

		let value = values.join(', ');
		if (/^content-encoding$/i.test(name)) {
			value = value.toLowerCase();
		}

		return value;
	}

	forEach(callback, thisArg = undefined) {
		for (const name of this.keys()) {
			Reflect.apply(callback, thisArg, [this.get(name), name, this]);
		}
	}

	* values() {
		for (const name of this.keys()) {
			yield this.get(name);
		}
	}

	/**
	 * @type {() => IterableIterator<[string, string]>}
	 */
	* entries() {
		for (const name of this.keys()) {
			yield [name, this.get(name)];
		}
	}

	[Symbol.iterator]() {
		return this.entries();
	}

	/**
	 * Node-fetch non-spec method
	 * returning all headers and their values as array
	 * @returns {Record<string, string[]>}
	 */
	raw() {
		return [...this.keys()].reduce((result, key) => {
			result[key] = this.getAll(key);
			return result;
		}, {});
	}

	/**
	 * For better console.log(headers) and also to convert Headers into Node.js Request compatible format
	 */
	[Symbol.for('nodejs.util.inspect.custom')]() {
		return [...this.keys()].reduce((result, key) => {
			const values = this.getAll(key);
			// Http.request() only supports string as Host header.
			// This hack makes specifying custom Host header possible.
			if (key === 'host') {
				result[key] = values[0];
			} else {
				result[key] = values.length > 1 ? values : values[0];
			}

			return result;
		}, {});
	}
}

/**
 * Re-shaping object for Web IDL tests
 * Only need to do it for overridden methods
 */
Object.defineProperties(
	Headers.prototype,
	['get', 'entries', 'forEach', 'values'].reduce((result, property) => {
		result[property] = {enumerable: true};
		return result;
	}, {})
);

/**
 * Create a Headers object from an http.IncomingMessage.rawHeaders, ignoring those that do
 * not conform to HTTP grammar productions.
 * @param {import('http').IncomingMessage['rawHeaders']} headers
 */
function fromRawHeaders(headers = []) {
	return new Headers(
		headers
			// Split into pairs
			.reduce((result, value, index, array) => {
				if (index % 2 === 0) {
					result.push(array.slice(index, index + 2));
				}

				return result;
			}, [])
			.filter(([name, value]) => {
				try {
					validateHeaderName(name);
					validateHeaderValue(name, String(value));
					return true;
				} catch {
					return false;
				}
			})

	);
}


/***/ }),
/* 38 */
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   isRedirect: () => (/* binding */ isRedirect)
/* harmony export */ });
const redirectStatus = new Set([301, 302, 303, 307, 308]);

/**
 * Redirect code matching
 *
 * @param {number} code - Status code
 * @return {boolean}
 */
const isRedirect = code => {
	return redirectStatus.has(code);
};


/***/ }),
/* 39 */
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ Request),
/* harmony export */   getNodeRequestOptions: () => (/* binding */ getNodeRequestOptions)
/* harmony export */ });
/* harmony import */ var node_url__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(40);
/* harmony import */ var node_util__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(24);
/* harmony import */ var _headers_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(37);
/* harmony import */ var _body_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(23);
/* harmony import */ var _utils_is_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(35);
/* harmony import */ var _utils_get_search_js__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(41);
/* harmony import */ var _utils_referrer_js__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(42);
/**
 * Request.js
 *
 * Request class contains server only options
 *
 * All spec algorithm step numbers are based on https://fetch.spec.whatwg.org/commit-snapshots/ae716822cb3a61843226cd090eefc6589446c1d2/.
 */









const INTERNALS = Symbol('Request internals');

/**
 * Check if `obj` is an instance of Request.
 *
 * @param  {*} object
 * @return {boolean}
 */
const isRequest = object => {
	return (
		typeof object === 'object' &&
		typeof object[INTERNALS] === 'object'
	);
};

const doBadDataWarn = (0,node_util__WEBPACK_IMPORTED_MODULE_1__.deprecate)(() => {},
	'.data is not a valid RequestInit property, use .body instead',
	'https://github.com/node-fetch/node-fetch/issues/1000 (request)');

/**
 * Request class
 *
 * Ref: https://fetch.spec.whatwg.org/#request-class
 *
 * @param   Mixed   input  Url or Request instance
 * @param   Object  init   Custom options
 * @return  Void
 */
class Request extends _body_js__WEBPACK_IMPORTED_MODULE_3__["default"] {
	constructor(input, init = {}) {
		let parsedURL;

		// Normalize input and force URL to be encoded as UTF-8 (https://github.com/node-fetch/node-fetch/issues/245)
		if (isRequest(input)) {
			parsedURL = new URL(input.url);
		} else {
			parsedURL = new URL(input);
			input = {};
		}

		if (parsedURL.username !== '' || parsedURL.password !== '') {
			throw new TypeError(`${parsedURL} is an url with embedded credentials.`);
		}

		let method = init.method || input.method || 'GET';
		if (/^(delete|get|head|options|post|put)$/i.test(method)) {
			method = method.toUpperCase();
		}

		if (!isRequest(init) && 'data' in init) {
			doBadDataWarn();
		}

		// eslint-disable-next-line no-eq-null, eqeqeq
		if ((init.body != null || (isRequest(input) && input.body !== null)) &&
			(method === 'GET' || method === 'HEAD')) {
			throw new TypeError('Request with GET/HEAD method cannot have body');
		}

		const inputBody = init.body ?
			init.body :
			(isRequest(input) && input.body !== null ?
				(0,_body_js__WEBPACK_IMPORTED_MODULE_3__.clone)(input) :
				null);

		super(inputBody, {
			size: init.size || input.size || 0
		});

		const headers = new _headers_js__WEBPACK_IMPORTED_MODULE_2__["default"](init.headers || input.headers || {});

		if (inputBody !== null && !headers.has('Content-Type')) {
			const contentType = (0,_body_js__WEBPACK_IMPORTED_MODULE_3__.extractContentType)(inputBody, this);
			if (contentType) {
				headers.set('Content-Type', contentType);
			}
		}

		let signal = isRequest(input) ?
			input.signal :
			null;
		if ('signal' in init) {
			signal = init.signal;
		}

		// eslint-disable-next-line no-eq-null, eqeqeq
		if (signal != null && !(0,_utils_is_js__WEBPACK_IMPORTED_MODULE_4__.isAbortSignal)(signal)) {
			throw new TypeError('Expected signal to be an instanceof AbortSignal or EventTarget');
		}

		// §5.4, Request constructor steps, step 15.1
		// eslint-disable-next-line no-eq-null, eqeqeq
		let referrer = init.referrer == null ? input.referrer : init.referrer;
		if (referrer === '') {
			// §5.4, Request constructor steps, step 15.2
			referrer = 'no-referrer';
		} else if (referrer) {
			// §5.4, Request constructor steps, step 15.3.1, 15.3.2
			const parsedReferrer = new URL(referrer);
			// §5.4, Request constructor steps, step 15.3.3, 15.3.4
			referrer = /^about:(\/\/)?client$/.test(parsedReferrer) ? 'client' : parsedReferrer;
		} else {
			referrer = undefined;
		}

		this[INTERNALS] = {
			method,
			redirect: init.redirect || input.redirect || 'follow',
			headers,
			parsedURL,
			signal,
			referrer
		};

		// Node-fetch-only options
		this.follow = init.follow === undefined ? (input.follow === undefined ? 20 : input.follow) : init.follow;
		this.compress = init.compress === undefined ? (input.compress === undefined ? true : input.compress) : init.compress;
		this.counter = init.counter || input.counter || 0;
		this.agent = init.agent || input.agent;
		this.highWaterMark = init.highWaterMark || input.highWaterMark || 16384;
		this.insecureHTTPParser = init.insecureHTTPParser || input.insecureHTTPParser || false;

		// §5.4, Request constructor steps, step 16.
		// Default is empty string per https://fetch.spec.whatwg.org/#concept-request-referrer-policy
		this.referrerPolicy = init.referrerPolicy || input.referrerPolicy || '';
	}

	/** @returns {string} */
	get method() {
		return this[INTERNALS].method;
	}

	/** @returns {string} */
	get url() {
		return (0,node_url__WEBPACK_IMPORTED_MODULE_0__.format)(this[INTERNALS].parsedURL);
	}

	/** @returns {Headers} */
	get headers() {
		return this[INTERNALS].headers;
	}

	get redirect() {
		return this[INTERNALS].redirect;
	}

	/** @returns {AbortSignal} */
	get signal() {
		return this[INTERNALS].signal;
	}

	// https://fetch.spec.whatwg.org/#dom-request-referrer
	get referrer() {
		if (this[INTERNALS].referrer === 'no-referrer') {
			return '';
		}

		if (this[INTERNALS].referrer === 'client') {
			return 'about:client';
		}

		if (this[INTERNALS].referrer) {
			return this[INTERNALS].referrer.toString();
		}

		return undefined;
	}

	get referrerPolicy() {
		return this[INTERNALS].referrerPolicy;
	}

	set referrerPolicy(referrerPolicy) {
		this[INTERNALS].referrerPolicy = (0,_utils_referrer_js__WEBPACK_IMPORTED_MODULE_6__.validateReferrerPolicy)(referrerPolicy);
	}

	/**
	 * Clone this request
	 *
	 * @return  Request
	 */
	clone() {
		return new Request(this);
	}

	get [Symbol.toStringTag]() {
		return 'Request';
	}
}

Object.defineProperties(Request.prototype, {
	method: {enumerable: true},
	url: {enumerable: true},
	headers: {enumerable: true},
	redirect: {enumerable: true},
	clone: {enumerable: true},
	signal: {enumerable: true},
	referrer: {enumerable: true},
	referrerPolicy: {enumerable: true}
});

/**
 * Convert a Request to Node.js http request options.
 *
 * @param {Request} request - A Request instance
 * @return The options object to be passed to http.request
 */
const getNodeRequestOptions = request => {
	const {parsedURL} = request[INTERNALS];
	const headers = new _headers_js__WEBPACK_IMPORTED_MODULE_2__["default"](request[INTERNALS].headers);

	// Fetch step 1.3
	if (!headers.has('Accept')) {
		headers.set('Accept', '*/*');
	}

	// HTTP-network-or-cache fetch steps 2.4-2.7
	let contentLengthValue = null;
	if (request.body === null && /^(post|put)$/i.test(request.method)) {
		contentLengthValue = '0';
	}

	if (request.body !== null) {
		const totalBytes = (0,_body_js__WEBPACK_IMPORTED_MODULE_3__.getTotalBytes)(request);
		// Set Content-Length if totalBytes is a number (that is not NaN)
		if (typeof totalBytes === 'number' && !Number.isNaN(totalBytes)) {
			contentLengthValue = String(totalBytes);
		}
	}

	if (contentLengthValue) {
		headers.set('Content-Length', contentLengthValue);
	}

	// 4.1. Main fetch, step 2.6
	// > If request's referrer policy is the empty string, then set request's referrer policy to the
	// > default referrer policy.
	if (request.referrerPolicy === '') {
		request.referrerPolicy = _utils_referrer_js__WEBPACK_IMPORTED_MODULE_6__.DEFAULT_REFERRER_POLICY;
	}

	// 4.1. Main fetch, step 2.7
	// > If request's referrer is not "no-referrer", set request's referrer to the result of invoking
	// > determine request's referrer.
	if (request.referrer && request.referrer !== 'no-referrer') {
		request[INTERNALS].referrer = (0,_utils_referrer_js__WEBPACK_IMPORTED_MODULE_6__.determineRequestsReferrer)(request);
	} else {
		request[INTERNALS].referrer = 'no-referrer';
	}

	// 4.5. HTTP-network-or-cache fetch, step 6.9
	// > If httpRequest's referrer is a URL, then append `Referer`/httpRequest's referrer, serialized
	// >  and isomorphic encoded, to httpRequest's header list.
	if (request[INTERNALS].referrer instanceof URL) {
		headers.set('Referer', request.referrer);
	}

	// HTTP-network-or-cache fetch step 2.11
	if (!headers.has('User-Agent')) {
		headers.set('User-Agent', 'node-fetch');
	}

	// HTTP-network-or-cache fetch step 2.15
	if (request.compress && !headers.has('Accept-Encoding')) {
		headers.set('Accept-Encoding', 'gzip, deflate, br');
	}

	let {agent} = request;
	if (typeof agent === 'function') {
		agent = agent(parsedURL);
	}

	// HTTP-network fetch step 4.2
	// chunked encoding is handled by Node.js

	const search = (0,_utils_get_search_js__WEBPACK_IMPORTED_MODULE_5__.getSearch)(parsedURL);

	// Pass the full URL directly to request(), but overwrite the following
	// options:
	const options = {
		// Overwrite search to retain trailing ? (issue #776)
		path: parsedURL.pathname + search,
		// The following options are not expressed in the URL
		method: request.method,
		headers: headers[Symbol.for('nodejs.util.inspect.custom')](),
		insecureHTTPParser: request.insecureHTTPParser,
		agent
	};

	return {
		/** @type {URL} */
		parsedURL,
		options
	};
};


/***/ }),
/* 40 */
/***/ ((module) => {

"use strict";
module.exports = require("node:url");

/***/ }),
/* 41 */
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   getSearch: () => (/* binding */ getSearch)
/* harmony export */ });
const getSearch = parsedURL => {
	if (parsedURL.search) {
		return parsedURL.search;
	}

	const lastOffset = parsedURL.href.length - 1;
	const hash = parsedURL.hash || (parsedURL.href[lastOffset] === '#' ? '#' : '');
	return parsedURL.href[lastOffset - hash.length] === '?' ? '?' : '';
};


/***/ }),
/* 42 */
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   DEFAULT_REFERRER_POLICY: () => (/* binding */ DEFAULT_REFERRER_POLICY),
/* harmony export */   ReferrerPolicy: () => (/* binding */ ReferrerPolicy),
/* harmony export */   determineRequestsReferrer: () => (/* binding */ determineRequestsReferrer),
/* harmony export */   isOriginPotentiallyTrustworthy: () => (/* binding */ isOriginPotentiallyTrustworthy),
/* harmony export */   isUrlPotentiallyTrustworthy: () => (/* binding */ isUrlPotentiallyTrustworthy),
/* harmony export */   parseReferrerPolicyFromHeader: () => (/* binding */ parseReferrerPolicyFromHeader),
/* harmony export */   stripURLForUseAsAReferrer: () => (/* binding */ stripURLForUseAsAReferrer),
/* harmony export */   validateReferrerPolicy: () => (/* binding */ validateReferrerPolicy)
/* harmony export */ });
/* harmony import */ var node_net__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(43);


/**
 * @external URL
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/URL|URL}
 */

/**
 * @module utils/referrer
 * @private
 */

/**
 * @see {@link https://w3c.github.io/webappsec-referrer-policy/#strip-url|Referrer Policy §8.4. Strip url for use as a referrer}
 * @param {string} URL
 * @param {boolean} [originOnly=false]
 */
function stripURLForUseAsAReferrer(url, originOnly = false) {
	// 1. If url is null, return no referrer.
	if (url == null) { // eslint-disable-line no-eq-null, eqeqeq
		return 'no-referrer';
	}

	url = new URL(url);

	// 2. If url's scheme is a local scheme, then return no referrer.
	if (/^(about|blob|data):$/.test(url.protocol)) {
		return 'no-referrer';
	}

	// 3. Set url's username to the empty string.
	url.username = '';

	// 4. Set url's password to null.
	// Note: `null` appears to be a mistake as this actually results in the password being `"null"`.
	url.password = '';

	// 5. Set url's fragment to null.
	// Note: `null` appears to be a mistake as this actually results in the fragment being `"#null"`.
	url.hash = '';

	// 6. If the origin-only flag is true, then:
	if (originOnly) {
		// 6.1. Set url's path to null.
		// Note: `null` appears to be a mistake as this actually results in the path being `"/null"`.
		url.pathname = '';

		// 6.2. Set url's query to null.
		// Note: `null` appears to be a mistake as this actually results in the query being `"?null"`.
		url.search = '';
	}

	// 7. Return url.
	return url;
}

/**
 * @see {@link https://w3c.github.io/webappsec-referrer-policy/#enumdef-referrerpolicy|enum ReferrerPolicy}
 */
const ReferrerPolicy = new Set([
	'',
	'no-referrer',
	'no-referrer-when-downgrade',
	'same-origin',
	'origin',
	'strict-origin',
	'origin-when-cross-origin',
	'strict-origin-when-cross-origin',
	'unsafe-url'
]);

/**
 * @see {@link https://w3c.github.io/webappsec-referrer-policy/#default-referrer-policy|default referrer policy}
 */
const DEFAULT_REFERRER_POLICY = 'strict-origin-when-cross-origin';

/**
 * @see {@link https://w3c.github.io/webappsec-referrer-policy/#referrer-policies|Referrer Policy §3. Referrer Policies}
 * @param {string} referrerPolicy
 * @returns {string} referrerPolicy
 */
function validateReferrerPolicy(referrerPolicy) {
	if (!ReferrerPolicy.has(referrerPolicy)) {
		throw new TypeError(`Invalid referrerPolicy: ${referrerPolicy}`);
	}

	return referrerPolicy;
}

/**
 * @see {@link https://w3c.github.io/webappsec-secure-contexts/#is-origin-trustworthy|Referrer Policy §3.2. Is origin potentially trustworthy?}
 * @param {external:URL} url
 * @returns `true`: "Potentially Trustworthy", `false`: "Not Trustworthy"
 */
function isOriginPotentiallyTrustworthy(url) {
	// 1. If origin is an opaque origin, return "Not Trustworthy".
	// Not applicable

	// 2. Assert: origin is a tuple origin.
	// Not for implementations

	// 3. If origin's scheme is either "https" or "wss", return "Potentially Trustworthy".
	if (/^(http|ws)s:$/.test(url.protocol)) {
		return true;
	}

	// 4. If origin's host component matches one of the CIDR notations 127.0.0.0/8 or ::1/128 [RFC4632], return "Potentially Trustworthy".
	const hostIp = url.host.replace(/(^\[)|(]$)/g, '');
	const hostIPVersion = (0,node_net__WEBPACK_IMPORTED_MODULE_0__.isIP)(hostIp);

	if (hostIPVersion === 4 && /^127\./.test(hostIp)) {
		return true;
	}

	if (hostIPVersion === 6 && /^(((0+:){7})|(::(0+:){0,6}))0*1$/.test(hostIp)) {
		return true;
	}

	// 5. If origin's host component is "localhost" or falls within ".localhost", and the user agent conforms to the name resolution rules in [let-localhost-be-localhost], return "Potentially Trustworthy".
	// We are returning FALSE here because we cannot ensure conformance to
	// let-localhost-be-loalhost (https://tools.ietf.org/html/draft-west-let-localhost-be-localhost)
	if (url.host === 'localhost' || url.host.endsWith('.localhost')) {
		return false;
	}

	// 6. If origin's scheme component is file, return "Potentially Trustworthy".
	if (url.protocol === 'file:') {
		return true;
	}

	// 7. If origin's scheme component is one which the user agent considers to be authenticated, return "Potentially Trustworthy".
	// Not supported

	// 8. If origin has been configured as a trustworthy origin, return "Potentially Trustworthy".
	// Not supported

	// 9. Return "Not Trustworthy".
	return false;
}

/**
 * @see {@link https://w3c.github.io/webappsec-secure-contexts/#is-url-trustworthy|Referrer Policy §3.3. Is url potentially trustworthy?}
 * @param {external:URL} url
 * @returns `true`: "Potentially Trustworthy", `false`: "Not Trustworthy"
 */
function isUrlPotentiallyTrustworthy(url) {
	// 1. If url is "about:blank" or "about:srcdoc", return "Potentially Trustworthy".
	if (/^about:(blank|srcdoc)$/.test(url)) {
		return true;
	}

	// 2. If url's scheme is "data", return "Potentially Trustworthy".
	if (url.protocol === 'data:') {
		return true;
	}

	// Note: The origin of blob: and filesystem: URLs is the origin of the context in which they were
	// created. Therefore, blobs created in a trustworthy origin will themselves be potentially
	// trustworthy.
	if (/^(blob|filesystem):$/.test(url.protocol)) {
		return true;
	}

	// 3. Return the result of executing §3.2 Is origin potentially trustworthy? on url's origin.
	return isOriginPotentiallyTrustworthy(url);
}

/**
 * Modifies the referrerURL to enforce any extra security policy considerations.
 * @see {@link https://w3c.github.io/webappsec-referrer-policy/#determine-requests-referrer|Referrer Policy §8.3. Determine request's Referrer}, step 7
 * @callback module:utils/referrer~referrerURLCallback
 * @param {external:URL} referrerURL
 * @returns {external:URL} modified referrerURL
 */

/**
 * Modifies the referrerOrigin to enforce any extra security policy considerations.
 * @see {@link https://w3c.github.io/webappsec-referrer-policy/#determine-requests-referrer|Referrer Policy §8.3. Determine request's Referrer}, step 7
 * @callback module:utils/referrer~referrerOriginCallback
 * @param {external:URL} referrerOrigin
 * @returns {external:URL} modified referrerOrigin
 */

/**
 * @see {@link https://w3c.github.io/webappsec-referrer-policy/#determine-requests-referrer|Referrer Policy §8.3. Determine request's Referrer}
 * @param {Request} request
 * @param {object} o
 * @param {module:utils/referrer~referrerURLCallback} o.referrerURLCallback
 * @param {module:utils/referrer~referrerOriginCallback} o.referrerOriginCallback
 * @returns {external:URL} Request's referrer
 */
function determineRequestsReferrer(request, {referrerURLCallback, referrerOriginCallback} = {}) {
	// There are 2 notes in the specification about invalid pre-conditions.  We return null, here, for
	// these cases:
	// > Note: If request's referrer is "no-referrer", Fetch will not call into this algorithm.
	// > Note: If request's referrer policy is the empty string, Fetch will not call into this
	// > algorithm.
	if (request.referrer === 'no-referrer' || request.referrerPolicy === '') {
		return null;
	}

	// 1. Let policy be request's associated referrer policy.
	const policy = request.referrerPolicy;

	// 2. Let environment be request's client.
	// not applicable to node.js

	// 3. Switch on request's referrer:
	if (request.referrer === 'about:client') {
		return 'no-referrer';
	}

	// "a URL": Let referrerSource be request's referrer.
	const referrerSource = request.referrer;

	// 4. Let request's referrerURL be the result of stripping referrerSource for use as a referrer.
	let referrerURL = stripURLForUseAsAReferrer(referrerSource);

	// 5. Let referrerOrigin be the result of stripping referrerSource for use as a referrer, with the
	//    origin-only flag set to true.
	let referrerOrigin = stripURLForUseAsAReferrer(referrerSource, true);

	// 6. If the result of serializing referrerURL is a string whose length is greater than 4096, set
	//    referrerURL to referrerOrigin.
	if (referrerURL.toString().length > 4096) {
		referrerURL = referrerOrigin;
	}

	// 7. The user agent MAY alter referrerURL or referrerOrigin at this point to enforce arbitrary
	//    policy considerations in the interests of minimizing data leakage. For example, the user
	//    agent could strip the URL down to an origin, modify its host, replace it with an empty
	//    string, etc.
	if (referrerURLCallback) {
		referrerURL = referrerURLCallback(referrerURL);
	}

	if (referrerOriginCallback) {
		referrerOrigin = referrerOriginCallback(referrerOrigin);
	}

	// 8.Execute the statements corresponding to the value of policy:
	const currentURL = new URL(request.url);

	switch (policy) {
		case 'no-referrer':
			return 'no-referrer';

		case 'origin':
			return referrerOrigin;

		case 'unsafe-url':
			return referrerURL;

		case 'strict-origin':
			// 1. If referrerURL is a potentially trustworthy URL and request's current URL is not a
			//    potentially trustworthy URL, then return no referrer.
			if (isUrlPotentiallyTrustworthy(referrerURL) && !isUrlPotentiallyTrustworthy(currentURL)) {
				return 'no-referrer';
			}

			// 2. Return referrerOrigin.
			return referrerOrigin.toString();

		case 'strict-origin-when-cross-origin':
			// 1. If the origin of referrerURL and the origin of request's current URL are the same, then
			//    return referrerURL.
			if (referrerURL.origin === currentURL.origin) {
				return referrerURL;
			}

			// 2. If referrerURL is a potentially trustworthy URL and request's current URL is not a
			//    potentially trustworthy URL, then return no referrer.
			if (isUrlPotentiallyTrustworthy(referrerURL) && !isUrlPotentiallyTrustworthy(currentURL)) {
				return 'no-referrer';
			}

			// 3. Return referrerOrigin.
			return referrerOrigin;

		case 'same-origin':
			// 1. If the origin of referrerURL and the origin of request's current URL are the same, then
			//    return referrerURL.
			if (referrerURL.origin === currentURL.origin) {
				return referrerURL;
			}

			// 2. Return no referrer.
			return 'no-referrer';

		case 'origin-when-cross-origin':
			// 1. If the origin of referrerURL and the origin of request's current URL are the same, then
			//    return referrerURL.
			if (referrerURL.origin === currentURL.origin) {
				return referrerURL;
			}

			// Return referrerOrigin.
			return referrerOrigin;

		case 'no-referrer-when-downgrade':
			// 1. If referrerURL is a potentially trustworthy URL and request's current URL is not a
			//    potentially trustworthy URL, then return no referrer.
			if (isUrlPotentiallyTrustworthy(referrerURL) && !isUrlPotentiallyTrustworthy(currentURL)) {
				return 'no-referrer';
			}

			// 2. Return referrerURL.
			return referrerURL;

		default:
			throw new TypeError(`Invalid referrerPolicy: ${policy}`);
	}
}

/**
 * @see {@link https://w3c.github.io/webappsec-referrer-policy/#parse-referrer-policy-from-header|Referrer Policy §8.1. Parse a referrer policy from a Referrer-Policy header}
 * @param {Headers} headers Response headers
 * @returns {string} policy
 */
function parseReferrerPolicyFromHeader(headers) {
	// 1. Let policy-tokens be the result of extracting header list values given `Referrer-Policy`
	//    and response’s header list.
	const policyTokens = (headers.get('referrer-policy') || '').split(/[,\s]+/);

	// 2. Let policy be the empty string.
	let policy = '';

	// 3. For each token in policy-tokens, if token is a referrer policy and token is not the empty
	//    string, then set policy to token.
	// Note: This algorithm loops over multiple policy values to allow deployment of new policy
	// values with fallbacks for older user agents, as described in § 11.1 Unknown Policy Values.
	for (const token of policyTokens) {
		if (token && ReferrerPolicy.has(token)) {
			policy = token;
		}
	}

	// 4. Return policy.
	return policy;
}


/***/ }),
/* 43 */
/***/ ((module) => {

"use strict";
module.exports = require("node:net");

/***/ }),
/* 44 */
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   AbortError: () => (/* binding */ AbortError)
/* harmony export */ });
/* harmony import */ var _base_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(34);


/**
 * AbortError interface for cancelled requests
 */
class AbortError extends _base_js__WEBPACK_IMPORTED_MODULE_0__.FetchBaseError {
	constructor(message, type = 'aborted') {
		super(message, type);
	}
}


/***/ }),
/* 45 */
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Blob: () => (/* reexport safe */ _index_js__WEBPACK_IMPORTED_MODULE_4__["default"]),
/* harmony export */   File: () => (/* reexport safe */ _file_js__WEBPACK_IMPORTED_MODULE_3__["default"]),
/* harmony export */   blobFrom: () => (/* binding */ blobFrom),
/* harmony export */   blobFromSync: () => (/* binding */ blobFromSync),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__),
/* harmony export */   fileFrom: () => (/* binding */ fileFrom),
/* harmony export */   fileFromSync: () => (/* binding */ fileFromSync)
/* harmony export */ });
/* harmony import */ var node_fs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(46);
/* harmony import */ var node_path__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(47);
/* harmony import */ var node_domexception__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(48);
/* harmony import */ var _file_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(32);
/* harmony import */ var _index_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(25);







const { stat } = node_fs__WEBPACK_IMPORTED_MODULE_0__.promises

/**
 * @param {string} path filepath on the disk
 * @param {string} [type] mimetype to use
 */
const blobFromSync = (path, type) => fromBlob((0,node_fs__WEBPACK_IMPORTED_MODULE_0__.statSync)(path), path, type)

/**
 * @param {string} path filepath on the disk
 * @param {string} [type] mimetype to use
 * @returns {Promise<Blob>}
 */
const blobFrom = (path, type) => stat(path).then(stat => fromBlob(stat, path, type))

/**
 * @param {string} path filepath on the disk
 * @param {string} [type] mimetype to use
 * @returns {Promise<File>}
 */
const fileFrom = (path, type) => stat(path).then(stat => fromFile(stat, path, type))

/**
 * @param {string} path filepath on the disk
 * @param {string} [type] mimetype to use
 */
const fileFromSync = (path, type) => fromFile((0,node_fs__WEBPACK_IMPORTED_MODULE_0__.statSync)(path), path, type)

// @ts-ignore
const fromBlob = (stat, path, type = '') => new _index_js__WEBPACK_IMPORTED_MODULE_4__["default"]([new BlobDataItem({
  path,
  size: stat.size,
  lastModified: stat.mtimeMs,
  start: 0
})], { type })

// @ts-ignore
const fromFile = (stat, path, type = '') => new _file_js__WEBPACK_IMPORTED_MODULE_3__["default"]([new BlobDataItem({
  path,
  size: stat.size,
  lastModified: stat.mtimeMs,
  start: 0
})], (0,node_path__WEBPACK_IMPORTED_MODULE_1__.basename)(path), { type, lastModified: stat.mtimeMs })

/**
 * This is a blob backed up by a file on the disk
 * with minium requirement. Its wrapped around a Blob as a blobPart
 * so you have no direct access to this.
 *
 * @private
 */
class BlobDataItem {
  #path
  #start

  constructor (options) {
    this.#path = options.path
    this.#start = options.start
    this.size = options.size
    this.lastModified = options.lastModified
  }

  /**
   * Slicing arguments is first validated and formatted
   * to not be out of range by Blob.prototype.slice
   */
  slice (start, end) {
    return new BlobDataItem({
      path: this.#path,
      lastModified: this.lastModified,
      size: end - start,
      start: this.#start + start
    })
  }

  async * stream () {
    const { mtimeMs } = await stat(this.#path)
    if (mtimeMs > this.lastModified) {
      throw new node_domexception__WEBPACK_IMPORTED_MODULE_2__('The requested file could not be read, typically due to permission problems that have occurred after a reference to a file was acquired.', 'NotReadableError')
    }
    yield * (0,node_fs__WEBPACK_IMPORTED_MODULE_0__.createReadStream)(this.#path, {
      start: this.#start,
      end: this.#start + this.size - 1
    })
  }

  get [Symbol.toStringTag] () {
    return 'Blob'
  }
}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (blobFromSync);



/***/ }),
/* 46 */
/***/ ((module) => {

"use strict";
module.exports = require("node:fs");

/***/ }),
/* 47 */
/***/ ((module) => {

"use strict";
module.exports = require("node:path");

/***/ }),
/* 48 */
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

/*! node-domexception. MIT License. Jimmy Wärting <https://jimmy.warting.se/opensource> */

if (!globalThis.DOMException) {
  try {
    const { MessageChannel } = __webpack_require__(49),
    port = new MessageChannel().port1,
    ab = new ArrayBuffer()
    port.postMessage(ab, [ab, ab])
  } catch (err) {
    err.constructor.name === 'DOMException' && (
      globalThis.DOMException = err.constructor
    )
  }
}

module.exports = globalThis.DOMException


/***/ }),
/* 49 */
/***/ ((module) => {

"use strict";
module.exports = require("worker_threads");

/***/ }),
/* 50 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.ConnectionsView = void 0;
/* eslint-disable @typescript-eslint/naming-convention */
const vscode = __webpack_require__(1);
const ui = __webpack_require__(4);
class ConnectionsView {
    constructor(panel, extensionUri, api) {
        this._disposables = [];
        ui.logToOutput('ConnectionsView.constructor Started');
        this.extensionUri = extensionUri;
        this._panel = panel;
        this.api = api;
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        this._setWebviewMessageListener(this._panel.webview);
        this.loadData();
        ui.logToOutput('ConnectionsView.constructor Completed');
    }
    async loadData() {
        ui.logToOutput('ConnectionsView.loadData Started');
        const result = await this.api.getConnections();
        if (result.isSuccessful) {
            this.connectionsJson = result.result;
        }
        await this.renderHtml();
    }
    async renderHtml() {
        ui.logToOutput('ConnectionsView.renderHtml Started');
        this._panel.webview.html = this._getWebviewContent(this._panel.webview, this.extensionUri);
        ui.logToOutput('ConnectionsView.renderHtml Completed');
    }
    static render(extensionUri, api) {
        ui.logToOutput('ConnectionsView.render Started');
        if (ConnectionsView.Current) {
            ConnectionsView.Current.api = api;
            ConnectionsView.Current._panel.reveal(vscode.ViewColumn.One);
            ConnectionsView.Current.loadData();
        }
        else {
            const panel = vscode.window.createWebviewPanel("connectionsView", "Connections", vscode.ViewColumn.One, {
                enableScripts: true,
            });
            ConnectionsView.Current = new ConnectionsView(panel, extensionUri, api);
        }
    }
    dispose() {
        ui.logToOutput('ConnectionsView.dispose Started');
        ConnectionsView.Current = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }
    _getWebviewContent(webview, extensionUri) {
        ui.logToOutput('ConnectionsView._getWebviewContent Started');
        const toolkitUri = ui.getUri(webview, extensionUri, [
            "node_modules",
            "@vscode",
            "webview-ui-toolkit",
            "dist",
            "toolkit.js",
        ]);
        const mainUri = ui.getUri(webview, extensionUri, ["media", "main.js"]);
        const styleUri = ui.getUri(webview, extensionUri, ["media", "style.css"]);
        const connectionsData = this.connectionsJson ? JSON.stringify(this.connectionsJson, null, 4) : "No connections found";
        const result = /*html*/ `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width,initial-scale=1.0">
        <script type="module" src="${toolkitUri}"></script>
        <script type="module" src="${mainUri}"></script>
        <link rel="stylesheet" href="${styleUri}">
        <title>Connections</title>
      </head>
      <body>  
        <h2>Airflow Connections</h2>
        <vscode-button appearance="secondary" id="refresh-connections">Refresh</vscode-button>
        <br><br>
        <pre>${connectionsData}</pre>
      </body>
    </html>
    `;
        return result;
    }
    _setWebviewMessageListener(webview) {
        ui.logToOutput('ConnectionsView._setWebviewMessageListener Started');
        webview.onDidReceiveMessage((message) => {
            ui.logToOutput('ConnectionsView._setWebviewMessageListener Message Received ' + message.command);
            switch (message.command) {
                case "refresh-connections":
                    this.loadData();
                    return;
            }
        }, undefined, this._disposables);
    }
}
exports.ConnectionsView = ConnectionsView;


/***/ }),
/* 51 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.VariablesView = void 0;
/* eslint-disable @typescript-eslint/naming-convention */
const vscode = __webpack_require__(1);
const ui = __webpack_require__(4);
class VariablesView {
    constructor(panel, extensionUri, api) {
        this._disposables = [];
        ui.logToOutput('VariablesView.constructor Started');
        this.extensionUri = extensionUri;
        this._panel = panel;
        this.api = api;
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        this._setWebviewMessageListener(this._panel.webview);
        this.loadData();
        ui.logToOutput('VariablesView.constructor Completed');
    }
    async loadData() {
        ui.logToOutput('VariablesView.loadData Started');
        const result = await this.api.getVariables();
        if (result.isSuccessful) {
            this.variablesJson = result.result;
        }
        await this.renderHtml();
    }
    async renderHtml() {
        ui.logToOutput('VariablesView.renderHtml Started');
        this._panel.webview.html = this._getWebviewContent(this._panel.webview, this.extensionUri);
        ui.logToOutput('VariablesView.renderHtml Completed');
    }
    static render(extensionUri, api) {
        ui.logToOutput('VariablesView.render Started');
        if (VariablesView.Current) {
            VariablesView.Current.api = api;
            VariablesView.Current._panel.reveal(vscode.ViewColumn.One);
            VariablesView.Current.loadData();
        }
        else {
            const panel = vscode.window.createWebviewPanel("variablesView", "Variables", vscode.ViewColumn.One, {
                enableScripts: true,
            });
            VariablesView.Current = new VariablesView(panel, extensionUri, api);
        }
    }
    dispose() {
        ui.logToOutput('VariablesView.dispose Started');
        VariablesView.Current = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }
    _getWebviewContent(webview, extensionUri) {
        ui.logToOutput('VariablesView._getWebviewContent Started');
        const elementsUri = ui.getUri(webview, extensionUri, [
            "node_modules",
            "@vscode-elements",
            "elements",
            "dist",
            "bundled.js",
        ]);
        const mainUri = ui.getUri(webview, extensionUri, ["media", "main.js"]);
        const styleUri = ui.getUri(webview, extensionUri, ["media", "style.css"]);
        // Build table rows from variables data
        let tableRows = '';
        if (this.variablesJson) {
            // tableRows = this.variablesJson.map((variable: any) => {
            //     const key = variable.key || 'N/A';
            //     const value = variable.val || 'N/A';
            //     const description = variable.description || '';
            //     return `
            //     <vscode-table-row>
            //         <vscode-table-cell>${this._escapeHtml(key)}</vscode-table-cell>
            //         <vscode-table-cell><code>${this._escapeHtml(value)}</code></vscode-table-cell>
            //         <vscode-table-cell>${this._escapeHtml(description)}</vscode-table-cell>
            //     </vscode-table-row>`;
            // }).join('');
            for (const variable of this.variablesJson.variables) {
                const key = variable.key || 'N/A';
                const value = variable.val || 'N/A';
                const description = variable.description || '';
                tableRows += `
                <vscode-table-row>
                    <vscode-table-cell>${this._escapeHtml(key)}</vscode-table-cell>
                    <vscode-table-cell><code>${this._escapeHtml(value)}</code></vscode-table-cell>
                    <vscode-table-cell>${this._escapeHtml(description)}</vscode-table-cell>
                </vscode-table-row>`;
            }
        }
        const result = /*html*/ `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width,initial-scale=1.0">
        <script type="module" src="${elementsUri}"></script>
        <script type="module" src="${mainUri}"></script>
        <link rel="stylesheet" href="${styleUri}">
        <style>
            body {
                padding: 16px;
            }
            h2 {
                margin-top: 0;
            }
            .controls {
                margin-bottom: 16px;
            }
            vscode-table {
                width: 100%;
                max-height: 600px;
                overflow-y: auto;
            }
            vscode-table-cell {
                word-wrap: break-word;
                white-space: normal;
            }
            code {
                background-color: var(--vscode-editor-background);
                color: var(--vscode-editor-foreground);
                padding: 2px 4px;
                border-radius: 3px;
                font-family: monospace;
            }
        </style>
        <title>Variables</title>
      </head>
      <body>  
        <h2>Airflow Variables</h2>
        <div class="controls">
            <vscode-button appearance="secondary" id="refresh-variables">Refresh</vscode-button>
        </div>
        
        <vscode-table zebra bordered-columns resizable>
            <vscode-table-header slot="header">
                <vscode-table-header-cell>Key</vscode-table-header-cell>
                <vscode-table-header-cell>Value</vscode-table-header-cell>
                <vscode-table-header-cell>Description</vscode-table-header-cell>
            </vscode-table-header>
            <vscode-table-body slot="body">
            ${tableRows}
            </vscode-table-body>
        </vscode-table>
      </body>
    </html>
    `;
        return result;
    }
    _escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    }
    _setWebviewMessageListener(webview) {
        ui.logToOutput('VariablesView._setWebviewMessageListener Started');
        webview.onDidReceiveMessage((message) => {
            ui.logToOutput('VariablesView._setWebviewMessageListener Message Received ' + message.command);
            switch (message.command) {
                case "refresh-variables":
                    this.loadData();
                    return;
            }
        }, undefined, this._disposables);
    }
}
exports.VariablesView = VariablesView;


/***/ }),
/* 52 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.ProvidersView = void 0;
/* eslint-disable @typescript-eslint/naming-convention */
const vscode = __webpack_require__(1);
const ui = __webpack_require__(4);
class ProvidersView {
    constructor(panel, extensionUri, api) {
        this._disposables = [];
        ui.logToOutput('ProvidersView.constructor Started');
        this.extensionUri = extensionUri;
        this._panel = panel;
        this.api = api;
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        this._setWebviewMessageListener(this._panel.webview);
        this.loadData();
        ui.logToOutput('ProvidersView.constructor Completed');
    }
    async loadData() {
        ui.logToOutput('ProvidersView.loadData Started');
        const result = await this.api.getProviders();
        if (result.isSuccessful) {
            this.providersJson = result.result;
        }
        await this.renderHtml();
    }
    async renderHtml() {
        ui.logToOutput('ProvidersView.renderHtml Started');
        this._panel.webview.html = this._getWebviewContent(this._panel.webview, this.extensionUri);
        ui.logToOutput('ProvidersView.renderHtml Completed');
    }
    static render(extensionUri, api) {
        ui.logToOutput('ProvidersView.render Started');
        if (ProvidersView.Current) {
            ProvidersView.Current.api = api;
            ProvidersView.Current._panel.reveal(vscode.ViewColumn.One);
            ProvidersView.Current.loadData();
        }
        else {
            const panel = vscode.window.createWebviewPanel("providersView", "Providers", vscode.ViewColumn.One, {
                enableScripts: true,
            });
            ProvidersView.Current = new ProvidersView(panel, extensionUri, api);
        }
    }
    dispose() {
        ui.logToOutput('ProvidersView.dispose Started');
        ProvidersView.Current = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }
    _getWebviewContent(webview, extensionUri) {
        ui.logToOutput('ProvidersView._getWebviewContent Started');
        const elementsUri = ui.getUri(webview, extensionUri, [
            "node_modules",
            "@vscode-elements",
            "elements",
            "dist",
            "bundled.js",
        ]);
        const mainUri = ui.getUri(webview, extensionUri, ["media", "main.js"]);
        const styleUri = ui.getUri(webview, extensionUri, ["media", "style.css"]);
        // Build table rows from providers data
        let tableRows = '';
        if (this.providersJson) {
            // tableRows = this.providersJson.map((provider: any) => {
            //     const packageName = provider.package_name || 'N/A';
            //     const version = provider.version || 'N/A';
            //     const description = provider.description || 'N/A';
            //     return `
            //     <vscode-table-row>
            //         <vscode-table-cell>${this._escapeHtml(packageName)}</vscode-table-cell>
            //         <vscode-table-cell>${this._escapeHtml(version)}</vscode-table-cell>
            //         <vscode-table-cell>${this._escapeHtml(description)}</vscode-table-cell>
            //     </vscode-table-row>`;
            // }).join('');
            for (const provider of this.providersJson.providers) {
                const packageName = provider.package_name || 'N/A';
                const version = provider.version || 'N/A';
                const description = provider.description || 'N/A';
                tableRows += `
                <vscode-table-row>
                    <vscode-table-cell>${this._escapeHtml(packageName)}</vscode-table-cell>
                    <vscode-table-cell>${this._escapeHtml(version)}</vscode-table-cell>
                    <vscode-table-cell>${this._escapeHtml(description)}</vscode-table-cell>
                </vscode-table-row>`;
            }
        }
        const result = /*html*/ `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width,initial-scale=1.0">
        <script type="module" src="${elementsUri}"></script>
        <script type="module" src="${mainUri}"></script>
        <link rel="stylesheet" href="${styleUri}">
        <style>
            body {
                padding: 16px;
            }
            h2 {
                margin-top: 0;
            }
            .controls {
                margin-bottom: 16px;
            }
            vscode-table {
                width: 100%;
                max-height: 600px;
                overflow-y: auto;
            }
            vscode-table-cell {
                word-wrap: break-word;
                white-space: normal;
            }
        </style>
        <title>Providers</title>
      </head>
      <body>  
        <h2>Airflow Providers</h2>
        <div class="controls">
            <vscode-button appearance="secondary" id="refresh-providers">Refresh</vscode-button>
        </div>
        
        <vscode-table zebra bordered-columns resizable>
            <vscode-table-header slot="header">
                <vscode-table-header-cell>Package Name</vscode-table-header-cell>
                <vscode-table-header-cell>Version</vscode-table-header-cell>
                <vscode-table-header-cell>Description</vscode-table-header-cell>
            </vscode-table-header>
            <vscode-table-body slot="body">
            ${tableRows}
            </vscode-table-body>
        </vscode-table>
      </body>
    </html>
    `;
        return result;
    }
    _escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    }
    _setWebviewMessageListener(webview) {
        ui.logToOutput('ProvidersView._setWebviewMessageListener Started');
        webview.onDidReceiveMessage((message) => {
            ui.logToOutput('ProvidersView._setWebviewMessageListener Message Received ' + message.command);
            switch (message.command) {
                case "refresh-providers":
                    this.loadData();
                    return;
            }
        }, undefined, this._disposables);
    }
}
exports.ProvidersView = ProvidersView;


/***/ }),
/* 53 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";

/**
 * AirflowClientAdapter - Adapter to bridge AirflowApi with Language Model Tools
 *
 * This class adapts the existing AirflowApi class to work with the Language Model Tools.
 */
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.AirflowClientAdapter = void 0;
const DagTreeView_1 = __webpack_require__(2);
const ui = __webpack_require__(4);
class AirflowClientAdapter {
    /**
     * Dynamically retrieves the currently connected Airflow API instance.
     * Throws an error if no server is connected.
     */
    get api() {
        if (!DagTreeView_1.DagTreeView.Current || !DagTreeView_1.DagTreeView.Current.api) {
            const msg = "No Airflow server connected. Please connect to a server in the Airflow view.";
            ui.showErrorMessage(msg);
            throw new Error(msg);
        }
        return DagTreeView_1.DagTreeView.Current.api;
    }
    /**
     * Triggers a DAG run via POST /dags/{dag_id}/dagRuns
     *
     * @param dagId - The DAG identifier
     * @param configJson - JSON string containing the DAG run configuration (optional)
     * @param date - The logical date for the run (optional)
     * @returns Promise with the created DAG run result
     */
    async triggerDagRun(dagId, configJson = '{}', date) {
        // Validate JSON before calling API
        try {
            JSON.parse(configJson);
        }
        catch (error) {
            throw new Error(`Invalid JSON in config_json parameter: ${error instanceof Error ? error.message : String(error)}`);
        }
        // Call the actual AirflowApi.triggerDag method
        // Note: AirflowApi.triggerDag already accepts date as the 3rd argument
        const result = await this.api.triggerDag(dagId, configJson, date);
        if (!result.isSuccessful) {
            throw new Error(result.error?.message || 'Failed to trigger DAG run');
        }
        // Map the API response to our interface
        const apiResponse = result.result;
        return {
            dag_id: apiResponse.dag_id || dagId,
            dag_run_id: apiResponse.dag_run_id || apiResponse.run_id || '',
            state: apiResponse.state || 'queued',
            execution_date: apiResponse.execution_date || apiResponse.logical_date || new Date().toISOString(),
            logical_date: apiResponse.logical_date || apiResponse.execution_date || new Date().toISOString(),
            start_date: apiResponse.start_date,
            end_date: apiResponse.end_date,
            conf: apiResponse.conf
        };
    }
    /**
     * Queries for failed DAG runs using the Airflow API
     *
     * @param timeRangeHours - Number of hours to look back (default 24)
     * @param dagIdFilter - Optional DAG ID filter
     * @returns Promise with array of failed run summaries
     */
    async queryFailedRuns(timeRangeHours = 24, dagIdFilter) {
        const failedRuns = [];
        try {
            // If dagIdFilter is specified, query only that DAG
            if (dagIdFilter) {
                const result = await this.api.getDagRunHistory(dagIdFilter);
                if (result.isSuccessful && result.result?.dag_runs) {
                    failedRuns.push(...this.filterFailedRuns(result.result.dag_runs, timeRangeHours));
                }
            }
            else {
                // If no filter, we need to get the DAG list first, then query each
                const dagListResult = await this.api.getDagList();
                if (dagListResult.isSuccessful && dagListResult.result) {
                    // Handle both v1 (array) and v2 (object with dags property) responses
                    const resultData = dagListResult.result;
                    const dags = Array.isArray(resultData) ? resultData : (resultData.dags || []);
                    // Limit to first 20 DAGs to avoid too many API calls
                    const dagsToCheck = dags.slice(0, 20);
                    // Query each DAG's runs in parallel
                    const runPromises = dagsToCheck.map(async (dag) => {
                        try {
                            const dagId = dag.dag_id;
                            const runResult = await this.api.getDagRunHistory(dagId);
                            if (runResult.isSuccessful && runResult.result?.dag_runs) {
                                return this.filterFailedRuns(runResult.result.dag_runs, timeRangeHours);
                            }
                        }
                        catch (error) {
                            // Silently continue on error for individual DAGs
                            return [];
                        }
                        return [];
                    });
                    const results = await Promise.all(runPromises);
                    results.forEach(runs => failedRuns.push(...runs));
                }
            }
            return failedRuns;
        }
        catch (error) {
            throw new Error(`Failed to query failed runs: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Retrieves a list of DAGs filtered by paused state
     *
     * @param isPaused - Whether to list paused (true) or active (false) DAGs
     * @returns Promise with array of DAG summaries
     */
    async getDags(isPaused) {
        try {
            const dagListResult = await this.api.getDagList();
            if (!dagListResult.isSuccessful || !dagListResult.result) {
                throw new Error(dagListResult.error?.message || 'Failed to fetch DAG list');
            }
            // Handle both v1 (array) and v2 (object with dags property) responses
            const resultData = dagListResult.result;
            const dags = Array.isArray(resultData) ? resultData : (resultData.dags || []);
            return dags
                .filter((dag) => dag.is_paused === isPaused)
                .map((dag) => ({
                dag_id: dag.dag_id,
                is_paused: dag.is_paused,
                is_active: dag.is_active !== undefined ? dag.is_active : !dag.is_paused,
                description: dag.description,
                owners: dag.owners,
                tags: dag.tags
            }));
        }
        catch (error) {
            throw new Error(`Failed to get DAG list: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Pauses or unpauses a DAG
     *
     * @param dagId - The DAG ID
     * @param isPaused - True to pause, false to unpause
     */
    async pauseDag(dagId, isPaused) {
        try {
            const result = await this.api.pauseDag(dagId, isPaused);
            if (!result.isSuccessful) {
                throw new Error(result.error?.message || `Failed to ${isPaused ? 'pause' : 'unpause'} DAG`);
            }
        }
        catch (error) {
            throw new Error(`Failed to change DAG state: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Retrieves the latest DAG run for a given DAG
     *
     * @param dagId - The DAG ID
     * @returns Promise with the latest DAG run result or undefined if not found
     */
    async getLatestDagRun(dagId) {
        try {
            const result = await this.api.getLastDagRun(dagId);
            if (!result.isSuccessful || !result.result) {
                return undefined;
            }
            const apiResponse = result.result;
            return {
                dag_id: apiResponse.dag_id || dagId,
                dag_run_id: apiResponse.dag_run_id || apiResponse.run_id || '',
                state: apiResponse.state || 'unknown',
                execution_date: apiResponse.execution_date || apiResponse.logical_date || new Date().toISOString(),
                logical_date: apiResponse.logical_date || apiResponse.execution_date || new Date().toISOString(),
                start_date: apiResponse.start_date,
                end_date: apiResponse.end_date,
                conf: apiResponse.conf
            };
        }
        catch (error) {
            // Return undefined on error to allow caller to handle
            return undefined;
        }
    }
    /**
     * Retrieves task instances for a specific DAG run
     *
     * @param dagId - The DAG ID
     * @param dagRunId - The DAG run ID
     * @returns Promise with array of task instances
     */
    async getTaskInstances(dagId, dagRunId) {
        try {
            const result = await this.api.getTaskInstances(dagId, dagRunId);
            if (!result.isSuccessful || !result.result) {
                return [];
            }
            // API v2 returns { task_instances: [...] }
            return result.result.task_instances || [];
        }
        catch (error) {
            return [];
        }
    }
    /**
     * Retrieves task log content
     *
     * @param dagId - The DAG ID
     * @param dagRunId - The DAG run ID
     * @param taskId - The task ID
     * @param tryNumber - The task attempt number
     * @returns Promise with the log content (truncated for LLM processing)
     */
    async getTaskLog(dagId, dagRunId, taskId, tryNumber) {
        try {
            // Use the existing getTaskInstanceLog method
            const result = await this.api.getTaskInstanceLog(dagId, dagRunId, taskId);
            if (!result.isSuccessful) {
                throw new Error(result.error?.message || 'Failed to retrieve task log');
            }
            const logContent = result.result || '';
            // Truncate to last 400 characters for token efficiency
            if (logContent.length > 400) {
                return '...' + logContent.slice(-400);
            }
            return logContent;
        }
        catch (error) {
            throw new Error(`Failed to get task log: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Helper method to filter failed runs within the time range
     */
    filterFailedRuns(dagRuns, timeRangeHours) {
        const cutoffTime = new Date();
        cutoffTime.setHours(cutoffTime.getHours() - timeRangeHours);
        const failedStates = ['failed', 'upstream_failed', 'skipped'];
        return dagRuns
            .filter((run) => {
            // Filter by state
            if (!failedStates.includes(run.state)) {
                return false;
            }
            // Filter by time range
            const runDate = new Date(run.execution_date || run.logical_date || run.start_date);
            return runDate >= cutoffTime;
        })
            .map((run) => ({
            dag_id: run.dag_id,
            dag_run_id: run.dag_run_id || run.run_id,
            state: run.state,
            execution_date: run.execution_date || run.logical_date,
            logical_date: run.logical_date || run.execution_date,
            start_date: run.start_date,
            end_date: run.end_date,
            error_message: this.extractErrorMessage(run)
        }));
    }
    /**
     * Retrieves DAG run history for a specific DAG
     *
     * @param dagId - The DAG ID
     * @param date - Optional date filter (YYYY-MM-DD format)
     * @returns Promise with DAG runs data
     */
    async getDagRunHistory(dagId, date) {
        try {
            const result = await this.api.getDagRunHistory(dagId, date);
            if (!result.isSuccessful || !result.result) {
                throw new Error(result.error?.message || 'Failed to fetch DAG run history');
            }
            return result.result;
        }
        catch (error) {
            throw new Error(`Failed to get DAG run history: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Stops a running DAG run by setting its state to failed
     *
     * @param dagId - The DAG ID
     * @param dagRunId - The DAG run ID to stop
     */
    async stopDagRun(dagId, dagRunId) {
        try {
            const result = await this.api.stopDagRun(dagId, dagRunId);
            if (!result.isSuccessful) {
                throw new Error(result.error?.message || 'Failed to stop DAG run');
            }
        }
        catch (error) {
            throw new Error(`Failed to stop DAG run: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Retrieves the source code for a DAG
     *
     * @param dagId - The DAG ID
     * @returns Promise with the DAG source code
     */
    async getDagSource(dagId) {
        try {
            const result = await this.api.getSourceCode(dagId);
            if (!result.isSuccessful || !result.result) {
                throw new Error(result.error?.message || 'Failed to fetch DAG source code');
            }
            return result.result;
        }
        catch (error) {
            throw new Error(`Failed to get DAG source code: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Helper to extract error message from DAG run
     */
    extractErrorMessage(run) {
        // Try to extract error information from the run object
        if (run.note) {
            return run.note;
        }
        if (run.state === 'failed') {
            return `DAG run failed`;
        }
        if (run.state === 'upstream_failed') {
            return `Upstream task(s) failed`;
        }
        if (run.state === 'skipped') {
            return `DAG run was skipped`;
        }
        return undefined;
    }
}
exports.AirflowClientAdapter = AirflowClientAdapter;


/***/ }),
/* 54 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";

/**
 * TriggerDagRunTool - Language Model Tool for triggering Airflow DAG runs
 *
 * This tool implements a state-changing action that requires explicit user confirmation
 * via the prepareInvocation method. It displays the target DAG ID and configuration
 * payload in a markdown-formatted confirmation dialog before execution.
 */
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.TriggerDagRunTool = void 0;
const vscode = __webpack_require__(1);
const fs = __webpack_require__(5);
/**
 * TriggerDagRunTool - Implements vscode.LanguageModelTool for DAG triggering
 */
class TriggerDagRunTool {
    constructor(client) {
        this.client = client;
    }
    /**
     * SECURITY CRITICAL: Prepare invocation with user confirmation
     *
     * This method is called before invoke() and provides a confirmation gate
     * for the user to review the exact DAG and configuration before triggering.
     *
     * @param options - Contains the parsed input parameters
     * @param token - Cancellation token
     * @returns PreparedToolInvocation with confirmation message
     */
    async prepareInvocation(options, token) {
        const { dag_id, config_json, date } = options.input;
        // Process config_json: check if it's a file path
        let finalConfig = config_json || '{}';
        let configSource = 'Inline';
        if (config_json && !config_json.trim().startsWith('{')) {
            // Assume it's a file path if it doesn't start with {
            try {
                // Remove quotes if present
                const filePath = config_json.replace(/^['"]|['"]$/g, '');
                if (fs.existsSync(filePath)) {
                    finalConfig = fs.readFileSync(filePath, 'utf8');
                    configSource = `File: ${filePath}`;
                }
            }
            catch (error) {
                // If read fails, keep original string (validation will happen later)
                console.warn(`Failed to read config file: ${error}`);
            }
        }
        // Validate JSON
        try {
            JSON.parse(finalConfig);
        }
        catch (e) {
            throw new Error(`Invalid JSON configuration: ${e instanceof Error ? e.message : String(e)}`);
        }
        const confirmationMessage = new vscode.MarkdownString();
        confirmationMessage.isTrusted = true;
        confirmationMessage.appendMarkdown('## ⚠️ Trigger DAG Confirmation\n\n');
        confirmationMessage.appendMarkdown(`You are about to trigger the following DAG:\n\n`);
        confirmationMessage.appendMarkdown(`**DAG ID:** \`${dag_id}\`\n`);
        if (date) {
            confirmationMessage.appendMarkdown(`**Logical Date:** \`${date}\`\n`);
        }
        confirmationMessage.appendMarkdown(`**Config Source:** ${configSource}\n\n`);
        confirmationMessage.appendMarkdown('**Configuration Payload:**\n');
        confirmationMessage.appendCodeblock(finalConfig, 'json');
        confirmationMessage.appendMarkdown('\nDo you want to proceed?');
        return {
            invocationMessage: `Triggering DAG: ${dag_id}`,
            confirmationMessages: {
                title: 'Confirm DAG Trigger',
                message: confirmationMessage
            }
        };
    }
    /**
     * Execute the DAG trigger action
     *
     * @param options - Contains the validated input parameters
     * @param token - Cancellation token
     * @returns LanguageModelToolResult with success/error information
     */
    async invoke(options, token) {
        const { dag_id, config_json, date } = options.input;
        try {
            // Re-process config for invoke (same logic as prepare)
            let finalConfig = config_json || '{}';
            if (config_json && !config_json.trim().startsWith('{')) {
                try {
                    const filePath = config_json.replace(/^['"]|['"]$/g, '');
                    if (fs.existsSync(filePath)) {
                        finalConfig = fs.readFileSync(filePath, 'utf8');
                    }
                }
                catch (error) {
                    // Ignore error here, will fail at JSON parse in client
                }
            }
            const result = await this.client.triggerDagRun(dag_id, finalConfig, date);
            const message = [
                `✅ **Success!** DAG Run triggered.`,
                ``,
                `- **DAG ID:** ${result.dag_id}`,
                `- **Run ID:** ${result.dag_run_id}`,
                `- **State:** ${result.state}`,
                `- **Logical Date:** ${result.logical_date}`,
                date ? `- **Requested Date:** ${date}` : ''
            ].filter(Boolean).join('\n');
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(message)
            ]);
        }
        catch (error) {
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(`❌ Failed to trigger DAG ${dag_id}: ${error instanceof Error ? error.message : String(error)}`)
            ]);
        }
    }
}
exports.TriggerDagRunTool = TriggerDagRunTool;


/***/ }),
/* 55 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";

/**
 * GetFailedRunsTool - Language Model Tool for monitoring failed DAG runs
 *
 * This tool implements a read-only observability action that retrieves
 * failed DAG runs from Airflow. It does not require user confirmation
 * since it's a non-destructive operation.
 */
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.GetFailedRunsTool = void 0;
const vscode = __webpack_require__(1);
/**
 * GetFailedRunsTool - Implements vscode.LanguageModelTool for monitoring
 */
class GetFailedRunsTool {
    constructor(client) {
        this.client = client;
    }
    /**
     * Prepare invocation - minimal for read-only operations
     *
     * Since this is a read-only monitoring tool, we don't need extensive
     * confirmation dialogs. This method can return undefined or a simple message.
     *
     * @param options - Contains the parsed input parameters
     * @param token - Cancellation token
     * @returns PreparedToolInvocation or undefined
     */
    async prepareInvocation(options, token) {
        const timeRange = options.input.time_range_hours || 24;
        const dagFilter = options.input.dag_id_filter;
        const message = dagFilter
            ? `Querying failed runs for DAG '${dagFilter}' (last ${timeRange} hours)`
            : `Querying all failed runs (last ${timeRange} hours)`;
        return {
            invocationMessage: message
        };
    }
    /**
     * Execute the query for failed DAG runs
     *
     * @param options - Contains the validated input parameters
     * @param token - Cancellation token
     * @returns LanguageModelToolResult with failed runs data
     */
    async invoke(options, token) {
        const timeRange = options.input.time_range_hours || 24;
        const dagFilter = options.input.dag_id_filter;
        try {
            // Call the mock API client to get failed runs
            const failedRuns = await this.client.queryFailedRuns(timeRange, dagFilter);
            // Format the response for the LLM
            if (failedRuns.length === 0) {
                const noFailuresMessage = dagFilter
                    ? `✅ No failed runs found for DAG '${dagFilter}' in the last ${timeRange} hours.`
                    : `✅ No failed runs found in the last ${timeRange} hours. All DAGs are healthy!`;
                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart(noFailuresMessage)
                ]);
            }
            // Build a detailed summary
            let summaryMessage = `## ⚠️ Failed DAG Runs Report\n\n`;
            summaryMessage += `**Time Range:** Last ${timeRange} hours\n`;
            if (dagFilter) {
                summaryMessage += `**DAG Filter:** ${dagFilter}\n`;
            }
            summaryMessage += `**Total Failed Runs:** ${failedRuns.length}\n\n`;
            summaryMessage += `---\n\n`;
            // Add individual run details
            failedRuns.forEach((run, index) => {
                summaryMessage += `### ${index + 1}. ${run.dag_id}\n\n`;
                summaryMessage += `- **Run ID:** \`${run.dag_run_id}\`\n`;
                summaryMessage += `- **State:** ${run.state}\n`;
                summaryMessage += `- **Execution Date:** ${run.execution_date}\n`;
                summaryMessage += `- **Logical Date:** ${run.logical_date}\n`;
                if (run.start_date) {
                    summaryMessage += `- **Started:** ${run.start_date}\n`;
                }
                if (run.end_date) {
                    summaryMessage += `- **Ended:** ${run.end_date}\n`;
                }
                if (run.error_message) {
                    summaryMessage += `- **Error:** ${run.error_message}\n`;
                }
                summaryMessage += `\n`;
            });
            // Also include raw JSON for LLM processing
            summaryMessage += `\n---\n\n**Raw Data (JSON):**\n\n`;
            summaryMessage += `\`\`\`json\n${JSON.stringify(failedRuns, null, 2)}\n\`\`\`\n`;
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(summaryMessage)
            ]);
        }
        catch (error) {
            // Handle errors gracefully
            const errorMessage = `
❌ Failed to Query DAG Runs

**Error:** ${error instanceof Error ? error.message : String(error)}

Please check:
- The Airflow server is accessible
- You have the necessary permissions
- The time range and filters are valid
            `.trim();
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(errorMessage)
            ]);
        }
    }
}
exports.GetFailedRunsTool = GetFailedRunsTool;


/***/ }),
/* 56 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";

/**
 * ListActiveDagsTool - Language Model Tool for listing active DAGs
 */
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.ListActiveDagsTool = void 0;
const vscode = __webpack_require__(1);
class ListActiveDagsTool {
    constructor(client) {
        this.client = client;
    }
    async prepareInvocation(options, token) {
        return {
            invocationMessage: "Listing active DAGs..."
        };
    }
    async invoke(options, token) {
        try {
            const dags = await this.client.getDags(false); // false = active (not paused)
            if (dags.length === 0) {
                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart("✅ No active DAGs found.")
                ]);
            }
            let message = `## 🟢 Active DAGs (${dags.length})\n\n`;
            dags.forEach(dag => {
                message += `- **${dag.dag_id}**`;
                if (dag.description) {
                    message += `: ${dag.description}`;
                }
                message += `\n`;
            });
            message += `\n---\n**Raw Data:**\n\`\`\`json\n${JSON.stringify(dags, null, 2)}\n\`\`\``;
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(message)
            ]);
        }
        catch (error) {
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(`❌ Failed to list active DAGs: ${error instanceof Error ? error.message : String(error)}`)
            ]);
        }
    }
}
exports.ListActiveDagsTool = ListActiveDagsTool;


/***/ }),
/* 57 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";

/**
 * ListPausedDagsTool - Language Model Tool for listing paused DAGs
 */
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.ListPausedDagsTool = void 0;
const vscode = __webpack_require__(1);
class ListPausedDagsTool {
    constructor(client) {
        this.client = client;
    }
    async prepareInvocation(options, token) {
        return {
            invocationMessage: "Listing paused DAGs..."
        };
    }
    async invoke(options, token) {
        try {
            const dags = await this.client.getDags(true); // true = paused
            if (dags.length === 0) {
                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart("✅ No paused DAGs found.")
                ]);
            }
            let message = `## ⏸️ Paused DAGs (${dags.length})\n\n`;
            dags.forEach(dag => {
                message += `- **${dag.dag_id}**`;
                if (dag.description) {
                    message += `: ${dag.description}`;
                }
                message += `\n`;
            });
            message += `\n---\n**Raw Data:**\n\`\`\`json\n${JSON.stringify(dags, null, 2)}\n\`\`\``;
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(message)
            ]);
        }
        catch (error) {
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(`❌ Failed to list paused DAGs: ${error instanceof Error ? error.message : String(error)}`)
            ]);
        }
    }
}
exports.ListPausedDagsTool = ListPausedDagsTool;


/***/ }),
/* 58 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";

/**
 * PauseDagTool - Language Model Tool for pausing a DAG
 */
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.PauseDagTool = void 0;
const vscode = __webpack_require__(1);
class PauseDagTool {
    constructor(client) {
        this.client = client;
    }
    async prepareInvocation(options, token) {
        const { dag_id } = options.input;
        const confirmationMessage = new vscode.MarkdownString();
        confirmationMessage.isTrusted = true;
        confirmationMessage.appendMarkdown('## ⚠️ Pause DAG Confirmation\n\n');
        confirmationMessage.appendMarkdown(`You are about to **PAUSE** the following DAG:\n\n`);
        confirmationMessage.appendMarkdown(`**DAG ID:** \`${dag_id}\`\n\n`);
        confirmationMessage.appendMarkdown('**Effect:** No new runs will be scheduled for this DAG.\n\n');
        confirmationMessage.appendMarkdown('Do you want to proceed?');
        return {
            invocationMessage: `Pausing DAG: ${dag_id}`,
            confirmationMessages: {
                title: 'Confirm Pause DAG',
                message: confirmationMessage
            }
        };
    }
    async invoke(options, token) {
        const { dag_id } = options.input;
        try {
            await this.client.pauseDag(dag_id, true); // true = pause
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(`✅ Successfully PAUSED DAG: **${dag_id}**`)
            ]);
        }
        catch (error) {
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(`❌ Failed to pause DAG ${dag_id}: ${error instanceof Error ? error.message : String(error)}`)
            ]);
        }
    }
}
exports.PauseDagTool = PauseDagTool;


/***/ }),
/* 59 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";

/**
 * UnpauseDagTool - Language Model Tool for unpausing (activating) a DAG
 */
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.UnpauseDagTool = void 0;
const vscode = __webpack_require__(1);
class UnpauseDagTool {
    constructor(client) {
        this.client = client;
    }
    async prepareInvocation(options, token) {
        const { dag_id } = options.input;
        const confirmationMessage = new vscode.MarkdownString();
        confirmationMessage.isTrusted = true;
        confirmationMessage.appendMarkdown('## ⚠️ Unpause DAG Confirmation\n\n');
        confirmationMessage.appendMarkdown(`You are about to **UNPAUSE** (activate) the following DAG:\n\n`);
        confirmationMessage.appendMarkdown(`**DAG ID:** \`${dag_id}\`\n\n`);
        confirmationMessage.appendMarkdown('**Effect:** New runs will be scheduled for this DAG.\n\n');
        confirmationMessage.appendMarkdown('Do you want to proceed?');
        return {
            invocationMessage: `Unpausing DAG: ${dag_id}`,
            confirmationMessages: {
                title: 'Confirm Unpause DAG',
                message: confirmationMessage
            }
        };
    }
    async invoke(options, token) {
        const { dag_id } = options.input;
        try {
            await this.client.pauseDag(dag_id, false); // false = unpause
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(`✅ Successfully UNPAUSED DAG: **${dag_id}**`)
            ]);
        }
        catch (error) {
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(`❌ Failed to unpause DAG ${dag_id}: ${error instanceof Error ? error.message : String(error)}`)
            ]);
        }
    }
}
exports.UnpauseDagTool = UnpauseDagTool;


/***/ }),
/* 60 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";

/**
 * GetDagRunsTool - Language Model Tool for retrieving DAG runs
 *
 * This tool retrieves the runs for a specific DAG, optionally filtered by date.
 * Returns run ID, start time, duration, and status for each run.
 */
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.GetDagRunsTool = void 0;
const vscode = __webpack_require__(1);
const ui = __webpack_require__(4);
/**
 * GetDagRunsTool - Implements vscode.LanguageModelTool for retrieving DAG runs
 */
class GetDagRunsTool {
    constructor(client) {
        this.client = client;
    }
    /**
     * Prepare invocation - minimal for read-only operations
     */
    async prepareInvocation(options, token) {
        const { dag_id, date } = options.input;
        const dateStr = date || ui.toISODateString(new Date());
        return {
            invocationMessage: `Retrieving runs for DAG '${dag_id}' (date: ${dateStr})`
        };
    }
    /**
     * Execute the query for DAG runs
     */
    async invoke(options, token) {
        const { dag_id, date } = options.input;
        try {
            // Get DAG run history from the API
            const result = await this.client.getDagRunHistory(dag_id);
            if (!result || !result.dag_runs || result.dag_runs.length === 0) {
                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart(`ℹ️ No runs found for DAG '${dag_id}'.`)
                ]);
            }
            let runs = result.dag_runs;
            // Filter by date if provided
            if (date) {
                const targetDate = new Date(date);
                runs = runs.filter((run) => {
                    const runDate = new Date(run.execution_date || run.logical_date);
                    return ui.toISODateString(runDate) === ui.toISODateString(targetDate);
                });
                if (runs.length === 0) {
                    return new vscode.LanguageModelToolResult([
                        new vscode.LanguageModelTextPart(`ℹ️ No runs found for DAG '${dag_id}' on ${date}.`)
                    ]);
                }
            }
            // Build detailed summary
            let summaryMessage = `## 📊 DAG Runs for '${dag_id}'\n\n`;
            if (date) {
                summaryMessage += `**Date Filter:** ${date}\n`;
            }
            else {
                summaryMessage += `**Date Filter:** Today (${ui.toISODateString(new Date())})\n`;
            }
            summaryMessage += `**Total Runs:** ${runs.length}\n\n`;
            summaryMessage += `---\n\n`;
            // Add individual run details
            runs.forEach((run, index) => {
                const startTime = run.start_date || run.execution_date || 'N/A';
                const endTime = run.end_date || 'N/A';
                let duration = 'N/A';
                if (run.start_date && run.end_date) {
                    const start = new Date(run.start_date);
                    const end = new Date(run.end_date);
                    const durationMs = end.getTime() - start.getTime();
                    const durationSec = Math.floor(durationMs / 1000);
                    const minutes = Math.floor(durationSec / 60);
                    const seconds = durationSec % 60;
                    duration = `${minutes}m ${seconds}s`;
                }
                const status = run.state || 'unknown';
                const statusEmoji = this.getStatusEmoji(status);
                summaryMessage += `### ${index + 1}. Run: ${run.dag_run_id || run.run_id}\n\n`;
                summaryMessage += `- **Status:** ${statusEmoji} ${status}\n`;
                summaryMessage += `- **Start Time:** ${startTime}\n`;
                if (endTime !== 'N/A') {
                    summaryMessage += `- **End Time:** ${endTime}\n`;
                }
                summaryMessage += `- **Duration:** ${duration}\n`;
                summaryMessage += `- **Execution Date:** ${run.execution_date || run.logical_date}\n`;
                summaryMessage += `\n`;
            });
            // Include raw JSON for LLM processing
            summaryMessage += `\n---\n\n**Raw Data (JSON):**\n\n`;
            summaryMessage += `\`\`\`json\n${JSON.stringify(runs, null, 2)}\n\`\`\`\n`;
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(summaryMessage)
            ]);
        }
        catch (error) {
            const errorMessage = `
❌ Failed to retrieve DAG runs

**Error:** ${error instanceof Error ? error.message : String(error)}

Please check:
- The DAG ID is correct
- The Airflow server is accessible
- You have the necessary permissions
            `.trim();
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(errorMessage)
            ]);
        }
    }
    /**
     * Helper to get emoji for run status
     */
    getStatusEmoji(status) {
        const statusMap = {
            'success': '✅',
            'failed': '❌',
            'running': '▶️',
            'queued': '⏳',
            'upstream_failed': '⚠️',
            'skipped': '⏭️',
            'up_for_retry': '🔄',
            'up_for_reschedule': '📅',
            'removed': '🗑️',
            'scheduled': '📆'
        };
        return statusMap[status.toLowerCase()] || '❓';
    }
}
exports.GetDagRunsTool = GetDagRunsTool;


/***/ }),
/* 61 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";

/**
 * StopDagRunTool - Language Model Tool for stopping a running DAG run
 *
 * This tool stops the currently running DAG run for a specific DAG.
 * It requires user confirmation since it's a state-changing operation.
 */
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.StopDagRunTool = void 0;
const vscode = __webpack_require__(1);
/**
 * StopDagRunTool - Implements vscode.LanguageModelTool for stopping DAG runs
 */
class StopDagRunTool {
    constructor(client) {
        this.client = client;
    }
    /**
     * Prepare invocation with user confirmation
     */
    async prepareInvocation(options, token) {
        const { dag_id } = options.input;
        // Try to get the current running DAG run
        let runInfo = '';
        try {
            const latestRun = await this.client.getLatestDagRun(dag_id);
            if (latestRun && (latestRun.state === 'running' || latestRun.state === 'queued')) {
                runInfo = `\n**Current Run:** \`${latestRun.dag_run_id}\`\n**State:** ${latestRun.state}\n\n`;
            }
        }
        catch (error) {
            // Ignore error, proceed with generic confirmation
        }
        const confirmationMessage = new vscode.MarkdownString();
        confirmationMessage.isTrusted = true;
        confirmationMessage.appendMarkdown('## ⚠️ Stop DAG Run Confirmation\n\n');
        confirmationMessage.appendMarkdown(`You are about to **STOP** the running DAG run for:\n\n`);
        confirmationMessage.appendMarkdown(`**DAG ID:** \`${dag_id}\`\n`);
        if (runInfo) {
            confirmationMessage.appendMarkdown(runInfo);
        }
        confirmationMessage.appendMarkdown('**Effect:** The current DAG run will be marked as failed and stopped.\n\n');
        confirmationMessage.appendMarkdown('Do you want to proceed?');
        return {
            invocationMessage: `Stopping DAG run: ${dag_id}`,
            confirmationMessages: {
                title: 'Confirm Stop DAG Run',
                message: confirmationMessage
            }
        };
    }
    /**
     * Execute the stop DAG run action
     */
    async invoke(options, token) {
        const { dag_id } = options.input;
        try {
            // First, get the latest DAG run to find the running one
            const latestRun = await this.client.getLatestDagRun(dag_id);
            if (!latestRun) {
                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart(`ℹ️ No DAG run found for '${dag_id}'.`)
                ]);
            }
            // Check if the latest run is actually running
            if (latestRun.state !== 'running' && latestRun.state !== 'queued') {
                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart(`ℹ️ DAG '${dag_id}' is not currently running.\n\nLatest run state: **${latestRun.state}**\nRun ID: \`${latestRun.dag_run_id}\``)
                ]);
            }
            // Stop the DAG run
            await this.client.stopDagRun(dag_id, latestRun.dag_run_id);
            const message = [
                `✅ **Success!** DAG run stopped.`,
                ``,
                `- **DAG ID:** ${dag_id}`,
                `- **Run ID:** ${latestRun.dag_run_id}`,
                `- **Previous State:** ${latestRun.state}`,
                ``,
                `The DAG run has been marked as failed and stopped.`
            ].join('\n');
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(message)
            ]);
        }
        catch (error) {
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(`❌ Failed to stop DAG run for ${dag_id}: ${error instanceof Error ? error.message : String(error)}`)
            ]);
        }
    }
}
exports.StopDagRunTool = StopDagRunTool;


/***/ }),
/* 62 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";

/**
 * AnalyseDagLatestRunTool - Language Model Tool for comprehensive DAG run analysis
 *
 * This tool retrieves comprehensive information about the latest DAG run including:
 * - DAG run details
 * - Task instances
 * - DAG source code
 * - Task logs
 *
 * It provides a complete analysis to help diagnose issues and understand execution.
 */
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.AnalyseDagLatestRunTool = void 0;
const vscode = __webpack_require__(1);
/**
 * AnalyseDagLatestRunTool - Implements vscode.LanguageModelTool for comprehensive DAG analysis
 */
class AnalyseDagLatestRunTool {
    constructor(client) {
        this.client = client;
    }
    /**
     * Prepare invocation
     */
    async prepareInvocation(options, token) {
        const { dag_id } = options.input;
        return {
            invocationMessage: `Analyzing latest run for DAG '${dag_id}'...`
        };
    }
    /**
     * Execute comprehensive DAG run analysis
     */
    async invoke(options, token) {
        const { dag_id } = options.input;
        try {
            // Step 1: Get the latest DAG run
            const dagRun = await this.client.getLatestDagRun(dag_id);
            if (!dagRun) {
                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart(`ℹ️ No DAG run found for '${dag_id}'.`)
                ]);
            }
            // Step 2: Get task instances for this run
            const taskInstances = await this.client.getTaskInstances(dag_id, dagRun.dag_run_id);
            // Step 3: Get DAG source code
            let dagSourceCode = 'N/A';
            try {
                dagSourceCode = await this.client.getDagSource(dag_id);
            }
            catch (error) {
                dagSourceCode = `Failed to retrieve source code: ${error instanceof Error ? error.message : String(error)}`;
            }
            // Step 4: Get logs for each task (focusing on failed tasks first, then all)
            const taskLogs = [];
            // Sort tasks: failed first, then by execution order
            const sortedTasks = [...taskInstances].sort((a, b) => {
                const failedStates = ['failed', 'upstream_failed'];
                const aFailed = failedStates.includes(a.state);
                const bFailed = failedStates.includes(b.state);
                if (aFailed && !bFailed)
                    return -1;
                if (!aFailed && bFailed)
                    return 1;
                return 0;
            });
            // Get logs for up to 5 tasks (prioritizing failed tasks)
            const tasksToLog = sortedTasks.slice(0, 5);
            for (const task of tasksToLog) {
                try {
                    const log = await this.client.getTaskLog(dag_id, dagRun.dag_run_id, task.task_id, task.try_number?.toString() || '1');
                    taskLogs.push({
                        task_id: task.task_id,
                        state: task.state,
                        log: log
                    });
                }
                catch (error) {
                    taskLogs.push({
                        task_id: task.task_id,
                        state: task.state,
                        log: `Failed to retrieve log: ${error instanceof Error ? error.message : String(error)}`
                    });
                }
            }
            // Build comprehensive analysis report
            let report = this.buildAnalysisReport(dag_id, dagRun, taskInstances, dagSourceCode, taskLogs);
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(report)
            ]);
        }
        catch (error) {
            const errorMessage = `
❌ Failed to analyze DAG run

**Error:** ${error instanceof Error ? error.message : String(error)}

Please check:
- The DAG ID is correct
- The Airflow server is accessible
- You have the necessary permissions
            `.trim();
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(errorMessage)
            ]);
        }
    }
    /**
     * Build comprehensive analysis report
     */
    buildAnalysisReport(dagId, dagRun, taskInstances, dagSourceCode, taskLogs) {
        let report = `# 🔍 Comprehensive DAG Run Analysis\n\n`;
        report += `## DAG: ${dagId}\n\n`;
        report += `---\n\n`;
        // Section 1: DAG Run Overview
        report += `## 📊 DAG Run Overview\n\n`;
        report += `- **Run ID:** \`${dagRun.dag_run_id}\`\n`;
        report += `- **State:** ${this.getStatusEmoji(dagRun.state)} **${dagRun.state}**\n`;
        report += `- **Execution Date:** ${dagRun.execution_date}\n`;
        report += `- **Logical Date:** ${dagRun.logical_date}\n`;
        if (dagRun.start_date) {
            report += `- **Start Date:** ${dagRun.start_date}\n`;
        }
        if (dagRun.end_date) {
            report += `- **End Date:** ${dagRun.end_date}\n`;
            // Calculate duration
            const start = new Date(dagRun.start_date);
            const end = new Date(dagRun.end_date);
            const durationMs = end.getTime() - start.getTime();
            const durationSec = Math.floor(durationMs / 1000);
            const minutes = Math.floor(durationSec / 60);
            const seconds = durationSec % 60;
            report += `- **Duration:** ${minutes}m ${seconds}s\n`;
        }
        report += `\n---\n\n`;
        // Section 2: Task Instances Summary
        report += `## 📋 Task Instances (${taskInstances.length} tasks)\n\n`;
        // Group tasks by state
        const tasksByState = {};
        taskInstances.forEach((task) => {
            const state = task.state || 'unknown';
            if (!tasksByState[state]) {
                tasksByState[state] = [];
            }
            tasksByState[state].push(task);
        });
        // Display summary by state
        for (const [state, tasks] of Object.entries(tasksByState)) {
            report += `### ${this.getStatusEmoji(state)} ${state} (${tasks.length})\n`;
            tasks.forEach((task) => {
                report += `- **${task.task_id}**`;
                if (task.duration) {
                    report += ` - Duration: ${Math.round(task.duration)}s`;
                }
                if (task.start_date) {
                    report += ` - Started: ${task.start_date}`;
                }
                report += `\n`;
            });
            report += `\n`;
        }
        report += `---\n\n`;
        // Section 3: Task Logs Analysis
        if (taskLogs.length > 0) {
            report += `## 📝 Task Logs (Top ${taskLogs.length} tasks)\n\n`;
            taskLogs.forEach((taskLog, index) => {
                report += `### ${index + 1}. Task: ${taskLog.task_id} (${this.getStatusEmoji(taskLog.state)} ${taskLog.state})\n\n`;
                report += `\`\`\`\n${taskLog.log}\n\`\`\`\n\n`;
            });
            report += `---\n\n`;
        }
        // Section 4: DAG Source Code
        report += `## 💻 DAG Source Code\n\n`;
        report += `\`\`\`python\n${dagSourceCode}\n\`\`\`\n\n`;
        report += `---\n\n`;
        // Section 5: Raw Data
        report += `## 📦 Raw Data (JSON)\n\n`;
        report += `### DAG Run\n\`\`\`json\n${JSON.stringify(dagRun, null, 2)}\n\`\`\`\n\n`;
        report += `### Task Instances\n\`\`\`json\n${JSON.stringify(taskInstances, null, 2)}\n\`\`\`\n\n`;
        // Section 6: Analysis Prompt
        report += `---\n\n`;
        report += `## 🤖 Analysis Request\n\n`;
        report += `Please analyze the above information and provide:\n`;
        report += `1. **Summary of Execution:** What happened during this DAG run?\n`;
        report += `2. **Issues Identified:** What errors or problems occurred?\n`;
        report += `3. **Root Cause Analysis:** What likely caused any failures?\n`;
        report += `4. **Recommendations:** How can these issues be resolved?\n`;
        report += `5. **Code Review:** Any issues in the DAG code that need attention?\n`;
        return report;
    }
    /**
     * Helper to get emoji for task/run status
     */
    getStatusEmoji(status) {
        const statusMap = {
            'success': '✅',
            'failed': '❌',
            'running': '▶️',
            'queued': '⏳',
            'upstream_failed': '⚠️',
            'skipped': '⏭️',
            'up_for_retry': '🔄',
            'up_for_reschedule': '📅',
            'removed': '🗑️',
            'scheduled': '📆',
            'none': '⚪',
            'unknown': '❓'
        };
        return statusMap[status?.toLowerCase()] || '❓';
    }
}
exports.AnalyseDagLatestRunTool = AnalyseDagLatestRunTool;


/***/ }),
/* 63 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";

/**
 * GetDagHistoryTool - Language Model Tool for retrieving DAG run history
 *
 * This tool retrieves the run history for a specific DAG, optionally filtered by date.
 * Returns date of run, status, duration, and notes for each run.
 */
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.GetDagHistoryTool = void 0;
const vscode = __webpack_require__(1);
const ui = __webpack_require__(4);
/**
 * GetDagHistoryTool - Implements vscode.LanguageModelTool for retrieving DAG history
 */
class GetDagHistoryTool {
    constructor(client) {
        this.client = client;
    }
    /**
     * Prepare invocation - minimal for read-only operations
     */
    async prepareInvocation(options, token) {
        const { dag_id, date } = options.input;
        const dateStr = date || ui.toISODateString(new Date());
        return {
            invocationMessage: `Retrieving history for DAG '${dag_id}' (date: ${dateStr})`
        };
    }
    /**
     * Execute the query for DAG history
     */
    async invoke(options, token) {
        const { dag_id, date } = options.input;
        // Use today's date if not provided
        const queryDate = date || ui.toISODateString(new Date());
        try {
            // Get DAG run history from the API
            const result = await this.client.getDagRunHistory(dag_id, queryDate);
            if (!result || !result.dag_runs || result.dag_runs.length === 0) {
                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart(`ℹ️ No run history found for DAG '${dag_id}' on ${queryDate}.`)
                ]);
            }
            const runs = result.dag_runs;
            // Build detailed summary
            let summaryMessage = `## 📜 DAG Run History for '${dag_id}'\n\n`;
            summaryMessage += `**Date Filter:** ${queryDate}\n`;
            summaryMessage += `**Total Runs:** ${runs.length}\n\n`;
            summaryMessage += `---\n\n`;
            // Add individual run details in a table-like format
            summaryMessage += `| # | Date/Time | Status | Duration | Note |\n`;
            summaryMessage += `|---|-----------|--------|----------|------|\n`;
            runs.forEach((run, index) => {
                const runDate = run.execution_date || run.logical_date || 'N/A';
                const status = this.getStatusEmoji(run.state) + ' ' + (run.state || 'unknown');
                let duration = 'N/A';
                if (run.start_date && run.end_date) {
                    const start = new Date(run.start_date);
                    const end = new Date(run.end_date);
                    const durationMs = end.getTime() - start.getTime();
                    const durationSec = Math.floor(durationMs / 1000);
                    const minutes = Math.floor(durationSec / 60);
                    const seconds = durationSec % 60;
                    duration = `${minutes}m ${seconds}s`;
                }
                else if (run.start_date && !run.end_date) {
                    duration = '⏳ Running';
                }
                const note = run.note || '-';
                summaryMessage += `| ${index + 1} | ${runDate} | ${status} | ${duration} | ${note} |\n`;
            });
            summaryMessage += `\n---\n\n`;
            // Add detailed breakdown
            summaryMessage += `### Detailed Breakdown\n\n`;
            runs.forEach((run, index) => {
                summaryMessage += `#### ${index + 1}. Run ID: ${run.dag_run_id || run.run_id}\n\n`;
                summaryMessage += `- **Status:** ${this.getStatusEmoji(run.state)} ${run.state || 'unknown'}\n`;
                summaryMessage += `- **Execution Date:** ${run.execution_date || run.logical_date}\n`;
                summaryMessage += `- **Logical Date:** ${run.logical_date || run.execution_date}\n`;
                if (run.start_date) {
                    summaryMessage += `- **Start Date:** ${run.start_date}\n`;
                }
                if (run.end_date) {
                    summaryMessage += `- **End Date:** ${run.end_date}\n`;
                    const start = new Date(run.start_date);
                    const end = new Date(run.end_date);
                    const durationMs = end.getTime() - start.getTime();
                    const durationSec = Math.floor(durationMs / 1000);
                    const minutes = Math.floor(durationSec / 60);
                    const seconds = durationSec % 60;
                    summaryMessage += `- **Duration:** ${minutes}m ${seconds}s\n`;
                }
                if (run.note) {
                    summaryMessage += `- **Note:** ${run.note}\n`;
                }
                if (run.conf && Object.keys(run.conf).length > 0) {
                    summaryMessage += `- **Configuration:** \`${JSON.stringify(run.conf)}\`\n`;
                }
                summaryMessage += `\n`;
            });
            // Include raw JSON for LLM processing
            summaryMessage += `---\n\n**Raw Data (JSON):**\n\n`;
            summaryMessage += `\`\`\`json\n${JSON.stringify(runs, null, 2)}\n\`\`\`\n`;
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(summaryMessage)
            ]);
        }
        catch (error) {
            const errorMessage = `
❌ Failed to retrieve DAG history

**Error:** ${error instanceof Error ? error.message : String(error)}

Please check:
- The DAG ID is correct
- The date format is YYYY-MM-DD
- The Airflow server is accessible
- You have the necessary permissions
            `.trim();
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(errorMessage)
            ]);
        }
    }
    /**
     * Helper to get emoji for run status
     */
    getStatusEmoji(status) {
        const statusMap = {
            'success': '✅',
            'failed': '❌',
            'running': '▶️',
            'queued': '⏳',
            'upstream_failed': '⚠️',
            'skipped': '⏭️',
            'up_for_retry': '🔄',
            'up_for_reschedule': '📅',
            'removed': '🗑️',
            'scheduled': '📆'
        };
        return statusMap[status?.toLowerCase()] || '❓';
    }
}
exports.GetDagHistoryTool = GetDagHistoryTool;


/***/ }),
/* 64 */,
/* 65 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.AdminTreeView = void 0;
const vscode = __webpack_require__(1);
const AdminTreeItem_1 = __webpack_require__(66);
class AdminTreeView {
    constructor(context) {
        this.context = context;
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    }
    refresh() {
        this._onDidChangeTreeData.fire();
    }
    getTreeItem(element) {
        return element;
    }
    getChildren(element) {
        if (!element) {
            // Root level - return the three admin nodes
            return Promise.resolve([
                new AdminTreeItem_1.AdminTreeItem('Variables', vscode.TreeItemCollapsibleState.None, {
                    command: 'dagTreeView.viewVariables',
                    title: 'View Variables',
                    arguments: []
                }, new vscode.ThemeIcon('symbol-variable')),
                new AdminTreeItem_1.AdminTreeItem('Connections', vscode.TreeItemCollapsibleState.None, {
                    command: 'dagTreeView.viewConnections',
                    title: 'View Connections',
                    arguments: []
                }, new vscode.ThemeIcon('link')),
                new AdminTreeItem_1.AdminTreeItem('Providers', vscode.TreeItemCollapsibleState.None, {
                    command: 'dagTreeView.viewProviders',
                    title: 'View Providers',
                    arguments: []
                }, new vscode.ThemeIcon('package'))
            ]);
        }
        return Promise.resolve([]);
    }
}
exports.AdminTreeView = AdminTreeView;


/***/ }),
/* 66 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.AdminTreeItem = void 0;
const vscode = __webpack_require__(1);
class AdminTreeItem extends vscode.TreeItem {
    constructor(label, collapsibleState, command, iconPath) {
        super(label, collapsibleState);
        this.label = label;
        this.collapsibleState = collapsibleState;
        this.command = command;
        this.iconPath = iconPath;
        this.command = command;
        this.iconPath = iconPath;
    }
}
exports.AdminTreeItem = AdminTreeItem;


/***/ })
/******/ 	]);
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			id: moduleId,
/******/ 			loaded: false,
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Flag the module as loaded
/******/ 		module.loaded = true;
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = __webpack_modules__;
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/ensure chunk */
/******/ 	(() => {
/******/ 		__webpack_require__.f = {};
/******/ 		// This file contains only the entry chunk.
/******/ 		// The chunk loading function for additional chunks
/******/ 		__webpack_require__.e = (chunkId) => {
/******/ 			return Promise.all(Object.keys(__webpack_require__.f).reduce((promises, key) => {
/******/ 				__webpack_require__.f[key](chunkId, promises);
/******/ 				return promises;
/******/ 			}, []));
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/get javascript chunk filename */
/******/ 	(() => {
/******/ 		// This function allow to reference async chunks
/******/ 		__webpack_require__.u = (chunkId) => {
/******/ 			// return url for filenames based on template
/******/ 			return "" + chunkId + ".extension.js";
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/node module decorator */
/******/ 	(() => {
/******/ 		__webpack_require__.nmd = (module) => {
/******/ 			module.paths = [];
/******/ 			if (!module.children) module.children = [];
/******/ 			return module;
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/require chunk loading */
/******/ 	(() => {
/******/ 		// no baseURI
/******/ 		
/******/ 		// object to store loaded chunks
/******/ 		// "1" means "loaded", otherwise not loaded yet
/******/ 		var installedChunks = {
/******/ 			0: 1
/******/ 		};
/******/ 		
/******/ 		// no on chunks loaded
/******/ 		
/******/ 		var installChunk = (chunk) => {
/******/ 			var moreModules = chunk.modules, chunkIds = chunk.ids, runtime = chunk.runtime;
/******/ 			for(var moduleId in moreModules) {
/******/ 				if(__webpack_require__.o(moreModules, moduleId)) {
/******/ 					__webpack_require__.m[moduleId] = moreModules[moduleId];
/******/ 				}
/******/ 			}
/******/ 			if(runtime) runtime(__webpack_require__);
/******/ 			for(var i = 0; i < chunkIds.length; i++)
/******/ 				installedChunks[chunkIds[i]] = 1;
/******/ 		
/******/ 		};
/******/ 		
/******/ 		// require() chunk loading for javascript
/******/ 		__webpack_require__.f.require = (chunkId, promises) => {
/******/ 			// "1" is the signal for "already loaded"
/******/ 			if(!installedChunks[chunkId]) {
/******/ 				if(true) { // all chunks have JS
/******/ 					var installedChunk = require("./" + __webpack_require__.u(chunkId));
/******/ 					if (!installedChunks[chunkId]) {
/******/ 						installChunk(installedChunk);
/******/ 					}
/******/ 				} else installedChunks[chunkId] = 1;
/******/ 			}
/******/ 		};
/******/ 		
/******/ 		// no external install chunk
/******/ 		
/******/ 		// no HMR
/******/ 		
/******/ 		// no HMR manifest
/******/ 	})();
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry needs to be wrapped in an IIFE because it needs to be in strict mode.
(() => {
"use strict";
var exports = __webpack_exports__;

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.activate = activate;
exports.deactivate = deactivate;
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = __webpack_require__(1);
const DagTreeView_1 = __webpack_require__(2);
const AdminTreeView_1 = __webpack_require__(65);
const ui = __webpack_require__(4);
const AirflowClientAdapter_1 = __webpack_require__(53);
const TriggerDagRunTool_1 = __webpack_require__(54);
const GetFailedRunsTool_1 = __webpack_require__(55);
const ListActiveDagsTool_1 = __webpack_require__(56);
const ListPausedDagsTool_1 = __webpack_require__(57);
const PauseDagTool_1 = __webpack_require__(58);
const UnpauseDagTool_1 = __webpack_require__(59);
const GetDagRunsTool_1 = __webpack_require__(60);
const StopDagRunTool_1 = __webpack_require__(61);
const AnalyseDagLatestRunTool_1 = __webpack_require__(62);
const GetDagHistoryTool_1 = __webpack_require__(63);
// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
function activate(context) {
    ui.logToOutput('Extension activation started');
    let dagTreeView = new DagTreeView_1.DagTreeView(context);
    let adminTreeView = new AdminTreeView_1.AdminTreeView(context);
    // Register the Admin Tree View
    vscode.window.registerTreeDataProvider('adminTreeView', adminTreeView);
    ui.logToOutput('Admin Tree View registered');
    // register commands and keep disposables so they are cleaned up on deactivate
    const commands = [];
    commands.push(vscode.commands.registerCommand('dagTreeView.refreshServer', () => { dagTreeView.refresh(); }));
    commands.push(vscode.commands.registerCommand('dagTreeView.addServer', () => { dagTreeView.addServer(); }));
    commands.push(vscode.commands.registerCommand('dagTreeView.removeServer', () => { dagTreeView.removeServer(); }));
    commands.push(vscode.commands.registerCommand('dagTreeView.connectServer', () => { dagTreeView.connectServer(); }));
    commands.push(vscode.commands.registerCommand('dagTreeView.clearServers', () => { dagTreeView.clearServers(); }));
    commands.push(vscode.commands.registerCommand('dagTreeView.filter', () => { dagTreeView.filter(); }));
    commands.push(vscode.commands.registerCommand('dagTreeView.showOnlyActive', () => { dagTreeView.showOnlyActive(); }));
    commands.push(vscode.commands.registerCommand('dagTreeView.showOnlyFavorite', () => { dagTreeView.showOnlyFavorite(); }));
    commands.push(vscode.commands.registerCommand('dagTreeView.viewDagView', (node) => { dagTreeView.viewDagView(node); }));
    commands.push(vscode.commands.registerCommand('dagTreeView.triggerDag', (node) => { dagTreeView.triggerDag(node); }));
    commands.push(vscode.commands.registerCommand('dagTreeView.triggerDagWithConfig', (node) => { dagTreeView.triggerDagWConfig(node); }));
    commands.push(vscode.commands.registerCommand('dagTreeView.checkDagRunState', (node) => { dagTreeView.checkDagRunState(node); }));
    commands.push(vscode.commands.registerCommand('dagTreeView.checkAllDagsRunState', () => { dagTreeView.checkAllDagsRunState(); }));
    commands.push(vscode.commands.registerCommand('dagTreeView.pauseDAG', (node) => { dagTreeView.pauseDAG(node); }));
    commands.push(vscode.commands.registerCommand('dagTreeView.unPauseDAG', (node) => { dagTreeView.unPauseDAG(node); }));
    commands.push(vscode.commands.registerCommand('dagTreeView.lastDAGRunLog', (node) => { dagTreeView.lastDAGRunLog(node); }));
    commands.push(vscode.commands.registerCommand('dagTreeView.dagSourceCode', (node) => { dagTreeView.dagSourceCode(node); }));
    commands.push(vscode.commands.registerCommand('dagTreeView.showDagInfo', (node) => { dagTreeView.showDagInfo(node); }));
    commands.push(vscode.commands.registerCommand('dagTreeView.addToFavDAG', (node) => { dagTreeView.addToFavDAG(node); }));
    commands.push(vscode.commands.registerCommand('dagTreeView.deleteFromFavDAG', (node) => { dagTreeView.deleteFromFavDAG(node); }));
    commands.push(vscode.commands.registerCommand('dagTreeView.showDagView', (node) => { dagTreeView.viewDagView(node); }));
    commands.push(vscode.commands.registerCommand('dagTreeView.viewConnections', () => { dagTreeView.viewConnections(); }));
    commands.push(vscode.commands.registerCommand('dagTreeView.viewVariables', () => { dagTreeView.viewVariables(); }));
    commands.push(vscode.commands.registerCommand('dagTreeView.viewProviders', () => { dagTreeView.viewProviders(); }));
    commands.push(vscode.commands.registerCommand('dagTreeView.viewDagRuns', () => { dagTreeView.viewDagRuns(); }));
    commands.push(vscode.commands.registerCommand('dagTreeView.AskAI', (node) => { dagTreeView.askAI(node); }));
    const participant = vscode.chat.createChatParticipant('airflow-ext.participant', dagTreeView.aIHandler.bind(dagTreeView));
    participant.iconPath = vscode.Uri.joinPath(context.extensionUri, 'media', 'airflow-extension-logo.png');
    context.subscriptions.push(participant);
    // Register Language Model Tools for AI-powered control, monitoring, and debugging
    ui.logToOutput('Registering Language Model Tools...');
    // Initialize the API adapter (uses DagTreeView.Current.api dynamically)
    const airflowClient = new AirflowClientAdapter_1.AirflowClientAdapter();
    // Register Tool 1: trigger_dag_run (Control)
    const triggerDagRunTool = vscode.lm.registerTool('trigger_dag_run', new TriggerDagRunTool_1.TriggerDagRunTool(airflowClient));
    context.subscriptions.push(triggerDagRunTool);
    ui.logToOutput('Registered tool: trigger_dag_run');
    // Register Tool 2: get_failed_runs (Monitoring)
    const getFailedRunsTool = vscode.lm.registerTool('get_failed_runs', new GetFailedRunsTool_1.GetFailedRunsTool(airflowClient));
    context.subscriptions.push(getFailedRunsTool);
    ui.logToOutput('Registered tool: get_failed_runs');
    // Register Tool 4: list_active_dags (Monitoring)
    const listActiveDagsTool = vscode.lm.registerTool('list_active_dags', new ListActiveDagsTool_1.ListActiveDagsTool(airflowClient));
    context.subscriptions.push(listActiveDagsTool);
    ui.logToOutput('Registered tool: list_active_dags');
    // Register Tool 5: list_paused_dags (Monitoring)
    const listPausedDagsTool = vscode.lm.registerTool('list_paused_dags', new ListPausedDagsTool_1.ListPausedDagsTool(airflowClient));
    context.subscriptions.push(listPausedDagsTool);
    ui.logToOutput('Registered tool: list_paused_dags');
    // Register Tool 6: pause_dag (Control)
    const pauseDagTool = vscode.lm.registerTool('pause_dag', new PauseDagTool_1.PauseDagTool(airflowClient));
    context.subscriptions.push(pauseDagTool);
    ui.logToOutput('Registered tool: pause_dag');
    // Register Tool 7: unpause_dag (Control)
    const unpauseDagTool = vscode.lm.registerTool('unpause_dag', new UnpauseDagTool_1.UnpauseDagTool(airflowClient));
    context.subscriptions.push(unpauseDagTool);
    ui.logToOutput('Registered tool: unpause_dag');
    // Register Tool 8: get_dag_runs (Monitoring)
    const getDagRunsTool = vscode.lm.registerTool('get_dag_runs', new GetDagRunsTool_1.GetDagRunsTool(airflowClient));
    context.subscriptions.push(getDagRunsTool);
    ui.logToOutput('Registered tool: get_dag_runs');
    // Register Tool 9: stop_dag_run (Control)
    const stopDagRunTool = vscode.lm.registerTool('stop_dag_run', new StopDagRunTool_1.StopDagRunTool(airflowClient));
    context.subscriptions.push(stopDagRunTool);
    ui.logToOutput('Registered tool: stop_dag_run');
    // Register Tool 10: analyse_dag_latest_run (Analysis)
    const analyseDagLatestRunTool = vscode.lm.registerTool('analyse_dag_latest_run', new AnalyseDagLatestRunTool_1.AnalyseDagLatestRunTool(airflowClient));
    context.subscriptions.push(analyseDagLatestRunTool);
    ui.logToOutput('Registered tool: analyse_dag_latest_run');
    // Register Tool 11: get_dag_history (Monitoring)
    const getDagHistoryTool = vscode.lm.registerTool('get_dag_history', new GetDagHistoryTool_1.GetDagHistoryTool(airflowClient));
    context.subscriptions.push(getDagHistoryTool);
    ui.logToOutput('Registered tool: get_dag_history');
    ui.logToOutput('All Language Model Tools registered successfully');
    for (const c of commands) {
        context.subscriptions.push(c);
    }
    ui.logToOutput('Extension activation completed');
}
// this method is called when your extension is deactivated
function deactivate() {
    ui.logToOutput('Extension is now deactive!');
}

})();

module.exports = __webpack_exports__;
/******/ })()
;
//# sourceMappingURL=extension.js.map