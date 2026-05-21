// Shared PI runtime. Connects to Stream Deck, persists ACTION-LOCAL settings
// for action-specific fields (light, mode, etc.), and persists the API
// BASE URL via Stream Deck GLOBAL settings — so it's configured once and
// every key uses the same server.

(() => {
  const DEFAULT_BASE = 'http://127.0.0.1:31337';

  const pi = window.boisPI = {
    settings: {},        // per-action settings
    global: { base: DEFAULT_BASE },
    context: null,
    actionUUID: null,
    ws: null,
    onSettings: () => {},
    onMessage: () => {}
  };

  window.connectElgatoStreamDeckSocket = function (inPort, inUUID, inRegisterEvent, _inInfo, inActionInfo) {
    pi.context = inUUID;
    let parsed = {};
    try { parsed = JSON.parse(inActionInfo); } catch (_) {}
    pi.actionUUID = parsed.action;
    pi.settings = (parsed.payload && parsed.payload.settings) || {};

    pi.ws = new WebSocket('ws://127.0.0.1:' + inPort);
    pi.ws.onopen = () => {
      pi.ws.send(JSON.stringify({ event: inRegisterEvent, uuid: inUUID }));
      // Ask for global settings; we'll fire onSettings once they arrive so
      // PI fields can populate against an accurate base URL.
      pi.ws.send(JSON.stringify({ event: 'getGlobalSettings', context: inUUID }));
      // Fire onSettings now too, so action-local fields render immediately;
      // the base-URL field will update when global settings come back.
      pi.onSettings(pi.settings);
    };
    pi.ws.onmessage = (evt) => {
      let msg;
      try { msg = JSON.parse(evt.data); } catch (_) { return; }
      if (msg.event === 'didReceiveSettings') {
        pi.settings = (msg.payload && msg.payload.settings) || {};
        pi.onSettings(pi.settings);
      } else if (msg.event === 'didReceiveGlobalSettings') {
        const g = (msg.payload && msg.payload.settings) || {};
        if (!g.base) g.base = DEFAULT_BASE;
        pi.global = g;
        // Refresh the server-block UI if it's mounted.
        const baseEl = document.getElementById('bois-base');
        if (baseEl) baseEl.value = pi.global.base;
      } else if (msg.event === 'sendToPropertyInspector') {
        pi.onMessage(msg.payload || {});
      }
    };
  };

  pi.save = function () {
    if (!pi.ws) return;
    pi.ws.send(JSON.stringify({
      event: 'setSettings',
      context: pi.context,
      payload: pi.settings
    }));
  };

  pi.saveGlobal = function () {
    if (!pi.ws) return;
    pi.ws.send(JSON.stringify({
      event: 'setGlobalSettings',
      context: pi.context,
      payload: pi.global
    }));
  };

  pi.ask = function (cmd, extra) {
    if (!pi.ws) return;
    const payload = Object.assign({ command: cmd, base: pi.global.base }, extra || {});
    pi.ws.send(JSON.stringify({
      event: 'sendToPlugin',
      context: pi.context,
      action: pi.actionUUID,
      payload
    }));
  };

  pi.bind = function (selector, key, transform) {
    const el = document.querySelector(selector);
    if (!el) return;
    const apply = () => {
      const v = transform ? transform(el.value) : el.value;
      pi.settings[key] = v;
      pi.save();
    };
    if (el.type === 'range' || el.type === 'color' || el.tagName === 'SELECT') {
      el.addEventListener('input', apply);
      el.addEventListener('change', apply);
    } else if (el.type === 'text' || el.type === 'number') {
      el.addEventListener('change', apply);
      el.addEventListener('blur', apply);
    } else {
      el.addEventListener('change', apply);
    }
  };

  pi.fillOptions = function (selectSelector, items, getValue, getLabel, currentValue) {
    const sel = document.querySelector(selectSelector);
    if (!sel) return;
    sel.innerHTML = '';
    items.forEach((it) => {
      const opt = document.createElement('option');
      opt.value = getValue(it);
      opt.textContent = getLabel(it);
      if (currentValue != null && String(opt.value) === String(currentValue)) opt.selected = true;
      sel.appendChild(opt);
    });
  };

  pi.serverBlock = function () {
    return `
      <h2>Server (global) <span class="status" id="bois-server-status">unknown</span></h2>
      <div class="row">
        <label>Base URL</label>
        <input type="text" id="bois-base" placeholder="http://127.0.0.1:31337">
        <button id="bois-test">Test</button>
      </div>
      <div class="hint">One value shared by <em>every</em> Bois Club key. e.g. <code>http://127.0.0.1:31337</code> (this Mac) or <code>http://192.168.1.42:31337</code> for another box.</div>
      <hr>
    `;
  };

  pi.wireServerBlock = function () {
    const baseEl = document.getElementById('bois-base');
    const status = document.getElementById('bois-server-status');
    if (!baseEl) return;
    baseEl.value = pi.global.base || DEFAULT_BASE;
    baseEl.addEventListener('change', () => {
      pi.global.base = (baseEl.value.trim() || DEFAULT_BASE);
      pi.saveGlobal();
    });
    document.getElementById('bois-test').addEventListener('click', () => {
      status.textContent = 'pinging…'; status.className = 'status';
      pi.ask('ping');
    });
    pi.onMessage = ((prev) => (m) => {
      if (m.command === 'ping') {
        if (m.ok) { status.textContent = 'connected ✓'; status.className = 'status good'; }
        else      { status.textContent = `unreachable (${m.status || 'no response'})`; status.className = 'status bad'; }
      }
      if (prev) prev(m);
    })(pi.onMessage);
  };

  pi.loadNeewerLights = function (selectId, currentValue) {
    pi.ask('getLights');
    pi.onMessage = ((prev) => (m) => {
      if (m.command === 'lights') {
        const lights = m.lights || [];
        const items = [{ name: '', label: '(any / all)' }].concat(lights.map((l) => ({
          name: l.name, label: `${l.name} · type ${l.lightType}${l.connected ? '' : ' (offline)'}`
        })));
        pi.fillOptions('#' + selectId, items, (i) => i.name, (i) => i.label, currentValue);
      }
      if (prev) prev(m);
    })(pi.onMessage);
  };

  pi.loadGoveeDevices = function (selectId, currentValue, includeAll) {
    pi.ask('getGovee');
    pi.onMessage = ((prev) => (m) => {
      if (m.command === 'goveeDevices') {
        const devs = m.devices || [];
        const items = (includeAll ? [{ value: '', label: '(all Govee)' }] : [])
          .concat(devs.map((d) => ({ value: d.ip, label: `${d.model} · ${d.ip}` })));
        pi.fillOptions('#' + selectId, items, (i) => i.value, (i) => i.label, currentValue);
      }
      if (prev) prev(m);
    })(pi.onMessage);
  };

  pi.loadPresets = function (selectId, currentValue) {
    pi.ask('getPresets');
    pi.onMessage = ((prev) => (m) => {
      if (m.command === 'presets') {
        const list = m.presets || [];
        pi.fillOptions('#' + selectId, list, (i) => i.id, (i) => `${i.label} — ${i.desc}`, currentValue);
      }
      if (prev) prev(m);
    })(pi.onMessage);
  };

  pi.loadEffects = function (selectId, currentValue) {
    pi.ask('getEffects');
    pi.onMessage = ((prev) => (m) => {
      if (m.command === 'effects') {
        const list = m.effects || [];
        const items = list.concat([{ id: 'stop', label: '✋ Stop running effect', desc: '' }]);
        pi.fillOptions('#' + selectId, items, (i) => i.id, (i) => i.desc ? `${i.label} — ${i.desc}` : i.label, currentValue);
      }
      if (prev) prev(m);
    })(pi.onMessage);
  };
})();
