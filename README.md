# Bois Club Light Controller

A Node.js service that discovers and controls Neewer BLE lights plus Govee LAN lights, with a built-in web UI, creative "vibe" presets, robust auto-reconnect, a Stream Deck plugin, and a one-shot macOS installer that runs it as a LaunchAgent on every login / reboot.

## What you get

- 🎛 **Web UI** at `http://127.0.0.1:31337/` — per-light cards with brightness / CCT / HSI / scene / speed sliders, vibe-preset grid, Govee row.
- 🌈 **Creative vibe presets** — `sunset`, `horror`, `vampire`, `rave`, `underwater`, `spaceship`, `ufo`, `fireplace`, `noir`, `paparazzi`, `fireworks`, `tvScreen`, `daylight`, `cinematic`, `candlelight`, `police`, `blackout`, `surpriseMe`.
- 🟢 **Govee software effects** — `police`, `candlelight`, `fireplace`, `rave`, `party`, `rainbow`, `pulse`, `strobe`, `horror`, `ocean`, `ufo`, `tvScreen`. The Govee LAN API has no native scenes, so the server runs them as timed loops over `setColor` / `setBrightness`.
- 🟰 **Unified `/all/*` endpoints** — `/all/on`, `/all/off`, `/all/toggle`, `/all/color`, `/all/brightness` fan out to every Neewer + every Govee in one call.
- 🔁 **Self-healing BLE** — per-light exponential reconnect backoff, scan auto-resume, multi-light fan-out (`NEEWER_MAX_LIGHTS`, default 8).
- 🛟 **Hardened HTTP layer** — every command returns `{ ok, … }` JSON; Govee absence isn't fatal; uncaught exceptions are logged not crashed.
- 🎨 **Govee LAN** alongside Neewer — on / off / brightness / arbitrary RGB, per-device targeting.
- 🪟 **Installable service** — `./install.sh` provisions a `launchd` LaunchAgent (`com.boisclub.lightcontroller`) with `RunAtLoad` + `KeepAlive`. Survives logout, sleep, and reboot.
- 🎮 **Stream Deck plugin** — `streamdeck-plugin/com.boisclub.lightcontroller.sdPlugin/` is a working plugin (run `streamdeck-plugin/install-plugin.sh`). 12 actions: Neewer/Govee/All × power/colour/effect/brightness/scene/preset.

## Requirements

- macOS 12+ (LaunchAgent install is mac-only; the server itself runs anywhere Node + Noble does)
- Node.js 18+
- A Bluetooth adapter the host OS exposes to Noble
- One or more Neewer lights powered on and in range (advertised names matching `nw`, `neewer`, `nee`).
  **Note:** This project has only been tested on the **Neewer MS60C**. Other Neewer lights using the same `0x69400001-…` GATT service *should* work but are unverified — protocol bytes and `lightType` values may differ.
- Optional: Govee lights on the same network. Supports **most Govee Wi-Fi RGB lights**, but each device must have **LAN Control enabled** in the Govee Home app (device → settings → LAN Control) before this server can see it. BLE-only Govee models won't be detected.

## Install

```bash
# 1. fetch deps
npm install

# 2. either run interactively…
npm start

# …or install as a LaunchAgent (recommended — survives reboot)
./install.sh
```

`install.sh` will:

1. `npm install` deps
2. write `com.boisclub.lightcontroller.plist` (templated with your absolute paths + node binary) to `~/Library/LaunchAgents/`
3. `launchctl bootstrap` + `enable` + `kickstart`
4. poll `http://127.0.0.1:31337/lights` until the server answers
5. print the web-UI URL

To remove: `./uninstall.sh` (logs in `~/Library/Logs/BoisClubLightController/` are preserved).

> First-run note: macOS may prompt you to grant **Bluetooth permission** to the Node binary. Approve it once in *System Settings → Privacy & Security → Bluetooth* — otherwise BLE scanning silently returns no devices.

## Web UI

Open <http://127.0.0.1:31337/> in any browser on the same machine. You'll see:

