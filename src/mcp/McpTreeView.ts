import * as vscode from 'vscode';
import { McpTreeItem } from './McpTreeItem';

export class McpTreeView implements vscode.TreeDataProvider<McpTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<McpTreeItem | undefined | null | void> = new vscode.EventEmitter<McpTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<McpTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

  constructor() {
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: McpTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: McpTreeItem): Thenable<McpTreeItem[]> {
    if (!element) {
      return Promise.resolve([
        new McpTreeItem(
          'Status',
          vscode.TreeItemCollapsibleState.None,
          {
            command: 'airflow-ext.McpStatus',
            title: 'MCP Status',
            arguments: []
          },
          new vscode.ThemeIcon('info')
        ),
        new McpTreeItem(
          'Start',
          vscode.TreeItemCollapsibleState.None,
          {
            command: 'airflow-ext.StartMcpServer',
            title: 'Start MCP Server',
            arguments: []
          },
          new vscode.ThemeIcon('play')
        ),
        new McpTreeItem(
          'Stop',
          vscode.TreeItemCollapsibleState.None,
          {
            command: 'airflow-ext.StopMcpServers',
            title: 'Stop MCP Servers',
            arguments: []
          },
          new vscode.ThemeIcon('stop-circle')
        ),
        new McpTreeItem(
          'Manage',
          vscode.TreeItemCollapsibleState.None,
          {
            command: 'airflow-ext.OpenMcpManageView',
            title: 'Open MCP Manager',
            arguments: []
          },
          new vscode.ThemeIcon('settings')
        )
      ]);
    }
    return Promise.resolve([]);
  }
}
