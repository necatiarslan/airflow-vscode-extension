import * as vscode from 'vscode';

export class AdminTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly command?: vscode.Command,
    public readonly iconPath?: vscode.ThemeIcon
  ) {
    super(label, collapsibleState);
    this.command = command;
    this.iconPath = iconPath;
  }
}
