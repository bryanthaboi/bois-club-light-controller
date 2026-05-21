// goveeEffects.js
// Software-implemented effect loops for Govee LAN lights. Each effect drives
// device.actions.setColor / setBrightness on a per-device timer. Only one
// effect is active per device at a time — starting a new one cancels the
// previous. /govee/stopEffect clears the active effect and leaves the light
// in its current state.

const logger = require('./logger');

const active = new Map(); // deviceID -> { name, stop, startedAt }

function rgb(r, g, b) { return { rgb: [r, g, b] }; }

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function safeWrite(device, kind, value) {
  try {
    if (kind === 'color') {
      await device.actions.setColor(value);
    } else if (kind === 'brightness') {
      await device.actions.setBrightness(value);
    }
  } catch (err) {
    // Don't spam logs — Govee writes can fail under contention.
  }
}

function start(device, name, runner) {
  stop(device.deviceID);
  let cancelled = false;
  const tick = async () => {
    if (cancelled) return;
    try {
      await runner();
    } catch (_) {}
  };
  const id = setInterval(tick, runner.intervalMs || 500);
  // Fire immediately so user gets feedback without waiting one tick.
  tick();
  active.set(device.deviceID, {
    name,
    startedAt: Date.now(),
    stop: () => { cancelled = true; clearInterval(id); }
  });
}

function stop(deviceID) {
  const a = active.get(deviceID);
  if (!a) return false;
  a.stop();
  active.delete(deviceID);
  return true;
}

function stopAll() {
  for (const a of active.values()) a.stop();
  active.clear();
}

function isRunning(deviceID) {
  return active.has(deviceID);
}

function status() {
  const out = [];
  for (const [id, a] of active.entries()) {
    out.push({ deviceID: id, effect: a.name, runningMs: Date.now() - a.startedAt });
  }
  return out;
}

