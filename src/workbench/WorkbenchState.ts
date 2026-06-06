import { Session } from '../common/Session';
import { WorkbenchNodeBase } from './WorkbenchNodeBase';
import { WorkbenchTreeState } from './WorkbenchNodeTypes';

export class WorkbenchState {
  private static readonly STATE_KEY = 'Workbench.TreeState.v1';
  private saveTimer: NodeJS.Timeout | undefined;

  public scheduleSave(rootNodes: WorkbenchNodeBase[]): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }

    this.saveTimer = setTimeout(() => {
      this.saveImmediate(rootNodes);
    }, 500);
  }

  public saveImmediate(rootNodes: WorkbenchNodeBase[]): void {
    if (!Session.Current.Context) {
      return;
    }

    const state: WorkbenchTreeState = {
      version: 1,
      nodes: rootNodes.map(node => node.toState()),
    };

    void Session.Current.Context.globalState.update(WorkbenchState.STATE_KEY, state);
  }

  public load(): WorkbenchNodeBase[] {
    if (!Session.Current.Context) {
      return [];
    }

    const state = Session.Current.Context.globalState.get<WorkbenchTreeState>(WorkbenchState.STATE_KEY);
    if (!state || state.version !== 1 || !Array.isArray(state.nodes)) {
      return [];
    }

    return state.nodes.map(nodeState => WorkbenchNodeBase.fromState(nodeState));
  }
}
