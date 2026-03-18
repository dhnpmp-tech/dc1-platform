#!/usr/bin/env bash
# DC1 API — HTTPS setup with nginx + Let's Encrypt (Certbot)
#
# Usage:
#   sudo bash setup-https.sh api.dcp.sa admin@dcp.sa
#
# What this does:
#   1. Installs nginx + certbot
#   2. Obtains a Let's Encrypt certificate for DOMAIN
#   3. Deploys the nginx reverse-proxy config
#   4. Configures HTTP → HTTPS redirect
#   5. Sets up auto-renewal (systemd timer + cron fallback)
#
# Prerequisites:
#   - Ubuntu 22.04+ on the VPS
#   - Port 80 and 443 open in firewall (ufw allow 80 && ufw allow 443)
#   - DNS A record: DOMAIN → 76.13.179.86 (propagated)
#   - DC1 Express API running on port 8083

set -euo pipefail

DOMAIN="${1:-api.dcp.sa}"
EMAIL="${2:-admin@dcp.sa}"
NGINX_CONF_SRC="$(dirname "$0")/dc1-api.conf"
NGINX_CONF_DEST="/etc/nginx/sites-available/dc1-api"
NGINX_ENABLED="/etc/nginx/sites-enabled/dc1-api"
CERTBOT_WEBROOT="/var/www/certbot"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
log_ok()   { echo -e "${GREEN}✓${NC} $1"; }
log_info() { echo -e "${YELLOW}▶${NC} $1"; }
log_err()  { echo -e "${RED}✗${NC} $1"; exit 1; }

echo -e "\n${BLUE}════════════════════════════════════════${NC}"
echo -e "${BLUE}  DC1 HTTPS Setup — $DOMAIN${NC}"
echo -e "${BLUE}════════════════════════════════════════${NC}\n"

# ── 1. Install dependencies ──────────────────────────────────────────────────
log_info "Installing nginx and certbot..."
apt-get update -qq
apt-get install -y --no-install-recommends nginx certbot python3-certbot-nginx
log_ok "nginx and certbot installed"

# ── 2. Create certbot webroot ────────────────────────────────────────────────
mkdir -p "$CERTBOT_WEBROOT"
log_ok "Certbot webroot: $CERTBOT_WEBROOT"

# ── 3. Deploy stub nginx config for ACME challenge (HTTP only) ───────────────
log_info "Deploying temporary HTTP-only nginx config for ACME challenge..."
cat > "$NGINX_CONF_DEST" <<NGINX_STUB
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN;

    location /.well-known/acme-challenge/ {
        root $CERTBOT_WEBROOT;
    }

    location / {
        return 200 'DC1 API — HTTPS setup in progress';
        add_header Content-Type text/plain;
    }
}
NGINX_STUB

# Enable the site
ln -sf "$NGINX_CONF_DEST" "$NGINX_ENABLED" 2>/dev/null || true
# Remove default site if it exists
rm -f /etc/nginx/sites-enabled/default

nginx -t && systemctl reload nginx
log_ok "Temporary nginx config active"

# ── 4. Obtain Let's Encrypt certificate ──────────────────────────────────────
log_info "Obtaining SSL certificate for $DOMAIN..."
certbot certonly \
    --webroot \
    --webroot-path="$CERTBOT_WEBROOT" \
    --non-interactive \
    --agree-tos \
    --email "$EMAIL" \
    -d "$DOMAIN"
log_ok "Certificate obtained: /etc/letsencrypt/live/$DOMAIN/"

# ── 5. Deploy full nginx reverse-proxy config ────────────────────────────────
log_info "Deploying full HTTPS reverse-proxy config..."
# Replace domain placeholder in config template
sed "s/api\.dcp\.sa/$DOMAIN/g" "$NGINX_CONF_SRC" > "$NGINX_CONF_DEST"

nginx -t || log_err "nginx config test failed — check $NGINX_CONF_DEST"
systemctl reload nginx
log_ok "HTTPS reverse proxy active at https://$DOMAIN"

# ── 6. Auto-renewal ──────────────────────────────────────────────────────────
log_info "Configuring certificate auto-renewal..."

# Certbot installs a systemd timer on Ubuntu 20.04+ — verify it
if systemctl is-enabled certbot.timer &>/dev/null; then
    log_ok "certbot.timer is enabled (systemd auto-renewal active)"
else
    # Fallback: cron job (runs twice daily as recommended by Let's Encrypt)
    CRON_LINE="0 3,15 * * * certbot renew --quiet --post-hook 'systemctl reload nginx'"
    (crontab -l 2>/dev/null | grep -qF 'certbot renew') || \
        (crontab -l 2>/dev/null; echo "$CRON_LINE") | crontab -
    log_ok "Cron renewal job added (twice daily at 03:00 and 15:00)"
fi

# ── 7. Firewall ──────────────────────────────────────────────────────────────
if command -v ufw &>/dev/null; then
    ufw allow 'Nginx Full' 2>/dev/null || true
    ufw --force enable 2>/dev/null || true
    log_ok "ufw: Nginx Full (80 + 443) allowed"
fi

# ── 8. Summary ───────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo -e "${GREEN}  HTTPS setup complete!${NC}"
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo ""
echo "  API endpoint:  https://$DOMAIN"
echo "  Certificate:   /etc/letsencrypt/live/$DOMAIN/"
echo "  Renews:        automatic (certbot timer or cron)"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "  1. Update BACKEND_URL in Vercel env vars to https://$DOMAIN"
echo "  2. Update daemon installer default: ApiUrl = 'https://$DOMAIN'"
echo "  3. Test: curl -s https://$DOMAIN/api/health"
echo ""
