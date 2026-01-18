import * as vscode from 'vscode';
import { ReportTreeItem } from './ReportTreeItem';
import { Telemetry } from '../common/Telemetry';

export class ReportTreeView implements vscode.TreeDataProvider<ReportTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<ReportTreeItem | undefined | null | void> = new vscode.EventEmitter<ReportTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<ReportTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

  constructor() {
    Telemetry.Current.send('ReportTreeView.constructor.called');
  }

  refresh(): void {
    Telemetry.Current.send('ReportTreeView.refresh.called');
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
          'Daily DAG Runs',
          vscode.TreeItemCollapsibleState.None,
          {
            command: 'dagTreeView.viewDagRuns',
            title: 'View Daily DAG Runs',
            arguments: []
          },
          new vscode.ThemeIcon('list-selection')
        ),
        new ReportTreeItem(
          'DAG Run History',
          vscode.TreeItemCollapsibleState.None,
          {
            command: 'dagTreeView.viewDagRunHistory',
            title: 'View DAG Run History',
            arguments: []
          },
          new vscode.ThemeIcon('history')
        )
      ]);
    }
    return Promise.resolve([]);
  }
}
