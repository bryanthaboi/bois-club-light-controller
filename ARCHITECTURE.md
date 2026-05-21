# Architecture

Bois Club Light Controller is a single-process Node.js service that bridges two transports:

1. **HTTP (Express, `:31337`)** — control plane and static web UI
2. **BLE (Noble, `@stoprocent/noble`)** — outbound to Neewer lights

A third side-path (Govee LAN) is bolted onto the HTTP layer via the `govee-lan-control` library, which manages its own LAN discovery and command sockets independently. When deployed via `install.sh`, the whole thing runs as a macOS `launchd` LaunchAgent with `RunAtLoad` + `KeepAlive`, so it survives logout and reboot.

## Process layout

```
┌──────────────────── Node process (LaunchAgent) ────────────────────┐
│                                                                     │
│  Express app (31337)                                                 │
│    ├── /public        → static web UI (HTML + CSS + JS)             │
│    ├── /turnOn… etc.  → commands.execute(name, req, ctx)            │
│    ├── /lights        → bleManager.getStatus()                      │
│    ├── /presets       → presets.list()                              │
│    └── /preset/:name  → presets.run(name, { lights, govee })        │
│           │                                                         │
│           ▼                                                         │
│   ┌────────────────┐    ┌────────────────────────────────────────┐  │
│   │ command        │    │ bleManager (noble)                     │  │
│   │ registry       │◄──►│  ├── attachNobleListenersOnce          │  │
│   │ (string→fn,    │    │  ├── onDiscover → new NeewerLight      │  │
│   │  validation)   │    │  ├── reconnect w/ exp backoff per id   │  │
│   └────────────────┘    │  └── keepalive every 10 s              │  │
│                         └────────────────────────────────────────┘  │
│                                          │                          │
│                                          ▼                          │
│                              NeewerLight instances ──► GATT writes  │
│                                                                     │
│  Govee.default()  (separate library, manages its own LAN sockets)   │
│                                                                     │
│  uncaughtException / unhandledRejection handlers → log, don't crash │
└─────────────────────────────────────────────────────────────────────┘
```

## Module map

| Module | Role |
| ------ | ---- |
| `index.js` | Boots Express, the static UI, the Govee client, BLE scanning, signal handlers, and uncaught-exception traps. Defines every HTTP route. |
| `commands.js` | Command registry: `{ name → async handler }`. Every handler returns `{ ok, … }`; errors caught and converted to `{ ok: false, error }`. |
| `commandParameter.js` | Wraps `req.query` in a typed accessor (`HUE()`, `CCT()`, `brightness()`, …). |
| `presets.js` | Named "vibes" — each is an async `(ctx) → void` that issues a sequence of safe-wrapped writes. Tolerant of missing devices. |
| `bleManager.js` | Owns the Noble lifecycle, the `discoveredLights` registry, scan retry, per-light reconnect with exponential backoff, keepalive interval. Exposes `getStatus()` for the UI. |
| `neewerLight.js` | One instance per peripheral. Connects, discovers GATT, writes commands (with timeout + non-throwing failure), runs scenes, exposes `snapshot()` for `/lights`. |
| `neewerLightConstant.js` | Static class of protocol bytes, light-type tables, and command builders. |
| `neewerLightFX.js` | Scene factory (17 static methods, each returns a `NeewerLightFX` with appropriate flags). |
| `logger.js` | Level-gated logger driven by `NEEWER_LOG_LEVEL`. |
| `public/*` | Static web UI. Pure browser JS, polls `/lights` every 2 s. |
| `com.boisclub.lightcontroller.plist` + `install.sh` + `uninstall.sh` | `launchd` LaunchAgent template + installer / tear-down. |

## Request lifecycle (Neewer)

`GET /setLightCCT?light=NW-12345&CCT=32&Brightness=60`

1. Express route handler in `index.js` calls `commands.execute('setLightCCT', req, ctx)`.
2. `commands.js` looks up the handler. The wrapper try/catches the call and converts any thrown error into `{ ok: false, error }`.
3. Handler parses `req.query` via `commandParameter`, asks `bleManager.getLightByNameOrAll(name)` for targets, and issues `light.setCCTValues(brr, cct, gm)` for each.
4. `setCCTValues` asks `constants.getCCTLightCommand(...)` for the byte buffer and calls `writeCommand` three times, 100 ms apart. The triple-write tolerates Neewer firmware dropping the first one or two writes after a reconnect.
5. `writeCommand` short-circuits cleanly if the light is not connected, otherwise writes to the device-control characteristic with a 5-second timeout. It never throws — it returns `true`/`false` and updates `lastError` on the light snapshot.
6. The route returns `{ ok: true, affected: N, cct, brightness, gm }`.

`setLightHSI` and `setLightScene` follow the same shape with different builders. `setLightScene` sends **two** writes — the short `getSceneValue` envelope, then the long `getSceneCommand` carrying the full `NeewerLightFX` parameter block.

## Preset lifecycle

`GET /preset/sunset` (or `POST /preset/sunset`)

