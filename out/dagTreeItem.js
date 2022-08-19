"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DagTreeItem = void 0;
/* eslint-disable @typescript-eslint/naming-convention */
const vscode = require("vscode");
class DagTreeItem extends vscode.TreeItem {
    constructor(apiResponse) {
        super(apiResponse["dag_id"]);
        this.isFav = false;
        this.setApiResponse(apiResponse);
        this.refreshUI();
    }
    setApiResponse(apiResponse) {
        this.apiResponse = apiResponse;
        this.dagId = apiResponse["dag_id"];
        this.isActive = apiResponse["is_active"];
        this.isPaused = apiResponse["is_paused"];
        this.owners = apiResponse["owners"];
        this.tags = apiResponse["tags"];
        this.fileToken = apiResponse["file_token"];
    }
    isDagRunning() {
        return (this.latestDagState === 'queued' || this.latestDagState === 'running');
    }
    refreshUI() {
        if (this.isPaused) {
            this.iconPath = new vscode.ThemeIcon('circle-outline');
            this.apiResponse["is_paused"] = true;
        }
        else {
            //"queued" "running" "success" "failed"
            if (this.latestDagState === 'queued') {
                this.iconPath = new vscode.ThemeIcon('loading~spin');
            }
            else if (this.latestDagState === 'running') {
                this.iconPath = new vscode.ThemeIcon('loading~spin');
            }
            else if (this.latestDagState === 'success') {
                this.iconPath = new vscode.ThemeIcon('check');
            }
            else if (this.latestDagState === 'failed') {
                this.iconPath = new vscode.ThemeIcon('error');
            }
            else {
                this.iconPath = new vscode.ThemeIcon('circle-filled');
            }
            this.apiResponse["is_paused"] = false;
        }
    }
    doesFilterMatch(filterString) {
        let words = filterString.split(',');
        let matchingWords = [];
        for (var word of words) {
            if (word === 'active' && !this.isPaused) {
                matchingWords.push(word);
                continue;
            }
            if (word === 'paused' && this.isPaused) {
                matchingWords.push(word);
                continue;
            }
            if (this.dagId.includes(word)) {
                matchingWords.push(word);
                continue;
            }
            if (this.owners.includes(word)) {
                matchingWords.push(word);
                continue;
            }
            if (word === 'fav' && this.isFav) {
                matchingWords.push(word);
                continue;
            }
            //TODO
            // for(var t of this.tags)
            // {
            // 	if (t.includes(word)) { matchingWords.push(word); continue; }
            // }
        }
        return words.length === matchingWords.length;
    }
}
exports.DagTreeItem = DagTreeItem;
//# sourceMappingURL=dagTreeItem.js.map