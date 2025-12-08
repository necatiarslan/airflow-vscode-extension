import * as vscode from 'vscode';
import { AirflowClientAdapter } from './AirflowClientAdapter';

export interface IGetDagSourceCodeParams {
    dagId: string;
}

export class GetDagSourceCodeTool implements vscode.LanguageModelTool<IGetDagSourceCodeParams> {
    constructor(private airflowClient: AirflowClientAdapter) {}

    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<IGetDagSourceCodeParams>,
        token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {
        const { dagId } = options.input;

        try {
            const sourceCode = await this.airflowClient.getDagSourceCode(dagId);

            const result = `## DAG Source Code: ${dagId}

\`\`\`python
${sourceCode}
\`\`\`

**Total Lines:** ${sourceCode.split('\n').length}

The source code has been retrieved successfully. You can analyze it for:
- DAG structure and task dependencies
- Operator configurations
- Schedule and retry settings
- Custom logic and parameters
- Potential issues or improvements
`;

            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(result)
            ]);
        } catch (error) {
            const errorMessage = `Failed to retrieve source code for DAG '${dagId}': ${error instanceof Error ? error.message : String(error)}`;
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(errorMessage)
            ]);
        }
    }

    async prepareInvocation(
        options: vscode.LanguageModelToolInvocationPrepareOptions<IGetDagSourceCodeParams>,
        token: vscode.CancellationToken
    ): Promise<vscode.PreparedToolInvocation> {
        return {
            invocationMessage: `Retrieving source code for DAG '${options.input.dagId}'...`
        };
    }
}