1. The route invokes `commands.execute('applyPreset', req, { govee })`.
2. The handler calls `presets.run('sunset', { lights: bleManager.getAllLights(), govee })`.
3. The preset's `run({lights, govee})` is an async sequence of `safe(label, fn)` calls. Each `safe` swallows + logs errors so one bad write doesn't abort the rest of the preset.
4. Typical preset: `powerOn` → `setHSI` for RGB lights → `goveeOn` → `goveeColor` → `goveeBrightness`. Lights without RGB support are silently skipped.

## BLE flow

`bleManager.startScanning()` is called once at server startup (and on demand from `/scanLight`).

- It attaches Noble listeners exactly once (`nobleListenersAttached` guard) — prior versions could double-attach `discover` handlers on re-scan.
- When the adapter reaches `poweredOn`, it calls `startScanningAsync([], true)` (no service filter, duplicates allowed) and starts the keepalive interval.
- On `discover`, if the local name matches `nw|neewer|nee` and the registry isn't at `NEEWER_MAX_LIGHTS`, it constructs a `NeewerLight`, registers a `disconnect` listener that schedules reconnect, then calls `connectAndDiscover`.
- On `disconnect` the per-light backoff (`reconnectBackoff` map) advances `1s → 2s → 4s → … 60s` and `scheduleReconnect` recurses until either the device returns or the process exits.
- On unexpected `scanStop`, `scheduleScanRetry` waits 5 s and re-enters `startScanningAsync`.

### Keepalive

Every 10 s the keepalive loop iterates every `NeewerLight`:

- If `peripheral.state === 'connected'`, it resends the cached power state — both a heartbeat and a self-healing measure if the bulb was power-cycled.
- Otherwise it does nothing — the disconnect handler already scheduled a backoff-driven reconnect.

### GATT layout

```
Service       69400001-b5a3-f393-e0a9-e50e24dcca99
  ├─ 69400002  device control (write)   → deviceCtlCharacteristic
  └─ 69400003  GATT notify              → gattCharacteristic
```

UUIDs are normalized (dashes stripped, lowercased) before comparison because Noble's reported UUIDs aren't dash-delimited.

## Web UI

The UI is plain HTML/CSS/JS in `public/`. No build step.

- `index.html` defines a sticky top bar, vibe grid, light grid, Govee row, log tail.
- `app.js` polls `/lights` every 2 s. It only re-renders cards when the signature (per-light id/state/brightness/cct/hue/saturation/mode) changes, avoiding flicker on cards the user is dragging sliders on. (It still rerenders fully when a light count changes.)
- `styles.css` is a small dark-theme palette with subtle gradients on the brand dot and preset cards.
- Every card button → `fetch('/setLightCCT?…')` etc. Status is shown via the top-bar BT badge + per-card "connected / reconnecting" meta.

## Error & resilience strategy

- **HTTP layer**: every handler is wrapped (`wrap(commandName)` in `index.js`) so route errors become 4xx JSON. A trailing error-middleware catches anything Express didn't.
- **BLE writes**: never throw — return `false` and stash `lastError`. The keepalive loop and reconnect paths run independently.
- **Govee**: `startGovee()` is in a try/catch. If the library throws (e.g. EADDRINUSE on the multicast socket) the server still boots; Govee endpoints return `503 no_govee_devices` rather than crashing.
- **Process**: `uncaughtException` and `unhandledRejection` are caught and logged; the LaunchAgent's `KeepAlive` policy still restarts the process on crash (`SuccessfulExit=false`, `Crashed=true`).
- **Shutdown**: SIGINT / SIGTERM trigger `bleManager.cleanup()` which stops scanning, disconnects every peripheral, then exits with a 500 ms grace window.

## Service (launchd) install

```
com.boisclub.lightcontroller.plist   ← template (uses __NODE__, __DIR__, __LOG__)
install.sh              ← substitutes real paths, writes to ~/Library/LaunchAgents,
                         bootstraps, kickstarts, polls /lights to verify
uninstall.sh            ← bootouts the job, removes the plist (logs preserved)
```

LaunchAgent policy:

- `RunAtLoad` true → starts on login (and after reboot).
- `KeepAlive` with `SuccessfulExit=false`, `Crashed=true` → restart on abnormal exit.
- `ThrottleInterval` 5 s → avoid restart storms.
- `ProcessType=Interactive` → keeps macOS from idle-throttling BLE writes.
- Logs to `~/Library/Logs/BoisClubLightController/boisclub.{out,err}.log`.

## Known rough edges

- `lightType` defaults to `42` in the `NeewerLight` constructor; `handleNotifyUpdate` could parse the actual type from the GATT notification stream but currently just logs.
- `getLightByNameOrAll` matches `userLightName` exactly (case-insensitive) **or** by substring. If two of your lights share substrings, target by the full advertised name.
- Govee features depend on what the upstream `govee-lan-control` library supports — older firmwares may ignore RGB writes or coalesce them.
- The triple-write in `setCCTValues` is a workaround, not a fix. Some lights still drop writes during heavy BT contention; the next keepalive recovers them.

For HTTP API tables, preset list, install steps, and example calls see [README.md](./README.md).
