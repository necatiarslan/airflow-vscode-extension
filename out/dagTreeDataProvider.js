"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DagTreeDataProvider = void 0;
/* eslint-disable @typescript-eslint/naming-convention */
const vscode = require("vscode");
const dagTreeItem_1 = require("./dagTreeItem");
class DagTreeDataProvider {
    constructor() {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.filterString = '';
        this.dagList = [];
        this.visibleDagList = [];
    }
    refresh() {
        this._onDidChangeTreeData.fire();
    }
    loadDagTreeItemsFromApiResponse() {
        this.dagList = [];
        if (this.daglistResponse) {
            for (var dag of this.daglistResponse["dags"]) {
                if (dag) {
                    let treeItem = new dagTreeItem_1.DagTreeItem(dag);
                    this.dagList.push(treeItem);
                }
            }
        }
    }
    getChildren(element) {
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
    getTreeItem(element) {
        return element;
    }
}
exports.DagTreeDataProvider = DagTreeDataProvider;
//# sourceMappingURL=dagTreeDataProvider.js.map