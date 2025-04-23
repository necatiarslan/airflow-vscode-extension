build:
    vsce package
    mv *.vsix ./vsix/

publish:
    vsce publish

npm_outdated:
    npm outdated

npm_upgrade:
    brew upgrade # upgrade homebrew
    brew install node # install the latest node version
    npm install -g npm@latest # upgrade to the latest version
    nvm alias default node # set the default node version
    nvm install node # install the latest node version

    npm upgrade # upgrade all packages used in the project

npm_doctor:
    node -v
    npm -v
    tsc -v
    npm doctor
    npm prune # remove unused dependencies
    npx depcheck # check dependencies
    npm-check # check dependencies
    
npm-install:
    rm -rf node_modules package-lock.json
    npm install
    npx tsc --noEmit

npm_rebuild:
    rm -rf node_modules
    npm install

get_token:
ENDPOINT_URL="http://localhost:8080/"
curl -X POST ${ENDPOINT_URL}auth/token \
-H "Content-Type: application/json" \
-d '{
    "username": "airflow",
    "password": "airflow"
}'

list_dags:
ENDPOINT_URL="http://localhost:8080/"
curl -X GET ${ENDPOINT_URL}api/v2/dags \
  -H "Authorization: Bearer eyJhbGciOiJIUzUxMiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIiwiaXNzIjpbXSwiYXVkIjoiYXBhY2hlLWFpcmZsb3ciLCJuYmYiOjE3NDUzNzQyNzcsImV4cCI6MTc0NTQ2MDY3NywiaWF0IjoxNzQ1Mzc0Mjc3fQ.AF6BY0Zd7Sct-sOKk5dd9Kt-BmWLVRrQluKDIGKsrKgSPPdmtCUvAuw9194Dj2MqinNH8oWnuneYgiW_NC211A"
