@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo 知潮启动后，请打开 http://127.0.0.1:4173
call npm.cmd start
pause
