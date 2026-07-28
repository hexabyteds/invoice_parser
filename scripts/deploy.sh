#!/usr/bin/env bash
#
# One-command deploy — no SSH required.
#
# Pushes your code to GitHub, then calls cPanel's UAPI (over HTTPS, port
# 2083, authenticated with an API token) to pull the latest commit into the
# cPanel-managed git repo AND run the deployment tasks defined in
# .cpanel.yml (build frontend, install deps, run DB migrations, restart the
# Passenger app) — all in one API call: VersionControlDeployment::create.
#
# Docs: https://docs.cpanel.net/knowledge-base/web-services/guide-to-git-deployment/
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

: "${CPANEL_HOST:?Set CPANEL_HOST in deploy.config}"
: "${CPANEL_USER:?Set CPANEL_USER in deploy.config}"
: "${CPANEL_API_TOKEN:?Set CPANEL_API_TOKEN in deploy.config}"
: "${REPO_PATH:?Set REPO_PATH in deploy.config}"
BRANCH="${BRANCH:-main}"

API="https://${CPANEL_HOST}:2083/execute"
AUTH_HEADER="Authorization: cpanel ${CPANEL_USER}:${CPANEL_API_TOKEN}"

info()  { echo -e "\033[1;34m==>\033[0m $1"; }
ok()    { echo -e "\033[1;32m✓\033[0m $1"; }
fail()  { echo -e "\033[1;31m✗\033[0m $1"; exit 1; }

have_jq=false
if command -v jq >/dev/null 2>&1; then have_jq=true; fi

json_get() {
  # json_get '<json>' '.result.status' — falls back to grep if no jq
  if $have_jq; then
    echo "$1" | jq -r "$2" 2>/dev/null
  else
    echo ""
  fi
}

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
# 2. Push source to GitHub (what cPanel's repo pulls from)
# ------------------------------------------------------------------
info "Pushing $BRANCH to origin..."
git push origin "$BRANCH"
ok "Pushed"

# ------------------------------------------------------------------
# 3. Trigger pull + .cpanel.yml deployment tasks via cPanel UAPI
# ------------------------------------------------------------------
info "Triggering deployment on server (pull + build + migrate + restart)..."
RESPONSE="$(curl -sS -H "$AUTH_HEADER" \
  --data-urlencode "repository_root=${REPO_PATH}" \
  "${API}/VersionControlDeployment/create")"

echo "$RESPONSE"

STATUS="$(json_get "$RESPONSE" '.result.status // .status')"
if [[ "$STATUS" == "0" ]]; then
  fail "cPanel rejected the deployment request — see errors above. Common causes: working tree not clean in the cPanel repo, or .cpanel.yml missing/invalid there yet (first deploy needs it pulled in — see DEPLOY.md)."
fi

TASK_ID="$(json_get "$RESPONSE" '.result.data.task_id // .data.task_id')"
ok "Deployment queued${TASK_ID:+ (task_id: $TASK_ID)}"

# ------------------------------------------------------------------
# 4. Poll for completion
# ------------------------------------------------------------------
info "Waiting for deployment tasks to finish (this runs npm install + frontend build + migrations on the server, can take a minute)..."
for i in $(seq 1 20); do
  sleep 6
  STATUS_RESPONSE="$(curl -sS -H "$AUTH_HEADER" \
    --data-urlencode "repository_root=${REPO_PATH}" \
    "${API}/VersionControlDeployment/retrieve")"

  if $have_jq; then
    SUCCEEDED="$(echo "$STATUS_RESPONSE" | jq -r '.result.data[0].timestamps.succeeded // .data[0].timestamps.succeeded // empty' 2>/dev/null)"
    DEPLOY_FAILED="$(echo "$STATUS_RESPONSE" | jq -r '.result.data[0].timestamps.failed // .data[0].timestamps.failed // empty' 2>/dev/null)"
    if [[ -n "$SUCCEEDED" ]]; then
      ok "Deployment finished successfully."
      echo "$STATUS_RESPONSE"
      exit 0
    fi
    if [[ -n "$DEPLOY_FAILED" ]]; then
      fail "Deployment failed on the server. Full status:\n$STATUS_RESPONSE"
    fi
  else
    echo "  (install 'jq' locally for cleaner status polling — showing raw response)"
    echo "$STATUS_RESPONSE"
  fi
done

echo ""
echo "Still running after ~2 minutes, or status is ambiguous (install jq for reliable polling)."
echo "Check cPanel -> Git Version Control -> Manage -> Pull or Deploy tab for the final result,"
echo "or run: npm run db:diff   (also confirms the app is responding with fresh data)"
