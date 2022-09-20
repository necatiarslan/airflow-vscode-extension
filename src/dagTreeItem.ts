/* eslint-disable @typescript-eslint/naming-convention */
import * as vscode from 'vscode';

export class DagTreeItem extends vscode.TreeItem {
	public isPaused: boolean;
	public isActive: boolean;
	public dagId: string;
	public owners: string[];
	public tags: {name:string}[];
	public apiResponse: any;
	public fileToken: string;
	public latestDagRunId: string;
	public latestDagState: string;
	public isFav: boolean = false;

	constructor(apiResponse: any) {
		super(apiResponse["dag_id"]);
		this.setApiResponse(apiResponse);
		this.refreshUI();
	}

	public setApiResponse(apiResponse: any) {
		this.apiResponse = apiResponse;
		this.dagId = apiResponse["dag_id"];
		this.isActive = apiResponse["is_active"];
		this.isPaused = apiResponse["is_paused"];
		this.owners = apiResponse["owners"];
		this.tags = apiResponse["tags"];
		this.fileToken = apiResponse["file_token"];
	}

	public isDagRunning(): boolean {
		return (this.latestDagState === 'queued' || this.latestDagState === 'running');
	}

	public refreshUI() {
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

	public doesFilterMatch(filterString: string): boolean {
		let words: string[] = filterString.split(',');
		let matchingWords: string[] = [];
		for (var word of words) {
			if (word === 'active' && !this.isPaused) { matchingWords.push(word); continue; }
			if (word === 'paused' && this.isPaused) { matchingWords.push(word); continue; }
			if (this.dagId.includes(word)) { matchingWords.push(word); continue; }
			if (this.owners.includes(word)) { matchingWords.push(word); continue; }
			if (word === 'fav' && this.isFav) { matchingWords.push(word); continue; }

			for(var t of this.tags)
			{
				if (t.name.includes(word)) { matchingWords.push(word); continue; }
			}
		}

		return words.length === matchingWords.length;
	}
}