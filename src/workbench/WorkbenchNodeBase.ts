import * as vscode from 'vscode';
import {
  WorkbenchNodeData,
  WorkbenchNodeState,
  WorkbenchNodeType,
  canContainChildren,
} from './WorkbenchNodeTypes';

export class WorkbenchNodeBase extends vscode.TreeItem {
  public Parent?: WorkbenchNodeBase;
  public Children: WorkbenchNodeBase[] = [];
  public iconColor?: string;
  public isFavorite: boolean = false;
  public isHidden: boolean = false;

  constructor(
    public readonly id: string,
    public type: WorkbenchNodeType,
    public label: string,
    public data: WorkbenchNodeData = {},
    public workspace: string = '',
    parent?: WorkbenchNodeBase
  ) {
    super(label, canContainChildren(type) ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None);
    this.Parent = parent;
    this.description = this.getDescription();
    this.tooltip = this.getTooltip();
    this.iconPath = this.getIcon();
    this.contextValue = this.getContextValue();

    if (this.type === WorkbenchNodeType.File || this.type === WorkbenchNodeType.BatchFile || this.type === WorkbenchNodeType.Note || this.type === WorkbenchNodeType.AirflowDag) {
      this.command = {
        command: 'workbenchTreeView.openNode',
        title: 'Open Node',
        arguments: [this],
      };
    }
  }

  public refreshUi(): void {
    this.collapsibleState = canContainChildren(this.type) ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None;
    this.label = this.label;
    this.description = this.getDescription();
    this.tooltip = this.getTooltip();
    this.iconPath = this.getIcon();
    this.contextValue = this.getContextValue();

    if (this.type === WorkbenchNodeType.File || this.type === WorkbenchNodeType.BatchFile || this.type === WorkbenchNodeType.Note || this.type === WorkbenchNodeType.AirflowDag) {
      this.command = {
        command: 'workbenchTreeView.openNode',
        title: 'Open Node',
        arguments: [this],
      };
    } else {
      this.command = undefined;
    }
  }

  public toState(): WorkbenchNodeState {
    return {
      id: this.id,
      type: this.type,
      label: this.label,
      workspace: this.workspace,
      iconColor: this.iconColor,
      isFavorite: this.isFavorite,
      isHidden: this.isHidden,
      data: this.data,
      children: this.Children.map(c => c.toState()),
    };
  }

  public static fromState(state: WorkbenchNodeState, parent?: WorkbenchNodeBase): WorkbenchNodeBase {
    const node = new WorkbenchNodeBase(state.id, state.type, state.label, state.data ?? {}, state.workspace ?? '', parent);
    node.iconColor = state.iconColor;
    node.isFavorite = state.isFavorite ?? false;
    node.isHidden = state.isHidden ?? false;
    node.Children = state.children.map(child => WorkbenchNodeBase.fromState(child, node));
    node.refreshUi();
    return node;
  }

  public async setCustomTooltip(): Promise<boolean> {
    const tooltip = await vscode.window.showInputBox({
      placeHolder: 'Enter custom tooltip (leave empty to reset)',
      value: this.data.tooltip ?? '',
    });

    if (tooltip === undefined) {
      return false;
    }

    this.data.tooltip = tooltip.trim() || undefined;
    this.refreshUi();
    return true;
  }

  public setFavorite(value: boolean): void {
    this.isFavorite = value;
    this.refreshUi();
    for (const child of this.Children) {
      child.setFavorite(value);
    }
  }

  public setHidden(value: boolean): void {
    this.isHidden = value;
    this.refreshUi();
    for (const child of this.Children) {
      child.setHidden(value);
    }
  }

  public async setIconColor(): Promise<boolean> {
    const colors: { label: string; token: string | undefined }[] = [
      { label: '$(circle-outline) Default', token: undefined },
      { label: '$(symbol-color) Blue', token: 'charts.blue' },
      { label: '$(symbol-color) Green', token: 'charts.green' },
      { label: '$(symbol-color) Orange', token: 'charts.orange' },
      { label: '$(symbol-color) Red', token: 'charts.red' },
      { label: '$(symbol-color) Purple', token: 'charts.purple' },
      { label: '$(symbol-color) Yellow', token: 'charts.yellow' },
      { label: '$(symbol-color) Gray', token: 'charts.gray' },
    ];

    const selected = await vscode.window.showQuickPick(colors.map(c => c.label), {
      placeHolder: 'Select icon color',
    });

    if (selected === undefined) {
      return false;
    }

    const chosen = colors.find(c => c.label === selected);
    this.iconColor = chosen?.token;
    this.refreshUi();
    return true;
  }