// ---------- effects ----------
const EFFECTS = {
  police: {
    label: 'Police',
    desc: 'Hard alternating red ↔ blue, fast.',
    spawn(device) {
      let red = true;
      const runner = async () => {
        await safeWrite(device, 'color', rgb(red ? 255 : 0, 0, red ? 0 : 255));
        red = !red;
      };
      runner.intervalMs = 350;
      start(device, 'police', runner);
    }
  },

  candlelight: {
    label: 'Candlelight',
    desc: 'Warm orange flicker.',
    spawn(device) {
      const runner = async () => {
        const r = rand(220, 255);
        const g = rand(80, 130);
        const b = rand(10, 30);
        await safeWrite(device, 'color', rgb(r, g, b));
        await safeWrite(device, 'brightness', rand(35, 70));
      };
      runner.intervalMs = 220;
      start(device, 'candlelight', runner);
    }
  },

  fireplace: {
    label: 'Fireplace',
    desc: 'Deep red-orange flicker, brighter than candlelight.',
    spawn(device) {
      const runner = async () => {
        const r = rand(230, 255);
        const g = rand(40, 110);
        const b = 0;
        await safeWrite(device, 'color', rgb(r, g, b));
        await safeWrite(device, 'brightness', rand(55, 95));
      };
      runner.intervalMs = 180;
      start(device, 'fireplace', runner);
    }
  },

  rave: {
    label: 'Rave',
    desc: 'Random punchy saturated colors, fast.',
    spawn(device) {
      const palette = [
        [255, 0, 0], [255, 0, 255], [0, 0, 255], [0, 255, 255],
        [0, 255, 0], [255, 255, 0], [255, 80, 0]
      ];
      const runner = async () => {
        const c = pick(palette);
        await safeWrite(device, 'color', rgb(c[0], c[1], c[2]));
      };
      runner.intervalMs = 250;
      start(device, 'rave', runner);
    }
  },

  party: {
    label: 'Party',
    desc: 'Random colors + brightness shimmer.',
    spawn(device) {
      const runner = async () => {
        await safeWrite(device, 'color', rgb(rand(0, 255), rand(0, 255), rand(0, 255)));
        await safeWrite(device, 'brightness', rand(60, 100));
      };
      runner.intervalMs = 400;
      start(device, 'party', runner);
    }
  },

  rainbow: {
    label: 'Rainbow',
    desc: 'Slow continuous hue cycle.',
    spawn(device) {
      let h = 0;
      const runner = async () => {
        h = (h + 8) % 360;
        const { r, g, b } = hsvToRgb(h, 1.0, 1.0);
        await safeWrite(device, 'color', rgb(r, g, b));
      };
      runner.intervalMs = 300;
      start(device, 'rainbow', runner);
    }
  },

  pulse: {
    label: 'Pulse',
    desc: 'Single color, brightness breathing.',
    spawn(device) {
      let t = 0;
      const runner = async () => {
        t += 0.18;
        const b = Math.round(40 + 55 * (0.5 + 0.5 * Math.sin(t)));
        await safeWrite(device, 'brightness', b);
      };
      runner.intervalMs = 180;
      start(device, 'pulse', runner);
    }
  },

  strobe: {
    label: 'Strobe',
    desc: 'White flash. Headache mode.',
    spawn(device) {
      let on = false;
      const runner = async () => {
        on = !on;
        await safeWrite(device, 'color', rgb(255, 255, 255));
        await safeWrite(device, 'brightness', on ? 100 : 1);
      };
      runner.intervalMs = 150;
      start(device, 'strobe', runner);
    }
  },

  horror: {
    label: 'Horror',
    desc: 'Sickly red flicker.',
    spawn(device) {
      const runner = async () => {
        if (Math.random() < 0.15) {
          await safeWrite(device, 'brightness', rand(5, 25));
        } else {
          await safeWrite(device, 'brightness', rand(50, 75));
        }
        await safeWrite(device, 'color', rgb(rand(150, 220), 0, 0));
      };
      runner.intervalMs = 280;
      start(device, 'horror', runner);
    }
  },

  ocean: {
    label: 'Ocean',
    desc: 'Slow cyan/blue gradient drift.',
    spawn(device) {
      let t = 0;
      const runner = async () => {
        t += 0.07;
        const g = Math.round(80 + 80 * Math.sin(t));
        const b = Math.round(140 + 100 * Math.cos(t * 0.6));
        await safeWrite(device, 'color', rgb(0, g, b));
      };
      runner.intervalMs = 250;
      start(device, 'ocean', runner);
    }
  },

  ufo: {
    label: 'UFO',
    desc: 'Green hue pulse.',
    spawn(device) {
      let t = 0;
      const runner = async () => {
        t += 0.2;
        const intensity = Math.round(120 + 100 * (0.5 + 0.5 * Math.sin(t)));
        await safeWrite(device, 'color', rgb(0, intensity, 30));
      };
      runner.intervalMs = 200;
      start(device, 'ufo', runner);
    }
  },

  tvScreen: {
    label: 'TV Screen',
    desc: 'Cool blue with random brightness twitches.',
    spawn(device) {
      const runner = async () => {
        await safeWrite(device, 'color', rgb(rand(60, 110), rand(80, 140), rand(140, 220)));
        await safeWrite(device, 'brightness', rand(40, 70));
      };
      runner.intervalMs = 220;
      start(device, 'tvScreen', runner);
    }
  }
};

// ---------- HSV → RGB (simple, for rainbow) ----------
function hsvToRgb(h, s, v) {
  const c = v * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = v - c;
  let r = 0, g = 0, b = 0;
  if (h < 60)        { r = c; g = x; }
  else if (h < 120)  { r = x; g = c; }
  else if (h < 180)  { g = c; b = x; }
  else if (h < 240)  { g = x; b = c; }
  else if (h < 300)  { r = x; b = c; }
  else               { r = c; b = x; }
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255)
  };
}

// ---------- public API ----------
function list() {
  return Object.entries(EFFECTS).map(([id, e]) => ({ id, label: e.label, desc: e.desc }));
}

function startOnDevice(device, name) {
  const eff = EFFECTS[name];
  if (!eff) {
    const err = new Error(`Unknown effect: ${name}`);
    err.code = 'UNKNOWN_EFFECT';
    throw err;
  }
  if (!device || !device.actions) {
    const err = new Error('Invalid device');
    err.code = 'INVALID_DEVICE';
    throw err;
  }
  eff.spawn(device);
  logger.info(`Started effect ${name} on Govee ${device.model} @ ${device.ip}`);
}

module.exports = {
  list,
  startOnDevice,
  stop,
  stopAll,
  isRunning,
  status
};
