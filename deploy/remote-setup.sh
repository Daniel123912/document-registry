#!/bin/bash
set -euo pipefail

APP_DIR="/opt/bakor-docflow"
REPO_URL="https://github.com/Daniel123912/document-registry.git"
PUBLIC_URL="http://151.248.113.156"

export DEBIAN_FRONTEND=noninteractive

apt-get update -qq
apt-get install -y -qq git curl ca-certificates nginx openssl

if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi

if ! command -v node >/dev/null 2>&1 || [[ "$(node -v | cut -d. -f1 | tr -d v)" -lt 20 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y -qq nodejs
fi

npm install -g pm2

mkdir -p "$APP_DIR"
if [[ -d "$APP_DIR/.git" ]]; then
  cd "$APP_DIR"
  git fetch origin
  git reset --hard origin/master
else
  git clone "$REPO_URL" "$APP_DIR"
  cd "$APP_DIR"
fi

docker compose up -d

JWT_SECRET="$(openssl rand -hex 32)"
VAULT_KEY="$(openssl rand -hex 32)"
DB_PASS="123456"

cat > "$APP_DIR/backend/.env" <<EOF
PORT=4011
JWT_SECRET=${JWT_SECRET}
PASSWORD_VAULT_KEY=${VAULT_KEY}
MODERATOR_LOGIN=moderator
MODERATOR_PASSWORD=$(openssl rand -base64 18 | tr -d '/+=' | head -c 16)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=my_project_db
DB_USER=postgres
DB_PASSWORD=${DB_PASS}
APP_PUBLIC_URL=${PUBLIC_URL}
SMTP_HOST=smtp.mail.ru
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=
SMTP_PASS=
MAIL_FROM=Реестр БАКОР <noreply@mail.ru>
EOF

echo "Waiting for PostgreSQL..."
for i in $(seq 1 30); do
  if docker compose exec -T postgres pg_isready -U postgres -d my_project_db >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

cd "$APP_DIR/backend"
npm ci
npm run seed

pm2 delete bakor-api 2>/dev/null || true
pm2 start src/server.js --name bakor-api
pm2 save
pm2 startup systemd -u root --hp /root 2>/dev/null | tail -1 | bash || true

cd "$APP_DIR/frontend"
npm ci
# Пустой VITE_API_URL: в production client.js ходит на тот же origin (/auth, /documents… через nginx).
VITE_API_URL= npm run build

cat > /etc/nginx/sites-available/bakor-docflow <<'NGINX'
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    root /opt/bakor-docflow/frontend/dist;
    index index.html;

    client_max_body_size 100M;

    # Страница входа модератора — SPA, не API
    location = /moderator {
        try_files /index.html =404;
    }

    location ~ ^/(auth|users|documents|folders|reports|email-templates|email-template-folders|letters|health) {
        proxy_pass http://127.0.0.1:4011;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location ^~ /moderator/ {
        proxy_pass http://127.0.0.1:4011;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/bakor-docflow /etc/nginx/sites-enabled/bakor-docflow
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable nginx
systemctl restart nginx

echo "DEPLOY_OK"
echo "Site: ${PUBLIC_URL}"
echo "Moderator password: $(grep MODERATOR_PASSWORD "$APP_DIR/backend/.env" | cut -d= -f2-)"
