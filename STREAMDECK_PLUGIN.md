# Building a Stream Deck plugin for Bois Club Light Controller

This guide walks through wrapping the Bois Club Light Controller HTTP API in an Elgato Stream Deck plugin so each light command, scene, and preset can be a single button on your deck. It targets the **Stream Deck SDK v2** (current as of 2025+), which is the same SDK used by every recent Elgato plugin.

> TL;DR: Bois Club Light Controller runs on `http://127.0.0.1:31337`. The plugin is a small Node.js / TypeScript program that the Stream Deck app launches, opens a WebSocket back to the app, and on every "key down" event makes a `fetch` call to the local server.

---

## 1. Prerequisites

- macOS or Windows
- Stream Deck **6.x** desktop app installed
- Node.js 18+
- The Elgato CLI:
  ```bash
  npm install -g @elgato/cli
  ```
- Bois Club Light Controller running locally (`./install.sh` puts it on a LaunchAgent — see `README.md`).

Verify the server is alive before starting:

```bash
curl -s http://127.0.0.1:31337/lights | head
curl -s http://127.0.0.1:31337/presets
```

---

## 2. Scaffold the plugin

The Elgato CLI scaffolds a TypeScript plugin and registers a developer UUID for you.

```bash
streamdeck create
```

When prompted:

