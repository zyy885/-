@echo off
chcp 65001 >nul
cd /d "%~dp0"

git add -A
if %errorlevel% neq 0 (
    echo [错误] git add 失败
    pause
    exit /b 1
)

git commit -m "auto: 自动同步 %date:~0,10% %time:~0,5%"
if %errorlevel% neq 0 (
    echo [提示] 没有需要提交的更改，跳过 commit
)

git push origin main
if %errorlevel% neq 0 (
    echo [错误] git push 失败
    pause
    exit /b 1
)

echo.
echo [成功] 已同步到 GitHub，Render 将自动部署
timeout /t 3 >nul
