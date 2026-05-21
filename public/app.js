// Bois Club Light Controller web UI client. Polls /lights + /govee/devices
// + /govee/effects every 2 s and renders cards.

const SCENE_NAMES = [
  'Lighting', 'Paparazzi', 'Defective bulb', 'Explosion', 'Welding',
  'CCT flash', 'HUE flash', 'CCT pulse', 'HUE pulse', 'Cop Car',
  'Candlelight', 'HUE Loop', 'CCT Loop', 'INT loop', 'TV Screen',
  'Firework', 'Party'
];

const $ = (sel) => document.querySelector(sel);

const state = {
  presets: [],
  effects: [],
  effectsRunning: [],
  lastLightsJson: '',
  lastGoveeJson: ''
};

function log(msg) {
  const el = $('#logTail');
  const time = new Date().toLocaleTimeString();
  el.textContent = `[${time}] ${msg}\n` + el.textContent;
  if (el.textContent.length > 4000) el.textContent = el.textContent.slice(0, 4000);
}

async function fetchJSON(url, opts) {
  try {
    const r = await fetch(url, opts);
    const j = await r.json().catch(() => ({}));
    return { ok: r.ok, status: r.status, json: j };
  } catch (e) {
    return { ok: false, status: 0, json: { error: e.message } };
  }
}

async function call(url, label) {
  const r = await fetchJSON(url);
  log(`${label || url} → ${r.status} ${JSON.stringify(r.json).slice(0, 120)}`);
  refresh();
  return r;
}

function badge(state) {
  const el = $('#connStatus');
  el.className = 'conn-badge';
  if (state === 'poweredOn') { el.classList.add('good'); el.textContent = 'BT ready'; }
  else if (state === 'unknown') { el.classList.add('warn'); el.textContent = 'BT unknown'; }
  else { el.classList.add('bad'); el.textContent = `BT ${state}`; }
}

// ---------------- presets ----------------
function renderPresets() {
  const grid = $('#presetGrid');
  grid.innerHTML = '';
  for (const p of state.presets) {
    const card = document.createElement('div');
    card.className = 'preset-card';
    card.innerHTML = `<div class="label">${p.label}</div><div class="desc">${p.desc}</div>`;
    card.addEventListener('click', () => call(`/preset/${encodeURIComponent(p.id)}`, `preset:${p.id}`));
    grid.appendChild(card);
  }
}

// ---------------- Neewer ----------------
function renderLights(status) {
  badge(status.adapterState || 'unknown');
  const grid = $('#lightGrid');
  const empty = $('#noLights');
  if (!status.lights || status.lights.length === 0) {
    if (empty) empty.style.display = 'block';
    grid.querySelectorAll('.light-card').forEach((n) => n.remove());
    return;
  }
  if (empty) empty.style.display = 'none';

  const sig = JSON.stringify(status.lights.map((l) => ({
    id: l.id, on: l.isOn, b: l.brightness, c: l.cct, h: l.hue, s: l.saturation,
    conn: l.connected, mode: l.mode, scene: l.lastSceneId
  })));
  if (sig === state.lastLightsJson) return;
  state.lastLightsJson = sig;

  grid.querySelectorAll('.light-card').forEach((n) => n.remove());
  for (const l of status.lights) grid.appendChild(buildNeewerCard(l));
}

