@echo off
setlocal enabledelayedexpansion
title 研途单词 - 公网访问模式

echo ==========================================
echo   研途单词 - 公网访问模式 (Ngrok)
echo ==========================================
echo.

cd /d "%~dp0"

where node >nul 2>nul
if %errorlevel% neq 0 (
  echo [错误] 未检测到 Node.js！请先安装 Node.js
  pause
  exit /b 1
)

if not exist ngrok.exe (
  echo [错误] 未找到 ngrok.exe，请先下载解压到项目目录
  pause
  exit /b 1
)

echo [1/3] 启动后端服务...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3001 ^| findstr LISTENING') do (
  echo   发现占用端口 3001 的进程: PID %%a，正在停止...
  taskkill /PID %%a /F >nul 2>nul
)
timeout /t 1 /nobreak >nul

cd backend
node -e "require('better-sqlite3')" >nul 2>nul
if %errorlevel% neq 0 (
  echo   SQLite 模块不匹配，正在重新编译...
  call npm rebuild better-sqlite3 >nul 2>nul
)

start "研途单词-后端" cmd /c "node src/server.js"
cd ..

timeout /t 3 /nobreak >nul

echo.
echo [2/3] 检查 Ngrok 认证...
ngrok config check >nul 2>nul
if %errorlevel% neq 0 (
  echo.
  echo   未检测到 Ngrok 认证！
  echo   请先访问 https://ngrok.com/signup 注册免费账号
  echo   然后在 https://dashboard.ngrok.com/get-started/your-authtoken 复制你的 authtoken
  echo.
  set /p token=请粘贴你的 Ngrok authtoken 后回车: 
  if defined token (
    ngrok config add-authtoken !token!
    echo   认证成功！
  ) else (
    echo   [错误] 未输入 token，无法启动 Ngrok
    pause
    exit /b 1
  )
)

echo.
echo [3/3] 启动 Ngrok 内网穿透...
echo   正在获取公网地址，请稍候...
echo.

start "研途单词-Ngrok" cmd /k "ngrok http 3001"

timeout /t 5 /nobreak >nul

echo.
echo ==========================================
echo   启动完成！
echo ==========================================
echo.
echo   本地访问: http://localhost:3001
echo.
echo   公网地址: 请查看弹出的 Ngrok 窗口
echo   把 Forwarding 后面的 https://xxx.ngrok-free.app 
echo   发给你的学生就能访问了！
echo.
echo   注意: 
echo   1. 关闭本窗口或关机后，公网地址会失效
echo   2. 免费版 Ngrok 每次重启地址会变
echo.
echo ==========================================
echo.
pause
