import { AskAIContext } from '../common/Types';
import { Session } from '../common/Session';
import * as vscode from 'vscode';
import * as ui from '../common/UI';
import { AirflowClientAdapter } from './AirflowClientAdapter';
import { TriggerDagRunTool } from './TriggerDagRunTool';
import { GetFailedRunsTool } from './GetFailedRunsTool';
import { ListActiveDagsTool } from './ListActiveDagsTool';
import { ListPausedDagsTool } from './ListPausedDagsTool';
import { GetRunningDagsTool } from './GetRunningDagsTool';
import { PauseDagTool } from './PauseDagTool';
import { UnpauseDagTool } from './UnpauseDagTool';
import { GetDagRunsTool } from './GetDagRunsTool';
import { CancelDagRunTool } from './CancelDagRunTool';
import { AnalyseDagLatestRunTool } from './AnalyseDagLatestRunTool';
import { GetDagHistoryTool } from './GetDagHistoryTool';
import { GetDagRunDetailTool } from './GetDagRunDetailTool';
import { GetTodayTool } from './GetTodayTool';
import { GetDagSourceCodeTool } from './GetDagSourceCodeTool';
import { GoToDagViewTool } from './GoToDagViewTool';
import { GoToDagLogViewTool } from './GoToDagLogViewTool';
import { GoToDagRunHistoryTool } from './GoToDagRunHistoryTool';
import { GoToProvidersViewTool } from './GoToProvidersViewTool';
import { GoToConnectionsViewTool } from './GoToConnectionsViewTool';
import { GoToVariablesViewTool } from './GoToVariablesViewTool';
import { GoToConfigsViewTool } from './GoToConfigsViewTool';
import { GoToPluginsViewTool } from './GoToPluginsViewTool';
import { GoToServerHealthViewTool } from './GoToServerHealthViewTool';
import { Telemetry } from '../common/Telemetry';
import * as skills from '../common/Skills';

export class AIHandler 
{
    public static Current: AIHandler;

    public askAIContext: AskAIContext | undefined;
    public currentDagId: string | undefined;

    constructor() {
        AIHandler.Current = this;
        Telemetry.Current.send('AIHandler.Initialized');
    }

