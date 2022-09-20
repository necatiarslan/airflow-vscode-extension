/* eslint-disable @typescript-eslint/naming-convention */
import * as vscode from 'vscode';
import { DagTreeItem } from './dagTreeItem';
import { DagTreeView } from './dagTreeView';

export class DagTreeDataProvider implements vscode.TreeDataProvider<DagTreeItem>
{
	private _onDidChangeTreeData: vscode.EventEmitter<DagTreeItem | undefined | void> = new vscode.EventEmitter<DagTreeItem | undefined | void>();
	readonly onDidChangeTreeData: vscode.Event<DagTreeItem | undefined | void> = this._onDidChangeTreeData.event;
	daglistResponse: any;
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
			this.visibleDagList = this.getVisibleDagList();
			return Promise.resolve(this.visibleDagList);
		}
		return Promise.resolve([]);
	}

	getVisibleDagList(): DagTreeItem[]{
		var result: DagTreeItem[] = [];
		for (var node of this.dagList) {
			if (DagTreeView.Current.filterString && !node.doesFilterMatch(DagTreeView.Current.filterString)) { continue; }
			if (DagTreeView.Current.ShowOnlyActive && node.isPaused) { continue; }
			if (DagTreeView.Current.ShowOnlyFavorite && !node.isFav) { continue; }

			result.push(node);
		}
		return result;
	}

	getTreeItem(element: DagTreeItem): DagTreeItem {
		return element;
	}
}