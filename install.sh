#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$PROJECT_DIR/.env"
NGINX_TEMPLATE="$PROJECT_DIR/ops/nginx/curly.conf.template"
DOMAIN=""
EMAIL=""
MEDIA_ROOT="/srv/curly/media"
ADMIN_USER="admin"
ADMIN_PASSWORD=""

usage() {
  cat <<EOF
Usage: sudo ./install.sh --domain media.example.com --email admin@example.com [--media-root /srv/curly/media] [--admin-user admin]
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --domain)
      DOMAIN="$2"
      shift 2
      ;;
    --email)
      EMAIL="$2"
      shift 2
      ;;
    --media-root)
      MEDIA_ROOT="$2"
      shift 2
      ;;
    --admin-user)
      ADMIN_USER="$2"
      shift 2
      ;;
    --admin-password)
      ADMIN_PASSWORD="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ $EUID -ne 0 ]]; then
  echo "Run install.sh with sudo or as root." >&2
  exit 1
fi

prompt_if_missing() {
  local var_name="$1"
  local label="$2"
  local current_value="${!var_name}"
  if [[ -z "$current_value" ]]; then
    read -r -p "$label: " current_value
    printf -v "$var_name" "%s" "$current_value"
  fi
}

prompt_secret_if_missing() {
  local var_name="$1"
  local label="$2"
  local current_value="${!var_name}"
  if [[ -z "$current_value" ]]; then
    read -r -s -p "$label: " current_value
    echo
    printf -v "$var_name" "%s" "$current_value"
  fi
}

prompt_if_missing DOMAIN "Domain"
prompt_if_missing EMAIL "Let's Encrypt email"
prompt_secret_if_missing ADMIN_PASSWORD "Initial Curly admin password"

source /etc/os-release
if [[ "${ID:-}" != "ubuntu" ]]; then
  echo "Curly install.sh currently targets Ubuntu only." >&2
  exit 1
fi

case "${VERSION_ID:-}" in
  22.04|24.04)
    ;;
  *)
    echo "Curly install.sh supports Ubuntu 22.04 LTS and 24.04 LTS." >&2
    exit 1
    ;;
esac

SERVER_IP="$(curl -fsSL https://api64.ipify.org)"
DNS_IP="$(getent ahostsv4 "$DOMAIN" | awk '{print $1; exit}')"

if [[ -z "$DNS_IP" || "$DNS_IP" != "$SERVER_IP" ]]; then
  echo "DNS for $DOMAIN must point to $SERVER_IP before continuing." >&2
  exit 1
fi

install_docker() {
  if command -v docker >/dev/null 2>&1; then
    return
  fi

  apt-get update
  apt-get install -y ca-certificates curl gnupg lsb-release
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
    $(. /etc/os-release && echo "$VERSION_CODENAME") stable" > /etc/apt/sources.list.d/docker.list
  apt-get update
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
}

install_node() {
  if command -v node >/dev/null 2>&1; then
    return
  fi

  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
}

install_host_packages() {
  apt-get update
  apt-get install -y jq nginx certbot python3-certbot-nginx ufw postgresql-client
}

install_docker
install_node
install_host_packages

mkdir -p "$MEDIA_ROOT"/movies "$MEDIA_ROOT"/anime "$MEDIA_ROOT"/shows "$MEDIA_ROOT"/uploads
mkdir -p /var/www/html

POSTGRES_PASSWORD="$(openssl rand -hex 24)"
JELLYFIN_SERVICE_PASSWORD="$(openssl rand -hex 24)"

if [[ ! -f "$ENV_FILE" ]]; then
  cp "$PROJECT_DIR/.env.example" "$ENV_FILE"
fi

sed -i "s|^APP_URL=.*$|APP_URL=https://$DOMAIN|" "$ENV_FILE"
sed -i "s|^DATABASE_URL=.*$|DATABASE_URL=postgresql://curly:${POSTGRES_PASSWORD}@127.0.0.1:5432/curly?schema=public|" "$ENV_FILE"
sed -i "s|^DATABASE_URL_DOCKER=.*$|DATABASE_URL_DOCKER=postgresql://curly:${POSTGRES_PASSWORD}@postgres:5432/curly?schema=public|" "$ENV_FILE"
sed -i "s|^MEDIA_ROOT=.*$|MEDIA_ROOT=${MEDIA_ROOT}|" "$ENV_FILE"
sed -i "s|^POSTGRES_PASSWORD=.*$|POSTGRES_PASSWORD=${POSTGRES_PASSWORD}|" "$ENV_FILE" || echo "POSTGRES_PASSWORD=${POSTGRES_PASSWORD}" >> "$ENV_FILE"
sed -i "s|^JELLYFIN_SERVICE_PASSWORD=.*$|JELLYFIN_SERVICE_PASSWORD=${JELLYFIN_SERVICE_PASSWORD}|" "$ENV_FILE"

cd "$PROJECT_DIR"
npm ci
npm run prisma:generate

docker compose up -d postgres jellyfin filebrowser

for _ in {1..60}; do
  if pg_isready -h 127.0.0.1 -p 5432 -U curly >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

npm run prisma:migrate:deploy
npm run bootstrap-admin -- --username "$ADMIN_USER" --password "$ADMIN_PASSWORD"
node "$PROJECT_DIR/scripts/jellyfin-init.mjs"
docker compose up -d --build app

NGINX_CONF="/etc/nginx/sites-available/curly.conf"
sed "s/__DOMAIN__/$DOMAIN/g" "$NGINX_TEMPLATE" > "$NGINX_CONF"
ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/curly.conf
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

if ufw status | grep -q inactive; then
  ufw allow OpenSSH
  ufw allow 80/tcp
  ufw allow 443/tcp
  ufw --force enable
else
  ufw allow 80/tcp
  ufw allow 443/tcp
fi

certbot --nginx --non-interactive --agree-tos --email "$EMAIL" -d "$DOMAIN" --redirect
certbot renew --dry-run

echo
echo "Curly is ready:"
echo "  URL: https://$DOMAIN"
echo "  Admin user: $ADMIN_USER"
echo "  Media root: $MEDIA_ROOT"
echo
echo "Create more users with:"
echo "  npm run user:create -- --role viewer --username <name> --password <strong-password>"