function buildNeewerCard(l) {
  const card = document.createElement('div');
  card.className = 'light-card';
  card.dataset.light = l.name;

  // CCT may be stored as raw Kelvin (3200) or as the ×100 multiplier (32) —
  // normalise to the multiplier form for the slider.
  const cctMul = l.cct > 100 ? Math.round(l.cct / 100) : l.cct;

  const sceneOptions = SCENE_NAMES
    .map((n, i) => `<option value="${i + 1}" ${l.lastSceneId === i + 1 ? 'selected' : ''}>${i + 1} – ${n}</option>`)
    .join('');

  card.innerHTML = `
    <div class="head">
      <div>
        <span class="dot ${l.isOn ? 'on' : ''}"></span>
        <span class="name">${l.name}</span>
        <div class="meta">Neewer · type ${l.lightType} · ${l.connected ? 'connected' : 'reconnecting'} · ${l.supportRGB ? 'RGB' : 'CCT only'}${l.connectionBreakCounter ? ` · breaks: ${l.connectionBreakCounter}` : ''}</div>
      </div>
      <div class="actions">
        <button data-cmd="on">On</button>
        <button data-cmd="off">Off</button>
        <button data-cmd="toggle">Toggle</button>
      </div>
    </div>

    <div class="row">
      <label>Brightness</label>
      <input type="range" min="0" max="100" value="${l.brightness}" data-bind="brightness">
      <span class="value" data-show="brightness">${l.brightness}</span>
    </div>
    <div class="row">
      <label>CCT</label>
      <input type="range" min="32" max="56" value="${cctMul}" data-bind="cct">
      <span class="value" data-show="cct">${cctMul * 100}K</span>
    </div>
    <div class="row">
      <label>GM tint</label>
      <input type="range" min="-50" max="50" value="${l.gm}" data-bind="gm">
      <span class="value" data-show="gm">${l.gm}</span>
    </div>
    <div class="row">
      <label>Hue</label>
      <input type="range" min="0" max="360" value="${l.hue}" data-bind="hue" ${l.supportRGB ? '' : 'disabled'}>
      <span class="value" data-show="hue">${l.hue}°</span>
    </div>
    <div class="row">
      <label>Saturation</label>
      <input type="range" min="0" max="100" value="${Math.round(l.saturation * 100)}" data-bind="sat" ${l.supportRGB ? '' : 'disabled'}>
      <span class="value" data-show="sat">${Math.round(l.saturation * 100)}%</span>
    </div>
    <div class="row">
      <label>Scene</label>
      <select class="scene-pick" data-bind="scene" ${l.supportRGB ? '' : 'disabled'}>${sceneOptions}</select>
    </div>
    <div class="row">
      <label>Speed</label>
      <input type="range" min="1" max="10" value="5" data-bind="speed">
      <span class="value" data-show="speed">5</span>
    </div>
    <div class="actions">
      <button data-cmd="applyCCT">Apply CCT</button>
      <button data-cmd="applyHSI" ${l.supportRGB ? '' : 'disabled'}>Apply HSI</button>
      <button data-cmd="applyScene" ${l.supportRGB ? '' : 'disabled'}>Run Scene</button>
      <button data-cmd="randomColor" ${l.supportRGB ? '' : 'disabled'}>🎲 Random</button>
    </div>
  `;

  card.querySelectorAll('input[type="range"], select').forEach((input) => {
    input.addEventListener('input', () => {
      const show = card.querySelector(`[data-show="${input.dataset.bind}"]`);
      if (!show) return;
      const v = input.value;
      if (input.dataset.bind === 'cct') show.textContent = (parseInt(v) * 100) + 'K';
      else if (input.dataset.bind === 'hue') show.textContent = v + '°';
      else if (input.dataset.bind === 'sat') show.textContent = v + '%';
      else show.textContent = v;
    });
  });

  card.querySelectorAll('[data-cmd]').forEach((btn) => {
    btn.addEventListener('click', () => onNeewerCmd(card, btn.dataset.cmd, l));
  });

  return card;
}

function readNeewerCard(card) {
  const get = (key) => card.querySelector(`[data-bind="${key}"]`)?.value;
  return {
    brightness: parseInt(get('brightness') || '100', 10),
    cct: parseInt(get('cct') || '32', 10),
    gm: parseInt(get('gm') || '0', 10),
    hue: parseInt(get('hue') || '0', 10),
    sat: parseInt(get('sat') || '100', 10) / 100,
    scene: parseInt(get('scene') || '1', 10),
    speed: parseInt(get('speed') || '5', 10)
  };
}

function onNeewerCmd(card, cmd, l) {
  const v = readNeewerCard(card);
  const name = encodeURIComponent(l.name);
  switch (cmd) {
    case 'on':       return call(`/turnOnLight?light=${name}`, `on:${l.name}`);
    case 'off':      return call(`/turnOffLight?light=${name}`, `off:${l.name}`);
    case 'toggle':   return call(`/toggleLight?light=${name}`, `toggle:${l.name}`);
    case 'applyCCT': return call(`/setLightCCT?light=${name}&CCT=${v.cct}&Brightness=${v.brightness}&GM=${v.gm}`, `cct:${l.name}`);
    case 'applyHSI': return call(`/setLightHSI?light=${name}&HUE=${v.hue}&Saturation=${v.sat}&Brightness=${v.brightness}`, `hsi:${l.name}`);
    case 'applyScene': return call(`/setLightScene?light=${name}&SceneId=${v.scene}&Brightness=${v.brightness}&Speed=${v.speed}`, `scene:${l.name}`);
    case 'randomColor': return call(`/randomColor?light=${name}&Brightness=${v.brightness}`, `random:${l.name}`);
  }
}

