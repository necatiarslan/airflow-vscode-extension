import * as vscode from 'vscode';
import { readFileSync } from 'fs';
import { join } from 'path';

export function showInfoMessage(message: string): void {
    vscode.window.showInformationMessage(message);
}

export function showWarningMessage(message: string): void {
    vscode.window.showWarningMessage(message);
}

export function showErrorMessage(message: string, error:Error = undefined): void {
    if(error)
    {
      vscode.window.showErrorMessage(message + "\n\n" + error);
    }
    else{
      vscode.window.showErrorMessage(message);
    }
}

export function getExtensionVersion() {
  const { version: extVersion } = JSON.parse(
    readFileSync(join(__dirname, '..', 'package.json'), { encoding: 'utf8' })
  );
  return extVersion;
}

export function showFile(file: string) {
  vscode.commands.executeCommand('vscode.open', vscode.Uri.file(file));
}