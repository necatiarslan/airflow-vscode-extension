/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ([
/* 0 */,
/* 1 */
/***/ ((module) => {

module.exports = require("vscode");

/***/ }),
/* 2 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.AirflowView = void 0;
const vscode = __webpack_require__(1);
class AirflowView {
    constructor(context) {
        const view = vscode.window.createTreeView('airflowView', { treeDataProvider: aNodeWithIdTreeDataProvider(), showCollapseAll: true });
        context.subscriptions.push(view);
    }
}
exports.AirflowView = AirflowView;
// http://localhost:8080/api/v1/dags 
const dagTree = {
    'example_bash_operator': {},
    'example_branch_datetime_operator_2': {},
    'example_branch_dop_operator_v3': {},
    'example_branch_labels': {},
    'example_branch_python_operator_decorator': {},
    'example_complex': {},
    'example_dag_decorator': {},
    'example_external_task_marker_child': {},
};
const nodes = {};
function aNodeWithIdTreeDataProvider() {
    return {
        getChildren: (element) => {
            return getChildren(element ? element.key : undefined).map(key => getNode(key));
        },
        getTreeItem: (element) => {
            const treeItem = getTreeItem(element.key);
            treeItem.id = element.key;
            return treeItem;
        },
        getParent: ({ key }) => {
            const parentKey = key.substring(0, key.length - 1);
            return parentKey ? new Key(parentKey) : void 0;
        }
    };
}
function getChildren(key) {
    if (!key) {
        return Object.keys(dagTree);
    }
    const treeElement = getTreeElement(key);
    if (treeElement) {
        return Object.keys(treeElement);
    }
    return [];
}
function getTreeItem(key) {
    const treeElement = getTreeElement(key);
    // An example of how to use codicons in a MarkdownString in a tree item tooltip.
    const tooltip = new vscode.MarkdownString(`$(zap) Tooltip for ${key}`, true);
    return {
        label: /**vscode.TreeItemLabel**/ { label: key, highlights: key.length > 1 ? [[key.length - 2, key.length - 1]] : void 0 },
        tooltip,
        collapsibleState: treeElement && Object.keys(treeElement).length ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None
    };
}
function getTreeElement(element) {
    let parent = dagTree;
    for (let i = 0; i < element.length; i++) {
        parent = parent[element.substring(0, i + 1)];
        if (!parent) {
            return null;
        }
    }
    return parent;
}
function getNode(key) {
    if (!nodes[key]) {
        nodes[key] = new Key(key);
    }
    return nodes[key];
}
class Key {
    constructor(key) {
        this.key = key;
    }
}


/***/ })
/******/ 	]);
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry need to be wrapped in an IIFE because it need to be isolated against other modules in the chunk.
(() => {
var exports = __webpack_exports__;

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.deactivate = exports.activate = void 0;
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = __webpack_require__(1);
const airflowView_1 = __webpack_require__(2);
// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
function activate(context) {
    console.log('Extension "airflow-vscode-extension" is now active!');
    vscode.commands.registerCommand('airflowView.refreshServer', () => {
        vscode.window.showInformationMessage('airflowView.refreshServer clicked!');
    });
    vscode.commands.registerCommand('airflowView.addServer', () => {
        vscode.window.showInformationMessage('airflowView.addServer clicked!');
    });
    vscode.commands.registerCommand('airflowView.viewDagView', () => {
        vscode.window.showInformationMessage('airflowView.viewDagView clicked!');
    });
    new airflowView_1.AirflowView(context);
}
exports.activate = activate;
// this method is called when your extension is deactivated
function deactivate() {
    console.log('Extension "airflow-vscode-extension" is now deactive!');
}
exports.deactivate = deactivate;

})();

module.exports = __webpack_exports__;
/******/ })()
;
//# sourceMappingURL=extension.js.map