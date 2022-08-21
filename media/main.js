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

  const prevRunLinkList = document.querySelectorAll("[id^='history-dag-run-id']");
  for (let i = 0; i < prevRunLinkList.length; i++) {
    //prevRunLinkList[i].id
    prevRunLinkList[i].addEventListener("click", dagRunHistoryLinkClicked);
}

}

function triggerDagClick() {
  vscode.postMessage({
    command: "run-trigger-dag",
    config: document.getElementById("run_config").value,
    date: document.getElementById("run_date").value,
  });
}

function viewLogDagClick() {
  vscode.postMessage({
    command: "run-view-log",
  });
}

function runMoreDagRunDetailClick() {
  vscode.postMessage({
    command: "run-more-dagrun-detail",
  });
}

function otherDagDetailClick() {
  vscode.postMessage({
    command: "other-dag-detail",
  });
}

function tasksMoreDetailClick() {
  vscode.postMessage({
    command: "tasks-more-detail",
  });
}

function revRunsRefreshClick() {
  vscode.postMessage({
    command: "rev-runs-refresh",
    text: "",
  });
}

function infoSourceCodeClick() {
  vscode.postMessage({
    command: "info-source-code",
  });
}

function runPauseDagClick() {
  vscode.postMessage({
    command: "run-pause-dag",
  });
}

function runUnPauseDagClick() {
  vscode.postMessage({
    command: "run-unpause-dag",
  });
}

function runLastRunCheckClick() {
  vscode.postMessage({
    command: "run-lastrun-check",
  });
}



function dagRunHistoryLinkClicked() {
  vscode.postMessage({
    command: "history-dag-run-id",
  });
}

