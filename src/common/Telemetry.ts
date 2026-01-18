import { TelemetryReporter } from "@vscode/extension-telemetry";
import * as vscode from "vscode";

export class Telemetry {

    private connectionString = "InstrumentationKey=10fbe7b4-13da-4481-ab61-902bd7acac44;IngestionEndpoint=https://eastus-8.in.applicationinsights.azure.com/;LiveEndpoint=https://eastus.livediagnostics.monitor.azure.com/;ApplicationId=1af62da8-61c9-4cb6-8c9b-34d84e6e8bfe";
    public static Current: Telemetry;

    private reporter: TelemetryReporter | undefined = undefined;

    constructor(context: vscode.ExtensionContext) {
        Telemetry.Current = this;
        if (vscode.env.isTelemetryEnabled && this.connectionString) {
            this.reporter = new TelemetryReporter(this.connectionString);
            context.subscriptions.push(this.reporter);
        }
    }

    public send(eventName: string, properties?: { [key: string]: string }, measurements?: { [key: string]: number }) {
        if (!vscode.env.isTelemetryEnabled) return;
        if (!this.reporter) return;

        this.reporter.sendTelemetryEvent(eventName, properties, measurements);
    }

    public sendError(eventName: string, errorOrProps?: Error | { [key: string]: string }, measurements?: { [key: string]: number }) {
        if (!vscode.env.isTelemetryEnabled) return;
        if (!this.reporter) return;


        if (errorOrProps instanceof Error) {
            this.reporter.sendTelemetryErrorEvent(eventName, {
                message: errorOrProps.message,
                name: errorOrProps.name,
                stack: errorOrProps.stack ?? ''
            }, measurements);
        } else {
            const props = errorOrProps || {};
            this.reporter.sendTelemetryErrorEvent(eventName, props, measurements);
        }
    }

    public dispose() {
        if (this.reporter) {
            this.reporter.dispose();
        }
    }

}

