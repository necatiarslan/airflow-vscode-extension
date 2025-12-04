import * as vscode from 'vscode';
import { AdminTreeItem } from './AdminTreeItem';

export class AdminTreeView implements vscode.TreeDataProvider<AdminTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<AdminTreeItem | undefined | null | void> = new vscode.EventEmitter<AdminTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<AdminTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

  constructor(private context: vscode.ExtensionContext) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: AdminTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: AdminTreeItem): Thenable<AdminTreeItem[]> {
    if (!element) {
      // Root level - return the three admin nodes
      return Promise.resolve([
        new AdminTreeItem(
          'Variables',
          vscode.TreeItemCollapsibleState.None,
          {
            command: 'dagTreeView.viewVariables',
            title: 'View Variables',
            arguments: []
          },
          new vscode.ThemeIcon('symbol-variable')
        ),
        new AdminTreeItem(
          'Connections',
          vscode.TreeItemCollapsibleState.None,
          {
            command: 'dagTreeView.viewConnections',
            title: 'View Connections',
            arguments: []
          },
          new vscode.ThemeIcon('link')
        ),
        new AdminTreeItem(
          'Providers',
          vscode.TreeItemCollapsibleState.None,
          {
            command: 'dagTreeView.viewProviders',
            title: 'View Providers',
            arguments: []
          },
          new vscode.ThemeIcon('package')
        )
      ]);
    }
    return Promise.resolve([]);
  }
}
