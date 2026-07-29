#!/bin/bash
set -e

echo "======================================"
echo "  开始构建单词测试平台 (Render)"
echo "======================================"

PROJECT_ROOT=$(pwd)/..

echo ""
echo "[1/3] 安装前端依赖..."
cd "$PROJECT_ROOT/frontend"
npm install

echo ""
echo "[2/3] 构建前端..."
npm run build

echo ""
echo "[3/3] 安装后端依赖..."
cd "$PROJECT_ROOT/backend"
npm install --production=false

echo ""
echo "======================================"
echo "  构建完成！"
echo "======================================"
