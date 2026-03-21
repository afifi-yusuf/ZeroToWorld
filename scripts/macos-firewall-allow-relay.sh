#!/usr/bin/env bash
# Allow incoming connections for Node (relay: npm run dev) and Terminal through macOS Application Firewall.
# Run once in Terminal.app from your project (you will be prompted for your login password):
#   chmod +x scripts/macos-firewall-allow-relay.sh && ./scripts/macos-firewall-allow-relay.sh

set -euo pipefail

FW="/usr/libexec/ApplicationFirewall/socketfilterfw"
if [[ ! -x "$FW" ]]; then
  echo "error: socketfilterfw not found (not macOS?)" >&2
  exit 1
fi

NODE="$(command -v node || true)"
if [[ -z "$NODE" ]]; then
  echo "error: node not on PATH. Open Terminal where \`npm run dev\` works, then run this script from that shell." >&2
  exit 1
fi

echo "Firewall state before:"
sudo "$FW" --getglobalstate

echo ""
echo "Registering and unblocking:"
echo "  - $NODE"
sudo "$FW" --add "$NODE" 2>/dev/null || true
sudo "$FW" --unblockapp "$NODE"

echo "  - Terminal.app"
sudo "$FW" --add "/System/Applications/Utilities/Terminal.app" 2>/dev/null || true
sudo "$FW" --unblockapp "/System/Applications/Utilities/Terminal.app"

# Cursor / VS Code integrated terminal often runs under this host app (optional).
CURSOR="/Applications/Cursor.app"
if [[ -d "$CURSOR" ]]; then
  echo "  - Cursor.app"
  sudo "$FW" --add "$CURSOR" 2>/dev/null || true
  sudo "$FW" --unblockapp "$CURSOR"
fi

echo ""
echo "Done. If you upgrade Node (nvm install), re-run this script so the new node binary is allowed."
echo "Verify relay: curl -s http://127.0.0.1:8420/health"
