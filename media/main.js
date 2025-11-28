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

  const historyLoadRuns = document.getElementById("history-load-runs");
  historyLoadRuns.addEventListener("click", historyLoadRunsClick);

  const infoSourceCode = document.getElementById("info-source-code");
  infoSourceCode.addEventListener("click", infoSourceCodeClick);

  const runPauseDag = document.getElementById("run-pause-dag");
  runPauseDag.addEventListener("click", runPauseDagClick);

  const runUnPauseDag = document.getElementById("run-unpause-dag");
  runUnPauseDag.addEventListener("click", runUnPauseDagClick);

  const runAskAI = document.getElementById("run-ask-ai");
  runAskAI.addEventListener("click", runAskAIClick);

  const runLastRunCheck = document.getElementById("run-lastrun-check");
  runLastRunCheck.addEventListener("click", runLastRunCheckClick);

  const runLastRunCancel = document.getElementById("run-lastrun-cancel");
  runLastRunCancel.addEventListener("click", runLastRunCancelClick);

  const tasksRefreshButton = document.getElementById("tasks-refresh");
  tasksRefreshButton.addEventListener("click", tasksRefreshClicked);

  const runUpdateNoteButton = document.getElementById("run-update-note");
  runUpdateNoteButton.addEventListener("click", runUpdateNoteClicked);

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

  const taskXComLinkList = document.querySelectorAll("[id^='task-xcom-link-']");
  for (let i = 0; i < taskXComLinkList.length; i++) {
    taskXComLinkList[i].addEventListener("click", taskXComLinkClicked);
  }

  const tabControl = document.getElementById("tab-control");
  tabControl.addEventListener("change", tabControlChanged);

}


function getActiveTabId() {
  const tabControl = document.getElementById("tab-control");
  // vscode-tabs uses selectedIndex (0-based)
  const index = tabControl.selectedIndex;
  return "tab-" + (index + 1);
}

function triggerDagClick() {
  vscode.postMessage({
    command: "run-trigger-dag",
    config: document.getElementById("run_config").value,
    date: document.getElementById("run_date").value,
    activetabid: getActiveTabId(),
  });
}

function viewLogDagClick() {
  vscode.postMessage({
    command: "run-view-log",
    activetabid: getActiveTabId(),
  });
}

function runMoreDagRunDetailClick() {
  vscode.postMessage({
    command: "run-more-dagrun-detail",
    activetabid: getActiveTabId(),
  });
}

function otherDagDetailClick() {
  vscode.postMessage({
    command: "other-dag-detail",
    activetabid: getActiveTabId(),
  });
}

function tasksMoreDetailClick() {
  vscode.postMessage({
    command: "tasks-more-detail",
    activetabid: getActiveTabId(),
  });
}

function historyLoadRunsClick() {
  vscode.postMessage({
    command: "history-load-runs",
    activetabid: getActiveTabId(),
    date: document.getElementById("history_date").value,
  });
}

function infoSourceCodeClick() {
  vscode.postMessage({
    command: "info-source-code",
    activetabid: getActiveTabId(),
  });
}

function runPauseDagClick() {
  vscode.postMessage({
    command: "run-pause-dag",
    activetabid: getActiveTabId(),
  });
}

function runUnPauseDagClick() {
  vscode.postMessage({
    command: "run-unpause-dag",
    activetabid: getActiveTabId(),
  });
}

function runAskAIClick() {
  vscode.postMessage({
    command: "run-ask-ai",
    activetabid: getActiveTabId(),
  });
}

function runLastRunCheckClick() {
  vscode.postMessage({
    command: "run-lastrun-check",
    activetabid: getActiveTabId(),
  });
}

function runLastRunCancelClick() {
  vscode.postMessage({
    command: "run-lastrun-cancel",
    activetabid: getActiveTabId(),
  });
}

function dagRunHistoryLinkClicked(e) {
  vscode.postMessage({
    command: "history-dag-run-id",
    activetabid: getActiveTabId(),
    id: e.target.id,
  });
}

function tasksRefreshClicked() {
  vscode.postMessage({
    command: "tasks-refresh",
    activetabid: getActiveTabId(),
  });
}

function runUpdateNoteClicked() {
  vscode.postMessage({
    command: "run-update-note",
    activetabid: getActiveTabId(),
  });
}

function taskLogLinkClicked(e) {
  vscode.postMessage({
    command: "task-log-link",
    activetabid: getActiveTabId(),
    id: e.target.id,
  });
}

function taskXComLinkClicked(e) {
  vscode.postMessage({
    command: "task-xcom-link",
    activetabid: getActiveTabId(),
    id: e.target.id,
  });
}

function tabControlChanged(e) {
  vscode.postMessage({
    command: "tabControlChanged",
    activeid: "tab-" + (e.target.selectedIndex + 1)
  });
}