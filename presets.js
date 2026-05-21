// presets.js
// Creative "vibe" presets. Each preset is a function (lights, govee) => Promise<void>
// that issues whatever sequence of writes is needed. Presets are intentionally
// tolerant — if a light doesn't support RGB or Govee isn't reachable, they
// quietly degrade rather than throwing.

const logger = require('./logger');

function clamp(v, min, max) {
  if (Number.isNaN(v) || v === null || v === undefined) return min;
  if (v < min) return min;
  if (v > max) return max;
  return v;
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function safe(label, fn) {
  try {
    await fn();
  } catch (e) {
    logger.error(`preset[${label}] step failed: ${e && e.message ? e.message : e}`);
  }
}

async function setCCT(lights, brr, cct, gm = 0) {
  for (const l of lights) {
    await safe('cct', async () => {
      await l.setCCTValues(brr, cct, gm);
    });
  }
}

async function setHSI(lights, brr, hue, sat) {
  for (const l of lights) {
    if (!l.supportRGB || !l.supportRGB()) continue;
    await safe('hsi', async () => {
      l.setHSIValues(brr, hue, sat);
    });
  }
}

async function setScene(lights, sceneId, brr, speed) {
  for (const l of lights) {
    if (!l.supportRGB || !l.supportRGB()) continue;
    await safe('scene', async () => {
      await l.setScene(sceneId, brr, speed);
    });
  }
}

async function powerOn(lights) {
  for (const l of lights) await safe('on', () => l.turnOnLight());
}

async function powerOff(lights) {
  for (const l of lights) await safe('off', () => l.turnOffLight());
}

async function goveeOn(govee) {
  if (!govee || !govee.devicesArray) return;
  govee.devicesArray.forEach((d) => safe('goveeOn', async () => d.actions.setOn()));
}

async function goveeOff(govee) {
  if (!govee || !govee.devicesArray) return;
  govee.devicesArray.forEach((d) => safe('goveeOff', async () => d.actions.setOff()));
}

async function goveeColor(govee, r, g, b) {
  if (!govee || !govee.devicesArray) return;
  for (const d of govee.devicesArray) {
    if (!d.actions || !d.actions.setColor) continue;
    await safe('goveeColor', async () => {
      await d.actions.setColor({ rgb: [r, g, b] });
    });
  }
}

async function goveeBrightness(govee, pct) {
  if (!govee || !govee.devicesArray) return;
  govee.devicesArray.forEach((d) => safe('goveeBrr', async () => d.actions.setBrightness(pct)));
}

// ----- presets -----
const presets = {
  // Warm cinematic feel — low brightness, 3200K, slight magenta
  cinematic: {
    label: 'Cinematic',
    desc: 'Warm 3200K, low brightness, hint of magenta.',
    run: async ({ lights, govee }) => {
      await powerOn(lights);
      await setCCT(lights, 35, 32, -8);
      await goveeOn(govee);
      await goveeColor(govee, 255, 180, 120);
      await goveeBrightness(govee, 40);
    }
  },

  sunset: {
    label: 'Sunset',
    desc: 'Deep orange fading into magenta.',
    run: async ({ lights, govee }) => {
      await powerOn(lights);
      await setHSI(lights, 65, 18, 0.95);
      await goveeOn(govee);
      await goveeColor(govee, 255, 110, 60);
      await goveeBrightness(govee, 70);
    }
  },

  daylight: {
    label: 'Daylight',
    desc: 'Crisp 5600K, full brightness — work-mode.',
    run: async ({ lights, govee }) => {
      await powerOn(lights);
      await setCCT(lights, 100, 56, 0);
      await goveeOn(govee);
      await goveeColor(govee, 255, 255, 255);
      await goveeBrightness(govee, 100);
    }
  },

  horror: {
    label: 'Horror',
    desc: 'Sickly red with a defective-bulb flicker.',
    run: async ({ lights, govee }) => {
      await powerOn(lights);
      await setScene(lights, 3, 60, 6); // defective bulb
      await setHSI(lights, 50, 0, 1.0);
      await goveeOn(govee);
      await goveeColor(govee, 180, 0, 0);
      await goveeBrightness(govee, 50);
    }
  },

  vampire: {
    label: 'Vampire',
    desc: 'Dim blood red, no flicker.',
    run: async ({ lights, govee }) => {
      await powerOn(lights);
      await setHSI(lights, 25, 0, 1.0);
      await goveeOn(govee);
      await goveeColor(govee, 90, 0, 0);
      await goveeBrightness(govee, 20);
    }
  },

  rave: {
    label: 'Rave',
    desc: 'Party scene at maximum chaos.',
    run: async ({ lights, govee }) => {
      await powerOn(lights);
      await setScene(lights, 17, 100, 10); // party
      await goveeOn(govee);
      await goveeBrightness(govee, 100);
    }
  },

  underwater: {
    label: 'Underwater',
    desc: 'Slow cyan pulse — submerged vibe.',
    run: async ({ lights, govee }) => {
      await powerOn(lights);
      await setScene(lights, 9, 70, 3); // hue pulse
      await setHSI(lights, 70, 190, 0.85);
      await goveeOn(govee);
      await goveeColor(govee, 0, 120, 200);
      await goveeBrightness(govee, 60);
    }
  },

  spaceship: {
    label: 'Spaceship',
    desc: 'Cool blue with intermittent red alert flashes.',
    run: async ({ lights, govee }) => {
      await powerOn(lights);
      await setScene(lights, 7, 80, 4); // hue flash
      await setHSI(lights, 80, 220, 0.9);
      await goveeOn(govee);
      await goveeColor(govee, 30, 80, 200);
      await goveeBrightness(govee, 70);
    }
  },

  ufo: {
    label: 'UFO',
    desc: 'Slow green hue pulse.',
    run: async ({ lights, govee }) => {
      await powerOn(lights);
      await setScene(lights, 9, 80, 2);
      await setHSI(lights, 80, 120, 1.0);
      await goveeOn(govee);
      await goveeColor(govee, 30, 220, 30);
      await goveeBrightness(govee, 75);
    }
  },

  fireplace: {
    label: 'Fireplace',
    desc: 'Candlelight scene shifted red-orange.',
    run: async ({ lights, govee }) => {
      await powerOn(lights);
      await setScene(lights, 11, 70, 5); // candlelight
      await goveeOn(govee);
      await goveeColor(govee, 255, 95, 20);
      await goveeBrightness(govee, 55);
    }
  },

  candlelight: {
    label: 'Candlelight',
    desc: 'Soft warm flicker, low brightness.',
    run: async ({ lights, govee }) => {
      await powerOn(lights);
      await setScene(lights, 11, 40, 4);
      await goveeOn(govee);
      await goveeColor(govee, 255, 160, 80);
      await goveeBrightness(govee, 30);
    }
  },

  police: {
    label: 'Police',
    desc: 'Cop Car scene, lights it up red & blue.',
    run: async ({ lights, govee }) => {
      await powerOn(lights);
      await setScene(lights, 10, 100, 9);
      await goveeOn(govee);
      await goveeBrightness(govee, 100);
    }
  },

  noir: {
    label: 'Noir',
    desc: 'Low warm tungsten, single source.',
    run: async ({ lights, govee }) => {
      await powerOn(lights);
      await setCCT(lights, 25, 32, 0);
      await goveeOff(govee);
    }
  },

  paparazzi: {
    label: 'Paparazzi',
    desc: 'Camera-shutter flash storm.',
    run: async ({ lights, govee }) => {
      await powerOn(lights);
      await setScene(lights, 2, 100, 10);
      await goveeOn(govee);
      await goveeColor(govee, 255, 255, 255);
      await goveeBrightness(govee, 100);
    }
  },

  fireworks: {
    label: 'Fireworks',
    desc: 'Bursting multi-color firework scene.',
    run: async ({ lights, govee }) => {
      await powerOn(lights);
      await setScene(lights, 16, 100, 9);
      await goveeOn(govee);
      await goveeBrightness(govee, 100);
    }
  },

  tvScreen: {
    label: 'TV Screen',
    desc: 'Flickering monitor glow.',
    run: async ({ lights, govee }) => {
      await powerOn(lights);
      await setScene(lights, 15, 70, 6);
      await goveeOn(govee);
      await goveeColor(govee, 80, 100, 180);
      await goveeBrightness(govee, 50);
    }
  },

  blackout: {
    label: 'Blackout',
    desc: 'Everything off — Neewer + Govee.',
    run: async ({ lights, govee }) => {
      await powerOff(lights);
      await goveeOff(govee);
    }
  },

  // Picks a random color preset every call.
  surpriseMe: {
    label: 'Surprise Me',
    desc: 'Random hue + random scene. Bring a friend.',
    run: async ({ lights, govee }) => {
      const hue = Math.floor(Math.random() * 360);
      const sat = 0.7 + Math.random() * 0.3;
      const brr = 60 + Math.floor(Math.random() * 40);
      const sceneId = pick([1, 6, 7, 8, 9, 10, 12, 16, 17]);
      const speed = 4 + Math.floor(Math.random() * 6);
      await powerOn(lights);
      await setScene(lights, sceneId, brr, speed);
      await setHSI(lights, brr, hue, sat);
      // Govee gets a random punchy color too.
      const r = Math.floor(Math.random() * 256);
      const g = Math.floor(Math.random() * 256);
      const b = Math.floor(Math.random() * 256);
      await goveeOn(govee);
      await goveeColor(govee, r, g, b);
      await goveeBrightness(govee, brr);
    }
  }
};

function list() {
  return Object.entries(presets).map(([key, p]) => ({
    id: key,
    label: p.label,
    desc: p.desc
  }));
}

async function run(name, ctx) {
  const preset = presets[name];
  if (!preset) {
    const err = new Error(`Unknown preset: ${name}`);
    err.code = 'UNKNOWN_PRESET';
    throw err;
  }
  logger.info(`Running preset ${name}`);
  await preset.run(ctx);
}

module.exports = {
  list,
  run,
  clamp,
  pick
};
