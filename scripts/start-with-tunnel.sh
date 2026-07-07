#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-3001}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if ! command -v cloudflared >/dev/null 2>&1; then
  echo "cloudflared not found. Install with: brew install cloudflared"
  exit 1
fi

if [[ ! -f "$ROOT/.env" ]]; then
  echo "Missing .env — copy .env.example and set GEMINI_API_KEY"
  exit 1
fi

cleanup() {
  echo ""
  echo "Stopping..."
  kill "$APP_PID" "$TUNNEL_PID" 2>/dev/null || true
  wait "$APP_PID" "$TUNNEL_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "Starting invoice app on port ${PORT}..."
cd "$ROOT"
node app-backend.js &
APP_PID=$!

sleep 2

if ! kill -0 "$APP_PID" 2>/dev/null; then
  echo "App failed to start. Check .env and run: npm start"
  exit 1
fi

echo "Starting Cloudflare tunnel..."
cloudflared tunnel --url "http://localhost:${PORT}" &
TUNNEL_PID=$!

echo ""
echo "App:    http://localhost:${PORT}"
echo "Tunnel: look for the https://*.trycloudflare.com URL above"
echo "Press Ctrl+C to stop both."
echo ""

wait