| Field | Suggested value |
| ----- | --------------- |
| Author | your name / handle |
| Plugin name | `Bois Club Light Controller` |
| Plugin UUID | `com.boisclub.lightcontroller.streamdeck` |
| Description | "Control Neewer + Govee lights via Bois Club Light Controller" |
| Icon | any 256×256 PNG (we'll replace later) |

You'll get a directory like `com.boisclub.lightcontroller.streamdeck.sdPlugin/` with:

```
manifest.json
bin/plugin.js          ← compiled output
src/plugin.ts          ← entry
src/actions/           ← one file per action
imgs/                  ← icons
ui/                    ← Property Inspector HTML
```

Run the dev loop:

```bash
streamdeck dev
npm run watch     # if the template includes it
```

`streamdeck dev` symlinks the plugin into `~/Library/Application Support/com.elgato.StreamDeck/Plugins/` (macOS) and tails its logs.

---

## 3. Manifest

`manifest.json` is what Stream Deck reads to populate its action list. Replace the scaffolded contents with the action set below — one entry per logical action.

```jsonc
{
  "Name": "Bois Club Light Controller",
  "Description": "Control Neewer & Govee lights via the Bois Club Light Controller local server.",
  "Author": "you",
  "Version": "1.0.0.0",
  "Icon": "imgs/plugin",
  "SDKVersion": 2,
  "OS": [
    { "Platform": "mac", "MinimumVersion": "12" },
    { "Platform": "windows", "MinimumVersion": "10" }
  ],
  "Software": { "MinimumVersion": "6.5" },
  "Nodejs": { "Version": "20", "Debug": "enabled" },
  "Category": "Bois Club Light Controller",
  "CategoryIcon": "imgs/category",
  "CodePath": "bin/plugin.js",
  "UUID": "com.boisclub.lightcontroller.streamdeck",
  "Actions": [
    {
      "UUID": "com.boisclub.lightcontroller.streamdeck.power",
      "Name": "Power",
      "Icon": "imgs/actions/power",
      "Tooltip": "Toggle, on, or off — for one light or all.",
      "States": [{ "Image": "imgs/actions/power_key" }],
      "Controllers": ["Keypad"],
      "PropertyInspectorPath": "ui/power.html"
    },
    {
      "UUID": "com.boisclub.lightcontroller.streamdeck.cct",
      "Name": "Set CCT",
      "Icon": "imgs/actions/cct",
      "Tooltip": "Apply a colour-temperature preset.",
      "States": [{ "Image": "imgs/actions/cct_key" }],
      "Controllers": ["Keypad"],
      "PropertyInspectorPath": "ui/cct.html"
    },
    {
      "UUID": "com.boisclub.lightcontroller.streamdeck.hsi",
      "Name": "Set HSI",
      "Icon": "imgs/actions/hsi",
      "Tooltip": "Apply a hue / saturation / intensity colour.",
      "States": [{ "Image": "imgs/actions/hsi_key" }],
      "Controllers": ["Keypad"],
      "PropertyInspectorPath": "ui/hsi.html"
    },
    {
      "UUID": "com.boisclub.lightcontroller.streamdeck.scene",
      "Name": "Run Scene",
      "Icon": "imgs/actions/scene",
      "Tooltip": "Trigger a Neewer scene (1–17).",
      "States": [{ "Image": "imgs/actions/scene_key" }],
      "Controllers": ["Keypad"],
      "PropertyInspectorPath": "ui/scene.html"
    },
    {
      "UUID": "com.boisclub.lightcontroller.streamdeck.preset",
      "Name": "Vibe Preset",
      "Icon": "imgs/actions/preset",
      "Tooltip": "Apply a Bois Club Light Controller preset (sunset, horror, rave…).",
      "States": [{ "Image": "imgs/actions/preset_key" }],
      "Controllers": ["Keypad"],
      "PropertyInspectorPath": "ui/preset.html"
    },
    {
      "UUID": "com.boisclub.lightcontroller.streamdeck.random",
      "Name": "Random Colour",
      "Icon": "imgs/actions/random",
      "Tooltip": "Randomise hue on every press.",
      "States": [{ "Image": "imgs/actions/random_key" }],
      "Controllers": ["Keypad"]
    },
    {
      "UUID": "com.boisclub.lightcontroller.streamdeck.govee",
      "Name": "Govee",
      "Icon": "imgs/actions/govee",
      "Tooltip": "Drive Govee LAN lights (on/off/brightness/colour).",
      "States": [{ "Image": "imgs/actions/govee_key" }],
      "Controllers": ["Keypad"],
      "PropertyInspectorPath": "ui/govee.html"
    }
  ]
}
```

Each action has its own Property Inspector HTML (the side panel that appears when the user drops the action onto a key). We'll define those in section 5.

---

## 4. Plugin code (TypeScript)

The Elgato SDK exposes a `@elgato/streamdeck` package that abstracts the WebSocket. Each action is a class that extends `SingletonAction` (one shared instance) or `Action` (one per key).

`src/plugin.ts` — bootstrap:

```ts
import streamDeck, { LogLevel } from "@elgato/streamdeck";

import { PowerAction } from "./actions/power";
import { CctAction } from "./actions/cct";
import { HsiAction } from "./actions/hsi";
import { SceneAction } from "./actions/scene";
import { PresetAction } from "./actions/preset";
import { RandomAction } from "./actions/random";
import { GoveeAction } from "./actions/govee";

streamDeck.logger.setLevel(LogLevel.INFO);

streamDeck.actions.registerAction(new PowerAction());
streamDeck.actions.registerAction(new CctAction());
streamDeck.actions.registerAction(new HsiAction());
streamDeck.actions.registerAction(new SceneAction());
streamDeck.actions.registerAction(new PresetAction());
streamDeck.actions.registerAction(new RandomAction());
streamDeck.actions.registerAction(new GoveeAction());

streamDeck.connect();
```

`src/lib/neewer.ts` — shared HTTP helper:

```ts
const BASE = process.env.NEEWER_BASE ?? "http://127.0.0.1:31337";

export async function call(path: string, params: Record<string, string | number | undefined> = {}) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    qs.set(k, String(v));
  }
  const url = `${BASE}${path}${qs.toString() ? "?" + qs.toString() : ""}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`${path} → HTTP ${res.status}`);
  }
  return res.json().catch(() => ({}));
}

export async function lights() {
  return call("/lights");
}

export async function presets() {
  return call("/presets");
}
```

`src/actions/power.ts`:

```ts
import { action, KeyDownEvent, SingletonAction, WillAppearEvent } from "@elgato/streamdeck";
import { call } from "../lib/neewer";

type Settings = { light?: string; mode?: "toggle" | "on" | "off" };

