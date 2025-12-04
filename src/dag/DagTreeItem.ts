/* eslint-disable @typescript-eslint/naming-convention */
import * as vscode from 'vscode';
import { AirflowDag } from '../common/Types';

export class DagTreeItem extends vscode.TreeItem {
    public IsPaused: boolean;
    public IsActive: boolean;
    public DagId: string;
    public Owners: string[];
    public Tags: { name: string }[];
    public ApiResponse: AirflowDag;
    public FileToken: string;
    public LatestDagRunId: string = '';
    public LatestDagState: string = '';
    private _IsFav: boolean = false;
    public IsFiltered: boolean = false;

    constructor(apiResponse: AirflowDag) {
        super(apiResponse.dag_id);
        this.ApiResponse = apiResponse;
        this.DagId = apiResponse.dag_id;
        this.IsActive = apiResponse.is_active;
        this.IsPaused = apiResponse.is_paused;
        this.Owners = apiResponse.owners;
        this.Tags = apiResponse.tags;
        this.FileToken = apiResponse.file_token;

        this.setContextValue();
        this.refreshUI();
    }

    public set IsFav(value: boolean) {
        this._IsFav = value;
        this.setContextValue();
    }

    public get IsFav(): boolean {
        return this._IsFav;
    }

    public isDagRunning(): boolean {
        return (this.LatestDagState === 'queued' || this.LatestDagState === 'running');
    }

    public setContextValue() {
        let contextValue = "#";
        contextValue += this.IsFav ? "IsFav#" : "!IsFav#";
        contextValue += this.IsPaused ? "IsPaused#" : "!IsPaused#";
        contextValue += this.IsActive ? "IsActive#" : "!IsActive#";
        contextValue += this.IsFiltered ? "IsFiltered#" : "!IsFiltered#";

        this.contextValue = contextValue;
    }

    public refreshUI() {

        if (this.IsPaused) {
            this.iconPath = new vscode.ThemeIcon('circle-outline');
            this.ApiResponse.is_paused = true;
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
            this.ApiResponse.is_paused = false;
        }
    }

    public doesFilterMatch(filterString: string): boolean {
        const words: string[] = filterString.split(',');
        const matchingWords: string[] = [];
        for (const word of words) {
            if (word === 'active' && !this.IsPaused) { matchingWords.push(word); continue; }
            if (word === 'paused' && this.IsPaused) { matchingWords.push(word); continue; }
            if (this.DagId.includes(word)) { matchingWords.push(word); continue; }
            if (this.Owners.includes(word)) { matchingWords.push(word); continue; }
            if (word === 'fav' && this.IsFav) { matchingWords.push(word); continue; }

            for (const t of this.Tags) {
                if (t.name.includes(word)) { matchingWords.push(word); continue; }
            }
        }
        this.IsFiltered = (words.length === matchingWords.length);
        return this.IsFiltered;
    }
}