"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DagTreeItem = void 0;
/* eslint-disable @typescript-eslint/naming-convention */
const vscode = require("vscode");
class DagTreeItem extends vscode.TreeItem {
    constructor(apiResponse) {
        super(apiResponse["dag_id"]);
        this._IsFav = false;
        this.IsFiltered = false;
        this.setApiResponse(apiResponse);
        this.refreshUI();
    }
    setApiResponse(apiResponse) {
        this.ApiResponse = apiResponse;
        this.DagId = apiResponse["dag_id"];
        this.IsActive = apiResponse["is_active"];
        this.IsPaused = apiResponse["is_paused"];
        this.Owners = apiResponse["owners"];
        this.Tags = apiResponse["tags"];
        this.FileToken = apiResponse["file_token"];
        this.setContextValue();
    }
    set IsFav(value) {
        this._IsFav = value;
        this.setContextValue();
    }
    get IsFav() {
        return this._IsFav;
    }
    isDagRunning() {
        return (this.LatestDagState === 'queued' || this.LatestDagState === 'running');
    }
    setContextValue() {
        let contextValue = "#";
        contextValue += this.IsFav ? "IsFav#" : "!IsFav#";
        contextValue += this.IsPaused ? "IsPaused#" : "!IsPaused#";
        contextValue += this.IsActive ? "IsActive#" : "!IsActive#";
        contextValue += this.IsFiltered ? "IsFiltered#" : "!IsFiltered#";
        this.contextValue = contextValue;
    }
    refreshUI() {
        if (this.IsPaused) {
            this.iconPath = new vscode.ThemeIcon('circle-outline');
            this.ApiResponse["is_paused"] = true;
        }
        else {
            //"queued" "running" "success" "failed"
            if (this.LatestDagState === 'queued') {
                this.iconPath = new vscode.ThemeIcon('loading~spin');
            }
            else if (this.LatestDagState === 'running') {
                this.iconPath = new vscode.ThemeIcon('loading~spin');
            }
            else if (this.LatestDagState === 'success') {
                this.iconPath = new vscode.ThemeIcon('check');
            }
            else if (this.LatestDagState === 'failed') {
                this.iconPath = new vscode.ThemeIcon('error');
            }
            else {
                this.iconPath = new vscode.ThemeIcon('circle-filled');
            }
            this.ApiResponse["is_paused"] = false;
        }
    }
    doesFilterMatch(filterString) {
        let words = filterString.split(',');
        let matchingWords = [];
        for (var word of words) {
            if (word === 'active' && !this.IsPaused) {
                matchingWords.push(word);
                continue;
            }
            if (word === 'paused' && this.IsPaused) {
                matchingWords.push(word);
                continue;
            }
            if (this.DagId.includes(word)) {
                matchingWords.push(word);
                continue;
            }
            if (this.Owners.includes(word)) {
                matchingWords.push(word);
                continue;
            }
            if (word === 'fav' && this.IsFav) {
                matchingWords.push(word);
                continue;
            }
            for (var t of this.Tags) {
                if (t.name.includes(word)) {
                    matchingWords.push(word);
                    continue;
                }
            }
        }
        this.IsFiltered = (words.length === matchingWords.length);
        return this.IsFiltered;
    }
}
exports.DagTreeItem = DagTreeItem;
//# sourceMappingURL=dagTreeItem.js.map