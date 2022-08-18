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

}

function triggerDagClick() {
  vscode.postMessage({
    command: "run-trigger-dag",
    text: "Trigger Dag",
    config: document.getElementById("run_config").value,
    date: document.getElementById("run_date").value,
  });
}

function viewLogDagClick() {
  vscode.postMessage({
    command: "run-view-log",
    text: "View Log",
  });
}

function runMoreDagRunDetailClick() {
  vscode.postMessage({
    command: "run-more-dagrun-detail",
    text: "More",
  });
}

function otherDagDetailClick() {
  vscode.postMessage({
    command: "other-dag-detail",
    text: "More",
  });
}

function tasksMoreDetailClick() {
  vscode.postMessage({
    command: "tasks-more-detail",
    text: "More",
  });
}
