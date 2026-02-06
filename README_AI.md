# 🤖 AI Airflow Assistant

The **Airflow Assistant** is a powerful AI companion integrated directly into your VS Code environment. Powered by the VS Code Chat API, it understands your Airflow environment context—DAGs, logs, and configurations—to help you monitor, control, and troubleshoot your workflows using natural language.

![screenshoot](./docs/readme/video2.gif)

## ⚡ Getting Started

1. Open the **VS Code Chat** (usually in the Secondary Side Bar).
2. Type `@airflow` followed by your question or command.
3. The assistant will analyze your request and use one of its **24 specialized tools** to perform the action or fetch the requested data.

---

## 🛠️ Capabilities & Tools

The AI Assistant can perform actions across four main categories:

### 1. 🕹️ Control & Execution
Directly interact with your DAGs without clicking buttons.
- **Trigger DAGs**: `@airflow trigger <dag_id> with config {...}`
- **Pause/Unpause**: `@airflow pause <dag_id>` or `@airflow unpause all`
- **Stop Execution**: `@airflow cancel run <run_id>`
- **Tools Used**: `trigger_dag_run`, `pause_dag`, `unpause_dag`, `cancel_dag_run`

### 2. 🔍 Analysis & Troubleshooting
Debug failed runs instantly. The AI reads logs and code so you don't have to hunt for errors.
- **Diagnose Failures**: `@airflow why did <dag_id> fail?`
- **Analyze Logs**: `@airflow analyze latest run of <dag_id>`
- **Run Details**: `@airflow get details for run <run_id>`
- **View Source Code**: `@airflow show me the source code for <dag_id>`
- **Tools Used**: `analyse_dag_latest_run`, `get_dag_run_detail`, `get_failed_runs`, `get_dag_source_code`

### 3. 📊 Monitoring & Status
Get a high-level overview of your Airflow cluster.
- **Active Runs**: `@airflow what is running right now?`
- **Health Check**: `@airflow show me failed runs from the last 24 hours`
- **History**: `@airflow show history for <dag_id> last week`
- **Tools Used**: `list_active_dags`, `list_paused_dags`, `get_running_dags`, `get_dag_history`, `get_dag_runs`

### 4. 🧭 Navigation
Quickly jump to specific views in the extension using voice-like commands.
- **Open Views**: `@airflow show connections`, `@airflow open server health`
- **Go to Log**: `@airflow open logs for <dag_id>`
- **Tools Used**: `go_to_dag_view`, `go_to_dag_log_view`, `go_to_connections_view`, `go_to_variables_view`, etc.

---

## 💡 Example Prompts

### 🆘 Scenario : A Critical DAG Failed
**You**: `@airflow The 'etl_daily_sync' DAG failed. Can you analyze the logs and tell me why?`
**AI**: *Executes `analyse_dag_latest_run`...* "I found an error in the 'extract' task. The logs show a `ConnectionTimeout` error when trying to reach the Postgres DB. Here is the relevant log snippet..."

### 🚀 Scenario: Manual Trigger
**You**: `@airflow Trigger 'data_backfill' for date 2023-11-01 with config {"dry_run": true}`
**AI**: *Executes `trigger_dag_run`...* "I've triggered 'data_backfill' for 2023-11-01. The run ID is `manual__2023...`."

### 🔎 Scenario: Application Health
**You**: `@airflow Are there any stalled or running DAGs right now?`
**AI**: *Executes `get_running_dags`...* "Currently, 'report_gen' is in a `running` state. All other DAGs are queued or finished."

## 🔒 Security & Context
- The AI only performs "State Changing" actions (like Trigger or Pause) after you confirm them in the Chat UI.
- It respects the permissions of the user credentials configured in the extension.

## 🧩 Skills
Airflow Skills are available as a bundled set to help the assistant respond with consistent, task-focused guidance. Installing them improves accuracy and keeps responses aligned with Airflow best practices and this extension's workflows.