@action({ UUID: "com.boisclub.lightcontroller.streamdeck.power" })
export class PowerAction extends SingletonAction<Settings> {
  async onKeyDown(ev: KeyDownEvent<Settings>) {
    const { light, mode = "toggle" } = ev.payload.settings;
    const path = mode === "on" ? "/turnOnLight" : mode === "off" ? "/turnOffLight" : "/toggleLight";
    try {
      await call(path, { light });
      await ev.action.showOk();
    } catch (err) {
      ev.action.showAlert();
      streamDeck.logger.warn(`power failed: ${(err as Error).message}`);
    }
  }

  // Show a tiny status dot on the key based on the targeted light's state.
  async onWillAppear(ev: WillAppearEvent<Settings>) {
    pollKey(ev);
  }
}

async function pollKey<S>(ev: WillAppearEvent<S & { light?: string }>) {
  setInterval(async () => {
    try {
      const status = await call("/lights");
      const target = (ev.payload.settings as { light?: string }).light;
      const light = (status.lights || []).find((l: any) => !target || l.name === target);
      if (!light) return;
      ev.action.setTitle(light.isOn ? "ON" : "off");
    } catch { /* ignore — server might be down */ }
  }, 3000);
}
```

`src/actions/cct.ts`:

```ts
import { action, KeyDownEvent, SingletonAction } from "@elgato/streamdeck";
import { call } from "../lib/neewer";

type Settings = { light?: string; cct: number; brightness: number; gm?: number };

@action({ UUID: "com.boisclub.lightcontroller.streamdeck.cct" })
export class CctAction extends SingletonAction<Settings> {
  async onKeyDown(ev: KeyDownEvent<Settings>) {
    const { light, cct, brightness, gm } = ev.payload.settings;
    try {
      await call("/setLightCCT", { light, CCT: cct, Brightness: brightness, GM: gm });
      await ev.action.showOk();
    } catch (err) {
      await ev.action.showAlert();
    }
  }
}
```

`src/actions/hsi.ts`, `src/actions/scene.ts`, `src/actions/random.ts` follow the same shape — only the path and parameter names change:

| Action | Path | Required settings |
| ------ | ---- | ----------------- |
| HSI | `/setLightHSI` | `HUE` (0–360), optional `Saturation`, `Brightness`, `light` |
| Scene | `/setLightScene` | `SceneId` (1–17), `Brightness`, `Speed`, optional `light` |
| Random | `/randomColor` | optional `light`, `Brightness` |
| Preset | `/preset/<name>` | preset name from `/presets` |
| Govee | `/goveeOn`, `/goveeOff`, `/goveeBrightness?pct=`, `/goveeColor?r=&g=&b=` | sub-action select |

`src/actions/preset.ts` is interesting because the dropdown of available preset names should be **populated dynamically** from the server. That's done in the Property Inspector — see next section.

---

## 5. Property Inspectors (the action's settings UI)

Each `PropertyInspectorPath` points to a small HTML page rendered in Stream Deck's side panel. It uses a tiny `sdpi` SDK (`@elgato/streamdeck-pi`) and exchanges messages with the plugin via WebSocket.

`ui/cct.html`:

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <link rel="stylesheet" href="https://sdpi-components.dev/releases/v3/sdpi-components.css">
  <script src="https://sdpi-components.dev/releases/v3/sdpi-components.js"></script>
</head>
<body>
  <sdpi-item label="Light">
    <sdpi-textfield setting="light" placeholder="(all)"></sdpi-textfield>
  </sdpi-item>
  <sdpi-item label="CCT (×100 K)">
    <sdpi-range setting="cct" min="32" max="56" step="1" default="40" showlabels></sdpi-range>
  </sdpi-item>
  <sdpi-item label="Brightness">
    <sdpi-range setting="brightness" min="0" max="100" step="1" default="80"></sdpi-range>
  </sdpi-item>
  <sdpi-item label="GM tint">
    <sdpi-range setting="gm" min="-50" max="50" step="1" default="0"></sdpi-range>
  </sdpi-item>
</body>
</html>
```

`ui/preset.html` — dynamic dropdown:

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <link rel="stylesheet" href="https://sdpi-components.dev/releases/v3/sdpi-components.css">
  <script src="https://sdpi-components.dev/releases/v3/sdpi-components.js"></script>
