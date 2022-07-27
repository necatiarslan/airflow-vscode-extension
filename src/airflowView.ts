import * as vscode from 'vscode';

export class AirflowView {

	constructor(context: vscode.ExtensionContext) {
		
		const view = vscode.window.createTreeView('airflowView', { treeDataProvider: aNodeWithIdTreeDataProvider(), showCollapseAll: true });
		
		context.subscriptions.push(view);
	}
}

// http://localhost:8080/api/v1/dags 
const dagTree = {
	'example_bash_operator': {},
	'example_branch_datetime_operator_2': {},
	'example_branch_dop_operator_v3':{},
	'example_branch_labels':{},
	'example_branch_python_operator_decorator':{},
	'example_complex':{},
	'example_dag_decorator':{},
	'example_external_task_marker_child':{},
};

const nodes = {};

function aNodeWithIdTreeDataProvider(): vscode.TreeDataProvider<{ key: string }> {
	return {
		getChildren: (element: { key: string }): { key: string }[] => {
			return getChildren(element ? element.key : undefined).map(key => getNode(key));
		},
		getTreeItem: (element: { key: string }): vscode.TreeItem => {
			const treeItem = getTreeItem(element.key);
			treeItem.id = element.key;
			return treeItem;
		},
		getParent: ({ key }: { key: string }): { key: string } => {
			const parentKey = key.substring(0, key.length - 1);
			return parentKey ? new Key(parentKey) : void 0;
		}
	};
}

function getChildren(key: string): string[] {
	if (!key) {
		return Object.keys(dagTree);
	}
	const treeElement = getTreeElement(key);
	if (treeElement) {
		return Object.keys(treeElement);
	}
	return [];
}

function getTreeItem(key: string): vscode.TreeItem {
	const treeElement = getTreeElement(key);
	// An example of how to use codicons in a MarkdownString in a tree item tooltip.
	const tooltip = new vscode.MarkdownString(`$(zap) Tooltip for ${key}`, true);
	return {
		label: /**vscode.TreeItemLabel**/<any>{ label: key, highlights: key.length > 1 ? [[key.length - 2, key.length - 1]] : void 0 },
		tooltip,
		collapsibleState: treeElement && Object.keys(treeElement).length ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None
	};
}

function getTreeElement(element:string): any {
	let parent = dagTree;
	for (let i = 0; i < element.length; i++) {
		parent = parent[element.substring(0, i + 1)];
		if (!parent) {
			return null;
		}
	}
	return parent;
}

function getNode(key: string): { key: string } {
	if (!nodes[key]) {
		nodes[key] = new Key(key);
	}
	return nodes[key];
}

class Key {
	constructor(readonly key: string) { }
}