#!/bin/sh
set -eu

DB_PATH="/database/filebrowser.db"
ROOT_PATH="/srv/media"
BASE_URL="${FILEBROWSER_BASEURL:-/api/files}"

mkdir -p /database "$ROOT_PATH"

if [ ! -f "$DB_PATH" ]; then
  filebrowser config init --database "$DB_PATH"
  filebrowser config set --database "$DB_PATH" --root "$ROOT_PATH"
  filebrowser config set --database "$DB_PATH" --address 0.0.0.0
  filebrowser config set --database "$DB_PATH" --port 8080
  filebrowser config set --database "$DB_PATH" --baseURL "$BASE_URL"
  filebrowser config set --database "$DB_PATH" --auth.method=noauth
fi

exec filebrowser --database "$DB_PATH" --root "$ROOT_PATH" --address 0.0.0.0 --port 8080
