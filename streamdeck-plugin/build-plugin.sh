#!/usr/bin/env bash
# build-plugin.sh — package the .sdPlugin folder into a .streamDeckPlugin
# file so it can be installed on any Stream Deck app (macOS or Windows).
# A .streamDeckPlugin file is just a ZIP of the .sdPlugin directory with
# a renamed extension; Stream Deck handles the rest on double-click.

set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC_NAME="com.boisclub.lightcontroller.sdPlugin"
SRC="${DIR}/${SRC_NAME}"
DIST="${DIR}/dist"
OUT="${DIST}/com.boisclub.lightcontroller.streamDeckPlugin"

if [[ ! -d "${SRC}" ]]; then
  echo "✗ Plugin source not found: ${SRC}" >&2
  exit 1
fi

mkdir -p "${DIST}"
rm -f "${OUT}"

if command -v streamdeck >/dev/null 2>&1; then
  echo "→ Using Elgato CLI (streamdeck pack)…"
  (cd "${DIR}" && streamdeck pack "${SRC_NAME}" --output "${DIST}" --force)
  # Elgato CLI may name the file slightly differently; normalise:
  produced="$(ls -t "${DIST}"/*.streamDeckPlugin 2>/dev/null | head -1 || true)"
  if [[ -n "${produced}" && "${produced}" != "${OUT}" ]]; then
    mv "${produced}" "${OUT}"
  fi
else
  echo "→ No Elgato CLI on PATH; using plain zip + renamed extension."
  # The Stream Deck app accepts a plain zip whose top-level entry is the
  # .sdPlugin directory, renamed to .streamDeckPlugin.
  (cd "${DIR}" && zip -r -q "${OUT}" "${SRC_NAME}" \
     -x "*/.DS_Store" "*/Thumbs.db" "*/.git/*")
fi

SIZE=$(du -h "${OUT}" | awk '{print $1}')
echo
echo "✓ Built: ${OUT}  (${SIZE})"
echo
cat <<EOF
─────────── How to install on Windows ───────────
1. Copy this file to the Windows machine:
   ${OUT}

2. On Windows, double-click the .streamDeckPlugin file.
   The Stream Deck app prompts; click Install. Bundles drop into:
   %APPDATA%\\Elgato\\StreamDeck\\Plugins\\com.boisclub.lightcontroller.sdPlugin

3. In any Bois Club action's Property Inspector, set the server URL
   to your server's LAN address — for the Mac running it right now:

     http://$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "<this-machine-LAN-IP>"):31337

   (The URL is a single GLOBAL setting — change it in any action's PI
   and every Bois Club key uses the same target.)
─────────────────────────────────────────────────

To re-package after edits: ./build-plugin.sh
EOF
