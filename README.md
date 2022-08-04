# Airflow Extension for Visual Studio Code

[![NPM Version](https://img.shields.io/npm/v/@vscode/webview-ui-toolkit?color=blue)](https://www.npmjs.com/package/@vscode/webview-ui-toolkit)
[![License: MIT](https://img.shields.io/badge/license-MIT-brightgreen)](./LICENSE)
![Deploy Docs Status](https://github.com/microsoft/vscode-webview-ui-toolkit/actions/workflows/docs-cd.yml/badge.svg)

![screenshoot](./docs/ScreenShot1.png)

## Introduction

This is a VSCode extension for Apache Airflow 2.0 and up.
You can trigger your DAGs, view execution logs using this extension and do much more.

## Getting started

You can manually install beta versions using vsix package file below.
Extension will be published to VsCode Extension Marketplace in a very short time.

https://github.com/necatiarslan/airflow-vscode-extension/blob/main/airflow-vscode-extension-1.0.1.vsix

## Enable Airflow Rest Api

To be able to connect a Airflow Server, you should enable Airflow Rest Api.
You can take a look the libk below how to do it.

https://airflow.apache.org/docs/apache-airflow/stable/security/api.html

## Bug Report

If you have an issue or new feature request, please click link below to add a new issue.

https://github.com/necatiarslan/airflow-vscode-extension/issues/new

Please start issue with "fix:" and new feature with "feat:" in the title.

## Todo List

- Multiple server support
- Dag Details View
		1. Trigger Dag
		2. Dag Execution Logs
		3. Execution Status
		4. Execution History
- Trigger Function
- Server Health Check/Status
- Logging
- Execution History / Report / Analysis
- Favorites
- Dag Coloring
- All Authentication Methods Support
- Code Snipets
- Dag Code Checks 

Thanks,
Necati ARSLAN
necatia@gmail.com