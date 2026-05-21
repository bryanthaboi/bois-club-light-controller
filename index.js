// index.js
// Entry point: starts the HTTP server, the BLE scanner, and the Govee LAN
// client. Every external dependency is wrapped — neither a missing Govee nor
// a flapping BLE adapter prevents the server from booting.

const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');

const bleManager = require('./bleManager');
const commands = require('./commands');
const logger = require('./logger');
const presets = require('./presets');
const goveeEffects = require('./goveeEffects');

const PORT = parseInt(process.env.NEEWER_PORT || '31337', 10);

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Serve the web UI from /public.
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

// ---------- Govee (LAN) — best-effort, never fatal ----------
let govee = null;
let goveeReady = false;
function startGovee() {
  try {
    const Govee = require('govee-lan-control');
    govee = new Govee.default({ discoverInterval: 15000 });
    govee.on('ready', () => {
      if (goveeReady) return; // library fires 'ready' twice — dedupe
      goveeReady = true;
      logger.info('Govee LAN ready (discover every 15s)');
    });
    govee.on('deviceAdded', (d) => {
      logger.info(`Govee device added: ${d.model || 'unknown'} @ ${d.ip}`);
    });
    govee.on('deviceRemoved', (d) => {
      logger.warn(`Govee device removed: ${d.model || 'unknown'} @ ${d.ip}`);
    });
    govee.on && govee.on('error', (e) => logger.warn(`Govee error: ${e && e.message}`));
  } catch (err) {
    logger.warn(`Govee init failed (continuing without it): ${err && err.message}`);
    govee = null;
  }
}
startGovee();

// ---------- helpers ----------
function ctx() { return { govee }; }

function send(res, result) {
  if (!result || result.ok === false) {
    return res.status(400).json(result || { ok: false, error: 'unknown_error' });
  }
  res.json(result);
}

function wrap(commandName) {
  return async (req, res) => {
    const result = await commands.execute(commandName, req, ctx());
    send(res, result);
  };
}

// ---------- Neewer light endpoints ----------
app.get('/turnOnLight',    wrap('turnOnLight'));
app.get('/turnOffLight',   wrap('turnOffLight'));
app.get('/toggleLight',    wrap('toggleLight'));
app.get('/scanLight',      wrap('scanLight'));
app.get('/setLightHSI',    wrap('setLightHSI'));
app.get('/setLightCCT',    wrap('setLightCCT'));
app.get('/setLightScene',  wrap('setLightScene'));
app.get('/randomColor',    wrap('randomColor'));

// ---------- status & presets ----------
app.get('/lights', async (_req, res) => {
  res.json(bleManager.getStatus());
});

app.get('/presets', async (_req, res) => {
  res.json({ presets: presets.list() });
});

app.get('/preset/:name', async (req, res) => {
  const result = await commands.execute('applyPreset', req, ctx());
  send(res, result);
});

app.post('/preset/:name', async (req, res) => {
  const result = await commands.execute('applyPreset', req, ctx());
  send(res, result);
});

// ---------- Govee endpoints ----------
function withGovee(fn) {
  return (req, res) => {
    if (!govee || !govee.devicesArray || govee.devicesArray.length === 0) {
      return res.status(503).json({ ok: false, error: 'no_govee_devices' });
    }
    try {
      fn(req, res);
    } catch (err) {
      logger.error(`Govee handler error: ${err && err.message}`);
      res.status(500).json({ ok: false, error: err && err.message });
    }
  };
}

// Resolve targets from query: ?device=<ip|deviceID|model>; missing = all.
function resolveGoveeTargets(req) {
  const filter = req.query.device || req.query.ip || req.query.id;
  if (!filter) return govee.devicesArray.slice();
  const needle = String(filter).toLowerCase();
  return govee.devicesArray.filter((d) =>
    (d.ip && d.ip.toLowerCase() === needle) ||
    (d.deviceID && d.deviceID.toLowerCase() === needle) ||
    (d.model && d.model.toLowerCase() === needle)
  );
}

app.get('/goveeOn', withGovee((req, res) => {
  const targets = resolveGoveeTargets(req);
  if (targets.length === 0) return res.status(404).json({ ok: false, error: 'no_matching_govee_device' });
  targets.forEach((d) => d.actions.setOn());
  res.json({ ok: true, affected: targets.length });
}));

app.get('/goveeOff', withGovee((req, res) => {
  const targets = resolveGoveeTargets(req);
  if (targets.length === 0) return res.status(404).json({ ok: false, error: 'no_matching_govee_device' });
  targets.forEach((d) => d.actions.setOff());
  res.json({ ok: true, affected: targets.length });
}));

