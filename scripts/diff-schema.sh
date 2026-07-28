#!/usr/bin/env bash
#
# Compares production's DB schema against db/schema.sql (your local dev DB
# snapshot) — no SSH required. Every deploy, .cpanel.yml dumps production's
# current schema to db/schema.production.sql on the server; this script
# just fetches that file's content via cPanel's UAPI (Fileman::get_file_content)
# and diffs it locally.
#
# Note: this reflects production's schema as of the LAST deploy, not this
# exact second — that's fine, it updates every time you run `npm run deploy`.
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

: "${CPANEL_HOST:?Set CPANEL_HOST in deploy.config}"
: "${CPANEL_USER:?Set CPANEL_USER in deploy.config}"
: "${CPANEL_API_TOKEN:?Set CPANEL_API_TOKEN in deploy.config}"
: "${REPO_PATH:?Set REPO_PATH in deploy.config}"

API="https://${CPANEL_HOST}:2083/execute"
AUTH_HEADER="Authorization: cpanel ${CPANEL_USER}:${CPANEL_API_TOKEN}"

echo "==> Fetching db/schema.production.sql from the server via cPanel API..."
RESPONSE="$(curl -sS -H "$AUTH_HEADER" \
  --data-urlencode "dir=${REPO_PATH}/db" \
  --data-urlencode "file=schema.production.sql" \
  "${API}/Fileman/get_file_content")"

if command -v jq >/dev/null 2>&1; then
  CONTENT="$(echo "$RESPONSE" | jq -r '.result.data.content // .data.content // empty')"
  STATUS="$(echo "$RESPONSE" | jq -r '.result.status // .status // empty')"
  if [[ "$STATUS" == "0" || -z "$CONTENT" ]]; then
    echo "Could not fetch the file. Raw response:"
    echo "$RESPONSE"
    echo ""
    echo "Most likely cause: no deploy has run yet (db/schema.production.sql"
    echo "is only created by .cpanel.yml during 'npm run deploy'). Run a"
    echo "deploy first, then re-run this."
    exit 1
  fi
  echo "$CONTENT" > /tmp/schema.production.sql
else
  echo "jq not found locally — install it (brew install jq) for reliable JSON parsing."
  echo "Raw response saved to /tmp/schema.production.raw.json for manual inspection:"
  echo "$RESPONSE" > /tmp/schema.production.raw.json
  exit 1
fi

echo ""
echo "==> Diff (local db/schema.sql  vs  production):"
echo ""
diff -u db/schema.sql /tmp/schema.production.sql && echo "No differences — production matches local schema." || true

echo ""
echo "Saved full production schema to /tmp/schema.production.sql"
echo "Use the diff above to write migration file(s) in migrations/ that bring"
echo "production up to date with local (see migrations/README.md)."
