# Airflow Extension for Visual Studio Code


![screenshoot](./docs/airflow-extension.png)


## Introduction

This is a VSCode extension for Apache Airflow 2.0 and up.
You can trigger your DAGs, pause/unpause DAGs, view execution logs, explore source code and do much more.
The motivation of this extension is having the same functionality like Airflow Web UI and make Airflow development easier for vscode developers.

To install the vscode extension, search 'Airflow' in the marketplace and install owned by Necati ARSLAN.

## Requirements - Airflow REST Api

To be able to connect an Airflow Server, you should enable Airflow Rest Api.
You can take a look the link below on how to do it.

https://airflow.apache.org/docs/apache-airflow/stable/security/api.html

## Survey
Please take this survey to help me make the extension better.\
https://bit.ly/airflow-extension-survey

## Bug Report

If you have an issue or new feature request, please click link below to add a new issue.

https://github.com/necatiarslan/airflow-vscode-extension/issues/new

Please start issue with "fix:" and new feature with "feat:" in the title.

## Install Airflow In Your Local
If you want to test Airflow on your machine in a docker container, click link below on how to run Airflow in your local machine in 5 mins.

https://www.youtube.com/watch?v=aTaytcxy2Ck

## Dag Tree
![screenshoot](./docs/dagview-dagtree.png)

## Dag Run
![screenshoot](./docs/dagview-run.png)

## Dag Tasks
![screenshoot](./docs/dagview-tasks.png)

# Dag Info
![screenshoot](./docs/dagview-info.png)

## Previous Dag Runs
![screenshoot](./docs/dagview-prevruns.png)


## Todo List

- Fix: not runned task duration
- Skip Try=0 Logs
- Run Selected Tasks
- Connections, Variables, XComs
- Hierarchical Tasks List
- Tasks graph view
- Tasks gantt chart view
- Prev Run, Date Filter
- Task View
    - Instance Details
    - Rendered Template
    - Log
    - X-Com
- TreeView Dag List Pagination (top 100 limit now)
- Treeview Dag hierarcy by owner, last run date, next run date, dag file folder structure, tags
- New DAG Wizard
- Run DAGs in your local (devcontainer)
- DAG Dry Run
- DAG Validation
- Run DAG Tests
- DAG Dependencies
- Preview DAG flow in your local
- Hide Dags & Show Hidden Dags Filter
- Add Survey to the DAG View
- Add Survey and Bug Report to TreeView Other commands
- DagView Table Colors
- How To Enable Airflow API and Connect
- DAG.test() support

- Highligt DAG and Operator Keywords
- Server Health Check/Status
- Dag Code Checks
- Server Alias

Follow me on linkedin to get latest news \
https://www.linkedin.com/in/necati-arslan/

Thanks, \
Necati ARSLAN \
necatia@gmail.com
