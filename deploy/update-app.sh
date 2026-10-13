#!/bin/bash
# Обновление кода на VPS: git, backend (pm2), пересборка фронта.
set -euo pipefail

APP_DIR="/opt/bakor-docflow"

cd "$APP_DIR"
git fetch origin
git reset --hard origin/master

docker compose up -d

cd "$APP_DIR/backend"
npm ci
pm2 restart bakor-api || pm2 start src/server.js --name bakor-api
pm2 save

cd "$APP_DIR/frontend"
npm ci
VITE_API_URL= npm run build

echo "DEPLOY_UPDATE_OK"