- **Global actions** (top): All On / All Off / Rescan / 🎲 Random / ✨ Surprise Me
- **Vibe grid**: one click applies a preset to every light + Govee
- **Light cards**: per-connected-light sliders (brightness, CCT, GM, hue, saturation, scene, speed) with On/Off/Toggle and Apply buttons
- **Govee row**: on/off, brightness presets, arbitrary RGB picker
- **Recent activity log**

The page polls `/lights` every 2 s.

## HTTP API

All endpoints are `GET` unless noted. Most commands accept an optional `light=<name>` to target a single light by its advertised name (case-insensitive substring match); omitted ⇒ broadcast to all.

### Neewer

| Endpoint          | Query params                                              | Notes |
| ----------------- | --------------------------------------------------------- | ----- |
| `/scanLight`      | —                                                         | Re-trigger BLE scan |
| `/turnOnLight`    | `light`                                                   | |
| `/turnOffLight`   | `light`                                                   | |
| `/toggleLight`    | `light`                                                   | Based on cached state |
| `/setLightCCT`    | `light`, `CCT` (32–56), `Brightness` (0–100), `GM`        | `CCT=32`→3200K, `56`→5600K |
| `/setLightHSI`    | `light`, `HUE` (0–360), `Saturation` (0–1 or 0–100), `Brightness` | RGB-capable lights only |
| `/setLightScene`  | `light`, `SceneId` (1–17) or `Scene` (name), `Brightness`, `Speed` (1–10) | |
| `/randomColor`    | `light`, `Brightness`                                     | Random hue/sat |

### Presets

| Endpoint              | Description                              |
| --------------------- | ---------------------------------------- |
| `/presets`            | List available presets w/ labels & descs |
| `/preset/<name>`      | Apply preset (GET or POST)               |

### Status

| Endpoint      | Description                                                                  |
| ------------- | ---------------------------------------------------------------------------- |
| `/lights`     | Snapshot: adapter state, all light states (`{ id, name, isOn, cct, hue, ... }`) |

### Govee

All Govee endpoints accept an optional `?device=<ip|deviceID|model>` to target a single light; omit it to broadcast to every Govee on the LAN.

| Endpoint                                    | Description                          |
| ------------------------------------------- | ------------------------------------ |
| `/goveeOn`                                  | Govee on                             |
| `/goveeOff`                                 | Govee off                            |
| `/goveeFullBrightness`                      | 100 %                                |
| `/goveeHalfBrightness`                      | 50 %                                 |
| `/goveeBrightness?pct=N`                    | Arbitrary brightness 0–100           |
| `/goveeColor?r=R&g=G&b=B`                   | RGB                                  |
| `/govee/devices`                            | List currently-detected Govee devices |
| `/govee/rediscover`                         | Force an immediate LAN discover probe |
| `/govee/effects`                            | List effects + currently-running set |
| `/govee/effect/<name>?device=<ip>`          | Start a software effect on a device  |
| `/govee/stopEffect?device=<ip>`             | Stop effect (omit device to stop all)|

### All lights (unified)

Hit Neewer + Govee in one request.

| Endpoint                              | Description                                |
| ------------------------------------- | ------------------------------------------ |
| `/all/on`                             | Power on every Neewer + every Govee        |
| `/all/off`                            | Power off everything                       |
| `/all/toggle`                         | Toggle each, based on its cached state     |
| `/all/color?r=R&g=G&b=B&brightness=N` | Same colour on Neewer (HSI) + Govee (RGB)  |
| `/all/brightness?pct=N`               | Same brightness across all devices         |

Every command returns JSON: success ⇒ `{ ok: true, … }`; failure ⇒ `{ ok: false, error: "<code>" }`. Unknown routes ⇒ `404 { ok: false, error: "not_found" }`.

## Scenes

`setLightScene` accepts either a numeric `SceneId` (1–17) or a friendly `Scene` name (alias set: `squadcar`, `ambulance`, `fireengine`, `fireworks`, `party`, `candlelight`, `lighting`, `paparazzi`, `screen`). Prefer `SceneId` for full coverage.

