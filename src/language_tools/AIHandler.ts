import { AskAIContext, ServerConfig } from '../common/Types';
import { DagTreeView } from '../dag/DagTreeView';
import { Session } from '../common/Session';
import * as vscode from 'vscode';
import * as ui from '../common/UI';

export class AIHandler 
{
    public static Current: AIHandler;

    public askAIContext: AskAIContext | undefined;
    public currentDagId: string | undefined;

    constructor() {
        AIHandler.Current = this;
    }

    public async aIHandler (request: vscode.ChatRequest, context: vscode.ChatContext, stream: vscode.ChatResponseStream, token: vscode.CancellationToken) : Promise<void>
    {
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
            vscode.LanguageModelChatMessage.User(`You are an expert in Apache Airflow. You have access to tools to manage DAGs, view logs, and check status. Use them when appropriate.`)
        ];

        // Add context if available
        if (aiContext) {
            messages.push(vscode.LanguageModelChatMessage.User(`Context:\nDAG: ${aiContext.dag || 'N/A'}\nLogs: ${aiContext.logs || 'N/A'}\nCode: ${aiContext.code || 'N/A'}`));
        }

        if (this.currentDagId) {
            messages.push(vscode.LanguageModelChatMessage.User(`Current DAG ID in focus: ${this.currentDagId}`));
        }

        messages.push(vscode.LanguageModelChatMessage.User(request.prompt));

        // 3. Select Model and Send Request
        try {
            const [model] = await vscode.lm.selectChatModels();
            ui.logToOutput(`Selected AI Family: ${model?.family || 'None'}, Name: ${model?.name || 'None'}`);
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
                            const errorMessage = `Tool execution failed: ${err instanceof Error ? err.message : String(err)}`;
                            messages.push(vscode.LanguageModelChatMessage.User([
                                new vscode.LanguageModelToolResultPart(toolCall.callId, [new vscode.LanguageModelTextPart(errorMessage)])
                            ]));
                        }
                    }
                }
            }

        } catch (err) {
            ui.logToOutput(`AIHandler.aIHandler Error: ${err instanceof Error ? err.message : String(err)}`);
            if (err instanceof Error) {
                stream.markdown(`I'm sorry, I couldn't connect to the AI model: ${err.message}`);
            } else {
                stream.markdown("I'm sorry, I couldn't connect to the AI model.");
            }
        }
    };

    public async isChatCommandAvailable(): Promise<boolean> {
        const commands = await vscode.commands.getCommands(true); // 'true' includes internal commands
        return commands.includes('workbench.action.chat.open');
    }

    public async askAI(dagId: string, fileToken: string) {
        ui.logToOutput('DagTreeView.askAI Started');
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
}