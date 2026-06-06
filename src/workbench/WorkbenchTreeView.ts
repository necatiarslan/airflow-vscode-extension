import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';
import { randomUUID } from 'crypto';
import * as tmp from 'tmp';
import * as ui from '../common/UI';
import { Session } from '../common/Session';
import { DagTreeView } from '../dag/DagTreeView';
import { DagLogView } from '../report/DagLogView';
import { AIHandler } from '../language_tools/AIHandler';
import { WorkbenchNodeBase } from './WorkbenchNodeBase';
import { WorkbenchState } from './WorkbenchState';
import {
  WorkbenchNodeType,
  getAllowedChildTypes,
  getTypeLabel,
} from './WorkbenchNodeTypes';
import { WorkbenchTreeProvider } from './WorkbenchTreeProvider';

export class WorkbenchTreeView {
  public static Current: WorkbenchTreeView;

  public FilterString: string = '';
  public ShowOnlyActive: boolean = false;
  public ShowOnlyFavorite: boolean = false;

  private readonly provider: WorkbenchTreeProvider;
  private readonly view: vscode.TreeView<WorkbenchNodeBase>;
  private readonly state: WorkbenchState;

  constructor(private readonly dagTreeView: DagTreeView) {
    this.provider = new WorkbenchTreeProvider();
    this.state = new WorkbenchState();

    this.provider.rootNodes = this.state.load();
    this.refreshAllNodes(this.provider.rootNodes);
    this.loadViewState();
    this.provider.setVisibilityEvaluator((node) => this.isNodeVisibleInCurrentWorkspace(node));

    this.view = vscode.window.createTreeView('airflow-ext.workbenchTreeView', {
      treeDataProvider: this.provider,
      showCollapseAll: true,
    });

    this.setViewMessage();

    Session.Current.Context!.subscriptions.push(this.view);
    Session.Current.Context!.subscriptions.push({ dispose: () => this.dispose() });
    WorkbenchTreeView.Current = this;
  }

  private dispose() {
    this.state.saveImmediate(this.provider.rootNodes);
  }

  public refresh(): void {
    this.provider.refresh();
    this.setViewMessage();
  }

  public async filter(): Promise<void> {
    const filterString = await vscode.window.showInputBox({
      placeHolder: 'Enter filter string',
      value: this.FilterString,
    });

    if (filterString === undefined) {
      return;
    }

    this.FilterString = filterString;
    this.saveViewState();
    this.refresh();
  }

  public showOnlyActive(): void {
    this.ShowOnlyActive = !this.ShowOnlyActive;
    this.saveViewState();
    this.refresh();
  }

  public showOnlyFavorite(): void {
    this.ShowOnlyFavorite = !this.ShowOnlyFavorite;
    this.saveViewState();
    this.refresh();
  }

  public async connectServer(): Promise<void> {
    await this.dagTreeView.connectServer();
    this.refresh();
  }

  public async addRootNode(): Promise<void> {
    await this.addNode(undefined);
  }

  public async addAirflowDag(dagId: string): Promise<void> {
    const normalizedDagId = dagId.trim();
    if (!normalizedDagId) {
      ui.showWarningMessage('DAG id is required.');
      return;
    }

    const folders = this.collectFolders();
    const destinationPick = await vscode.window.showQuickPick(
      [
        { label: 'Root', description: 'Add to top level', node: undefined as WorkbenchNodeBase | undefined },
        ...folders.map(folder => ({ label: folder.label, description: folder.getPathLabel(), node: folder })),
      ],
      { placeHolder: `Where should "${normalizedDagId}" be added in Workbench?` }
    );

    if (!destinationPick) {
      return;
    }

    const parent = destinationPick.node;
    const newNode = new WorkbenchNodeBase(
      this.newNodeId(),
      WorkbenchNodeType.AirflowDag,
      normalizedDagId,
      { dagId: normalizedDagId },
      parent?.workspace ?? '',
      parent
    );
    newNode.refreshUi();

    if (parent) {
      parent.Children.push(newNode);
    } else {
      this.provider.rootNodes.push(newNode);
    }

    this.persistAndRefresh(true);
  }

