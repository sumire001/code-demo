#!/usr/bin/env bash
# Startup script for the GraphQL API Server (cross-platform: Git Bash / Linux / macOS)
set -e

# Resolve to the directory containing this script, so it works from anywhere.
cd "$(dirname "$0")"

echo "==> Installing dependencies (skip if already present) ..."
npm install --no-audit --no-fund

PORT="${PORT:-4000}"
echo "==> Starting GraphQL API Server on http://localhost:${PORT}/"
echo "    Authorization header: Bearer test-bearer-token-woztell-2026"
echo "    (Ctrl+C to stop)"
echo ""

PORT="$PORT" npm start
