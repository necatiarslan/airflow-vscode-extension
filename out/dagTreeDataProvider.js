"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DagTreeDataProvider = void 0;
/* eslint-disable @typescript-eslint/naming-convention */
const vscode = require("vscode");
const dagTreeItem_1 = require("./dagTreeItem");
const dagTreeView_1 = require("./dagTreeView");
class DagTreeDataProvider {
    constructor() {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.dagTreeItemList = [];
        this.visibleDagList = [];
    }
    refresh() {
        this._onDidChangeTreeData.fire();
    }
    loadDagTreeItemsFromApiResponse() {
        this.dagTreeItemList = [];
        if (this.dagList) {
            for (var dag of this.dagList) {
                if (dag) {
                    let treeItem = new dagTreeItem_1.DagTreeItem(dag);
                    this.dagTreeItemList.push(treeItem);
                }
            }
        }
    }
    getChildren(element) {
        if (!element) {
            this.visibleDagList = this.getVisibleDagList();
            return Promise.resolve(this.visibleDagList);
        }
        return Promise.resolve([]);
    }
    getVisibleDagList() {
        var result = [];
        for (var node of this.dagTreeItemList) {
            if (dagTreeView_1.DagTreeView.Current.filterString && !node.doesFilterMatch(dagTreeView_1.DagTreeView.Current.filterString)) {
                continue;
            }
            if (dagTreeView_1.DagTreeView.Current.ShowOnlyActive && node.IsPaused) {
                continue;
            }
            if (dagTreeView_1.DagTreeView.Current.ShowOnlyFavorite && !node.IsFav) {
                continue;
            }
            result.push(node);
        }
        return result;
    }
    getTreeItem(element) {
        return element;
    }
}
exports.DagTreeDataProvider = DagTreeDataProvider;
//# sourceMappingURL=dagTreeDataProvider.js.map