# Airflow Extension for Visual Studio Code

[![NPM Version](https://img.shields.io/npm/v/@vscode/webview-ui-toolkit?color=blue)](https://www.npmjs.com/package/@vscode/webview-ui-toolkit)
[![License: MIT](https://img.shields.io/badge/license-MIT-brightgreen)](./LICENSE)
![Deploy Docs Status](https://github.com/microsoft/vscode-webview-ui-toolkit/actions/workflows/docs-cd.yml/badge.svg)
[![GitHub](https://flat.badgen.net/github/release/necatiarslan/airflow-vscode-extension/)](https://github.com/necatiarslan/airflow-vscode-extension/releases)
[![Visual Studio Marketplace](https://vsmarketplacebadge.apphb.com/installs-short/necatiarslan.airflow-vscode-extension.svg?style=flat-square)](https://marketplace.visualstudio.com/items?itemName=necatiarslan.airflow-vscode-extension)

![screenshoot](./docs/airflow-extension.png)


## Introduction

This is a VSCode extension for Apache Airflow 2.0 and up.
You can trigger your DAGs, pause/unpause DAGs, view execution logs, explore source code and do much more.
The motivation of this extension is having the same functionality like Airflow Web UI and make Airflow development easier for vscode developers.

## Requirements - Airflow REST Api

To be able to connect an Airflow Server, you should enable Airflow Rest Api.
You can take a look the link below on how to do it.

https://airflow.apache.org/docs/apache-airflow/stable/security/api.html

## Bug Report

If you have an issue or new feature request, please click link below to add a new issue.

https://github.com/necatiarslan/airflow-vscode-extension/issues/new

Please start issue with "fix:" and new feature with "feat:" in the title.

## Install Airflow In Your Local
If you want to test Airflow on your machine in a docker container, click link below on how to run Airflow in your local machine in 5 mins.

https://www.youtube.com/watch?v=aTaytcxy2Ck

## Troubleshooting
- Can Not Connect to Airflow

Check Api Url, UserName and Password.
Api URL should be like this below.

http://<SERVER_NAME>:<PORT_NUMBER>/api/v1/dags

- DAG Load Error !!! FORBIDDEN 

Check your API authentication configuration.

Run this command on your airflow server

$ airflow config get-value api auth_backends

Result Should Be

airflow.api.auth.backend.basic_auth

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
I am working on these features now, so they will be available in a couple of weeks.

- Multiple server support
- Filter by tags
- DAG Explorer (a treeview which lists your dags and tasks)
- Connections, Variables, XComs

- Server Health Check/Status
- Support Kerberos Authentication
- Dag Code Checks
- Highligt DAG and Operator Keywords



Thanks,
Necati ARSLAN
necatia@gmail.com