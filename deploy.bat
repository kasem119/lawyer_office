@echo off
chcp 65001 >nul
title Lawyer Office - Server Deployment
cd /d "%~dp0"

if "%~1"=="" (
    python deploy\deploy.py
    echo.
    pause
    exit /b %errorlevel%
)

set "FIRST_ARG=%~1"
if "%FIRST_ARG:~0,1%"=="-" (
    python deploy\deploy.py %*
) else (
    python deploy\deploy.py --mode %*
)
