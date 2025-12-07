const vscode = acquireVsCodeApi();

window.addEventListener("load", main);

function main() {
  // Use event delegation for all clicks on the document body
  // This ensures links work even after HTML is dynamically re-rendered
  document.body.addEventListener("click", function (e) {
    const target = e.target;
    const targetId = target.id;

    // Handle button clicks
    if (targetId === "run-trigger-dag") {
      triggerDagClick();
      return;
    }
    if (targetId === "run-view-log") {
      viewLogDagClick();
      return;
    }
    if (targetId === "run-more-dagrun-detail") {
      runMoreDagRunDetailClick();
      return;
    }
    if (targetId === "other-dag-detail") {
      otherDagDetailClick();
      return;
    }
    if (targetId === "tasks-more-detail") {
      tasksMoreDetailClick();
      return;
    }
    if (targetId === "history-load-runs") {
      historyLoadRunsClick();
      return;
    }
    if (targetId === "info-source-code") {
      infoSourceCodeClick();
      return;
    }
    if (targetId === "run-pause-dag") {
      runPauseDagClick();
      return;
    }
    if (targetId === "run-unpause-dag") {
      runUnPauseDagClick();
      return;
    }
    if (targetId === "run-ask-ai") {
      runAskAIClick();
      return;
    }
    if (targetId === "run-lastrun-check") {
      runLastRunCheckClick();
      return;
    }
    if (targetId === "run-lastrun-cancel") {
      runLastRunCancelClick();
      return;
    }
    if (targetId === "tasks-refresh") {
      tasksRefreshClicked();
      return;
    }
    if (targetId === "run-update-note") {
      runUpdateNoteClicked(e);
      return;
    }

    // Handle link clicks with preventDefault
    const linkTarget = target.closest('a');
    if (linkTarget) {
      const linkId = linkTarget.id;

      // Update note link
      if (linkId === "run-update-note-link") {
        e.preventDefault();
        runUpdateNoteClicked(e);
        return;
      }

      // History DAG run links
      if (linkId && linkId.startsWith("history-dag-run-id")) {
        e.preventDefault();
        // Use linkTarget.id instead of e.target.id inside the handler or pass the link element
        // But dagRunHistoryLinkClicked uses e.target.id. We should update it or fake the event?
        // Better to update the handler or pass the id explicitly.
        // Let's pass the element or update event target? We can't update event target.
        // We can call a modified function or pass explicit ID.
        // dagRunHistoryLinkClicked reads e.target.id.
        // Let's modify the calls here to pass the ID.
        vscode.postMessage({
          command: "history-dag-run-id",
          activetabid: getActiveTabId(),
          id: linkId,
        });
        return;
      }

      // Task log links
      if (linkId && linkId.startsWith("task-log-link-")) {
        e.preventDefault();
        vscode.postMessage({
          command: "task-log-link",
          activetabid: getActiveTabId(),
          id: linkId,
        });
        return;
      }

      // Task XCom links
      if (linkId && linkId.startsWith("task-xcom-link-")) {
        e.preventDefault();
        vscode.postMessage({
          command: "task-xcom-link",
          activetabid: getActiveTabId(),
          id: linkId,
        });
        return;
      }
    }
  });

  // Tab control still needs direct attachment as it's a custom element
  const tabControl = document.getElementById("tab-control");
  if (tabControl) {
    tabControl.addEventListener("change", tabControlChanged);
  }
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
  e.preventDefault();
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

function runUpdateNoteClicked(e) {
  e.preventDefault();
  vscode.postMessage({
    command: "run-update-note",
    activetabid: getActiveTabId(),
  });
}

function taskLogLinkClicked(e) {
  e.preventDefault();
  vscode.postMessage({
    command: "task-log-link",
    activetabid: getActiveTabId(),
    id: e.target.id,
  });
}

function taskXComLinkClicked(e) {
  e.preventDefault();
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