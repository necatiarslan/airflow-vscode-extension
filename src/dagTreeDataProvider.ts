/* eslint-disable @typescript-eslint/naming-convention */
import * as vscode from 'vscode';
import { DagTreeItem } from './dagTreeItem';

export class DagTreeDataProvider implements vscode.TreeDataProvider<DagTreeItem>
{
	private _onDidChangeTreeData: vscode.EventEmitter<DagTreeItem | undefined | void> = new vscode.EventEmitter<DagTreeItem | undefined | void>();
	readonly onDidChangeTreeData: vscode.Event<DagTreeItem | undefined | void> = this._onDidChangeTreeData.event;
	daglistResponse: any;
	filterString: string = '';
	dagList: DagTreeItem[] = [];
	visibleDagList: DagTreeItem[] = [];

	refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	loadDagTreeItemsFromApiResponse() {
		this.dagList = [];
		if (this.daglistResponse) {
			for (var dag of this.daglistResponse["dags"]) {
				if (dag) {
					let treeItem = new DagTreeItem(dag);
					this.dagList.push(treeItem);
				}
			}
		}
	}

	getChildren(element: DagTreeItem): Thenable<DagTreeItem[]> {
		if (!element) {
			this.visibleDagList = [];
			for (var node of this.dagList) {
				if (!this.filterString || (this.filterString && node.doesFilterMatch(this.filterString))) {
					this.visibleDagList.push(node);
				}
			}
			return Promise.resolve(this.visibleDagList);
		}
		return Promise.resolve([]);
	}

	getTreeItem(element: DagTreeItem): DagTreeItem {
		return element;
	}
}