  public async addChildNode(node: WorkbenchNodeBase): Promise<void> {
    await this.addNode(node);
  }

  private async addNode(parent?: WorkbenchNodeBase): Promise<void> {
    const allowedTypes = getAllowedChildTypes(parent?.type);
    if (allowedTypes.length === 0) {
      ui.showWarningMessage('Selected node cannot contain children.');
      return;
    }

    const typePick = await vscode.window.showQuickPick(
      allowedTypes.map(type => ({ label: getTypeLabel(type), type })),
      { placeHolder: parent ? `Add child node under ${parent.label}` : 'Select root node type' }
    );
    if (!typePick) {
      return;
    }

    const newNode = await this.createNode(typePick.type, parent);
    if (!newNode) {
      return;
    }

    if (parent) {
      parent.Children.push(newNode);
    } else {
      this.provider.rootNodes.push(newNode);
    }

    this.persistAndRefresh();
  }

  public async renameNode(node: WorkbenchNodeBase): Promise<void> {
    const newName = await vscode.window.showInputBox({
      value: node.label,
      placeHolder: 'Enter node name',
      prompt: 'Rename node',
      validateInput: value => value.trim().length === 0 ? 'Name is required' : undefined,
    });

    if (!newName) {
      return;
    }

    node.label = newName.trim();
    node.refreshUi();
    this.persistAndRefresh();
  }

  public async deleteNode(node: WorkbenchNodeBase): Promise<void> {
    const confirmation = await vscode.window.showWarningMessage(
      `Delete ${node.label}?`,
      { modal: true },
      'Delete'
    );

    if (confirmation !== 'Delete') {
      return;
    }

    const siblings = this.getSiblingList(node);
    const idx = siblings.findIndex(s => s.id === node.id);
    if (idx >= 0) {
      siblings.splice(idx, 1);
      this.persistAndRefresh(true);
    }
  }

  public moveUp(node: WorkbenchNodeBase): void {
    const siblings = this.getSiblingList(node);
    const idx = siblings.findIndex(s => s.id === node.id);
    if (idx <= 0) {
      return;
    }
    [siblings[idx - 1], siblings[idx]] = [siblings[idx], siblings[idx - 1]];
    this.persistAndRefresh();
  }

  public moveDown(node: WorkbenchNodeBase): void {
    const siblings = this.getSiblingList(node);
    const idx = siblings.findIndex(s => s.id === node.id);
    if (idx < 0 || idx === siblings.length - 1) {
      return;
    }
    [siblings[idx + 1], siblings[idx]] = [siblings[idx], siblings[idx + 1]];
    this.persistAndRefresh();
  }

  public async moveToFolder(node: WorkbenchNodeBase): Promise<void> {
    const folders = this.collectFolders();
    const candidates = folders.filter(folder => {
      if (folder.id === node.id) {
        return false;
      }
      if (folder.isDescendantOf(node)) {
        return false;
      }
      return true;
    });

    if (candidates.length === 0) {
      ui.showWarningMessage('No valid folder target found.');
      return;
    }

    const selected = await vscode.window.showQuickPick(
      candidates.map(folder => ({
        label: folder.label,
        description: folder.getPathLabel(),
        node: folder,
      })),
      { placeHolder: 'Select target folder' }
    );

    if (!selected) {
      return;
    }

    const currentSiblings = this.getSiblingList(node);
    const idx = currentSiblings.findIndex(s => s.id === node.id);
    if (idx >= 0) {
      currentSiblings.splice(idx, 1);
    }

    node.Parent = selected.node;
    selected.node.Children.push(node);

    this.persistAndRefresh();
  }

