#!/usr/bin/env bash
# install.sh — install Bois Club Light Controller as a macOS LaunchAgent (user scope).
# Runs on login / reboot. Logs to ~/Library/Logs/BoisClubLightController/.
#
# Re-running this script is safe: it bootouts any existing job before reload.

set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LABEL="com.boisclub.lightcontroller"
PLIST_NAME="${LABEL}.plist"
TEMPLATE="${DIR}/com.boisclub.lightcontroller.plist"
DEST_DIR="${HOME}/Library/LaunchAgents"
DEST="${DEST_DIR}/${PLIST_NAME}"
LOG_DIR="${HOME}/Library/Logs/BoisClubLightController"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "✗ install.sh supports macOS (Darwin) only. Detected: $(uname -s)" >&2
  exit 1
fi

if [[ ! -f "${TEMPLATE}" ]]; then
  echo "✗ Missing template: ${TEMPLATE}" >&2
  exit 1
fi

NODE_BIN="$(command -v node || true)"
if [[ -z "${NODE_BIN}" ]]; then
  echo "✗ node not found on PATH. Install Node.js first, then re-run." >&2
  exit 1
fi
echo "→ Using node: ${NODE_BIN}"

echo "→ Installing dependencies (npm install)…"
(cd "${DIR}" && npm install --no-fund --no-audit)

mkdir -p "${DEST_DIR}"
mkdir -p "${LOG_DIR}"

echo "→ Writing LaunchAgent to ${DEST}"
# In-place template substitution via sed, escaping slashes in paths.
ESC_NODE=$(printf '%s\n' "${NODE_BIN}" | sed 's/[\/&]/\\&/g')
ESC_DIR=$(printf '%s\n' "${DIR}"       | sed 's/[\/&]/\\&/g')
ESC_LOG=$(printf '%s\n' "${LOG_DIR}"   | sed 's/[\/&]/\\&/g')

sed \
  -e "s/__NODE__/${ESC_NODE}/g" \
  -e "s/__DIR__/${ESC_DIR}/g" \
  -e "s/__LOG__/${ESC_LOG}/g" \
  "${TEMPLATE}" > "${DEST}"

UID_NUM=$(id -u)

# Boot out any existing service before reloading (idempotent).
if launchctl print "gui/${UID_NUM}/${LABEL}" &>/dev/null; then
  echo "→ Existing service found — booting out first."
  launchctl bootout "gui/${UID_NUM}/${LABEL}" || true
  sleep 1
fi

echo "→ Bootstrapping LaunchAgent."
launchctl bootstrap "gui/${UID_NUM}" "${DEST}"
launchctl enable    "gui/${UID_NUM}/${LABEL}"
launchctl kickstart "gui/${UID_NUM}/${LABEL}" || true

sleep 2

echo "→ Verifying…"
if launchctl print "gui/${UID_NUM}/${LABEL}" >/dev/null 2>&1; then
  echo "✓ Service bootstrapped."
else
  echo "✗ Service didn't bootstrap. Check ${LOG_DIR}/boisclub.err.log." >&2
  exit 1
fi

# Wait for HTTP to answer.
URL="http://127.0.0.1:31337/lights"
for i in 1 2 3 4 5 6 7 8 9 10; do
  if curl -fsS "${URL}" >/dev/null 2>&1; then
    echo "✓ HTTP responding at ${URL}"
    break
  fi
  sleep 1
done

if ! curl -fsS "${URL}" >/dev/null 2>&1; then
  echo "✗ HTTP did not come up. Recent stderr:" >&2
  tail -n 40 "${LOG_DIR}/boisclub.err.log" 2>/dev/null || true
  exit 1
fi

cat <<EOF

────────────────────────────────────────────
✓ Bois Club Light Controller installed and running.

  Web UI:    http://127.0.0.1:31337/
  Status:    http://127.0.0.1:31337/lights
  Presets:   http://127.0.0.1:31337/presets

  Logs:
    out → ${LOG_DIR}/boisclub.out.log
    err → ${LOG_DIR}/boisclub.err.log

  Uninstall: ./uninstall.sh
  Restart:   launchctl kickstart -k gui/${UID_NUM}/${LABEL}
────────────────────────────────────────────
EOF
