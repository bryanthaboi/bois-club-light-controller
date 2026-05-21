// Bois Club Light Controller — Stream Deck plugin host.
// Runs in a CEF webview spawned by Stream Deck. Talks WebSocket to SD on
// localhost. Receives keyDown / willAppear events and dispatches HTTP calls
// to the Bois Club Light Controller server.

(() => {
  const DEFAULT_BASE = 'http://127.0.0.1:31337';
  let ws = null;
  let pluginUUID = null;
  let globalSettings = { base: DEFAULT_BASE };

  // ---------- WebSocket plumbing ----------
  function connectElgatoStreamDeckSocket(inPort, inPluginUUID, inRegisterEvent, _inInfo) {
    pluginUUID = inPluginUUID;
    ws = new WebSocket('ws://127.0.0.1:' + inPort);

    ws.onopen = () => {
      ws.send(JSON.stringify({ event: inRegisterEvent, uuid: inPluginUUID }));
      ws.send(JSON.stringify({ event: 'getGlobalSettings', context: inPluginUUID }));
    };

    ws.onmessage = (evt) => {
      let msg;
      try { msg = JSON.parse(evt.data); } catch (_) { return; }
      handleSDMessage(msg);
    };

    ws.onerror = (e) => log('ws error', e && e.message);
    ws.onclose = () => log('ws closed');
  }
  window.connectElgatoStreamDeckSocket = connectElgatoStreamDeckSocket;

  // ---------- helpers ----------
  function log(...args) {
    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify({
        event: 'logMessage',
        payload: { message: '[bois] ' + args.map((a) => typeof a === 'string' ? a : JSON.stringify(a)).join(' ') }
      }));
    }
  }

  function getBase(_settings) {
    // Always use the global setting — base URL is shared across every key.
    return String(globalSettings.base || DEFAULT_BASE).replace(/\/$/, '');
  }

  function showOk(context) {
    if (!ws) return;
    ws.send(JSON.stringify({ event: 'showOk', context }));
  }
  function showAlert(context) {
    if (!ws) return;
    ws.send(JSON.stringify({ event: 'showAlert', context }));
  }
  function setTitle(context, title) {
    if (!ws) return;
    ws.send(JSON.stringify({
      event: 'setTitle',
      context,
      payload: { title: title == null ? '' : String(title), target: 0 }
    }));
  }

  async function http(base, path, init) {
    const url = base + path;
    try {
      const res = await fetch(url, init);
      const json = await res.json().catch(() => ({}));
      return { ok: res.ok, status: res.status, json };
    } catch (err) {
      return { ok: false, status: 0, json: { error: (err && err.message) || 'network_error' } };
    }
  }

  function qs(obj) {
    const p = new URLSearchParams();
    for (const k in obj) {
      const v = obj[k];
      if (v === undefined || v === null || v === '') continue;
      p.set(k, String(v));
    }
    const s = p.toString();
    return s ? '?' + s : '';
  }

  // ---------- per-action handlers ----------
  // Each handler takes ({ context, settings }) and returns true on success.

  async function neewerPower({ context, settings }) {
    const mode = settings.mode || 'toggle';
    const path = mode === 'on' ? '/turnOnLight' : mode === 'off' ? '/turnOffLight' : '/toggleLight';
    const r = await http(getBase(settings), path + qs({ light: settings.light }));
    return r.ok;
  }

  async function neewerCCT({ settings }) {
    const r = await http(getBase(settings), '/setLightCCT' + qs({
      light: settings.light,
      CCT: settings.cct || 32,
      Brightness: settings.brightness != null ? settings.brightness : 80,
      GM: settings.gm || 0
    }));
    return r.ok;
  }

  async function neewerHSI({ settings }) {
    const r = await http(getBase(settings), '/setLightHSI' + qs({
      light: settings.light,
      HUE: settings.hue || 0,
      Saturation: settings.saturation != null ? settings.saturation : 1,
      Brightness: settings.brightness != null ? settings.brightness : 80
    }));
    return r.ok;
  }

  async function neewerScene({ settings }) {
    const r = await http(getBase(settings), '/setLightScene' + qs({
      light: settings.light,
      SceneId: settings.sceneId || 1,
      Brightness: settings.brightness != null ? settings.brightness : 100,
      Speed: settings.speed != null ? settings.speed : 5
    }));
    return r.ok;
  }

  async function goveePower({ settings }) {
    const mode = settings.mode || 'on';
    const path = mode === 'on' ? '/goveeOn' : '/goveeOff';
    const r = await http(getBase(settings), path + qs({ device: settings.device }));
    return r.ok;
  }

  async function goveeBrightness({ settings }) {
    const pct = settings.brightness != null ? settings.brightness : 100;
    const r = await http(getBase(settings), '/goveeBrightness' + qs({ pct, device: settings.device }));
    return r.ok;
  }

  async function goveeColor({ settings }) {
    let r, g, b;
    if (settings.hex) {
      const hex = settings.hex.replace('#', '');
      r = parseInt(hex.slice(0, 2), 16);
      g = parseInt(hex.slice(2, 4), 16);
      b = parseInt(hex.slice(4, 6), 16);
    } else {
      r = settings.r != null ? settings.r : 255;
      g = settings.g != null ? settings.g : 255;
      b = settings.b != null ? settings.b : 255;
    }
    const res = await http(getBase(settings), '/goveeColor' + qs({ r, g, b, device: settings.device }));
    return res.ok;
  }

  async function goveeEffect({ settings }) {
    const name = settings.effect;
    if (!name) return false;
    if (name === 'stop') {
      const r = await http(getBase(settings), '/govee/stopEffect' + qs({ device: settings.device }));
      return r.ok;
    }
    const r = await http(getBase(settings), '/govee/effect/' + encodeURIComponent(name) + qs({ device: settings.device }));
    return r.ok;
  }

  async function applyPreset({ settings }) {
    const name = settings.preset;
    if (!name) return false;
    const r = await http(getBase(settings), '/preset/' + encodeURIComponent(name));
    return r.ok;
  }

  async function allPower({ settings }) {
    const mode = settings.mode || 'toggle';
    const path = mode === 'on' ? '/all/on' : mode === 'off' ? '/all/off' : '/all/toggle';
    const r = await http(getBase(settings), path);
    return r.ok;
  }

  async function allColor({ settings }) {
    let r, g, b;
    if (settings.hex) {
      const hex = settings.hex.replace('#', '');
      r = parseInt(hex.slice(0, 2), 16);
      g = parseInt(hex.slice(2, 4), 16);
      b = parseInt(hex.slice(4, 6), 16);
    } else {
      r = settings.r != null ? settings.r : 255;
      g = settings.g != null ? settings.g : 255;
      b = settings.b != null ? settings.b : 255;
    }
    const bri = settings.brightness != null ? settings.brightness : 80;
    const res = await http(getBase(settings), '/all/color' + qs({ r, g, b, brightness: bri }));
    return res.ok;
  }

  async function allBrightness({ settings }) {
    const pct = settings.brightness != null ? settings.brightness : 100;
    const r = await http(getBase(settings), '/all/brightness' + qs({ pct }));
    return r.ok;
  }

  const HANDLERS = {
    'com.boisclub.lightcontroller.neewer-power': neewerPower,
    'com.boisclub.lightcontroller.neewer-cct': neewerCCT,
    'com.boisclub.lightcontroller.neewer-hsi': neewerHSI,
    'com.boisclub.lightcontroller.neewer-scene': neewerScene,
    'com.boisclub.lightcontroller.govee-power': goveePower,
    'com.boisclub.lightcontroller.govee-brightness': goveeBrightness,
    'com.boisclub.lightcontroller.govee-color': goveeColor,
    'com.boisclub.lightcontroller.govee-effect': goveeEffect,
    'com.boisclub.lightcontroller.preset': applyPreset,
    'com.boisclub.lightcontroller.all-power': allPower,
    'com.boisclub.lightcontroller.all-color': allColor,
    'com.boisclub.lightcontroller.all-brightness': allBrightness
  };

  // ---------- SD event dispatch ----------
  function handleSDMessage(msg) {
    const { event, action, context, payload } = msg;
    if (event === 'didReceiveGlobalSettings') {
      const incoming = (payload && payload.settings) || {};
      if (!incoming.base) incoming.base = DEFAULT_BASE;
      globalSettings = incoming;
      log('global settings received: base=' + globalSettings.base);
      return;
    }
    if (event === 'keyDown') {
      const settings = (payload && payload.settings) || {};
      const handler = HANDLERS[action];
      if (!handler) {
        log('no handler for action', action);
        showAlert(context);
        return;
      }
      Promise.resolve(handler({ context, settings, action, payload }))
        .then((ok) => { if (ok) showOk(context); else showAlert(context); })
        .catch((err) => { log('handler error', err && err.message); showAlert(context); });
      return;
    }
    if (event === 'willAppear') {
      // Update title from a per-key custom title if provided.
      const settings = (payload && payload.settings) || {};
      if (settings.label) setTitle(context, settings.label);
      return;
    }
    if (event === 'sendToPlugin') {
      // Property Inspectors can ask the plugin to test connectivity or fetch lists.
      handleSendToPlugin(action, context, (payload && payload) || {});
      return;
    }
  }

  async function handleSendToPlugin(action, context, payload) {
    const cmd = payload.command;
    // PIs send their current global base in payload.base; trust it for the
    // duration of this round-trip so a freshly-typed URL pings the new host
    // before its setGlobalSettings has flushed back to the plugin.
    const base = payload.base
      ? String(payload.base).replace(/\/$/, '')
      : getBase({});
    if (cmd === 'getLights') {
      const r = await http(base, '/lights');
      sendToPI(context, action, { command: 'lights', ok: r.ok, lights: (r.json && r.json.lights) || [] });
    } else if (cmd === 'getGovee') {
      const r = await http(base, '/govee/devices');
      sendToPI(context, action, { command: 'goveeDevices', ok: r.ok, devices: (r.json && r.json.devices) || [] });
    } else if (cmd === 'getPresets') {
      const r = await http(base, '/presets');
      sendToPI(context, action, { command: 'presets', ok: r.ok, presets: (r.json && r.json.presets) || [] });
    } else if (cmd === 'getEffects') {
      const r = await http(base, '/govee/effects');
      sendToPI(context, action, { command: 'effects', ok: r.ok, effects: (r.json && r.json.effects) || [] });
    } else if (cmd === 'ping') {
      const r = await http(base, '/lights');
      sendToPI(context, action, { command: 'ping', ok: r.ok, status: r.status });
    }
  }

  function sendToPI(context, action, payload) {
    if (!ws) return;
    ws.send(JSON.stringify({ event: 'sendToPropertyInspector', context, action, payload }));
  }
})();
