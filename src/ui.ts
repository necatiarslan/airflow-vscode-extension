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

export function showApiErrorMessage(message: string, jsonResult): void {
  if(jsonResult)
  {
    vscode.window.showErrorMessage(message + "\n\n"
    + "type:"+jsonResult.type+"\n" 
    + "title:"+jsonResult.title+"\n" 
    + "status:"+jsonResult.status+"\n" 
    + "detail:"+jsonResult.detail+"\n" 
    + "instance:"+jsonResult.instance+"\n" 
    );
  }
  else{
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

export function getExtensionVersion() {
  const { version: extVersion } = JSON.parse(
    readFileSync(join(__dirname, '..', 'package.json'), { encoding: 'utf8' })
  );
  return extVersion;
}

export function showFile(file: string) {
  vscode.commands.executeCommand('vscode.open', vscode.Uri.file(file));
}

function padTo2Digits(num: number) {
  return num.toString().padStart(2, '0');
}

export function getDuration(startDate:Date, endDate:Date):string
{
  var duration = endDate.valueOf() - startDate.valueOf();
  return(convertMsToTime(duration));
}

export function convertMsToTime(milliseconds: number):string {
  let seconds = Math.floor(milliseconds / 1000);
  let minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  seconds = seconds % 60;
  minutes = minutes % 60;

  // 👇️ If you want to roll hours over, e.g. 00 to 24
  // 👇️ uncomment the line below
  // uncommenting next line gets you `00:00:00` instead of `24:00:00`
  // or `12:15:31` instead of `36:15:31`, etc.
  // 👇️ (roll hours over)
  // hours = hours % 24;

  return `${padTo2Digits(hours)}:${padTo2Digits(minutes)}:${padTo2Digits(
    seconds,
  )}`;
}