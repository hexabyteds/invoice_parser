#!/usr/bin/env bash
#
# Compares your LIVE production DB schema against db/schema.sql (your local
# dev DB snapshot), by SSHing into the server and running mysqldump there
# using the server's own .env/environment credentials.
#
# Usage:
#   npm run db:diff
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

CONFIG_FILE="$ROOT/deploy.config"
if [[ ! -f "$CONFIG_FILE" ]]; then
  echo "Missing deploy.config. Run: cp deploy.config.example deploy.config"
  exit 1
fi
# shellcheck disable=SC1090
source "$CONFIG_FILE"

: "${SSH_HOST:?Set SSH_HOST in deploy.config}"
: "${SSH_USER:?Set SSH_USER in deploy.config}"
: "${APP_PATH:?Set APP_PATH in deploy.config}"
SSH_PORT="${SSH_PORT:-22}"
SSH_KEY="${SSH_KEY:-}"

SSH_OPTS=(-p "$SSH_PORT" -o StrictHostKeyChecking=accept-new)
if [[ -n "$SSH_KEY" ]]; then
  SSH_OPTS+=(-i "$SSH_KEY")
fi

echo "==> Fetching production schema snapshot via SSH..."
ssh "${SSH_OPTS[@]}" "${SSH_USER}@${SSH_HOST}" cat "${APP_PATH}/db/schema.production.sql" > /tmp/schema.production.sql \
  || { echo "Could not read db/schema.production.sql on the server — run npm run deploy first (it creates this file)."; exit 1; }

echo ""
echo "==> Diff (local db/schema.sql  vs  production):"
echo ""
diff -u db/schema.sql /tmp/schema.production.sql && echo "No differences — production matches local schema." || true

echo ""
echo "Saved full production schema to /tmp/schema.production.sql"
echo "Use the diff above to write migration file(s) in migrations/ that bring"
echo "production up to date with local (see migrations/README.md)."
