@echo off
chcp 65001 >nul
title Git 代理一键配置

echo ========================================
echo   Git 代理一键配置脚本
echo ========================================
echo.

echo [1/2] 配置 Git 代理为 127.0.0.1:7890 (Clash 默认端口)...
git config --global http.proxy http://127.0.0.1:7890
git config --global https.proxy http://127.0.0.1:7890
echo.
echo [2/2] 配置完成！
echo.

echo ========================================
echo   验证当前 Git 代理设置
echo ========================================
echo.
echo HTTP 代理:
git config --global http.proxy
echo.
echo HTTPS 代理:
git config --global https.proxy
echo.

echo ========================================
echo   配置成功！
echo ========================================
echo.
echo 使用说明：
echo   1. 先打开 Clash for Windows，并选择一个节点
echo   2. 保持 Clash 运行
echo   3. 然后就可以正常使用 git push 了
echo.
echo 如需取消代理，运行: unset-git-proxy.bat
echo.
pause