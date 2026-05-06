@echo off
setlocal

cd /d "%~dp0"

if exist "C:\Program Files\nodejs\npm.cmd" (
  "C:\Program Files\nodejs\npm.cmd" run dev
) else (
  npm.cmd run dev
)

endlocal
