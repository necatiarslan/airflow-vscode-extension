const vscode = acquireVsCodeApi();

window.addEventListener("load", main);

function main() {
  const triggerDag = document.getElementById("run-trigger-dag");
  triggerDag.addEventListener("click", triggerDagClick);

  const viewLogDag = document.getElementById("run-view-log");
  viewLogDag.addEventListener("click", viewLogDagClick);

  const runMoreDagRunDetail = document.getElementById("run-more-dagrun-detail");
  runMoreDagRunDetail.addEventListener("click", runMoreDagRunDetailClick);

  const otherDagDetail = document.getElementById("other-dag-detail");
  otherDagDetail.addEventListener("click", otherDagDetailClick);

  const tasksMoreDetail = document.getElementById("tasks-more-detail");
  tasksMoreDetail.addEventListener("click", tasksMoreDetailClick);

  const revRunsRefresh = document.getElementById("rev-runs-refresh");
  revRunsRefresh.addEventListener("click", revRunsRefreshClick);

  const infoSourceCode = document.getElementById("info-source-code");
  infoSourceCode.addEventListener("click", infoSourceCodeClick);

  const runPauseDag = document.getElementById("run-pause-dag");
  runPauseDag.addEventListener("click", runPauseDagClick);

  const runUnPauseDag = document.getElementById("run-unpause-dag");
  runUnPauseDag.addEventListener("click", runUnPauseDagClick);

  const runLastRunCheck = document.getElementById("run-lastrun-check");
  runLastRunCheck.addEventListener("click", runLastRunCheckClick);

  const runLastRunCancel = document.getElementById("run-lastrun-cancel");
  runLastRunCancel.addEventListener("click", runLastRunCancelClick);

  const tasksRefreshButton = document.getElementById("tasks-refresh");
  tasksRefreshButton.addEventListener("click", tasksRefreshClicked);

  const prevRunLinkList = document.querySelectorAll("[id^='history-dag-run-id']");
  for (let i = 0; i < prevRunLinkList.length; i++) {
    //prevRunLinkList[i].id
    prevRunLinkList[i].addEventListener("click", dagRunHistoryLinkClicked);
  }

  const taskLogLinkList = document.querySelectorAll("[id^='task-log-link-']");
  for (let i = 0; i < taskLogLinkList.length; i++) {
    //prevRunLinkList[i].id
    taskLogLinkList[i].addEventListener("click", taskLogLinkClicked);
  }

  const tabControl = document.getElementById("tab-control");
  tabControl.addEventListener("change", tabControlChanged);

}


  function triggerDagClick() {
  vscode.postMessage({
    command: "run-trigger-dag",
    config: document.getElementById("run_config").value,
    date: document.getElementById("run_date").value,
    activetabid: document.getElementById("tab-control").activeid,
  });
}

function viewLogDagClick() {
  vscode.postMessage({
    command: "run-view-log",
    activetabid: document.getElementById("tab-control").activeid,
  });
}

function runMoreDagRunDetailClick() {
  vscode.postMessage({
    command: "run-more-dagrun-detail",
    activetabid: document.getElementById("tab-control").activeid,
  });
}

function otherDagDetailClick() {
  vscode.postMessage({
    command: "other-dag-detail",
    activetabid: document.getElementById("tab-control").activeid,
  });
}

function tasksMoreDetailClick() {
  vscode.postMessage({
    command: "tasks-more-detail",
    activetabid: document.getElementById("tab-control").activeid,
  });
}

function revRunsRefreshClick() {
  vscode.postMessage({
    command: "rev-runs-refresh",
    activetabid: document.getElementById("tab-control").activeid,
  });
}

function infoSourceCodeClick() {
  vscode.postMessage({
    command: "info-source-code",
    activetabid: document.getElementById("tab-control").activeid,
  });
}

function runPauseDagClick() {
  vscode.postMessage({
    command: "run-pause-dag",
    activetabid: document.getElementById("tab-control").activeid,
  });
}

function runUnPauseDagClick() {
  vscode.postMessage({
    command: "run-unpause-dag",
    activetabid: document.getElementById("tab-control").activeid,
  });
}

function runLastRunCheckClick() {
  vscode.postMessage({
    command: "run-lastrun-check",
    activetabid: document.getElementById("tab-control").activeid,
  });
}

function runLastRunCancelClick() {
  vscode.postMessage({
    command: "run-lastrun-cancel",
    activetabid: document.getElementById("tab-control").activeid,
  });
}

function dagRunHistoryLinkClicked(e) {
  vscode.postMessage({
    command: "history-dag-run-id",
    activetabid: document.getElementById("tab-control").activeid,
    id: e.target.id,
  });
}

function tasksRefreshClicked() {
  vscode.postMessage({
    command: "tasks-refresh",
    activetabid: document.getElementById("tab-control").activeid,
  });
}

function taskLogLinkClicked(e) {
  vscode.postMessage({
    command: "task-log-link",
    activetabid: document.getElementById("tab-control").activeid,
    id: e.target.id,
  });
}

function tabControlChanged(e) {
  vscode.postMessage({
    command: "tabControlChanged",
    activeid: e.target.activeid
  });
}