</head>
<body>
  <sdpi-item label="Preset">
    <sdpi-select setting="preset" id="presetSelect" placeholder="Loading…"></sdpi-select>
  </sdpi-item>

  <script>
    fetch("http://127.0.0.1:31337/presets")
      .then((r) => r.json())
      .then((j) => {
        const sel = document.getElementById("presetSelect");
        sel.dataSource = (j.presets || []).map((p) => ({
          label: p.label + " — " + p.desc,
          value: p.id
        }));
      })
      .catch((e) => console.warn("preset fetch failed", e));
  </script>
</body>
</html>
```

The Property Inspector and plugin process share **settings objects**; everything you set with `sdpi-*` components is automatically delivered to the plugin in `ev.payload.settings`.

---

## 6. Icons

Stream Deck wants:

- `imgs/plugin@2x.png` (288×288)
- `imgs/category@2x.png` (84×84)
- `imgs/actions/<name>@2x.png` (84×84) — used in the action list
- `imgs/actions/<name>_key@2x.png` (144×144) — used as the default key image

Make them transparent PNGs. Stream Deck recolours them based on the active theme.

---

## 7. Building & packaging

```bash
npm run build            # tsc → bin/plugin.js
streamdeck pack          # produces Bois Club Light Controller.streamDeckPlugin
```

Double-click the resulting `.streamDeckPlugin` file to install. To re-pack after edits:

```bash
streamdeck restart com.boisclub.lightcontroller.streamdeck
```

---

## 8. Mapping cheat sheet (plugin action → Bois Club Light Controller HTTP)

| Action | Endpoint                                  | Query params from settings |
| ------ | ----------------------------------------- | -------------------------- |
| Power on  | `/turnOnLight`                         | `light` |
| Power off | `/turnOffLight`                        | `light` |
| Toggle    | `/toggleLight`                         | `light` |
| CCT       | `/setLightCCT`                         | `light`, `CCT`, `Brightness`, `GM` |
| HSI       | `/setLightHSI`                         | `light`, `HUE`, `Saturation`, `Brightness` |
| Scene     | `/setLightScene`                       | `light`, `SceneId`, `Brightness`, `Speed` |
| Random    | `/randomColor`                         | `light`, `Brightness` |
| Preset    | `/preset/<name>`                       | path param |
| Govee on  | `/goveeOn`                             | — |
| Govee off | `/goveeOff`                            | — |
| Govee brr | `/goveeBrightness?pct=N`               | `pct` |
| Govee rgb | `/goveeColor?r=R&g=G&b=B`              | `r`, `g`, `b` |
| Status    | `/lights`                              | poll every 3s to drive key titles |

---

## 9. Pro tips

- **`showOk()` / `showAlert()`** give the user a flash of feedback on every key press — pair them with try/catch around every `call()`.
- Use `setTitle()` from the polling loop to display live state (e.g. "ON • 60%" or "VAMPIRE").
- If Bois Club Light Controller isn't installed everywhere, fall back to `NEEWER_BASE` env var (read in `plugin.ts`) so the same plugin works against a remote server too.
- For multi-action keys (e.g. one key that runs a preset and then a random colour), chain calls in `onKeyDown`:
  ```ts
  await call("/preset/sunset");
  setTimeout(() => call("/randomColor"), 3000);
  ```
- The Stream Deck SDK also supports **dial / encoder** input on Stream Deck +. Wire dial actions to `/setLightCCT` (CCT) and `/setLightHSI` (Hue) for sweep control.

---

## 10. Troubleshooting

- **Key shows a triangle alert** → the call failed. Check `~/Library/Logs/ElgatoStreamDeck/` for the plugin's stderr.
- **`/lights` returns empty** → BLE scanning is paused or no light is in range. Hit "Rescan" in the Bois Club Light Controller web UI.
- **Plugin can't connect** → make sure Bois Club Light Controller is up: `curl http://127.0.0.1:31337/lights`. If you reboot, the LaunchAgent should restart the server automatically (see `install.sh`).
- **macOS Bluetooth permission** → when running Bois Club Light Controller as a LaunchAgent, the controlling process needs Bluetooth permission. Approve it once via System Settings → Privacy & Security → Bluetooth → enable for the Node binary.

That's the whole loop: scaffold, wire each action to a `/path`, drop in a Property Inspector for settings, pack, ship.