// ---------------- Govee ----------------
function rgbToHex(r, g, b) {
  const h = (n) => n.toString(16).padStart(2, '0');
  return '#' + h(r) + h(g) + h(b);
}

function renderGoveeStatus(devices) {
  const status = $('#goveeStatus');
  status.textContent = devices.length === 0
    ? 'no devices on LAN'
    : `${devices.length} device${devices.length === 1 ? '' : 's'}`;
}

function renderGoveeCards(devices) {
  const grid = $('#goveeGrid');
  const empty = $('#noGovee');

  if (devices.length === 0) {
    if (empty) empty.style.display = 'block';
    grid.querySelectorAll('.light-card').forEach((n) => n.remove());
    return;
  }
  if (empty) empty.style.display = 'none';

  // Re-render only if state changed.
  const sig = JSON.stringify(devices.map((d) => ({
    ip: d.ip, m: d.model, on: d.state && d.state.isOn,
    b: d.state && d.state.brightness,
    c: d.state && d.state.color
  }))) + '|' + state.effectsRunning.map((r) => `${r.deviceID}:${r.effect}`).join(',');

  if (sig === state.lastGoveeJson) return;
  state.lastGoveeJson = sig;

  grid.querySelectorAll('.light-card').forEach((n) => n.remove());
  for (const d of devices) grid.appendChild(buildGoveeCard(d));
}

function buildGoveeCard(d) {
  const card = document.createElement('div');
  card.className = 'light-card';
  card.dataset.govee = d.ip;

  const isOn = d.state && d.state.isOn;
  const brr = (d.state && d.state.brightness != null) ? d.state.brightness : 100;
  const c = (d.state && d.state.color) || { r: 255, g: 255, b: 255 };
  const hex = rgbToHex(c.r || 0, c.g || 0, c.b || 0);

  const activeEffect = state.effectsRunning.find((r) => r.deviceID === d.deviceID);

  const effectOptions = state.effects.map((e) =>
    `<option value="${e.id}" ${activeEffect && activeEffect.effect === e.id ? 'selected' : ''}>${e.label} — ${e.desc}</option>`
  ).join('');

  card.innerHTML = `
    <div class="head">
      <div>
        <span class="dot ${isOn ? 'on' : ''}"></span>
        <span class="name">${d.model}</span>
        <div class="meta">Govee · ${d.ip}${activeEffect ? ` · effect: <strong>${activeEffect.effect}</strong>` : ''}</div>
      </div>
      <div class="actions">
        <button data-cmd="on">On</button>
        <button data-cmd="off">Off</button>
      </div>
    </div>

    <div class="row">
      <label>Brightness</label>
      <input type="range" min="0" max="100" value="${brr}" data-bind="brightness">
      <span class="value" data-show="brightness">${brr}%</span>
    </div>
    <div class="row">
      <label>Colour</label>
      <input type="color" value="${hex}" data-bind="hex">
      <span class="value" data-show="hex">${hex.toUpperCase()}</span>
    </div>
    <div class="row">
      <label>Effect</label>
      <select class="scene-pick" data-bind="effect">
        <option value="">— pick effect —</option>
        ${effectOptions}
      </select>
    </div>
    <div class="actions">
      <button data-cmd="applyBrightness">Apply brightness</button>
      <button data-cmd="applyColor">Apply colour</button>
      <button data-cmd="startEffect">▶ Start effect</button>
      <button data-cmd="stopEffect">⏹ Stop effect</button>
    </div>
  `;

  card.querySelectorAll('input[type="range"], input[type="color"], select').forEach((input) => {
    input.addEventListener('input', () => {
      const show = card.querySelector(`[data-show="${input.dataset.bind}"]`);
      if (!show) return;
      if (input.dataset.bind === 'hex') show.textContent = input.value.toUpperCase();
      else if (input.dataset.bind === 'brightness') show.textContent = input.value + '%';
      else show.textContent = input.value;
    });
  });

  card.querySelectorAll('[data-cmd]').forEach((btn) => {
    btn.addEventListener('click', () => onGoveeCmd(card, btn.dataset.cmd, d));
  });

  return card;
}

