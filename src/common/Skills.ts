import * as vscode from 'vscode';
import { Session } from './Session';
import * as fs from 'fs';

export async function InstallSkills(): Promise<void> 
{

    const terminal = vscode.window.createTerminal({ name: 'Airflow Skills' });
    terminal.show(false);
    terminal.sendText('echo Installing Airflow Skills...', true);
    // Wait for terminal readiness before sending the command.
    setTimeout(() => {
        terminal.sendText('npx skills add necatiarslan/airflow-vscode-extension --yes --skill "*" -a github-copilot', true);
    }, 5000);

    CleanupSkillsExistsCache();
}

let _skillsExists : boolean | undefined = undefined;

export function AreSkillsInstalled(): boolean {
    if (_skillsExists !== undefined) {
        return _skillsExists;
    }

    if (!Session.Current.HasWorkspaceFolder) {
        return false;
    };

    const skillsFolderPath = ".agents/skills/airflow";
    const skillsFolderUri = vscode.Uri.joinPath(Session.Current.GetWorkspaceFolder()!.uri, skillsFolderPath);
    try {
        _skillsExists = fs.existsSync(skillsFolderUri.fsPath);
        return _skillsExists;
    } catch (error) {
        return false;
    }
}

export function CleanupSkillsExistsCache() {
    //wait for 1 minute before resetting the cache to avoid excessive filesystem checks
    setTimeout(() => {
        _skillsExists = undefined;
    }, 60000);
}
