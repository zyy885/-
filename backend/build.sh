#!/bin/bash
set -e

echo "======================================"
echo "  开始构建单词测试平台 (Render)"
echo "======================================"

PROJECT_ROOT=$(pwd)/..

echo ""
echo "[1/4] 安装前端依赖..."
cd "$PROJECT_ROOT/frontend"
npm install

echo ""
echo "[2/4] 构建前端..."
npm run build

echo ""
echo "[3/4] 安装后端依赖..."
cd "$PROJECT_ROOT/backend"
npm install --production=false

echo ""
echo "[4/4] 写入构建信息..."
BUILD_TIME=$(date -u +"%Y-%m-%d %H:%M:%S UTC")
cat > "$PROJECT_ROOT/backend/build-info.json" <<EOF
{
  "buildTime": "$BUILD_TIME"
}
EOF
echo "构建时间: $BUILD_TIME"

echo ""
echo "======================================"
echo "  构建完成！"
echo "======================================"
