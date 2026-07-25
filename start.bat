@echo off
title 研途单词 - 启动中...

echo ==========================================
echo   研途单词 - Windows 启动脚本
echo ==========================================
echo.

cd /d "%~dp0"

where node >nul 2>nul
if %errorlevel% neq 0 (
  echo [错误] 未检测到 Node.js！
  echo.
  echo 请先安装 Node.js:
  echo   下载地址: https://nodejs.org/zh-cn
  echo   下载 LTS 长期支持版，安装完成后重新运行本脚本
  echo.
  pause
  exit /b 1
)

echo Node.js 版本:
node -v
echo npm 版本:
npm -v
echo.

echo [1/2] 检查并安装后端依赖...
if not exist "backend\node_modules" (
  echo   正在安装后端依赖，首次运行需要 1-2 分钟...
  cd backend
  call npm install
  if %errorlevel% neq 0 (
    echo.
    echo [错误] 后端依赖安装失败！
    echo 请检查网络连接，或手动在 backend 目录下执行 npm install
    pause
    exit /b 1
  )
  cd ..
  echo   后端依赖安装完成
) else (
  echo   后端依赖已存在，跳过
)

echo.
echo [2/2] 启动服务...
echo   服务地址: http://localhost:3001
echo   浏览器会自动打开，请不要关闭此窗口
echo   按 Ctrl+C 停止服务
echo.
echo ==========================================
echo.

cd backend
start "" http://localhost:3001
node src/server.js

if %errorlevel% neq 0 (
  echo.
  echo [错误] 服务启动失败！
  echo 请检查端口 3001 是否被占用
  pause
)