  public setWorkspaceScope(value: string): void {
    this.workspace = value;
    this.refreshUi();
    for (const child of this.Children) {
      child.setWorkspaceScope(value);
    }
  }

  public isContainer(): boolean {
    return canContainChildren(this.type);
  }

  public isDescendantOf(node: WorkbenchNodeBase): boolean {
    let current: WorkbenchNodeBase | undefined = this.Parent;
    while (current) {
      if (current.id === node.id) {
        return true;
      }
      current = current.Parent;
    }
    return false;
  }

  public getPathLabel(): string {
    const labels: string[] = [this.label];
    let current = this.Parent;
    while (current) {
      labels.unshift(current.label);
      current = current.Parent;
    }
    return labels.join(' / ');
  }

  private getTooltip(): string {
    if (this.data.tooltip && this.data.tooltip.trim().length > 0) {
      return this.data.tooltip;
    }

    if (this.type === WorkbenchNodeType.AirflowDag) {
      return `${this.label}\nDAG: ${this.data.dagId ?? ''}`;
    }
    if (this.type === WorkbenchNodeType.Note) {
      return `${this.label}\n${this.data.note ?? ''}`;
    }
    if (this.type === WorkbenchNodeType.File || this.type === WorkbenchNodeType.BatchFile) {
      return `${this.label}\n${this.data.path ?? ''}`;
    }
    return this.label;
  }

  private getDescription(): string | undefined {
    if (this.isHidden) {
      return 'Hidden';
    }

    if (this.type === WorkbenchNodeType.AirflowDag) {
      return this.data.dagId;
    }
    if (this.type === WorkbenchNodeType.File || this.type === WorkbenchNodeType.BatchFile) {
      return this.data.path;
    }
    if (this.type === WorkbenchNodeType.Note) {
      if (!this.data.note) {
        return 'Empty note';
      }
      const preview = this.data.note.replace(/\s+/g, ' ').trim();
      return preview.length > 28 ? `${preview.slice(0, 28)}...` : preview;
    }
    return undefined;
  }

  private getIcon(): vscode.ThemeIcon {
    const applyColor = (id: string): vscode.ThemeIcon => {
      return this.iconColor ? new vscode.ThemeIcon(id, new vscode.ThemeColor(this.iconColor)) : new vscode.ThemeIcon(id);
    };

    switch (this.type) {
      case WorkbenchNodeType.AirflowDag:
        return applyColor('circle-outline');
      case WorkbenchNodeType.Folder:
        return applyColor('folder');
      case WorkbenchNodeType.File:
        return applyColor('file');
      case WorkbenchNodeType.Note:
        return applyColor('note');
      case WorkbenchNodeType.BatchFile:
        return applyColor('terminal-bash');
      case WorkbenchNodeType.BatchFolder:
        return applyColor('folder-library');
      default:
        return applyColor('symbol-misc');
    }
  }

  private getContextValue(): string {
    const parts: string[] = ['#WorkbenchNode#'];

    if (this.type === WorkbenchNodeType.AirflowDag) { parts.push('TypeAirflowDag#'); }
    if (this.type === WorkbenchNodeType.Folder) { parts.push('TypeFolder#'); }
    if (this.type === WorkbenchNodeType.File) { parts.push('TypeFile#'); }
    if (this.type === WorkbenchNodeType.Note) { parts.push('TypeNote#'); }
    if (this.type === WorkbenchNodeType.BatchFile) { parts.push('TypeBatchFile#'); }
    if (this.type === WorkbenchNodeType.BatchFolder) { parts.push('TypeBatchFolder#'); }

    parts.push(this.isContainer() ? 'IsContainer#' : '!IsContainer#');
    parts.push(this.Parent ? 'HasParent#' : '!HasParent#');
    parts.push(this.workspace ? 'ShowInAnyWorkspace#' : 'ShowOnlyInThisWorkspace#');
    parts.push(this.isFavorite ? 'RemoveFav#' : 'AddFav#');
    parts.push(this.isHidden ? 'UnHide#' : 'Hide#');

    return `#${parts.join('')}`;
  }
}
