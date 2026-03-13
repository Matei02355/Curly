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

upsert_env_value() {
  local key="$1"
  local value="$2"

  if grep -q "^${key}=" "$ENV_FILE" 2>/dev/null; then
    sed -i "s|^${key}=.*$|${key}=${value}|" "$ENV_FILE"
  else
    printf '%s=%s\n' "$key" "$value" >> "$ENV_FILE"
  fi
}

read_env_value() {
  local key="$1"

  if [[ ! -f "$ENV_FILE" ]]; then
    return 1
  fi

  awk -F= -v target_key="$key" '$1 == target_key { print substr($0, index($0, "=") + 1); exit }' "$ENV_FILE"
}

bootstrap_env_file() {
  if [[ -f "$ENV_FILE" ]]; then
    return
  fi

  if [[ -f "$PROJECT_DIR/.env.example" ]]; then
    cp "$PROJECT_DIR/.env.example" "$ENV_FILE"
    return
  fi

  cat > "$ENV_FILE" <<'EOF'
APP_NAME=Curly
APP_URL=http://localhost:3000
DATABASE_URL=postgresql://curly:curly@127.0.0.1:5432/curly?schema=public
DATABASE_URL_DOCKER=postgresql://curly:curly@postgres:5432/curly?schema=public
SESSION_COOKIE_NAME=curly_session
SESSION_TTL_DAYS=14
JELLYFIN_URL=http://127.0.0.1:8096
JELLYFIN_INTERNAL_URL=http://jellyfin:8096
JELLYFIN_API_KEY=
JELLYFIN_USER_ID=
JELLYFIN_SERVICE_USERNAME=curly-service
JELLYFIN_SERVICE_PASSWORD=change-me
JELLYFIN_SERVER_NAME=Curly Media
FILEBROWSER_URL=http://127.0.0.1:8080
FILEBROWSER_INTERNAL_URL=http://filebrowser:8080
FILEBROWSER_PROXY_PATH=/api/files
MEDIA_ROOT=/srv/curly/media
POSTGRES_PASSWORD=curly
EOF
}

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

SERVER_IPV4="$(curl -4fsS --max-time 5 https://api.ipify.org || true)"
SERVER_IPV6="$(curl -6fsS --max-time 5 https://api64.ipify.org || true)"
DNS_IPV4S="$(getent ahostsv4 "$DOMAIN" 2>/dev/null | awk '{print $1}' | sort -u || true)"
DNS_IPV6S="$(getent ahostsv6 "$DOMAIN" 2>/dev/null | awk '{print $1}' | sort -u || true)"

dns_points_to_server() {
  local expected_ip="$1"
  local resolved_ips="$2"

  [[ -n "$expected_ip" ]] || return 1
  grep -Fxq -- "$expected_ip" <<<"$resolved_ips"
}

sync_postgres_password() {
  local escaped_password="${POSTGRES_PASSWORD//\'/\'\'}"

  docker compose exec -T postgres \
    psql -U curly -d curly -v ON_ERROR_STOP=1 \
    -c "ALTER USER curly WITH PASSWORD '${escaped_password}';" >/dev/null
}

if [[ -z "$SERVER_IPV4" && -z "$SERVER_IPV6" ]]; then
  echo "Unable to determine this server's public IP for DNS validation." >&2
  exit 1
fi

if ! dns_points_to_server "$SERVER_IPV4" "$DNS_IPV4S" && ! dns_points_to_server "$SERVER_IPV6" "$DNS_IPV6S"; then
  echo "DNS for $DOMAIN must point directly to this server before continuing." >&2
  [[ -n "$SERVER_IPV4" ]] && echo "  Expected A record: $SERVER_IPV4" >&2
  [[ -n "$SERVER_IPV6" ]] && echo "  Expected AAAA record: $SERVER_IPV6" >&2
  echo "  If you use Cloudflare, switch the record to DNS only during install." >&2
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

bootstrap_env_file
POSTGRES_PASSWORD="$(read_env_value "POSTGRES_PASSWORD" || true)"
JELLYFIN_SERVICE_PASSWORD="$(read_env_value "JELLYFIN_SERVICE_PASSWORD" || true)"

if [[ -z "$POSTGRES_PASSWORD" || "$POSTGRES_PASSWORD" == "curly" ]]; then
  POSTGRES_PASSWORD="$(openssl rand -hex 24)"
fi

if [[ -z "$JELLYFIN_SERVICE_PASSWORD" || "$JELLYFIN_SERVICE_PASSWORD" == "change-me" ]]; then
  JELLYFIN_SERVICE_PASSWORD="$(openssl rand -hex 24)"
fi

upsert_env_value "APP_URL" "https://$DOMAIN"
upsert_env_value "DATABASE_URL" "postgresql://curly:${POSTGRES_PASSWORD}@127.0.0.1:5432/curly?schema=public"
upsert_env_value "DATABASE_URL_DOCKER" "postgresql://curly:${POSTGRES_PASSWORD}@postgres:5432/curly?schema=public"
upsert_env_value "MEDIA_ROOT" "$MEDIA_ROOT"
upsert_env_value "POSTGRES_PASSWORD" "$POSTGRES_PASSWORD"
upsert_env_value "JELLYFIN_SERVICE_PASSWORD" "$JELLYFIN_SERVICE_PASSWORD"
upsert_env_value "JELLYFIN_URL" "http://127.0.0.1:8096"
upsert_env_value "JELLYFIN_INTERNAL_URL" "http://jellyfin:8096"
upsert_env_value "FILEBROWSER_URL" "http://127.0.0.1:8080"
upsert_env_value "FILEBROWSER_INTERNAL_URL" "http://filebrowser:8080"
upsert_env_value "FILEBROWSER_PROXY_PATH" "/api/files"

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

sync_postgres_password

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
