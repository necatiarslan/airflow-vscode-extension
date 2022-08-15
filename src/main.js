const vscode = acquireVsCodeApi();

window.addEventListener("load", main);

function main() {
  const triggerDag = document.getElementById("trigger_dag");
  triggerDag.addEventListener("click", triggerDagClick);

  const viewLogDag = document.getElementById("view_log");
  viewLogDag.addEventListener("click", viewLogDagClick);
}

function triggerDagClick() {
  vscode.postMessage({
    command: "trigger_dag",
    text: "Trigger Dag",
  });
}

function viewLogDagClick() {
  vscode.postMessage({
    command: "view_log",
    text: "View Log",
  });
}