app.get('/goveeBrightness', withGovee((req, res) => {
  const pct = Math.max(0, Math.min(100, parseInt(req.query.pct || '100', 10)));
  const targets = resolveGoveeTargets(req);
  if (targets.length === 0) return res.status(404).json({ ok: false, error: 'no_matching_govee_device' });
  targets.forEach((d) => d.actions.setBrightness(pct));
  res.json({ ok: true, affected: targets.length, brightness: pct });
}));

app.get('/goveeFullBrightness', withGovee((req, res) => {
  const targets = resolveGoveeTargets(req);
  targets.forEach((d) => d.actions.setBrightness(100));
  res.json({ ok: true, affected: targets.length });
}));

app.get('/goveeHalfBrightness', withGovee((req, res) => {
  const targets = resolveGoveeTargets(req);
  targets.forEach((d) => d.actions.setBrightness(50));
  res.json({ ok: true, affected: targets.length });
}));

// ---------- Govee diagnostics ----------
app.get('/govee/devices', (_req, res) => {
  if (!govee) return res.json({ ok: false, error: 'govee_unavailable', devices: [] });
  const devices = (govee.devicesArray || []).map((d) => ({
    model: d.model,
    ip: d.ip,
    deviceID: d.deviceID,
    state: d.state
  }));
  res.json({ ok: true, count: devices.length, devices });
});

app.get('/govee/rediscover', (_req, res) => {
  if (!govee) return res.status(503).json({ ok: false, error: 'govee_unavailable' });
  try {
    govee.discover();
    res.json({ ok: true, message: 'discover packet sent — wait ~5s then re-check /govee/devices' });
  } catch (err) {
    res.status(500).json({ ok: false, error: err && err.message });
  }
});

// ---------- Govee effects (software-driven, one per device) ----------
function findGoveeDevice(filter) {
  if (!govee || !govee.devicesArray) return [];
  if (!filter) return govee.devicesArray.slice();
  const needle = String(filter).toLowerCase();
  return govee.devicesArray.filter((d) => {
    return (d.ip && d.ip.toLowerCase() === needle) ||
           (d.deviceID && d.deviceID.toLowerCase() === needle) ||
           (d.model && d.model.toLowerCase() === needle);
  });
}

app.get('/govee/effects', (_req, res) => {
  res.json({ ok: true, effects: goveeEffects.list(), running: goveeEffects.status() });
});

app.get('/govee/effect/:name', (req, res) => {
  if (!govee || !govee.devicesArray || govee.devicesArray.length === 0) {
    return res.status(503).json({ ok: false, error: 'no_govee_devices' });
  }
  const name = req.params.name;
  const filter = req.query.device || req.query.ip || req.query.id;
  const targets = findGoveeDevice(filter);
  if (targets.length === 0) {
    return res.status(404).json({ ok: false, error: 'no_matching_govee_device', filter });
  }
  try {
    targets.forEach((d) => goveeEffects.startOnDevice(d, name));
    res.json({ ok: true, started: name, count: targets.length });
  } catch (err) {
    res.status(400).json({ ok: false, error: err && err.message });
  }
});

app.get('/govee/stopEffect', (req, res) => {
  const filter = req.query.device || req.query.ip || req.query.id;
  if (!filter) {
    goveeEffects.stopAll();
    return res.json({ ok: true, stopped: 'all' });
  }
  const targets = findGoveeDevice(filter);
  if (targets.length === 0) {
    return res.status(404).json({ ok: false, error: 'no_matching_govee_device', filter });
  }
  let stopped = 0;
  targets.forEach((d) => { if (goveeEffects.stop(d.deviceID)) stopped += 1; });
  res.json({ ok: true, stopped });
});

app.get('/goveeColor', withGovee((req, res) => {
  const r = Math.max(0, Math.min(255, parseInt(req.query.r || '255', 10)));
  const g = Math.max(0, Math.min(255, parseInt(req.query.g || '255', 10)));
  const b = Math.max(0, Math.min(255, parseInt(req.query.b || '255', 10)));
  const targets = resolveGoveeTargets(req);
  if (targets.length === 0) return res.status(404).json({ ok: false, error: 'no_matching_govee_device' });
  targets.forEach((d) => {
    if (!d.actions || !d.actions.setColor) return;
    Promise.resolve(d.actions.setColor({ rgb: [r, g, b] }))
      .catch((e) => logger.warn(`Govee setColor for ${d.model}: ${e && e.message}`));
  });
  res.json({ ok: true, affected: targets.length, color: { r, g, b } });
}));

// ---------- /all/* — unified Neewer + Govee fan-out ----------
function rgbToHsi(r, g, b) {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  let h = 0, s = max === 0 ? 0 : (max - min) / max;
  const d = max - min;
  if (max !== min) {
    if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h /= 6;
  }
  return { hue: Math.round(h * 360), sat: Math.round(s * 100) / 100 };
}