  public async openNode(node: WorkbenchNodeBase): Promise<void> {
    if (node.type === WorkbenchNodeType.Note) {
      await this.editNote(node);
      return;
    }

    if (node.type === WorkbenchNodeType.AirflowDag) {
      if (!node.data.dagId) {
        ui.showWarningMessage('DAG id is missing for this node.');
        return;
      }
      const { DagView } = await import('../dag/DagView');
      DagView.render(node.data.dagId);
      return;
    }

    if (node.type !== WorkbenchNodeType.File && node.type !== WorkbenchNodeType.BatchFile) {
      return;
    }

    const filePath = node.data.path?.trim();
    if (!filePath) {
      ui.showWarningMessage('File path is empty.');
      return;
    }

    const uri = await this.resolveNodePath(filePath);
    if (!uri) {
      return;
    }

    try {
      await vscode.workspace.fs.stat(uri);
    } catch {
      const createChoice = await vscode.window.showWarningMessage(
        `File not found: ${uri.fsPath}`,
        'Create File'
      );

      if (createChoice !== 'Create File') {
        return;
      }

      const dirUri = vscode.Uri.file(path.dirname(uri.fsPath));
      await vscode.workspace.fs.createDirectory(dirUri);
      await vscode.workspace.fs.writeFile(uri, new Uint8Array());
    }

    const doc = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(doc);
  }

  public async editNote(node: WorkbenchNodeBase): Promise<void> {
    if (node.type !== WorkbenchNodeType.Note) {
      return;
    }

    const text = await vscode.window.showInputBox({
      value: node.data.note ?? '',
      placeHolder: 'Edit note text',
      prompt: `Note: ${node.label}`,
    });

    if (text === undefined) {
      return;
    }

    node.data.note = text;
    node.refreshUi();
    this.persistAndRefresh();
  }

  public showOnlyInThisWorkspace(node: WorkbenchNodeBase): void {
    const workspaceName = vscode.workspace.name;
    if (!workspaceName) {
      ui.showInfoMessage('Please open a workspace first.');
      return;
    }

    node.setWorkspaceScope(workspaceName);
    this.persistAndRefresh(true);
  }

  public showInAnyWorkspace(node: WorkbenchNodeBase): void {
    node.setWorkspaceScope('');
    this.persistAndRefresh(true);
  }

  public async setColor(node: WorkbenchNodeBase): Promise<void> {
    const changed = await node.setIconColor();
    if (!changed) {
      return;
    }

    this.persistAndRefresh(true);
  }

  public async setTooltip(node: WorkbenchNodeBase): Promise<void> {
    const changed = await node.setCustomTooltip();
    if (!changed) {
      return;
    }

    this.persistAndRefresh(true);
  }

  public addFav(node: WorkbenchNodeBase): void {
    node.setFavorite(true);
    this.persistAndRefresh(true);
  }

  public removeFav(node: WorkbenchNodeBase): void {
    node.setFavorite(false);
    this.persistAndRefresh(true);
  }

  public hideNode(node: WorkbenchNodeBase): void {
    node.setHidden(true);
    this.persistAndRefresh(true);
  }

  public unHideNode(node: WorkbenchNodeBase): void {
    node.setHidden(false);
    this.persistAndRefresh(true);
  }

  public async triggerDag(node: WorkbenchNodeBase): Promise<void> {
    const dagId = this.getDagIdFromNode(node);
    if (!dagId || !Session.Current.Api) {
      return;
    }

    const result = await Session.Current.Api.triggerDag(dagId);
    if (result.isSuccessful) {
      ui.showInfoMessage(`DAG ${dagId} triggered.`);
    }
  }

  public async lastDAGRunLog(node: WorkbenchNodeBase): Promise<void> {
    const dagId = this.getDagIdFromNode(node);
    if (!dagId || !Session.Current.Api) {
      return;
    }

    let dagRunId = '';
    const latestRun = await Session.Current.Api.getLastDagRun(dagId);
    if (latestRun.isSuccessful && latestRun.result?.dag_run_id) {
      dagRunId = latestRun.result.dag_run_id;
    }

    DagLogView.render(dagId, dagRunId);
  }

  public async askAI(node: WorkbenchNodeBase): Promise<void> {
    const dagId = this.getDagIdFromNode(node);
    if (!dagId || !Session.Current.Api) {
      return;
    }

    const dagInfo = await Session.Current.Api.getDagInfo(dagId);
    const fileToken = dagInfo.isSuccessful ? dagInfo.result?.file_token : undefined;
    if (!fileToken) {
      ui.showErrorMessage('Failed to fetch DAG file token for AI analysis.');
      return;
    }

    await AIHandler.Current.askAI(dagId, fileToken);
  }

