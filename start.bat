@echo off
setlocal enabledelayedexpansion
title Yantu Vocab - Starting...

echo ==========================================
echo   Yantu Vocab - Startup Script
echo ==========================================
echo.

cd /d "%~dp0"

where node >nul 2>nul
if %errorlevel% neq 0 (
  echo [ERROR] Node.js not found!
  echo.
  echo Please install Node.js first:
  echo   Download: https://nodejs.org/
  echo   Install LTS version, then re-run this script
  echo.
  pause
  exit /b 1
)

echo Node.js version:
node -v
echo npm version:
npm -v
echo.

echo [1/4] Checking backend dependencies...
if not exist "backend\node_modules" (
  echo   Installing backend dependencies, may take 1-2 minutes...
  cd backend
  call npm install
  if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Failed to install backend dependencies!
    echo Check network connection, or run: cd backend ^&^& npm install
    pause
    exit /b 1
  )
  cd ..
  echo   Backend dependencies installed
) else (
  echo   Backend dependencies exist, skipping
)

echo.
echo [2/4] Checking port 3001...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3001 ^| findstr LISTENING') do (
  echo   Found process using port 3001: PID %%a, stopping...
  taskkill /PID %%a /F >nul 2>nul
)
timeout /t 2 /nobreak >nul
echo   Port 3001 is ready

echo.
echo [3/4] Checking SQLite module...
cd backend
node -e "require('better-sqlite3')" >nul 2>nul
if %errorlevel% neq 0 (
  echo   SQLite module mismatch detected, rebuilding...
  call npm rebuild better-sqlite3
  if !errorlevel! neq 0 (
    echo   Rebuild failed, trying reinstall...
    if exist "node_modules\better-sqlite3" (
      rmdir /s /q node_modules\better-sqlite3
    )
    call npm install better-sqlite3
  )
  echo   SQLite module fixed
) else (
  echo   SQLite module OK
)
cd ..

echo.
echo [4/4] Starting server...
echo   URL: http://localhost:3001
echo   Browser will open automatically. Do not close this window.
echo   Press Ctrl+C to stop server
echo.
echo ==========================================
echo.

cd backend
start "" http://localhost:3001
node src/server.js

echo.
echo ==========================================
echo   Server stopped.
echo ==========================================
echo.
pause
