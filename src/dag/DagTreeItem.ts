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
        contextValue += this.isDagRunning() ? "IsRunning#" : "!IsRunning#";

        this.contextValue = contextValue;
    }

    public refreshUI() {

        if (this.IsPaused) {
            this.iconPath = new vscode.ThemeIcon('circle-outline', new vscode.ThemeColor('disabledForeground'));
            this.ApiResponse.is_paused = true;
        }
        else {
            //"queued" "running" "success" "failed"
            if (this.LatestDagState === 'queued') {
                this.iconPath = new vscode.ThemeIcon('loading~spin', new vscode.ThemeColor('charts.yellow'));
            }
            else if (this.LatestDagState === 'running') {
                this.iconPath = new vscode.ThemeIcon('loading~spin', new vscode.ThemeColor('charts.blue'));
            }
            else if (this.LatestDagState === 'success') {
                this.iconPath = new vscode.ThemeIcon('check', new vscode.ThemeColor('testing.iconPassed'));
            }
            else if (this.LatestDagState === 'failed') {
                this.iconPath = new vscode.ThemeIcon('error', new vscode.ThemeColor('testing.iconFailed'));
            }
            else {
                this.iconPath = new vscode.ThemeIcon('circle-filled', new vscode.ThemeColor('charts.gray'));
            }
            this.ApiResponse.is_paused = false;
        }
        
        // Update context value to reflect current running state
        this.setContextValue();
    }

    public doesFilterMatch(filterString: string): boolean {
        let words: string[] = filterString.split(',');
        words = words.map(word => word.trim());

        this.IsFiltered = false;
        for (const word of words) {
            if (this.DagId.includes(word)) { this.IsFiltered = true; break; }
            if (this.Owners.includes(word))  { this.IsFiltered = true; break; }

            for (const t of this.Tags) {
                if (t.name.includes(word)) { this.IsFiltered = true; break; }
            }
        }
        
        return this.IsFiltered;
    }
}