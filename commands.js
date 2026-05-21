// commands.js
// HTTP-route → action registry. Every handler returns a plain object the route
// can JSON-serialize. Errors are converted to { ok: false, error } — they never
// throw out to the route layer.

const bleManager = require('./bleManager');
const commandParameter = require('./commandParameter');
const presets = require('./presets');
const logger = require('./logger');

const registry = {};

function register(name, handler) {
  registry[name] = handler;
}

async function execute(commandName, req, ctx = {}) {
  const handler = registry[commandName];
  if (!handler) {
    logger.error(`Command not found: ${commandName}`);
    return { ok: false, error: `unknown_command:${commandName}` };
  }
  try {
    logger.info(`execute ${commandName} query=${JSON.stringify(req.query || {})}`);
    const result = await handler(req, ctx);
    return Object.assign({ ok: true }, result || {});
  } catch (err) {
    logger.error(`Command ${commandName} threw: ${err && err.message}`);
    return { ok: false, error: err && err.message ? err.message : String(err) };
  }
}

register('scanLight', async () => {
  await bleManager.startScanning();
  return { scanning: true };
});

register('turnOnLight', async (req) => {
  const param = commandParameter.parse(req);
  const lights = bleManager.getLightByNameOrAll(param.lightName());
  await Promise.all(lights.map((l) => l.turnOnLight()));
  return { affected: lights.length };
});

register('turnOffLight', async (req) => {
  const param = commandParameter.parse(req);
  const lights = bleManager.getLightByNameOrAll(param.lightName());
  await Promise.all(lights.map((l) => l.turnOffLight()));
  return { affected: lights.length };
});

register('toggleLight', async (req) => {
  const param = commandParameter.parse(req);
  const lights = bleManager.getLightByNameOrAll(param.lightName());
  await Promise.all(lights.map((l) => l.toggleLight()));
  return { affected: lights.length };
});

register('setLightCCT', async (req) => {
  const p = commandParameter.parse(req);
  const cct = p.CCT() || 3200;
  const brr = p.brightness() !== null ? p.brightness() : 100;
  const gm = p.GM() || 0;
  const lights = bleManager.getLightByNameOrAll(p.lightName());
  await Promise.all(lights.map(async (l) => {
    l.setCCTMode();
    await l.setCCTValues(brr, cct, gm);
  }));
  return { affected: lights.length, cct, brightness: brr, gm };
});

register('setLightHSI', async (req) => {
  const p = commandParameter.parse(req);
  const hueArg = p.HUE();
  if (hueArg === null) {
    return { ok: false, error: 'missing_param:HUE' };
  }
  const sat = p.saturation();
  const bri = p.brightness() !== null ? p.brightness() : 100;
  const lights = bleManager.getLightByNameOrAll(p.lightName()).filter((l) => l.supportRGB());
  await Promise.all(lights.map(async (l) => {
    l.setHSIMode();
    await l.setHSIValues(bri, hueArg, sat);
  }));
  return { affected: lights.length, hue: hueArg, saturation: sat, brightness: bri };
});

register('setLightScene', async (req) => {
  const p = commandParameter.parse(req);
  const sceneId = p.sceneId() !== null ? p.sceneId() : p.scene();
  const brightness = p.brightness() !== null ? p.brightness() : 100;
  const speed = p.speed() !== null ? p.speed() : 10;
  const lights = bleManager.getLightByNameOrAll(p.lightName()).filter((l) => l.supportRGB());
  await Promise.all(lights.map((l) => l.setScene(sceneId, brightness, speed)));
  return { affected: lights.length, sceneId, brightness, speed };
});

register('randomColor', async (req) => {
  const p = commandParameter.parse(req);
  const hue = Math.floor(Math.random() * 360);
  const sat = 0.6 + Math.random() * 0.4;
  const bri = p.brightness() !== null ? p.brightness() : 80;
  const lights = bleManager.getLightByNameOrAll(p.lightName()).filter((l) => l.supportRGB());
  await Promise.all(lights.map((l) => l.setHSIValues(bri, hue, sat)));
  return { affected: lights.length, hue, saturation: sat, brightness: bri };
});

register('applyPreset', async (req, ctx) => {
  const name = (req.query && (req.query.name || req.params && req.params.name)) || (req.params && req.params.name);
  if (!name) return { ok: false, error: 'missing_param:name' };
  await presets.run(name, {
    lights: bleManager.getAllLights(),
    govee: ctx.govee
  });
  return { applied: name };
});

register('listPresets', async () => {
  return { presets: presets.list() };
});

register('status', async () => {
  return { status: bleManager.getStatus() };
});

module.exports = {
  execute
};
