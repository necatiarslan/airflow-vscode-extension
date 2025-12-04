/* eslint-disable @typescript-eslint/naming-convention */
import * as vscode from 'vscode';
import { DagTreeItem } from './DagTreeItem';
import { DagTreeView } from './DagTreeView';

export class DagTreeDataProvider implements vscode.TreeDataProvider<DagTreeItem>
{
	private _onDidChangeTreeData: vscode.EventEmitter<DagTreeItem | undefined | void> = new vscode.EventEmitter<DagTreeItem | undefined | void>();
	readonly onDidChangeTreeData: vscode.Event<DagTreeItem | undefined | void> = this._onDidChangeTreeData.event;
	dagList: any;
	dagTreeItemList: DagTreeItem[] = [];
	visibleDagList: DagTreeItem[] = [];

	refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	loadDagTreeItemsFromApiResponse() {
		this.dagTreeItemList = [];
		if (this.dagList) {
			for (var dag of this.dagList) {
				if (dag) {
					let treeItem = new DagTreeItem(dag);
					this.dagTreeItemList.push(treeItem);
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
		for (var node of this.dagTreeItemList) {
			if (DagTreeView.Current.filterString && !node.doesFilterMatch(DagTreeView.Current.filterString)) { continue; }
			if (DagTreeView.Current.ShowOnlyActive && node.IsPaused) { continue; }
			if (DagTreeView.Current.ShowOnlyFavorite && !node.IsFav) { continue; }

			result.push(node);
		}
		return result;
	}

	getTreeItem(element: DagTreeItem): DagTreeItem {
		return element;
	}
}