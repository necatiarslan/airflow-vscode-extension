# 🛡️ Airflow Admin Management

The **Admin** panel in the Airflow VS Code extension provides a centralized interface to view and monitor the configuration and health of your Airflow environment. Instead of navigating through the Airflow Web UI, you can access critical administrative details directly within VS Code.

## 📋 Available Views

The Admin section is organized into several key views, mirroring the standard Airflow administration menus:

### 1. 🔌 Connections
View all configured connections in your Airflow environment.
- **Purpose**: Verify connection IDs, types, and host details for your external integrations (AWS, GCP, Databases, etc.).
- **Details Shown**: Connection Id, Conn Type, Host, Port.

### 2. ✖️ Variables
Monitor your global Airflow Key-Value pairs.
- **Purpose**: Check the values of configuration variables used across your DAGs.
- **Security**: Sensitive values (masked in Airflow) will follow Airflow's security practices.

### 3. 📦 Providers
List all installed Airflow Providers and their versions.
- **Purpose**: specific provider versions to ensure compatibility with your DAG code.
- **Details**: Provider Name, Version, Description.

### 4. 🧩 Plugins
View all loaded Airflow Plugins.
- **Purpose**: Verify that your custom plugins or macros are correctly loaded by the Airflow scheduler.
- **Details**: Plugin Name, Source.

### 5. ⚙️ Configurations
Access the live `airflow.cfg` configuration.
- **Purpose**: Review core system settings such as executor type, parallelism, parallelism, and authentication backends.
- **View**: displays the configuration as a raw or formatted list depending on the API response.

### 6. ❤️ Server Health
Real-time health check of your Airflow components.
- **Monitoring**:
  - **Meta Database**: Status of the backend database connection.
  - **Scheduler**: Status of the scheduler heartbeat.
  - **Triggerer**: Status of the triggerer service (if applicable).

## 🚀 How to Access
1. Open the **Airflow Extension** in the VS Code Sidebar.
2. Locate the **Admin** view in the sidebar pane (usually at the bottom).
3. Click on the item (e.g., "Connections", "Providers") to open the detailed webview panel.

> **Note**: These views do not currently support *editing* or *creating* new admin resources to prevent accidental changes to production environments. They are read-only for monitoring and verification.
