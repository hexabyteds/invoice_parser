#!/usr/bin/env bash
#
# Dumps the current DB schema (structure only) using this machine's own
# .env credentials. Used two ways:
#   - Locally: npm run db:snapshot   -> writes db/schema.sql (git-tracked
#     reference, regenerate after merging new migrations)
#   - On the server (via scripts/deploy.sh over SSH, on every deploy):
#     writes db/schema.production.sql (gitignored — a live artifact you
#     fetch with npm run db:diff, never committed, never overwrites
#     db/schema.sql)
#
# Usage:
#   bash scripts/snapshot-schema.sh [output-path]   # defaults to db/schema.sql
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

OUTPUT="${1:-db/schema.sql}"

if [[ ! -f .env ]]; then
  echo "Missing .env"
  exit 1
fi

# Resolve DB_* the same way the app itself does (via dotenv/process.env)
# rather than a plain bash `source .env` — on this host, cPanel injects
# some env vars (DB_HOST/USER/PASSWORD/NAME) specifically when Node runs
# through the app's venv wrapper, so they may not show up as plain shell
# vars even though the app can see them fine via process.env.
eval "$(node -e "
require('dotenv').config();
['DB_HOST','DB_PORT','DB_USER','DB_PASSWORD','DB_NAME'].forEach(k => {
  console.log(k + '=' + JSON.stringify(process.env[k] || ''));
});
")"

HOST="$DB_HOST"
if [[ "$HOST" == "localhost" || -z "$HOST" ]]; then HOST="127.0.0.1"; fi

mkdir -p "$(dirname "$OUTPUT")"
{
  cat <<'HEADER'
-- =============================================================
-- EazeeBooks / Invoice Parser — reference schema (structure only)
--
-- Generated from local dev DB via: npm run db:snapshot
--
-- WARNING: This file contains "DROP TABLE IF EXISTS" statements.
-- It is a REFERENCE / fresh-install snapshot only.
--   - DO NOT run this against the production database — it will
--     silently DELETE all existing tables and data.
--   - To evolve the PRODUCTION schema, add a new file under
--     migrations/ instead (see migrations/README.md) and let
--     `npm run migrate` (run automatically by scripts/deploy.sh)
--     apply it safely, without touching existing data.
-- =============================================================
HEADER
  mysqldump -h"$HOST" -P"${DB_PORT:-3306}" -u"$DB_USER" ${DB_PASSWORD:+-p"$DB_PASSWORD"} \
    --no-data --routines --triggers --skip-comments --column-statistics=0 \
    --no-tablespaces "$DB_NAME" \
    | sed -E 's/ AUTO_INCREMENT=[0-9]+//g'
} > "$OUTPUT"

echo "Wrote $OUTPUT"
