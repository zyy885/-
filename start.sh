#!/bin/bash
set -e

echo "=========================================="
echo "  单词测试系统 - 生产启动脚本"
echo "=========================================="

cd "$(dirname "$0")"

echo ""
echo "[1/3] 检查并安装后端依赖..."
if [ ! -d "backend/node_modules" ]; then
  cd backend && npm install --production && cd ..
else
  echo "  后端依赖已存在，跳过"
fi

echo ""
echo "[2/3] 构建前端..."
if [ ! -d "frontend/dist" ]; then
  cd frontend && npm install && npm run build && cd ..
else
  echo "  前端已构建，如需重新构建请手动执行: cd frontend && npm run build"
fi

echo ""
echo "[3/3] 启动服务..."
echo "  服务地址: http://localhost:${PORT:-3001}"
echo "  按 Ctrl+C 停止服务"
echo ""

cd backend
exec node src/server.js
