@echo off
chcp 65001 >nul
title GitHub Upload Helper

echo ========================================
echo   GitHub Upload Helper
echo ========================================
echo.

cd /d "%~dp0"

echo [1/3] Checking changed files...
echo.
git status --short
echo.

echo [2/3] Saving file list...
git diff --name-only HEAD > temp-changed-files.txt
echo File list saved to temp-changed-files.txt
echo.

echo [3/3] Opening GitHub upload page...
start https://github.com/zyy885/-/upload/main
echo.

echo ========================================
echo   Files to upload:
echo ========================================
echo.
type temp-changed-files.txt
echo.
echo ========================================
echo   Done! Please drag the above files
echo   to the GitHub page that opened.
echo ========================================
echo.
pause
