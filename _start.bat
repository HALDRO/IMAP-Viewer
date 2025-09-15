@echo off
title ImapViewer Starter
echo Installing dependencies using npm...
call npm install
if %errorlevel% neq 0 (
    echo Error: npm install failed.
    pause
    exit /b %errorlevel%
)
echo.
echo Starting the application...
call npm start
if %errorlevel% neq 0 (
    echo Error: npm start failed.
    pause
    exit /b %errorlevel%
)
pause 