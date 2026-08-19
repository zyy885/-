@echo off
chcp 65001 >nul
title GitHub Upload Helper - Step by Step

echo ========================================
echo   GitHub 上传助手
echo ========================================
echo.

echo [1/3] 打开 db.js 编辑页...
start https://github.com/zyy885/-/edit/main/backend/src/db.js
echo.
echo 等待 3 秒...
timeout /t 3 /nobreak >nul

echo [2/3] 打开 server.js 编辑页...
start https://github.com/zyy885/-/edit/main/backend/src/server.js
echo.
echo 等待 3 秒...
timeout /t 3 /nobreak >nul

echo [3/3] 打开 TaskManage.jsx 编辑页...
start https://github.com/zyy885/-/edit/main/frontend/src/pages/TaskManage.jsx
echo.

echo ========================================
echo   已打开 3 个文件的编辑页面
echo ========================================
echo.
echo 操作说明：
echo 1. 每个页面滚到底部
echo 2. 点 "Commit changes" 保存
echo 3. 然后去 Render 部署
echo.
pause
