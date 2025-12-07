# 📊 Airflow Reports & Analytics

The **Reports** view provides a high-level, aggregate perspective of your Airflow environment. While the DAG Explorer focuses on individual DAG structures, the Reports view focuses on **execution history and operational status** across the entire system.

## 📅 Daily DAG Runs Report

The primary feature of the Reports view is the **Daily DAG Runs** dashboard. This interface allows you to answer the question: *"What happened in my Airflow environment today (or on a specific date)?"*

### Key Features

#### 1. Date Filtering
- Navigate through time to see the state of your system on any given day.
- Pick a specific date to load all DAG runs that occurred within that 24-hour window.

#### 2. Status Filtering
Filter the list of runs to focus on what matters. Toggle visibility for:
- ✅ **Success**: Completed runs.
- ❌ **Failed**: Runs that error out (useful for daily triage).
- 🏃 **Running**: Currently active executions.
- ⏳ **Queued**: Jobs waiting for scheduler/slots.

#### 3. Search & ID Filtering
- Quickly find specific DAGs by typing a partial DAG ID in the filter box.
- Useful for environments with hundreds of DAGs.

#### 4. Execution Details
For every run listed, you can see identifying information at a glance:
- **DAG ID**: The name of the workflow.
- **Run ID**: The unique instance identifier (e.g., `scheduled__2023...`).
- **Start Date**: Exact timestamp when the run began.
- **Duration**: How long the run took (or has been running).
- **State**: Color-coded status badge.

### 🔗 Deep Dive Navigation
The Reports view is fully integrated with the rest of the extension:
- **Clicking a Run**: detailed view of that specific DAG Run in the **DAG View**.
- **Context Actions**: Right-click (or use action buttons) to access logs or source code directly from the report list.

## 🛠 Usage Tips
- **Morning Standup**: Open the Reports view, filter to 'Yesterday', and select only 'Failed'. This gives you an instant "Kill List" of issues to resolve.
- **Performance Spot-Check**: Filter to 'Success' and scan the 'Duration' column to identify unusually slow runs that might need optimization.
