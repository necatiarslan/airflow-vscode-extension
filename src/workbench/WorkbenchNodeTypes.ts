export enum WorkbenchNodeType {
  AirflowDag = 'airflowDag',
  Folder = 'folder',
  File = 'file',
  Note = 'note',
  BatchFile = 'batchFile',
  BatchFolder = 'batchFolder',
}

export interface WorkbenchNodeData {
  dagId?: string;
  path?: string;
  note?: string;
  tooltip?: string;
}

export interface WorkbenchNodeState {
  id: string;
  type: WorkbenchNodeType;
  label: string;
  workspace?: string;
  iconColor?: string;
  isFavorite?: boolean;
  isHidden?: boolean;
  data?: WorkbenchNodeData;
  children: WorkbenchNodeState[];
}

export interface WorkbenchTreeState {
  version: number;
  nodes: WorkbenchNodeState[];
}

export function canContainChildren(type: WorkbenchNodeType): boolean {
  return type === WorkbenchNodeType.Folder || type === WorkbenchNodeType.BatchFolder;
}

export function getAllowedChildTypes(parentType?: WorkbenchNodeType): WorkbenchNodeType[] {
  const all: WorkbenchNodeType[] = [
    WorkbenchNodeType.AirflowDag,
    WorkbenchNodeType.Folder,
    WorkbenchNodeType.File,
    WorkbenchNodeType.Note,
    WorkbenchNodeType.BatchFile,
    WorkbenchNodeType.BatchFolder,
  ];

  if (!parentType) {
    return all;
  }

  if (!canContainChildren(parentType)) {
    return [];
  }

  return all;
}

export function getTypeLabel(type: WorkbenchNodeType): string {
  switch (type) {
    case WorkbenchNodeType.AirflowDag:
      return 'Airflow DAG';
    case WorkbenchNodeType.Folder:
      return 'Folder';
    case WorkbenchNodeType.File:
      return 'File';
    case WorkbenchNodeType.Note:
      return 'Note';
    case WorkbenchNodeType.BatchFile:
      return 'Batch File';
    case WorkbenchNodeType.BatchFolder:
      return 'Batch Folder';
    default:
      return 'Unknown';
  }
}
