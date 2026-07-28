#!/usr/bin/env bash
#
# Regenerates db/schema.sql from your LOCAL dev database (structure only).
# Run this after your local dev DB has the changes you also captured as a
# migration in migrations/, so the reference snapshot stays up to date.
#
# Usage:
#   npm run db:snapshot
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env ]]; then
  echo "Missing .env"
  exit 1
fi

set -a
source .env
set +a

HOST="$DB_HOST"
if [[ "$HOST" == "localhost" ]]; then HOST="127.0.0.1"; fi

mkdir -p db
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
    --no-data --routines --triggers --skip-comments --column-statistics=0 "$DB_NAME" \
    | sed -E 's/ AUTO_INCREMENT=[0-9]+//g'
} > db/schema.sql

echo "Wrote db/schema.sql"