| ID  | Name             |
| --- | ---------------- |
| 1   | Lighting         |
| 2   | Paparazzi        |
| 3   | Defective bulb   |
| 4   | Explosion        |
| 5   | Welding          |
| 6   | CCT flash        |
| 7   | HUE flash        |
| 8   | CCT pulse        |
| 9   | HUE pulse        |
| 10  | Cop Car          |
| 11  | Candlelight      |
| 12  | HUE Loop         |
| 13  | CCT Loop         |
| 14  | INT loop         |
| 15  | TV Screen        |
| 16  | Firework         |
| 17  | Party            |

## Vibe presets

Fetch the live list via `GET /presets`. Built-ins (as of 1.1.0):

| ID            | What it does |
| ------------- | ------------ |
| `cinematic`   | Warm 3200K, low brightness, hint of magenta. |
| `sunset`      | Deep orange fading into magenta. |
| `daylight`    | Crisp 5600K, full brightness — work-mode. |
| `horror`      | Sickly red with a defective-bulb flicker. |
| `vampire`     | Dim blood red, no flicker. |
| `rave`        | Party scene at maximum chaos. |
| `underwater`  | Slow cyan pulse — submerged vibe. |
| `spaceship`   | Cool blue with intermittent red alert flashes. |
| `ufo`         | Slow green hue pulse. |
| `fireplace`   | Candlelight scene shifted red-orange. |
| `candlelight` | Soft warm flicker, low brightness. |
| `police`      | Cop Car scene, lights it up red & blue. |
| `noir`        | Low warm tungsten, single source. |
| `paparazzi`   | Camera-shutter flash storm. |
| `fireworks`   | Bursting multi-color firework scene. |
| `tvScreen`    | Flickering monitor glow. |
| `blackout`    | Everything off — Neewer + Govee. |
| `surpriseMe`  | Random hue + random scene. |

## Examples

```bash
# Turn every connected light on
curl 'http://localhost:31337/turnOnLight'

# Set one light to warm white at 60% brightness
curl 'http://localhost:31337/setLightCCT?light=NW-12345&CCT=32&Brightness=60'

# Cyan at full
curl 'http://localhost:31337/setLightHSI?HUE=180&Saturation=1&Brightness=100'

# Cop Car scene at speed 8
curl 'http://localhost:31337/setLightScene?SceneId=10&Brightness=100&Speed=8'

# Apply a vibe
curl 'http://localhost:31337/preset/sunset'
curl 'http://localhost:31337/preset/surpriseMe'

# What's online?
curl -s 'http://localhost:31337/lights' | jq

# Govee orange
curl 'http://localhost:31337/goveeColor?r=255&g=120&b=20'
```

## Environment variables

| Var                    | Default | Effect |
| ---------------------- | ------- | ------ |
| `NEEWER_PORT`          | `31337`  | HTTP port |
| `NEEWER_LOG_LEVEL`     | `info`  | `debug` / `info` / `warn` / `error` / `off` |
| `NEEWER_MAX_LIGHTS`    | `8`     | Cap on simultaneously-connected Neewer lights |

Edit `com.boisclub.lightcontroller.plist` (then re-run `./install.sh`) to bake them into the LaunchAgent.

## Project layout

