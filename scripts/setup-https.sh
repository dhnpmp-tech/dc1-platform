#!/usr/bin/env bash
# Usage: sudo ./scripts/setup-https.sh
# Purpose: Install nginx + certbot, configure reverse proxy for backend:8083, enable HTTPS for api.dcp.sa

set -euo pipefail

DOMAIN="${DOMAIN:-api.dcp.sa}"
BACKEND_PORT="${BACKEND_PORT:-8083}"
EMAIL="${EMAIL:-admin@dcp.sa}"
NGINX_SITE="/etc/nginx/sites-available/${DOMAIN}"
NGINX_LINK="/etc/nginx/sites-enabled/${DOMAIN}"

if [[ "${EUID}" -ne 0 ]]; then
  echo "ERROR: Run as root (use sudo)." >&2
  exit 1
fi

if ! command -v curl >/dev/null 2>&1; then
  echo "ERROR: curl is required." >&2
  exit 1
fi

echo "Checking DNS for ${DOMAIN}..."
DNS_IP="$(getent ahostsv4 "${DOMAIN}" | awk '{print $1}' | head -n1 || true)"
if [[ -z "${DNS_IP}" ]] && command -v dig >/dev/null 2>&1; then
  DNS_IP="$(dig +short A "${DOMAIN}" | tail -n1 || true)"
fi

if [[ -z "${DNS_IP}" ]]; then
  echo "ERROR: Could not resolve ${DOMAIN}. Confirm DNS A record exists first." >&2
  exit 1
fi

PUBLIC_IP="$(curl -4fsS https://api.ipify.org || true)"
if [[ -n "${PUBLIC_IP}" ]] && [[ "${DNS_IP}" != "${PUBLIC_IP}" ]]; then
  echo "ERROR: DNS mismatch for ${DOMAIN}." >&2
  echo "Resolved A record: ${DNS_IP}" >&2
  echo "Current server IP: ${PUBLIC_IP}" >&2
  echo "Update DNS, wait for propagation, then rerun." >&2
  exit 1
fi

echo "Installing nginx + certbot packages..."
apt-get update
apt-get install -y nginx certbot python3-certbot-nginx

echo "Writing nginx reverse proxy config: ${NGINX_SITE}"
cat > "${NGINX_SITE}" <<EOF
server {
  listen 80;
  server_name ${DOMAIN};

  location / {
    proxy_pass http://localhost:${BACKEND_PORT};
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_set_header Connection "";
  }
}
EOF

ln -sf "${NGINX_SITE}" "${NGINX_LINK}"
rm -f /etc/nginx/sites-enabled/default

echo "Validating and reloading nginx..."
nginx -t
systemctl enable --now nginx
systemctl reload nginx

echo "Requesting Let's Encrypt certificate for ${DOMAIN}..."
certbot --nginx -d "${DOMAIN}" --non-interactive --agree-tos -m "${EMAIL}" --redirect

# certbot package usually installs a timer for automatic renewal
systemctl enable certbot.timer >/dev/null 2>&1 || true

echo "Testing HTTPS endpoint..."
curl -fsS "https://${DOMAIN}/api/health" >/dev/null

echo "SUCCESS: HTTPS is active."
echo "API URL: https://${DOMAIN}"
echo "Health check: https://${DOMAIN}/api/health"
