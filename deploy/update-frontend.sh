#!/bin/bash
# Пересборка фронта на VPS после git pull (тот же origin, что и nginx в remote-setup.sh).
set -euo pipefail

APP_DIR="/opt/bakor-docflow"

cd "$APP_DIR"
git fetch origin
git reset --hard origin/master

cd "$APP_DIR/frontend"
npm ci
# Пустой VITE_API_URL — запросы на тот же хост (см. frontend/src/api/client.js).
VITE_API_URL= npm run build

echo "Frontend rebuilt. Обновите страницу в браузере (Ctrl+Shift+R)."
