"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isValidDate = exports.isJsonString = exports.convertMsToTime = exports.getDuration = exports.openFile = exports.getExtensionVersion = exports.showApiErrorMessage = exports.showErrorMessage = exports.showWarningMessage = exports.showInfoMessage = exports.logToOutput = exports.showOutputMessage = exports.getUri = void 0;
const vscode = require("vscode");
const vscode_1 = require("vscode");
const fs_1 = require("fs");
const path_1 = require("path");
var outputChannel;
var logsOutputChannel;
var NEW_LINE = "\n\n";
function getUri(webview, extensionUri, pathList) {
    return webview.asWebviewUri(vscode_1.Uri.joinPath(extensionUri, ...pathList));
}
exports.getUri = getUri;
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
exports.showOutputMessage = showOutputMessage;
function logToOutput(message, error = undefined) {
    let now = new Date().toLocaleString();
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
        logsOutputChannel.appendLine(error.stack);
    }
}
exports.logToOutput = logToOutput;
function showInfoMessage(message) {
    vscode.window.showInformationMessage(message);
}
exports.showInfoMessage = showInfoMessage;
function showWarningMessage(message) {
    vscode.window.showWarningMessage(message);
}
exports.showWarningMessage = showWarningMessage;
function showErrorMessage(message, error = undefined) {
    if (error) {
        vscode.window.showErrorMessage(message + NEW_LINE + error.name + NEW_LINE + error.message);
    }
    else {
        vscode.window.showErrorMessage(message);
    }
}
exports.showErrorMessage = showErrorMessage;
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
    /*
    {
    "type": "string",
    "title": "string",
    "status": 0,
    "detail": "string",
    "instance": "string"
    }
    */
}
exports.showApiErrorMessage = showApiErrorMessage;
function getExtensionVersion() {
    const { version: extVersion } = JSON.parse((0, fs_1.readFileSync)((0, path_1.join)(__dirname, '..', 'package.json'), { encoding: 'utf8' }));
    return extVersion;
}
exports.getExtensionVersion = getExtensionVersion;
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
exports.openFile = openFile;
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
    var duration = endDate.valueOf() - startDate.valueOf();
    return (convertMsToTime(duration));
}
exports.getDuration = getDuration;
function convertMsToTime(milliseconds) {
    let seconds = Math.floor(milliseconds / 1000);
    let minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    seconds = seconds % 60;
    minutes = minutes % 60;
    return `${padTo2Digits(hours)}:${padTo2Digits(minutes)}:${padTo2Digits(seconds)}`;
}
exports.convertMsToTime = convertMsToTime;
function isJsonString(jsonString) {
    try {
        var json = JSON.parse(jsonString);
        return (typeof json === 'object');
    }
    catch (e) {
        return false;
    }
}
exports.isJsonString = isJsonString;
function isValidDate(dateString) {
    var regEx = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateString.match(regEx)) {
        return false; // Invalid format
    }
    var d = new Date(dateString);
    var dNum = d.getTime();
    if (!dNum && dNum !== 0) {
        return false; // NaN value, Invalid date
    }
    return d.toISOString().slice(0, 10) === dateString;
}
exports.isValidDate = isValidDate;
//# sourceMappingURL=ui.js.map