/* eslint-disable @typescript-eslint/naming-convention */
import * as vscode from 'vscode';

export class DagTreeItem extends vscode.TreeItem {
	public IsPaused: boolean;
	public IsActive: boolean;
	public DagId: string;
	public Owners: string[];
	public Tags: {name:string}[];
	public ApiResponse: any;
	public FileToken: string;
	public LatestDagRunId: string;
	public LatestDagState: string;
	public IsFav: boolean = false;

	constructor(apiResponse: any) {
		super(apiResponse["dag_id"]);
		this.setApiResponse(apiResponse);
		this.refreshUI();
	}

	public setApiResponse(apiResponse: any) {
		this.ApiResponse = apiResponse;
		this.DagId = apiResponse["dag_id"];
		this.IsActive = apiResponse["is_active"];
		this.IsPaused = apiResponse["is_paused"];
		this.Owners = apiResponse["owners"];
		this.Tags = apiResponse["tags"];
		this.FileToken = apiResponse["file_token"];
	}

	public isDagRunning(): boolean {
		return (this.LatestDagState === 'queued' || this.LatestDagState === 'running');
	}

	public refreshUI() {
		super.label = this.DagId;

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

	public doesFilterMatch(filterString: string): boolean {
		let words: string[] = filterString.split(',');
		let matchingWords: string[] = [];
		for (var word of words) {
			if (word === 'active' && !this.IsPaused) { matchingWords.push(word); continue; }
			if (word === 'paused' && this.IsPaused) { matchingWords.push(word); continue; }
			if (this.DagId.includes(word)) { matchingWords.push(word); continue; }
			if (this.Owners.includes(word)) { matchingWords.push(word); continue; }
			if (word === 'fav' && this.IsFav) { matchingWords.push(word); continue; }

			for(var t of this.Tags)
			{
				if (t.name.includes(word)) { matchingWords.push(word); continue; }
			}
		}

		return words.length === matchingWords.length;
	}
}