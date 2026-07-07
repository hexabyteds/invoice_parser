#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-3001}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if ! command -v cloudflared >/dev/null 2>&1; then
  echo "cloudflared not found. Install with: brew install cloudflared"
  exit 1
fi

echo "Starting Cloudflare quick tunnel → http://localhost:${PORT}"
echo "Share the *.trycloudflare.com URL with your team."
echo "Press Ctrl+C to stop."
echo ""

cd "$ROOT"
exec cloudflared tunnel --url "http://localhost:${PORT}"
