@echo off
setlocal

cd /d "%~dp0"

if exist "C:\Program Files\nodejs\node.exe" (
  "C:\Program Files\nodejs\node.exe" .electron-vue\build.js
) else (
  node .electron-vue\build.js
)

if errorlevel 1 exit /b %errorlevel%

if exist "node_modules\.bin\electron-builder.cmd" (
  "node_modules\.bin\electron-builder.cmd" build --win -c.npmRebuild=false
) else (
  npx.cmd electron-builder build --win -c.npmRebuild=false
)

endlocal
