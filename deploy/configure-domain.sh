#!/bin/bash
# Nginx + Let's Encrypt для публичного домена (после того как A-запись указывает на VPS).
set -euo pipefail

DOMAIN="${1:-docs.nerohub.ru}"
APP_DIR="/opt/bakor-docflow"
PUBLIC_URL="https://${DOMAIN}"

if [[ -z "${CERTBOT_EMAIL:-}" ]]; then
  echo "Укажите email для Let's Encrypt: CERTBOT_EMAIL=you@example.com bash deploy/configure-domain.sh"
  exit 1
fi

if [[ ! -d "$APP_DIR/frontend/dist" ]]; then
  echo "Нет $APP_DIR/frontend/dist — сначала выполните deploy/remote-setup.sh или update-app.sh"
  exit 1
fi

apt-get update -qq
apt-get install -y -qq certbot python3-certbot-nginx

cat > /etc/nginx/sites-available/bakor-docflow <<NGINX
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};

    root ${APP_DIR}/frontend/dist;
    index index.html;

    client_max_body_size 100M;

    location = /moderator {
        try_files /index.html =404;
    }

    location ~ ^/(auth|users|documents|folders|reports|email-templates|email-template-folders|letters|health) {
        proxy_pass http://127.0.0.1:4011;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location ^~ /moderator/ {
        proxy_pass http://127.0.0.1:4011;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/bakor-docflow /etc/nginx/sites-enabled/bakor-docflow
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$CERTBOT_EMAIL" --redirect

if [[ -f "$APP_DIR/backend/.env" ]]; then
  if grep -q '^APP_PUBLIC_URL=' "$APP_DIR/backend/.env"; then
    sed -i "s|^APP_PUBLIC_URL=.*|APP_PUBLIC_URL=${PUBLIC_URL}|" "$APP_DIR/backend/.env"
  else
    echo "APP_PUBLIC_URL=${PUBLIC_URL}" >> "$APP_DIR/backend/.env"
  fi
  pm2 restart bakor-api 2>/dev/null || true
fi

echo "DOMAIN_OK"
echo "Site: ${PUBLIC_URL}"