async function allNeewerPower(turnOn) {
  const lights = bleManager.getAllLights();
  await Promise.all(lights.map((l) => turnOn ? l.turnOnLight() : l.turnOffLight()));
  return lights.length;
}

function allGoveePower(turnOn) {
  if (!govee || !govee.devicesArray) return 0;
  govee.devicesArray.forEach((d) => turnOn ? d.actions.setOn() : d.actions.setOff());
  return govee.devicesArray.length;
}

app.get('/all/on', async (_req, res) => {
  const neewer = await allNeewerPower(true);
  const goveeN = allGoveePower(true);
  res.json({ ok: true, neewer, govee: goveeN });
});

app.get('/all/off', async (_req, res) => {
  const neewer = await allNeewerPower(false);
  const goveeN = allGoveePower(false);
  res.json({ ok: true, neewer, govee: goveeN });
});

app.get('/all/toggle', async (_req, res) => {
  const lights = bleManager.getAllLights();
  await Promise.all(lights.map((l) => l.toggleLight()));
  // Govee toggle = invert each device's last known on/off
  let goveeAffected = 0;
  if (govee && govee.devicesArray) {
    govee.devicesArray.forEach((d) => {
      const on = d.state && d.state.isOn;
      if (on) d.actions.setOff(); else d.actions.setOn();
      goveeAffected += 1;
    });
  }
  res.json({ ok: true, neewer: lights.length, govee: goveeAffected });
});

app.get('/all/color', async (req, res) => {
  const r = Math.max(0, Math.min(255, parseInt(req.query.r || '255', 10)));
  const g = Math.max(0, Math.min(255, parseInt(req.query.g || '255', 10)));
  const b = Math.max(0, Math.min(255, parseInt(req.query.b || '255', 10)));
  const bri = Math.max(0, Math.min(100, parseInt(req.query.brightness || '80', 10)));
  const { hue, sat } = rgbToHsi(r, g, b);

  const lights = bleManager.getAllLights().filter((l) => l.supportRGB());
  await Promise.all(lights.map(async (l) => {
    try { await l.setHSIValues(bri, hue, sat); } catch (_) {}
  }));

  let goveeAffected = 0;
  if (govee && govee.devicesArray) {
    govee.devicesArray.forEach((d) => {
      if (!d.actions || !d.actions.setColor) return;
      Promise.resolve(d.actions.setColor({ rgb: [r, g, b] })).catch(() => {});
      try { d.actions.setBrightness(bri); } catch (_) {}
      goveeAffected += 1;
    });
  }
  res.json({ ok: true, neewer: lights.length, govee: goveeAffected, color: { r, g, b }, hue, saturation: sat, brightness: bri });
});

app.get('/all/brightness', async (req, res) => {
  const pct = Math.max(0, Math.min(100, parseInt(req.query.pct || '100', 10)));
  const lights = bleManager.getAllLights();
  await Promise.all(lights.map(async (l) => {
    try {
      if (l.mode === 'hsi') {
        await l.setHSIValues(pct, l.hueValue, l.satValue);
      } else {
        await l.setCCTValues(pct, l.cctValue || 32, l.gmValue || 0);
      }
    } catch (_) {}
  }));
  let goveeAffected = 0;
  if (govee && govee.devicesArray) {
    govee.devicesArray.forEach((d) => {
      try { d.actions.setBrightness(pct); goveeAffected += 1; } catch (_) {}
    });
  }
  res.json({ ok: true, neewer: lights.length, govee: goveeAffected, brightness: pct });
});

// ---------- catch-all + error middleware ----------
app.use((req, res) => {
  res.status(404).json({ ok: false, error: 'not_found', path: req.originalUrl });
});

app.use((err, req, res, _next) => {
  logger.error(`unhandled: ${err && err.message}`);
  res.status(500).json({ ok: false, error: err && err.message ? err.message : 'internal_error' });
});

// ---------- start ----------
const server = app.listen(PORT, () => {
  logger.info(`Bois Club Light Controller HTTP on :${PORT}`);
  bleManager.startScanning().catch((e) => logger.error(`scan boot failed: ${e && e.message}`));
});

server.on('error', (err) => {
  logger.error(`HTTP server error: ${err && err.message}`);
});

// ---------- crash containment ----------
process.on('uncaughtException', (err) => {
  logger.error(`uncaughtException: ${err && err.stack ? err.stack : err}`);
});
process.on('unhandledRejection', (reason) => {
  logger.error(`unhandledRejection: ${reason && reason.stack ? reason.stack : reason}`);
});

async function shutdown(signal) {
  logger.info(`Received ${signal} — shutting down.`);
  try { await bleManager.cleanup(); } catch (_) {}
  try { server.close(); } catch (_) {}
  setTimeout(() => process.exit(0), 500);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
