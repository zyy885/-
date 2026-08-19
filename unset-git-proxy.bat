@echo off
chcp 65001 >nul
title Git 代理一键取消

echo ========================================
echo   Git 代理一键取消脚本
echo ========================================
echo.

echo 正在取消 Git 代理设置...
git config --global --unset http.proxy
git config --global --unset https.proxy
echo.

echo ========================================
echo   验证当前 Git 代理设置
echo ========================================
echo.
echo HTTP 代理:
git config --global http.proxy
echo (如果显示为空，表示已取消)
echo.
echo HTTPS 代理:
git config --global https.proxy
echo (如果显示为空，表示已取消)
echo.

echo ========================================
echo   已取消代理设置！
echo ========================================
echo.
pause