    public async aIHandler (request: vscode.ChatRequest, context: vscode.ChatContext, stream: vscode.ChatResponseStream, token: vscode.CancellationToken) : Promise<void>
    {
        ui.logToOutput('AIHandler.aIHandler Started');
        Telemetry.Current.send('AIHandler.aIHandler.Started');

        const aiContext = AIHandler.Current?.askAIContext;
        
        // 1. Define the tools we want to expose to the model
        // These must match the definitions in package.json
        const tools: vscode.LanguageModelChatTool[] = [
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
                name: 'get_running_dags',
                description: 'Lists all Airflow DAGs that currently have running or queued DAG runs. Use this when asked about running, executing, or in-progress DAGs. Returns DAG IDs with run states and run IDs.',
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
                        dagId: { type: 'string', description: 'The unique identifier (ID) of the DAG to pause' }
                    },
                    required: ['dagId']
                }
            },
            {
                name: 'unpause_dag',
                description: 'Unpauses (activates) a specific Airflow DAG. Required input: dag_id (string).',
                inputSchema: {
                    type: 'object',
                    properties: {
                        dagId: { type: 'string', description: 'The unique identifier (ID) of the DAG to unpause' }
                    },
                    required: ['dagId']
                }
            },
            {
                name: 'trigger_dag_run',
                description: 'Triggers a DAG run. Inputs: dag_id (string), config_json (string, optional), date (string, optional).',
                inputSchema: {
                    type: 'object',
                    properties: {
                        dagId: { type: 'string', description: 'The DAG ID' },
                        configJson: { type: 'string', description: 'JSON configuration or file path' },
                        date: { type: 'string', description: 'Logical date in ISO 8601 format' }
                    },
                    required: ['dagId']
                }
            },
            {
                name: 'get_failed_runs',
                description: 'Gets failed DAG runs. Inputs: time_range_hours (number), dag_id_filter (string).',
                inputSchema: {
                    type: 'object',
                    properties: {
                        timeRangeHours: { type: 'number' },
                        dagIdFilter: { type: 'string' }
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
                        dagId: { type: 'string', description: 'The DAG ID' },
                        date: { type: 'string', description: 'Optional date filter YYYY-MM-DD' }
                    },
                    required: ['dagId']
                }
            },
            {
                name: 'get_dag_history',
                description: 'Retrieves DAG run history for a given date (defaults to today). Returns date/time, status, duration, note.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        dagId: { type: 'string', description: 'The DAG ID' },
                        date: { type: 'string', description: 'Optional date filter YYYY-MM-DD' }
                    },
                    required: ['dagId']
                }
            },
            {
                name: 'cancel_dag_run',
                description: 'Cancels the currently running DAG run for the given DAG. Required: dag_id.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        dagId: { type: 'string', description: 'The DAG ID' }
                    },
                    required: ['dagId']
                }
            },
            {
                name: 'analyse_dag_latest_run',
                description: 'Comprehensive analysis of the latest DAG run including tasks, source code, and logs. Required: dag_id.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        dagId: { type: 'string', description: 'The DAG ID' }
                    },
                    required: ['dagId']
                }
            },
            {
                name: 'get_dag_run_detail',
                description: 'Comprehensive analysis of a specific DAG run by run ID. Analyzes tasks, source code, and logs for the specified run. Required: dag_id, dag_run_id.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        dagId: { type: 'string', description: 'The DAG ID' },
                        dagRunId: { type: 'string', description: 'The DAG run ID to analyze' }
                    },
                    required: ['dagId', 'dagRunId']
                }
            },
            {
                name: 'get_today',
                description: 'Returns the current system date in multiple formats. Use when asked about today\'s date or current date. Helpful for date filtering operations. No inputs required.',
                inputSchema: {
                    type: 'object',
                    properties: {},
                    required: []
                }
            },
            {
                name: 'get_dag_source_code',
                description: 'Retrieves the Python source code for a specific DAG. Use when the user wants to see or analyze the DAG implementation. Required: dag_id.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        dagId: { type: 'string', description: 'The DAG ID to get source code for' }
                    },
                    required: ['dagId']
                }
            },
            {
                name: 'go_to_dag_view',
                description: 'Opens the DAG View panel to display information about a specific DAG. Optional: provide dag_run_id to view a specific run. Required: dag_id.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        dagId: { type: 'string', description: 'The DAG ID to view' },
                        dagRunId: { type: 'string', description: 'Optional DAG run ID to navigate to a specific run' }
                    },
                    required: ['dagId']
                }
            },
            {
                name: 'go_to_dag_log_view',
                description: 'Opens the DAG Log View panel to display task logs for a specific Airflow DAG. Required: dag_id. Optional: dag_run_id, task_id, try_number.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        dagId: { type: 'string', description: 'The DAG ID' },
                        dagRunId: { type: 'string', description: 'Optional: The DAG run ID' },
                        taskId: { type: 'string', description: 'Optional: The Task ID' },
                        tryNumber: { type: 'number', description: 'Optional: The try number' }
                    },
                    required: ['dagId']
                }
            },
            {
                name: 'go_to_dag_run_history',
                description: 'Opens the DAG Run History panel with optional filters. Shows run history for a DAG with optional date range and status filters. Required: dag_id.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        dagId: { type: 'string', description: 'The DAG ID to view history for' },
                        startDate: { type: 'string', description: 'Optional start date filter (YYYY-MM-DD format)' },
                        endDate: { type: 'string', description: 'Optional end date filter (YYYY-MM-DD format)' },
                        status: { type: 'string', description: 'Optional status filter (success, failed, running, queued, upstream_failed)' }
                    },
                    required: ['dagId']
                }
            },
            {
                name: 'go_to_providers_view',
                description: 'Opens the Providers View panel to display installed Airflow providers. No inputs required.',
                inputSchema: {
                    type: 'object',
                    properties: {},
                    required: []
                }
            },
            {
                name: 'go_to_connections_view',
                description: 'Opens the Connections View panel to display Airflow connections. No inputs required.',
                inputSchema: {
                    type: 'object',
                    properties: {},
                    required: []
                }
            },
            {
                name: 'go_to_variables_view',
                description: 'Opens the Variables View panel to display Airflow variables. No inputs required.',
                inputSchema: {
                    type: 'object',
                    properties: {},
                    required: []
                }
            },
            {
                name: 'go_to_configs_view',
                description: 'Opens the Configs View panel to display Airflow configuration settings. No inputs required.',
                inputSchema: {
                    type: 'object',
                    properties: {},
                    required: []
                }
            },
            {
                name: 'go_to_plugins_view',
                description: 'Opens the Plugins View panel to display installed Airflow plugins. No inputs required.',
                inputSchema: {
                    type: 'object',
                    properties: {},
                    required: []
                }
            },
            {
                name: 'go_to_server_health_view',
                description: 'Opens the Server Health View panel to display Airflow server health status. No inputs required.',
                inputSchema: {
                    type: 'object',
                    properties: {},
                    required: []
                }
            }
        ];

        // 2. Construct the Initial Messages
        const messages: vscode.LanguageModelChatMessage[] = [
            vscode.LanguageModelChatMessage.User(`You are an expert in Apache Airflow. You have access to tools to manage DAGs, view logs, and check status. Use them when appropriate.`),
            vscode.LanguageModelChatMessage.User(`Don't provide JSON responses unless specifically asked. Always format your responses in markdown.`)
        ];

        // Loop through the latest 6 entries from context.history (only previous @aws interactions)
        const recentHistory = context.history.slice(-6);
        for (const turn of recentHistory) {
            if (turn instanceof vscode.ChatRequestTurn) {
                messages.push(vscode.LanguageModelChatMessage.User(turn.prompt));
                continue;
            }

            if (turn instanceof vscode.ChatResponseTurn) {
                const responseContent = turn.response
                .filter((part): part is vscode.ChatResponseMarkdownPart => part instanceof vscode.ChatResponseMarkdownPart)
                .map((part: vscode.ChatResponseMarkdownPart) => part.value.value)
                .join('\n');

                if (responseContent) {
                messages.push(vscode.LanguageModelChatMessage.Assistant(responseContent));
                }
            }
        }

        // Add context if available
        if (aiContext) {
            messages.push(vscode.LanguageModelChatMessage.User(`Context:\nDAG: ${aiContext.dag || 'N/A'}\nLogs: ${aiContext.logs || 'N/A'}\nCode: ${aiContext.code || 'N/A'}`));
        }

        if (this.currentDagId) {
            messages.push(vscode.LanguageModelChatMessage.User(`Current DAG ID in focus: ${this.currentDagId}`));
        }

        messages.push(vscode.LanguageModelChatMessage.User(request.prompt));

        // Check if user is expressing appreciation
        const usedAppreciated = request.prompt.toLowerCase().includes('thank');

        // 3. Select Model and Send Request
        try {
            //TODO: Make model configurable
            // const [model] = await vscode.lm.selectChatModels( {id: "claude-sonnet-4.5"} );
            let model = request.model;
            if (request.model.id.includes('auto')) {
                const models = await vscode.lm.selectChatModels({ vendor: model.vendor, family: model.family });
                if (models.length > 0)
                {
                    model = models[0];
                    ui.logToOutput(`Auto-selected model: ${model.name} (${model.id})`);
                }
                else
                {
                    ui.logToOutput(`No models found for vendor: ${model.vendor}, family: ${model.family}`);
                    model = undefined;
                }
            }

            ui.logToOutput(`Selected AI Family: ${model?.family || 'None'}, Name: ${model?.name || 'None'}`);
            Telemetry.Current.send('AIHandler.aIHandler.ModelSelected', { modelId: model?.id || 'None' });
            if (!model) {
                stream.markdown("No suitable AI model found.");
                return;
            }

            // Tool calling loop
            let keepGoing = true;
            while (keepGoing && !token.isCancellationRequested) {
                keepGoing = false; // Default to stop unless we get a tool call

                const chatResponse = await model.sendRequest(messages, { tools }, token);
                let toolCalls: vscode.LanguageModelToolCallPart[] = [];

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
                        stream.progress(`Calling: ${toolCall.name}`);
                        ui.logToOutput(`AI requested tool: ${toolCall.name} with input: ${JSON.stringify(toolCall.input)}`);
                        Telemetry.Current.send('AIHandler.aIHandler.ToolCalled', { toolName: toolCall.name, toolInput: JSON.stringify(toolCall.input) });
                        
                        try {
                            // Invoke the tool using VS Code LM API
                            const result = await vscode.lm.invokeTool(
                                toolCall.name, 
                                { input: toolCall.input } as any, 
                                token
                            );
                            
                            // Convert result to string/text part
                            const resultText = result.content
                                .filter(part => part instanceof vscode.LanguageModelTextPart)
                                .map(part => (part as vscode.LanguageModelTextPart).value)
                                .join('\n');
                            
                            // Add result to history
                            messages.push(vscode.LanguageModelChatMessage.User([
                                new vscode.LanguageModelToolResultPart(toolCall.callId, [new vscode.LanguageModelTextPart(resultText)])
                            ]));

                        } catch (err) {
                            Telemetry.Current.send('AIHandler.aIHandler.ToolCallFailed', { toolName: toolCall.name, error: err instanceof Error ? err.message : String(err) });
                            const errorMessage = `Tool execution failed: ${err instanceof Error ? err.message : String(err)}`;
                            messages.push(vscode.LanguageModelChatMessage.User([
                                new vscode.LanguageModelToolResultPart(toolCall.callId, [new vscode.LanguageModelTextPart(errorMessage)])
                            ]));
                        }
                    }
                }
            }

            if(Session.Current?.HasWorkspaceFolder && !skills.AreSkillsInstalled()) {
                stream.markdown("\n\n\n");
                const vscodeMarkdownLink = new vscode.MarkdownString(
                    `🤖 [Install Airflow Skills](command:airflow-ext.installAirflowSkills) for the best experience`
                );
                vscodeMarkdownLink.isTrusted = {
                    enabledCommands: ['airflow-ext.installAirflowSkills']
                };
                stream.markdown(vscodeMarkdownLink);
            }

            // Final appreciation message
            if (usedAppreciated) {
                stream.markdown("\n\n\n")
                stream.markdown("\n🙏 [Donate](https://github.com/sponsors/necatiarslan) if you found me useful!");
                stream.markdown("\n🤔 Request a [New Feature](https://github.com/necatiarslan/airflow-vscode-extension/issues/new)");
                stream.markdown("\n🗳️ Attend [Survey](https://bit.ly/airflow-extension-survey) to help me get better. ");
            }

        } catch (err) {
            ui.logToOutput(`AIHandler.aIHandler Error: ${err instanceof Error ? err.message : String(err)}`);
            Telemetry.Current.send('AIHandler.aIHandler.Error', { error: err instanceof Error ? err.message : String(err) });
            if (err instanceof Error) {
                stream.markdown(`I'm sorry, I couldn't connect to the AI model: ${err.message}`);
            } else {
                stream.markdown("I'm sorry, I couldn't connect to the AI model.");
            }
            stream.markdown("\n🪲 Please [Report Bug](https://github.com/necatiarslan/airflow-vscode-extension/issues/new)");

        }
    };

    public async isChatCommandAvailable(): Promise<boolean> {
        const commands = await vscode.commands.getCommands(true); // 'true' includes internal commands
        return commands.includes('workbench.action.chat.open');
    }

    public async askAI(dagId: string, fileToken: string) {
        ui.logToOutput('AIHandler.askAI Started');
        Telemetry.Current.send('AIHandler.askAI.Started');
        if (!Session.Current.Api) { return; }
        if (!await this.isChatCommandAvailable()) {
            ui.showErrorMessage('Chat command is not available. Please ensure you have access to VS Code AI features.');
            return;
        }

        let dagSourceCode = '';
        let latestDagLogs = '';

        // Fetch DAG Source Code
        const sourceResult = await Session.Current.Api.getSourceCode(dagId, fileToken);
        if (sourceResult.isSuccessful) {
            dagSourceCode = sourceResult.result;
        } else {
            ui.showErrorMessage('Failed to fetch DAG source code for AI analysis.');
            return;
        }

        // Fetch Latest DAG Run Logs
        const logResult = await Session.Current.Api.getLastDagRunLogText(dagId);
        if (logResult.isSuccessful) {
            latestDagLogs = logResult.result;
        } else {
            ui.showErrorMessage('Failed to fetch latest DAG run logs for AI analysis.');
            return;
        }

        await this.askAIWithContext({ code: dagSourceCode, logs: latestDagLogs, dag: dagId, dagRun: null, tasks: null, taskInstances: null });
    }

    public async askAIWithContext(askAIContext: AskAIContext) {
        this.askAIContext = askAIContext;

        const appName = vscode.env.appName;
        let commandId = '';
        if (appName.includes('Antigravity')) {
            // Antigravity replaces the Chat with an Agent workflow.
            // We must use the Agent Manager command instead.
            // **REPLACE WITH THE ACTUAL ANTIGRAVITY AGENT COMMAND ID**
            commandId = 'antigravity.startAgentTask';

        } else if (appName.includes('Code - OSS') || appName.includes('Visual Studio Code')) {
            // This is standard VS Code or VSCodium. Check for the legacy Chat command.
            commandId = 'workbench.action.chat.open';

        } else {
            // Unknown environment, default to checking if the command exists at all.
            commandId = 'workbench.action.chat.open';
        }

        await vscode.commands.executeCommand(commandId, {
            query: '@airflow Analyze the current logs'
        });
    }

    public registerChatParticipant(){
        const participant = vscode.chat.createChatParticipant('airflow-ext.participant', AIHandler.Current.aIHandler.bind(AIHandler.Current));
        participant.iconPath = vscode.Uri.joinPath(Session.Current.Context.extensionUri, 'media', 'ai-assistant-logo.png');
        Session.Current.Context.subscriptions.push(participant);
    }

    public registerAiTools(){
        // Register Language Model Tools for AI-powered control, monitoring, and debugging
        ui.logToOutput('Registering Language Model Tools...');
        
        // Initialize the API adapter (uses DagTreeView.Current.api dynamically)
        const airflowClient = new AirflowClientAdapter();
        const context = Session.Current.Context;

        // Register Tool 1: trigger_dag_run (Control)
        const triggerDagRunTool = vscode.lm.registerTool(
            'trigger_dag_run',
            new TriggerDagRunTool(airflowClient)
        );
        context.subscriptions.push(triggerDagRunTool);
        ui.logToOutput('Registered tool: trigger_dag_run');

        // Register Tool 2: get_failed_runs (Monitoring)
        const getFailedRunsTool = vscode.lm.registerTool(
            'get_failed_runs',
            new GetFailedRunsTool(airflowClient)
        );
        context.subscriptions.push(getFailedRunsTool);
        ui.logToOutput('Registered tool: get_failed_runs');

        // Register Tool 4: list_active_dags (Monitoring)
        const listActiveDagsTool = vscode.lm.registerTool(
            'list_active_dags',
            new ListActiveDagsTool(airflowClient)
        );
        context.subscriptions.push(listActiveDagsTool);
        ui.logToOutput('Registered tool: list_active_dags');

        // Register Tool 5: list_paused_dags (Monitoring)
        const listPausedDagsTool = vscode.lm.registerTool(
            'list_paused_dags',
            new ListPausedDagsTool(airflowClient)
        );
        context.subscriptions.push(listPausedDagsTool);
        ui.logToOutput('Registered tool: list_paused_dags');

        // Register Tool 6: get_running_dags (Monitoring)
        const getRunningDagsTool = vscode.lm.registerTool(
            'get_running_dags',
            new GetRunningDagsTool(airflowClient)
        );
        context.subscriptions.push(getRunningDagsTool);
        ui.logToOutput('Registered tool: get_running_dags');

        // Register Tool 7: pause_dag (Control)
        const pauseDagTool = vscode.lm.registerTool(
            'pause_dag',
            new PauseDagTool(airflowClient)
        );
        context.subscriptions.push(pauseDagTool);
        ui.logToOutput('Registered tool: pause_dag');

        // Register Tool 8: unpause_dag (Control)
        const unpauseDagTool = vscode.lm.registerTool(
            'unpause_dag',
            new UnpauseDagTool(airflowClient)
        );
        context.subscriptions.push(unpauseDagTool);
        ui.logToOutput('Registered tool: unpause_dag');

        // Register Tool 9: get_dag_runs (Monitoring)
        const getDagRunsTool = vscode.lm.registerTool(
            'get_dag_runs',
            new GetDagRunsTool(airflowClient)
        );
        context.subscriptions.push(getDagRunsTool);
        ui.logToOutput('Registered tool: get_dag_runs');

        // Register Tool 10: cancel_dag_run (Control)
        const cancelDagRunTool = vscode.lm.registerTool(
            'cancel_dag_run',
            new CancelDagRunTool(airflowClient)
        );
        context.subscriptions.push(cancelDagRunTool);
        ui.logToOutput('Registered tool: cancel_dag_run');

        // Register Tool 11: analyse_dag_latest_run (Analysis)
        const analyseDagLatestRunTool = vscode.lm.registerTool(
            'analyse_dag_latest_run',
            new AnalyseDagLatestRunTool(airflowClient)
        );
        context.subscriptions.push(analyseDagLatestRunTool);
        ui.logToOutput('Registered tool: analyse_dag_latest_run');

        // Register Tool 12: get_dag_history (Monitoring)
        const getDagHistoryTool = vscode.lm.registerTool(
            'get_dag_history',
            new GetDagHistoryTool(airflowClient)
        );
        context.subscriptions.push(getDagHistoryTool);
        ui.logToOutput('Registered tool: get_dag_history');

        // Register Tool 13: get_dag_run_detail (Analysis)
        const getDagRunDetailTool = vscode.lm.registerTool(
            'get_dag_run_detail',
            new GetDagRunDetailTool(airflowClient)
        );
        context.subscriptions.push(getDagRunDetailTool);
        ui.logToOutput('Registered tool: get_dag_run_detail');

        // Register Tool 14: get_today (Utility)
        const getTodayTool = vscode.lm.registerTool(
            'get_today',
            new GetTodayTool()
        );
        context.subscriptions.push(getTodayTool);
        ui.logToOutput('Registered tool: get_today');

        // Register Tool 15: get_dag_source_code (Analysis)
        const getDagSourceCodeTool = vscode.lm.registerTool(
            'get_dag_source_code',
            new GetDagSourceCodeTool(airflowClient)
        );
        context.subscriptions.push(getDagSourceCodeTool);
        ui.logToOutput('Registered tool: get_dag_source_code');

        // Register Tool 16: go_to_dag_view (Navigation)
        const goToDagViewTool = vscode.lm.registerTool(
            'go_to_dag_view',
            new GoToDagViewTool()
        );
        context.subscriptions.push(goToDagViewTool);
        ui.logToOutput('Registered tool: go_to_dag_view');

        // Register Tool 17: go_to_dag_log_view (Navigation)
        const goToDagLogViewTool = vscode.lm.registerTool(
            'go_to_dag_log_view',
            new GoToDagLogViewTool()
        );
        context.subscriptions.push(goToDagLogViewTool);
        ui.logToOutput('Registered tool: go_to_dag_log_view');

        // Register Tool 18: go_to_dag_run_history (Navigation)
        const goToDagRunHistoryTool = vscode.lm.registerTool(
            'go_to_dag_run_history',
            new GoToDagRunHistoryTool()
        );
        context.subscriptions.push(goToDagRunHistoryTool);
        ui.logToOutput('Registered tool: go_to_dag_run_history');

        // Register Tool 19: go_to_providers_view (Navigation)
        const goToProvidersViewTool = vscode.lm.registerTool(
            'go_to_providers_view',
            new GoToProvidersViewTool()
        );
        context.subscriptions.push(goToProvidersViewTool);
        ui.logToOutput('Registered tool: go_to_providers_view');

        // Register Tool 20: go_to_connections_view (Navigation)
        const goToConnectionsViewTool = vscode.lm.registerTool(
            'go_to_connections_view',
            new GoToConnectionsViewTool()
        );
        context.subscriptions.push(goToConnectionsViewTool);
        ui.logToOutput('Registered tool: go_to_connections_view');

        // Register Tool 21: go_to_variables_view (Navigation)
        const goToVariablesViewTool = vscode.lm.registerTool(
            'go_to_variables_view',
            new GoToVariablesViewTool()
        );
        context.subscriptions.push(goToVariablesViewTool);
        ui.logToOutput('Registered tool: go_to_variables_view');

        // Register Tool 22: go_to_configs_view (Navigation)
        const goToConfigsViewTool = vscode.lm.registerTool(
            'go_to_configs_view',
            new GoToConfigsViewTool()
        );
        context.subscriptions.push(goToConfigsViewTool);
        ui.logToOutput('Registered tool: go_to_configs_view');

        // Register Tool 23: go_to_plugins_view (Navigation)
        const goToPluginsViewTool = vscode.lm.registerTool(
            'go_to_plugins_view',
            new GoToPluginsViewTool()
        );
        context.subscriptions.push(goToPluginsViewTool);
        ui.logToOutput('Registered tool: go_to_plugins_view');

        // Register Tool 24: go_to_server_health_view (Navigation)
        const goToServerHealthViewTool = vscode.lm.registerTool(
            'go_to_server_health_view',
            new GoToServerHealthViewTool()
        );
        context.subscriptions.push(goToServerHealthViewTool);
        ui.logToOutput('Registered tool: go_to_server_health_view');

        ui.logToOutput('All Language Model Tools registered successfully');
    }
}