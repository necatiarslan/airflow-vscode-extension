import * as vscode from 'vscode';
import { WorkbenchNodeBase } from './WorkbenchNodeBase';

export class WorkbenchTreeProvider implements vscode.TreeDataProvider<WorkbenchNodeBase> {
  private _onDidChangeTreeData: vscode.EventEmitter<WorkbenchNodeBase | undefined | null | void> = new vscode.EventEmitter<WorkbenchNodeBase | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<WorkbenchNodeBase | undefined | null | void> = this._onDidChangeTreeData.event;

  public rootNodes: WorkbenchNodeBase[] = [];
  private visibilityEvaluator?: (node: WorkbenchNodeBase) => boolean;

  setVisibilityEvaluator(evaluator: (node: WorkbenchNodeBase) => boolean): void {
    this.visibilityEvaluator = evaluator;
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: WorkbenchNodeBase): vscode.TreeItem {
    return element;
  }

  getChildren(element?: WorkbenchNodeBase): Thenable<WorkbenchNodeBase[]> {
    if (!element) {
      return Promise.resolve(this.getVisibleNodes(this.rootNodes));
    }
    return Promise.resolve(this.getVisibleNodes(element.Children));
  }

  private getVisibleNodes(nodes: WorkbenchNodeBase[]): WorkbenchNodeBase[] {
    if (!this.visibilityEvaluator) {
      return nodes;
    }

    return nodes.filter(node => this.visibilityEvaluator!(node));
  }
}
