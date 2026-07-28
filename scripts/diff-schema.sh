#!/usr/bin/env bash
#
# Compares your LIVE production DB schema against db/schema.sql (your local
# dev DB snapshot), by SSHing into the server and running mysqldump there
# using the server's own .env credentials (works even if the DB isn't
# reachable directly from your laptop).
#
# Use this once, before writing your first migration(s) in migrations/, to
# see exactly what's different between local dev and production so you can
# capture those differences as proper migration files.
#
# Usage:
#   bash scripts/diff-schema.sh
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

echo "==> Dumping production schema (structure only) via SSH..."
ssh "${SSH_OPTS[@]}" "${SSH_USER}@${SSH_HOST}" bash -s <<REMOTE > /tmp/schema.production.sql
set -euo pipefail
cd "$APP_PATH"
set -a
source .env
set +a
HOST="\$DB_HOST"
if [[ "\$HOST" == "localhost" ]]; then HOST="127.0.0.1"; fi
mysqldump -h"\$HOST" -P"\${DB_PORT:-3306}" -u"\$DB_USER" \${DB_PASSWORD:+-p"\$DB_PASSWORD"} \\
  --no-data --routines --triggers --skip-comments --column-statistics=0 "\$DB_NAME" \\
  | sed -E 's/ AUTO_INCREMENT=[0-9]+//g'
REMOTE

echo ""
echo "==> Diff (local db/schema.sql  vs  production):"
echo ""
diff -u db/schema.sql /tmp/schema.production.sql && echo "No differences — production matches local schema." || true

echo ""
echo "Saved full production schema to /tmp/schema.production.sql"
echo "Use the diff above to write migration file(s) in migrations/ that bring"
echo "production up to date with local (see migrations/README.md)."