  public async showDagInfo(node: WorkbenchNodeBase): Promise<void> {
    const dagId = this.getDagIdFromNode(node);
    if (!dagId || !Session.Current.Api) {
      return;
    }

    const result = await Session.Current.Api.getDagInfo(dagId);
    if (!result.isSuccessful) {
      ui.showErrorMessage('Failed to fetch DAG info');
      return;
    }

    this.createAndOpenTempFile(JSON.stringify(result.result, null, 2), `${dagId}_info`, '.json');
  }

  private async createNode(type: WorkbenchNodeType, parent?: WorkbenchNodeBase): Promise<WorkbenchNodeBase | undefined> {
    if (type === WorkbenchNodeType.AirflowDag) {
      const dagIds = this.dagTreeView.getAvailableDagIds();
      if (dagIds.length === 0) {
        ui.showWarningMessage('No DAGs available. Connect and load Airflow DAGs first.');
        return undefined;
      }

      const selected = await vscode.window.showQuickPick(dagIds, {
        placeHolder: 'Select Airflow DAG',
      });
      if (!selected) {
        return undefined;
      }

      const node = new WorkbenchNodeBase(this.newNodeId(), type, selected, { dagId: selected }, parent?.workspace ?? '', parent);
      node.refreshUi();
      return node;
    }

    const name = await vscode.window.showInputBox({
      placeHolder: `Enter ${getTypeLabel(type)} name`,
      prompt: 'Node name',
      validateInput: value => value.trim().length === 0 ? 'Name is required' : undefined,
    });

    if (!name) {
      return undefined;
    }

    if (type === WorkbenchNodeType.File || type === WorkbenchNodeType.BatchFile) {
      const filePath = await vscode.window.showInputBox({
        placeHolder: 'Relative or absolute file path',
        prompt: 'File path',
        validateInput: value => value.trim().length === 0 ? 'Path is required' : undefined,
      });
      if (!filePath) {
        return undefined;
      }

      const node = new WorkbenchNodeBase(this.newNodeId(), type, name.trim(), { path: filePath.trim() }, parent?.workspace ?? '', parent);
      node.refreshUi();
      return node;
    }

    if (type === WorkbenchNodeType.Note) {
      const noteText = await vscode.window.showInputBox({
        placeHolder: 'Optional note content',
        prompt: 'Note content',
      });
      const node = new WorkbenchNodeBase(this.newNodeId(), type, name.trim(), { note: noteText ?? '' }, parent?.workspace ?? '', parent);
      node.refreshUi();
      return node;
    }

    const node = new WorkbenchNodeBase(this.newNodeId(), type, name.trim(), {}, parent?.workspace ?? '', parent);
    node.refreshUi();
    return node;
  }

  private getSiblingList(node: WorkbenchNodeBase): WorkbenchNodeBase[] {
    if (node.Parent) {
      return node.Parent.Children;
    }
    return this.provider.rootNodes;
  }

  private collectFolders(): WorkbenchNodeBase[] {
    const result: WorkbenchNodeBase[] = [];

    const walk = (nodes: WorkbenchNodeBase[]) => {
      for (const node of nodes) {
        if (node.isContainer()) {
          result.push(node);
        }
        if (node.Children.length > 0) {
          walk(node.Children);
        }
      }
    };

    walk(this.provider.rootNodes);
    return result;
  }

  private refreshAllNodes(nodes: WorkbenchNodeBase[]): void {
    for (const node of nodes) {
      node.refreshUi();
      if (node.Children.length > 0) {
        for (const child of node.Children) {
          child.Parent = node;
        }
        this.refreshAllNodes(node.Children);
      }
    }
  }

  private persistAndRefresh(immediate: boolean = false): void {
    if (immediate) {
      this.state.saveImmediate(this.provider.rootNodes);
    } else {
      this.state.scheduleSave(this.provider.rootNodes);
    }
    this.refresh();
  }

