import { DagView } from "../dag/DagView";
import { DagTreeView } from "../dag/DagTreeView";


export function DagTriggered(source: any, dagId: string, dagRunId: string) {
	
    if (!(source instanceof DagView) && DagView.Current && DagView.Current.dagId === dagId) {
        DagView.Current.goToDagRun(dagId, dagRunId);
    }

    if (!(source instanceof DagTreeView) && DagTreeView.Current) {
        DagTreeView.Current?.notifyDagStateWithDagId(dagId, dagRunId, "queued");
    }
    
}

export function DagRunCancelled(source: any, dagId: string, dagRunId: string) {
	
    if (!(source instanceof DagView) && DagView.Current && DagView.Current.dagId === dagId) {
        DagView.Current.goToDagRun(dagId, dagRunId);
    }

    if (!(source instanceof DagTreeView) && DagTreeView.Current) {
        DagTreeView.Current?.notifyDagStateWithDagId(dagId, dagRunId, "failed");
    }
    
}


export function DagPaused(source: any, dagId: string) {
	
    if (!(source instanceof DagView) && DagView.Current && DagView.Current.dagId === dagId) {
        DagView.Current.loadDagInfoOnly();
    }

    if (!(source instanceof DagTreeView) && DagTreeView.Current) {
        DagTreeView.Current?.notifyDagPaused(dagId)
    }
    
}

export function DagUnPaused(source: any, dagId: string) {
	
    if (!(source instanceof DagView) && DagView.Current && DagView.Current.dagId === dagId) {
        DagView.Current.loadDagInfoOnly();
    }
    
    if (!(source instanceof DagTreeView) && DagTreeView.Current) {
        DagTreeView.Current?.notifyDagUnPaused(dagId)
    }
    
}