import * as vscode from 'vscode';
import { ReportTreeItem } from './ReportTreeItem';

export class ReportTreeView implements vscode.TreeDataProvider<ReportTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<ReportTreeItem | undefined | null | void> = new vscode.EventEmitter<ReportTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<ReportTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

  constructor(private context: vscode.ExtensionContext) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: ReportTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: ReportTreeItem): Thenable<ReportTreeItem[]> {
    if (!element) {
      // Root level - return the report nodes
      return Promise.resolve([
        new ReportTreeItem(
          'DAG Runs',
          vscode.TreeItemCollapsibleState.None,
          {
            command: 'dagTreeView.viewDagRuns',
            title: 'View DAG Runs',
            arguments: []
          },
          new vscode.ThemeIcon('list-selection')
        )
      ]);
    }
    return Promise.resolve([]);
  }
}