  private setViewMessage(): void {
    if (this.provider.rootNodes.length === 0) {
      this.view.message = 'Use + to add your first workbench node';
      return;
    }

    this.view.message = `${this.getBoolenSign(this.ShowOnlyFavorite)}Fav, ${this.getBoolenSign(this.ShowOnlyActive)}Active, Filter: ${this.FilterString}`;
  }

  private getDagIdFromNode(node: WorkbenchNodeBase): string | undefined {
    if (node.type !== WorkbenchNodeType.AirflowDag) {
      ui.showWarningMessage('This action is only available for Airflow DAG nodes.');
      return undefined;
    }

    const dagId = node.data.dagId?.trim();
    if (!dagId) {
      ui.showWarningMessage('DAG id is missing for this node.');
      return undefined;
    }

    return dagId;
  }

  private createAndOpenTempFile(content: string, prefix: string, extension: string): void {
    const tmpFile = tmp.fileSync({ mode: 0o644, prefix, postfix: extension });
    fs.appendFileSync(tmpFile.name, content);
    ui.openFile(tmpFile.name);
  }

  private isNodeVisibleInCurrentWorkspace(node: WorkbenchNodeBase): boolean {
    const workspaceName = vscode.workspace.name ?? '';
    let isVisibleForSelf = !node.workspace || node.workspace === workspaceName;

    if (isVisibleForSelf && this.FilterString.length > 0) {
      const filter = this.FilterString.toLowerCase();
      const nodeLabel = (node.label ?? '').toString().toLowerCase();
      if (!nodeLabel.includes(filter)) {
        isVisibleForSelf = false;
      }
    }

    if (isVisibleForSelf && this.ShowOnlyFavorite && !node.isFavorite) {
      isVisibleForSelf = false;
    }

    if (isVisibleForSelf && this.ShowOnlyActive && node.type === WorkbenchNodeType.AirflowDag) {
      const dagId = node.data.dagId ?? '';

      const isPaused = this.dagTreeView.getDagIsPaused(dagId);
      if (isPaused === true) {
        isVisibleForSelf = false;
      }
    }

    if (node.Children.length === 0) {
      return isVisibleForSelf;
    }

    const hasVisibleChild = node.Children.some(child => this.isNodeVisibleInCurrentWorkspace(child));
    return isVisibleForSelf || hasVisibleChild;
  }

  private saveViewState(): void {
    try {
      Session.Current.Context!.globalState.update('Workbench.FilterString', this.FilterString);
      Session.Current.Context!.globalState.update('Workbench.ShowOnlyActive', this.ShowOnlyActive);
      Session.Current.Context!.globalState.update('Workbench.ShowOnlyFavorite', this.ShowOnlyFavorite);
    } catch (error) {
      ui.logToOutput('WorkbenchTreeView.saveViewState Error !!!', error as Error);
    }
  }

  private loadViewState(): void {
    try {
      const filterString = Session.Current.Context!.globalState.get<string>('Workbench.FilterString');
      if (filterString !== undefined) {
        this.FilterString = filterString;
      }

      const showOnlyActive = Session.Current.Context!.globalState.get<boolean>('Workbench.ShowOnlyActive');
      if (showOnlyActive !== undefined) {
        this.ShowOnlyActive = showOnlyActive;
      }

      const showOnlyFavorite = Session.Current.Context!.globalState.get<boolean>('Workbench.ShowOnlyFavorite');
      if (showOnlyFavorite !== undefined) {
        this.ShowOnlyFavorite = showOnlyFavorite;
      }
    } catch (error) {
      ui.logToOutput('WorkbenchTreeView.loadViewState Error !!!', error as Error);
    }
  }

  private getBoolenSign(value: boolean): string {
    return value ? '✓' : '𐄂';
  }

  private async resolveNodePath(rawPath: string): Promise<vscode.Uri | undefined> {
    if (path.isAbsolute(rawPath)) {
      return vscode.Uri.file(rawPath);
    }

    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
      ui.showWarningMessage('No workspace folder is open.');
      return undefined;
    }

    return vscode.Uri.joinPath(folders[0].uri, rawPath);
  }

  private newNodeId(): string {
    if (typeof randomUUID === 'function') {
      return randomUUID();
    }

    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}
