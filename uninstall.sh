#!/usr/bin/env bash
# uninstall.sh — remove the Bois Club Light Controller LaunchAgent.

set -euo pipefail

LABEL="com.boisclub.lightcontroller"
DEST="${HOME}/Library/LaunchAgents/${LABEL}.plist"
UID_NUM=$(id -u)

if launchctl print "gui/${UID_NUM}/${LABEL}" &>/dev/null; then
  echo "→ Booting out service."
  launchctl bootout "gui/${UID_NUM}/${LABEL}" || true
fi

if [[ -f "${DEST}" ]]; then
  echo "→ Removing ${DEST}"
  rm -f "${DEST}"
fi

echo "✓ Bois Club Light Controller uninstalled. (Logs in ~/Library/Logs/Bois Club Light Controller/ kept.)"
