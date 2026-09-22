@echo off
cd /d "%~dp0server"
start "" "node_modules\electron\dist\electron.exe" "trayApp.js"
exit