function readGoveeCard(card) {
  const get = (key) => card.querySelector(`[data-bind="${key}"]`)?.value;
  return {
    brightness: parseInt(get('brightness') || '100', 10),
    hex: get('hex') || '#ffffff',
    effect: get('effect') || ''
  };
}

function onGoveeCmd(card, cmd, d) {
  const v = readGoveeCard(card);
  const ip = encodeURIComponent(d.ip);
  const hex = v.hex.replace('#', '');
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  switch (cmd) {
    case 'on':              return call(`/goveeOn?device=${ip}`, `gOn:${d.ip}`);
    case 'off':             return call(`/goveeOff?device=${ip}`, `gOff:${d.ip}`);
    case 'applyBrightness': return call(`/goveeBrightness?pct=${v.brightness}&device=${ip}`, `gBrr:${d.ip}`);
    case 'applyColor':      return call(`/goveeColor?r=${r}&g=${g}&b=${b}&device=${ip}`, `gColor:${d.ip}`);
    case 'startEffect':
      if (!v.effect) { log('pick an effect first'); return; }
      return call(`/govee/effect/${encodeURIComponent(v.effect)}?device=${ip}`, `gFX:${v.effect}@${d.ip}`);
    case 'stopEffect':      return call(`/govee/stopEffect?device=${ip}`, `gStop:${d.ip}`);
  }
}

async function loadPresets() {
  const r = await fetchJSON('/presets');
  if (r.ok && r.json && r.json.presets) {
    state.presets = r.json.presets;
    renderPresets();
  }
}

async function loadEffects() {
  const r = await fetchJSON('/govee/effects');
  if (r.ok && r.json) {
    state.effects = r.json.effects || [];
    state.effectsRunning = r.json.running || [];
  }
}

async function refresh() {
  const [lights, govee] = await Promise.all([
    fetchJSON('/lights'),
    fetchJSON('/govee/devices')
  ]);
  await loadEffects();
  if (lights.ok && lights.json) renderLights(lights.json);
  if (govee.ok && govee.json) {
    const devs = govee.json.devices || [];
    renderGoveeStatus(devs);
    renderGoveeCards(devs);
  }
}

// ---------------- global controls ----------------
document.addEventListener('click', (ev) => {
  const t = ev.target.closest('[data-action]');
  if (!t) return;
  switch (t.dataset.action) {
    case 'allOn':       call('/all/on', 'all:on'); break;
    case 'allOff':      call('/all/off', 'all:off'); break;
    case 'rescan':      call('/scanLight', 'rescan'); break;
    case 'rediscover':  call('/govee/rediscover', 'govee-rediscover'); break;
    case 'random':      call('/randomColor', 'random-all'); break;
    case 'surprise':    call('/preset/surpriseMe', 'surprise'); break;
  }
});

document.addEventListener('click', (ev) => {
  const t = ev.target.closest('[data-all]');
  if (!t) return;
  switch (t.dataset.all) {
    case 'on':     call('/all/on', 'all:on'); break;
    case 'off':    call('/all/off', 'all:off'); break;
    case 'toggle': call('/all/toggle', 'all:toggle'); break;
    case 'color': {
      const hex = $('#allColor').value.replace('#', '');
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      const bri = parseInt($('#allBrightness').value, 10);
      call(`/all/color?r=${r}&g=${g}&b=${b}&brightness=${bri}`, `all-color:${$('#allColor').value}`);
      break;
    }
    case 'brightness': {
      const pct = parseInt($('#allBrightness').value, 10);
      call(`/all/brightness?pct=${pct}`, `all-brr:${pct}`);
      break;
    }
  }
});

// Live update for the All Lights brightness label
document.addEventListener('input', (ev) => {
  if (ev.target.id === 'allBrightness') {
    $('#allBrightnessVal').textContent = ev.target.value + '%';
  }
});

loadPresets();
refresh();
setInterval(refresh, 2000);