```
index.js                  HTTP server, route wiring, static UI mount, shutdown
bleManager.js             Noble scan + reconnect-with-backoff, multi-light registry
neewerLight.js            One per peripheral: connect, write, scene, snapshot()
neewerLightConstant.js    BLE protocol constants + command byte builders
neewerLightFX.js          Scene factory (17 built-in scenes)
commands.js               Command registry — every handler returns { ok, … }
commandParameter.js       Query-string parsing
presets.js                Creative vibe presets (sunset, horror, rave, …)
goveeEffects.js           Software-driven effects for Govee (police, rainbow, …)
logger.js                 Level-gated console logger (NEEWER_LOG_LEVEL)

public/index.html         Web UI markup
public/styles.css         Dark theme
public/app.js             Client-side polling + controls

com.boisclub.lightcontroller.plist     launchd LaunchAgent template
install.sh                One-shot installer (resolves node bin, writes plist, bootstraps)
uninstall.sh              Tear-down counterpart

streamdeck-plugin/        Stream Deck plugin source (com.boisclub.lightcontroller.sdPlugin/)
streamdeck-plugin/install-plugin.sh  Install the plugin into Stream Deck and restart the app
streamdeck-plugin/make-icons.js      Pure-Node icon generator (light-bulb shapes)

ARCHITECTURE.md           Deeper architecture notes
README.md                 This file
```

## Stream Deck plugin

A complete plugin called **Bois Club Light Controller** ships under [`streamdeck-plugin/`](./streamdeck-plugin/).

**Easiest install (macOS or Windows):** double-click [`streamdeck-plugin/dist/com.boisclub.lightcontroller.streamDeckPlugin`](./streamdeck-plugin/dist/com.boisclub.lightcontroller.streamDeckPlugin). The Stream Deck app picks it up, prompts to install, and registers the plugin.

**Script install (macOS):** `streamdeck-plugin/install-plugin.sh` — quits Stream Deck, copies the unpacked bundle into `~/Library/Application Support/com.elgato.StreamDeck/Plugins/`, and relaunches.

The plugin exposes 12 actions in 4 families:

- **Neewer ·** Power / CCT / HSI / Scene — pick a specific Neewer light (or all) and set CCT, hue/sat colour, brightness, or fire a scene 1–17.
- **Govee ·** Power / Brightness / Color / Effect — pick a specific Govee device (or all), drive it.
- **All ·** Power / Color / Brightness — fan out to every Neewer + every Govee in one tap.
- **Vibe Preset** — apply one of the 18 named presets across everything.

The server URL is a **single global setting** shared by every key — edit it in any action's Property Inspector and the change applies everywhere. Default `http://127.0.0.1:31337`; change it to point at another machine on the LAN if the server runs elsewhere.

## Service control quickref

```bash
# tail logs
tail -f ~/Library/Logs/BoisClubLightController/boisclub.out.log
tail -f ~/Library/Logs/BoisClubLightController/boisclub.err.log

# restart (e.g. after editing index.js)
launchctl kickstart -k gui/$(id -u)/com.boisclub.lightcontroller

# is it loaded?
launchctl print gui/$(id -u)/com.boisclub.lightcontroller | head

# uninstall
./uninstall.sh
```

## Tested hardware

- **Neewer:** verified only on the **Neewer MS60C** (`lightType = 42`, BH-30S RGB family). Other Neewer lights using the same `0x69400001-…` GATT service may work but are untested — protocol bytes (`getNewPowerCommand`, `getCCTLightCommand`, `getNewRGBLightCommand`) and `lightType` capability tables may differ for other families.
- **Govee:** known to work with **most Govee Wi-Fi RGB lights** that support the LAN API. **Each Govee device must have "LAN Control" enabled in the Govee Home app** (device → settings → LAN Control) or it will be invisible to discovery — even devices on the supported model list won't appear without this toggle. BLE-only Govee models won't be detected at all.

## Notes & gotchas

- **First Bluetooth prompt** — on a clean install, macOS asks to grant the Node binary Bluetooth access. If you missed the prompt, toggle it in *System Settings → Privacy & Security → Bluetooth*.
- **One process owns the BT adapter** — running `npm start` while the LaunchAgent is also running will conflict. Use `./uninstall.sh` or `launchctl bootout` before debugging interactively.
- **`lightType` defaults to `42`** (BH-30S RGB / MS60C). The hook that would update it from BLE notifications is stubbed in `neewerLight.handleNotifyUpdate`.
- **Multi-light** — cap is `NEEWER_MAX_LIGHTS` (default 8), no longer hard-coded to 1.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for internals.

## License

MIT (per `package.json`).
