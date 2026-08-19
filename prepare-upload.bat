@echo off
chcp 65001 >nul
title Prepare Files for GitHub Upload

echo ========================================
echo   准备上传文件到 GitHub
echo ========================================
echo.

cd /d "%~dp0"

echo [1/3] 创建临时目录...
if exist upload-temp rmdir /s /q upload-temp
mkdir upload-temp
mkdir upload-temp\backend\src
mkdir upload-temp\frontend\src\pages

echo [2/3] 复制修改的文件...
copy backend\src\db.js upload-temp\backend\src\db.js
copy backend\src\server.js upload-temp\backend\src\server.js
copy frontend\src\pages\TaskManage.jsx upload-temp\frontend\src\pages\TaskManage.jsx

echo [3/3] 打开临时目录...
start upload-temp

echo.
echo ========================================
echo   准备完成！
echo ========================================
echo.
echo 现在请：
echo 1. 打开 https://github.com/zyy885/-/upload/main
echo 2. 从打开的 upload-temp 文件夹中拖入 3 个文件
echo    - backend/src/db.js
echo    - backend/src/server.js
echo    - frontend/src/pages/TaskManage.jsx
echo 3. 滚到底部点 Commit changes
echo.
echo 文件位置：%~dp0upload-temp
echo.
pause
