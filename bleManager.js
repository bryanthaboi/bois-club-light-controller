// bleManager.js
// Owns the Noble lifecycle, the discovered-light registry, and a self-healing
// keepalive loop. Reconnects use exponential backoff per light, so a single
// dead light can't peg the event loop.

const noble = require('@stoprocent/noble');
const logger = require('./logger');
const neewerLight = require('./neewerLight');

const MAX_LIGHTS = parseInt(process.env.NEEWER_MAX_LIGHTS || '8', 10);
const KEEPALIVE_INTERVAL_MS = 10000;
const SCAN_RESTART_DELAY_MS = 5000;

const discoveredLights = new Map();      // peripheral.id -> NeewerLight
const otherBleDevices = new Map();        // localName    -> peripheral (debug only)
const reconnectBackoff = new Map();       // peripheral.id -> next-delay ms

let keepAliveInterval = null;
let nobleListenersAttached = false;
let scanRequested = false;
let lastAdapterState = 'unknown';

async function attachNobleListenersOnce() {
  if (nobleListenersAttached) return;
  nobleListenersAttached = true;

  noble.on('stateChange', async (state) => {
    lastAdapterState = state;
    logger.info(`Bluetooth adapter state: ${state}`);
    if (state === 'poweredOn' && scanRequested) {
      try {
        await noble.startScanningAsync([], true);
        startKeepAlive();
      } catch (err) {
        logger.error(`Failed to start scanning after stateChange: ${err && err.message}`);
        scheduleScanRetry();
      }
    } else if (state !== 'poweredOn') {
      logger.warn(`Adapter not powered on (state=${state}); will resume when available.`);
    }
  });

  noble.on('scanStop', () => {
    if (scanRequested && lastAdapterState === 'poweredOn') {
      logger.warn('Noble scan stopped unexpectedly — restarting.');
      scheduleScanRetry();
    }
  });

  noble.on('discover', async (peripheral) => {
    try {
      await onDiscover(peripheral);
    } catch (err) {
      logger.error(`onDiscover error: ${err && err.message}`);
    }
  });
}

async function onDiscover(peripheral) {
  const localName = peripheral.advertisement && peripheral.advertisement.localName;
  if (!localName) return;

  const isNeewer = /nw|neewer|nee/i.test(localName);
  if (!isNeewer) {
    if (!otherBleDevices.has(localName)) otherBleDevices.set(localName, peripheral);
    return;
  }

  if (discoveredLights.has(peripheral.id)) return;
  if (discoveredLights.size >= MAX_LIGHTS) {
    logger.warn(`Skipping ${localName} — at MAX_LIGHTS (${MAX_LIGHTS}).`);
    return;
  }

  logger.info(`Found Neewer device ${localName} (${peripheral.id}) — connecting.`);
  const light = new neewerLight.NeewerLight(peripheral);
  discoveredLights.set(peripheral.id, light);

  peripheral.on('disconnect', () => {
    logger.warn(`${localName} disconnected — will retry in ${nextBackoff(peripheral.id)}ms.`);
    light.connectionBreakCounter += 1;
    light.connected = false;
    scheduleReconnect(peripheral.id);
  });

  try {
    await connectAndDiscover(light);
    resetBackoff(peripheral.id);
  } catch (err) {
    logger.error(`Failed initial connect to ${localName}: ${err && err.message}`);
    scheduleReconnect(peripheral.id);
  }
}

async function connectAndDiscover(light) {
  await light.peripheral.connectAsync();
  await light.discoverServicesAndCharacteristics();
  light.connected = true;
}

function nextBackoff(id) {
  const current = reconnectBackoff.get(id) || 1000;
  const next = Math.min(current * 2, 60000);
  reconnectBackoff.set(id, next);
  return current;
}

function resetBackoff(id) {
  reconnectBackoff.set(id, 1000);
}

function scheduleReconnect(id) {
  const delay = reconnectBackoff.get(id) || 1000;
  setTimeout(async () => {
    const light = discoveredLights.get(id);
    if (!light) return;
    if (light.peripheral && light.peripheral.state === 'connected') {
      resetBackoff(id);
      return;
    }
    try {
      logger.info(`Reconnect attempt for ${light.rawName} (${id}).`);
      await connectAndDiscover(light);
      resetBackoff(id);
      logger.info(`Reconnected to ${light.rawName}.`);
    } catch (err) {
      logger.error(`Reconnect failed for ${light.rawName}: ${err && err.message}`);
      nextBackoff(id);
      scheduleReconnect(id);
    }
  }, delay);
}

function scheduleScanRetry() {
  setTimeout(async () => {
    if (!scanRequested) return;
    if (lastAdapterState !== 'poweredOn') return;
    try {
      await noble.startScanningAsync([], true);
      logger.info('Resumed BLE scanning.');
    } catch (err) {
      logger.error(`Scan resume failed: ${err && err.message}`);
      scheduleScanRetry();
    }
  }, SCAN_RESTART_DELAY_MS);
}

async function startScanning() {
  scanRequested = true;
  logger.info('Starting BLE scan…');

  try {
    await attachNobleListenersOnce();

    if (noble.state === 'poweredOn') {
      await noble.startScanningAsync([], true);
      startKeepAlive();
    } else {
      logger.warn(`Adapter not yet ready (state=${noble.state}); will start when 'poweredOn' fires.`);
    }
  } catch (err) {
    logger.error(`startScanning failed: ${err && err.message}`);
    scheduleScanRetry();
  }
}

function startKeepAlive() {
  if (keepAliveInterval) return;
  keepAliveInterval = setInterval(async () => {
    for (const light of discoveredLights.values()) {
      try {
        await light.sendKeepAlive();
      } catch (err) {
        logger.error(`keepAlive error for ${light.rawName}: ${err && err.message}`);
      }
    }
  }, KEEPALIVE_INTERVAL_MS);
}

function stopKeepAlive() {
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
    keepAliveInterval = null;
  }
}

function getAllLights() {
  return Array.from(discoveredLights.values());
}

function getLightByNameOrAll(lightName) {
  const arr = getAllLights();
  if (!lightName) return arr;
  const needle = String(lightName).toLowerCase();
  return arr.filter((dev) => {
    const ln = (dev.userLightName || dev.rawName || '').toLowerCase();
    return ln === needle || ln.includes(needle);
  });
}

function getStatus() {
  return {
    adapterState: lastAdapterState,
    scanning: scanRequested && lastAdapterState === 'poweredOn',
    maxLights: MAX_LIGHTS,
    lights: getAllLights().map((l) => l.snapshot()),
    otherDevicesSeen: Array.from(otherBleDevices.keys())
  };
}

async function cleanup() {
  scanRequested = false;
  stopKeepAlive();
  try { await noble.stopScanningAsync(); } catch (_) {}
  for (const light of discoveredLights.values()) {
    try {
      if (light.peripheral && light.peripheral.state === 'connected') {
        await light.peripheral.disconnectAsync();
      }
    } catch (_) {}
  }
  discoveredLights.clear();
}

module.exports = {
  startScanning,
  getAllLights,
  getLightByNameOrAll,
  getStatus,
  cleanup
};
