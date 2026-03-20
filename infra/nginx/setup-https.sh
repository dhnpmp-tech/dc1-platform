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

require_root() {
    if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
        log_err "Run as root (example: sudo bash $0 $DOMAIN $EMAIL)"
    fi
}

install_if_missing() {
    local packages=()
    local pkg=""
    for pkg in "$@"; do
        if ! dpkg -s "$pkg" >/dev/null 2>&1; then
            packages+=("$pkg")
        fi
    done

    if [[ ${#packages[@]} -gt 0 ]]; then
        log_info "Installing missing packages: ${packages[*]}"
        apt-get update -qq
        apt-get install -y --no-install-recommends "${packages[@]}"
    else
        log_info "Required packages already installed"
    fi
}

ensure_renew_hook() {
    local hook_dir="/etc/letsencrypt/renewal-hooks/deploy"
    local hook_file="$hook_dir/reload-nginx.sh"
    mkdir -p "$hook_dir"
    cat > "$hook_file" <<'HOOK'
#!/usr/bin/env bash
set -euo pipefail
systemctl reload nginx
HOOK
    chmod 755 "$hook_file"
    log_ok "Certbot deploy hook installed: $hook_file"
}

ensure_renew_cron() {
    local cron_line="0 3,15 * * * certbot renew --quiet"
    if ! crontab -l 2>/dev/null | grep -qF "$cron_line"; then
        (crontab -l 2>/dev/null; echo "$cron_line") | crontab -
        log_ok "Cron renewal job added (twice daily at 03:00 and 15:00)"
    else
        log_ok "Cron renewal job already present"
    fi
}

verify_health_json() {
    local url="https://$DOMAIN/api/health"
    local attempt=1
    local body=""

    while [[ $attempt -le 10 ]]; do
        if body="$(curl -fsS --max-time 15 "$url" 2>/dev/null)"; then
            if python3 - "$body" <<'PY'
import json
import sys
json.loads(sys.argv[1])
PY
            then
                log_ok "Health check passed: $url returned valid JSON"
                return 0
            fi
        fi
        log_info "Health check attempt $attempt/10 failed; retrying in 2s..."
        sleep 2
        attempt=$((attempt + 1))
    done

    log_err "Health check failed: $url did not return valid JSON after 10 attempts"
}

echo -e "\n${BLUE}════════════════════════════════════════${NC}"
echo -e "${BLUE}  DC1 HTTPS Setup — $DOMAIN${NC}"
echo -e "${BLUE}════════════════════════════════════════${NC}\n"

require_root

# ── 1. Install dependencies ──────────────────────────────────────────────────
install_if_missing nginx certbot python3-certbot-nginx
systemctl enable nginx >/dev/null 2>&1 || true
systemctl start nginx
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
    --keep-until-expiring \
    --expand \
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
ensure_renew_hook

# Certbot installs a systemd timer on Ubuntu 20.04+ — verify/enable it
if systemctl is-enabled certbot.timer &>/dev/null; then
    systemctl enable certbot.timer >/dev/null 2>&1 || true
    systemctl start certbot.timer >/dev/null 2>&1 || true
    log_ok "certbot.timer is enabled (systemd auto-renewal active)"
else
    log_info "certbot.timer not enabled; relying on cron renewal"
fi
ensure_renew_cron

# ── 7. Firewall ──────────────────────────────────────────────────────────────
if command -v ufw &>/dev/null; then
    ufw allow 'Nginx Full' 2>/dev/null || true
    ufw --force enable 2>/dev/null || true
    log_ok "ufw: Nginx Full (80 + 443) allowed"
fi

# ── 8. Verify HTTPS health endpoint returns JSON ─────────────────────────────
verify_health_json

# ── 9. Summary ───────────────────────────────────────────────────────────────
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
