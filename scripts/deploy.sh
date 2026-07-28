#!/usr/bin/env bash
#
# One-command deploy over SSH.
#
# HostNext doesn't disclose the SSH port via the normal cPanel UI, but
# cPanel's own generated git clone URL (ssh://user@host:PORT/...) reveals
# the real SSH port — that's how PORT below was found. Full SSH login
# works fine on it (not restricted to git-only).
#
# Usage:
#   cp deploy.config.example deploy.config   # one-time, then fill it in
#   npm run deploy
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

CONFIG_FILE="$ROOT/deploy.config"
if [[ ! -f "$CONFIG_FILE" ]]; then
  echo "Missing deploy.config."
  echo "Run: cp deploy.config.example deploy.config   then fill in your server details."
  exit 1
fi
# shellcheck disable=SC1090
source "$CONFIG_FILE"

: "${SSH_HOST:?Set SSH_HOST in deploy.config}"
: "${SSH_USER:?Set SSH_USER in deploy.config}"
: "${REPO_PATH:?Set REPO_PATH in deploy.config}"
: "${APP_PATH:?Set APP_PATH in deploy.config}"
SSH_PORT="${SSH_PORT:-22}"
SSH_KEY="${SSH_KEY:-}"
NODE_VENV_ACTIVATE="${NODE_VENV_ACTIVATE:-}"
BRANCH="${BRANCH:-main}"

SSH_OPTS=(-p "$SSH_PORT" -o StrictHostKeyChecking=accept-new)
if [[ -n "$SSH_KEY" ]]; then
  SSH_OPTS+=(-i "$SSH_KEY")
fi

info()  { echo -e "\033[1;34m==>\033[0m $1"; }
ok()    { echo -e "\033[1;32m✓\033[0m $1"; }
fail()  { echo -e "\033[1;31m✗\033[0m $1"; exit 1; }

# ------------------------------------------------------------------
# 1. Safety checks
# ------------------------------------------------------------------
CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$CURRENT_BRANCH" != "$BRANCH" ]]; then
  echo "You're on '$CURRENT_BRANCH' but deploy.config targets '$BRANCH'."
  read -r -p "Continue deploying '$CURRENT_BRANCH' to production anyway? [y/N] " ans
  [[ "$ans" =~ ^[Yy]$ ]] || exit 1
  BRANCH="$CURRENT_BRANCH"
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "You have uncommitted changes:"
  git status --short
  read -r -p "Continue anyway (they will NOT be deployed)? [y/N] " ans
  [[ "$ans" =~ ^[Yy]$ ]] || exit 1
fi

# ------------------------------------------------------------------
# 2. Push source to GitHub (source of truth the server pulls from)
# ------------------------------------------------------------------
info "Pushing $BRANCH to origin..."
git push origin "$BRANCH"
ok "Pushed"

# ------------------------------------------------------------------
# 3. Build frontend locally
# ------------------------------------------------------------------
info "Building frontend..."
(cd "$ROOT/frontend" && npm install --no-audit --no-fund && npm run build)
ok "Frontend built (frontend/dist)"

# ------------------------------------------------------------------
# 4. Sync built frontend straight into the server's public/ folder
# ------------------------------------------------------------------
info "Uploading frontend build to server..."
rsync -az --delete \
  -e "ssh ${SSH_OPTS[*]}" \
  "$ROOT/frontend/dist/" \
  "${SSH_USER}@${SSH_HOST}:${APP_PATH}/public/"
ok "Frontend synced to ${APP_PATH}/public"

# ------------------------------------------------------------------
# 5. Pull latest backend code on the server, install deps, migrate, restart
# ------------------------------------------------------------------
info "Deploying backend on server..."
# shellcheck disable=SC2087
ssh "${SSH_OPTS[@]}" "${SSH_USER}@${SSH_HOST}" bash -s <<REMOTE
set -euo pipefail

echo "--> Pulling latest code"
cd "$REPO_PATH"
git fetch origin
git checkout "$BRANCH"
git pull origin "$BRANCH"

if [[ "$REPO_PATH" != "$APP_PATH" ]]; then
  echo "--> Syncing repo into app root"
  rsync -a --delete \
    --exclude ".git" --exclude "node_modules" --exclude "uploads" \
    --exclude "public" --exclude ".env" --exclude "tmp" \
    "$REPO_PATH/" "$APP_PATH/"
fi

cd "$APP_PATH"

if [[ -n "$NODE_VENV_ACTIVATE" && -f "$NODE_VENV_ACTIVATE" ]]; then
  echo "--> Activating Node.js virtual environment"
  source "$NODE_VENV_ACTIVATE"
fi

echo "--> Installing backend dependencies"
npm install --omit=dev --no-audit --no-fund

echo "--> Running database migrations"
node scripts/migrate.js

echo "--> Snapshotting live schema for later diffing"
bash scripts/snapshot-schema.sh db/schema.production.sql || true

echo "--> Restarting app (Passenger)"
mkdir -p tmp
touch tmp/restart.txt

echo "--> Done on server"
REMOTE

ok "Backend deployed, migrated, and restarted"

echo ""
ok "Deploy complete."
echo "Check your live site to confirm, and tail logs if anything looks off:"
echo "  ssh ${SSH_OPTS[*]} ${SSH_USER}@${SSH_HOST}"
