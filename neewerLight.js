// neewerLight.js
// One instance per BLE peripheral. Defensive throughout: missing characteristics,
// dropped writes, and connection drops are logged and skipped — never thrown
// to the HTTP layer.

const logger = require('./logger');
const constants = require('./neewerLightConstant');
const NeewerLightFX = require('./neewerLightFX');

const SERVICE_UUID = '69400001-b5a3-f393-e0a9-e50e24dcca99';
const DEVICE_CTL_CHAR_UUID = '69400002-b5a3-f393-e0a9-e50e24dcca99';
const GATT_CHAR_UUID = '69400003-b5a3-f393-e0a9-e50e24dcca99';

const WRITE_TIMEOUT_MS = 5000;
const SCENE_WRITE_GAP_MS = 100;

class NeewerLight {
  constructor(peripheral) {
    this.peripheral = peripheral;
    this.rawName = (peripheral.advertisement && peripheral.advertisement.localName) || 'unknown';
    this.identifier = peripheral.id;
    this.macAddress = (peripheral.address || 'E2:E4:8B:96:83:B7').toUpperCase();
    this.isOn = false;
    this.brightnessValue = 100;
    this.cctValue = 3200;
    this.gmValue = 0;
    this.hueValue = 0;
    this.satValue = 1.0;
    this.userLightName = this.rawName;
    this.deviceCtlCharacteristic = null;
    this.gattCharacteristic = null;
    this.lightType = 42;
    this.connectionBreakCounter = 0;
    this.connected = false;
    this.mode = 'idle'; // 'cct' | 'hsi' | 'scene' | 'idle'
    this.lastSceneId = null;
    this.lastError = null;
  }

  snapshot() {
    return {
      id: this.identifier,
      name: this.userLightName,
      rawName: this.rawName,
      mac: this.macAddress,
      lightType: this.lightType,
      connected: this.connected && this.peripheral && this.peripheral.state === 'connected',
      isOn: this.isOn,
      brightness: this.brightnessValue,
      cct: this.cctValue,
      gm: this.gmValue,
      hue: this.hueValue,
      saturation: this.satValue,
      mode: this.mode,
      lastSceneId: this.lastSceneId,
      supportRGB: this.supportRGB(),
      connectionBreakCounter: this.connectionBreakCounter,
      lastError: this.lastError
    };
  }

  async discoverServicesAndCharacteristics() {
    try {
      const { characteristics } = await this.peripheral.discoverSomeServicesAndCharacteristicsAsync(
        [SERVICE_UUID],
        [DEVICE_CTL_CHAR_UUID, GATT_CHAR_UUID]
      );

      this.deviceCtlCharacteristic = null;
      this.gattCharacteristic = null;

      characteristics.forEach((ch) => {
        const norm = ch.uuid.replace(/-/g, '').toLowerCase();
        if (norm === DEVICE_CTL_CHAR_UUID.replace(/-/g, '').toLowerCase()) {
          this.deviceCtlCharacteristic = ch;
        }
        if (norm === GATT_CHAR_UUID.replace(/-/g, '').toLowerCase()) {
          this.gattCharacteristic = ch;
        }
      });

      if (!this.deviceCtlCharacteristic) {
        logger.warn(`No control characteristic for ${this.rawName}`);
      }

      if (this.gattCharacteristic && this.gattCharacteristic.properties.includes('notify')) {
        try {
          await this.gattCharacteristic.subscribeAsync();
          this.gattCharacteristic.on('data', (data) => this.handleNotifyUpdate(data));
        } catch (err) {
          logger.warn(`Notify subscribe failed for ${this.rawName}: ${err && err.message}`);
        }
      }

      this.connected = true;
      logger.info(`Discovered services for ${this.rawName}`);
      await this.turnOnLight();
    } catch (err) {
      this.lastError = err && err.message ? err.message : String(err);
      logger.error(`discover error for ${this.identifier}: ${this.lastError}`);
      throw err;
    }
  }

  handleNotifyUpdate(data) {
    try {
      logger.debug(`notify from ${this.rawName}: ${data.toString('hex')}`);
    } catch (_) {}
  }

  writeCommand(buffer) {
    if (!this.deviceCtlCharacteristic) {
      logger.warn(`writeCommand skipped — no control characteristic for ${this.rawName}`);
      return Promise.resolve(false);
    }
    if (!this.peripheral || this.peripheral.state !== 'connected') {
      logger.warn(`writeCommand skipped — ${this.rawName} not connected (state=${this.peripheral && this.peripheral.state}).`);
      return Promise.resolve(false);
    }

    this.deviceCtlCharacteristic.setMaxListeners(20);

    return new Promise((resolve) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        this.lastError = 'write timeout';
        logger.error(`Write timeout for ${this.rawName}`);
        resolve(false);
      }, WRITE_TIMEOUT_MS);

      try {
        this.deviceCtlCharacteristic.write(buffer, false, (err) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          if (err) {
            this.lastError = err.message || String(err);
            logger.error(`Write error for ${this.rawName}: ${this.lastError}`);
            resolve(false);
          } else {
            this.lastError = null;
            resolve(true);
          }
        });
      } catch (err) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.lastError = err && err.message ? err.message : String(err);
        logger.error(`Write threw for ${this.rawName}: ${this.lastError}`);
        resolve(false);
      }
    });
  }

  async turnOnLight() {
    this.isOn = true;
    const cmd = constants.getNewPowerCommand(true, this.macAddress);
    return this.writeCommand(cmd);
  }

  async turnOffLight() {
    this.isOn = false;
    const cmd = constants.getNewPowerCommand(false, this.macAddress);
    return this.writeCommand(cmd);
  }

  async toggleLight() {
    return this.isOn ? this.turnOffLight() : this.turnOnLight();
  }

  setCCTMode() { this.mode = 'cct'; }
  setHSIMode() { this.mode = 'hsi'; }
  setSceneMode() { this.mode = 'scene'; }

  async setCCTValues(brr = 100, cct = 3200, gm = 0) {
    this.mode = 'cct';
    this.brightnessValue = brr;
    this.cctValue = cct;
    this.gmValue = gm;

    const cmd = constants.getCCTLightCommand(brr, cct, gm, this.macAddress);
    // Triple-write because Neewer firmware sometimes drops the first one or two
    // writes after a reconnect.
    await this.writeCommand(cmd);
    await sleep(SCENE_WRITE_GAP_MS);
    await this.writeCommand(cmd);
    await sleep(SCENE_WRITE_GAP_MS);
    await this.writeCommand(cmd);
  }

  async setHSIValues(brightness, hue, sat) {
    this.mode = 'hsi';
    this.brightnessValue = brightness;
    this.hueValue = hue;
    this.satValue = sat;
    const cmd = constants.getNewRGBLightCommand(this.macAddress, brightness, hue, sat);
    return this.writeCommand(cmd);
  }

  async setScene(sceneId, brightness, speed) {
    this.mode = 'scene';
    this.lastSceneId = sceneId;
    speed = clamp(speed, 1, 10);
    brightness = clamp(brightness, 0, 100);

    const fx = sceneFactory(sceneId);
    fx.brrValue = brightness;
    fx.speedValue = speed;
    fx.lightType = this.lightType;
    fx.projectName = this.rawName;

    if (sceneId === 10 && fx.colors && fx.colors[1]) fx.colorValue = fx.colors[1].value;
    if ((sceneId === 16 || sceneId === 17) && fx.colors && fx.colors[2]) fx.colorValue = fx.colors[2].value;

    const envelope = constants.getSceneValue(this.macAddress, sceneId, brightness, speed);
    await this.writeCommand(envelope);
    const detailed = constants.getSceneCommand(this.macAddress, fx);
    await this.writeCommand(detailed);
  }

  supportRGB() {
    return constants.getRGBLightTypes().includes(this.lightType);
  }

  async sendKeepAlive() {
    if (!this.peripheral) return;
    const state = this.peripheral.state;

    if (state === 'connected') {
      this.connectionBreakCounter = 0;
      this.connected = true;
      // Heartbeat: re-send current power state.
      try {
        if (this.isOn) await this.turnOnLight();
        else await this.turnOffLight();
      } catch (err) {
        logger.error(`keepalive write for ${this.rawName}: ${err && err.message}`);
      }
      return;
    }

    // Anything other than connected: the disconnect listener in bleManager
    // already scheduled a reconnect with backoff. Just flag state.
    this.connected = false;
  }
}

function sceneFactory(sceneId) {
  switch (sceneId) {
    case 1:  return NeewerLightFX.lightingScene();
    case 2:  return NeewerLightFX.paparazziScene();
    case 3:  return NeewerLightFX.defectiveBulbScene();
    case 4:  return NeewerLightFX.explosionScene();
    case 5:  return NeewerLightFX.weldingScene();
    case 6:  return NeewerLightFX.cctFlashScene();
    case 7:  return NeewerLightFX.hueFlashScene();
    case 8:  return NeewerLightFX.cctPulseScene();
    case 9:  return NeewerLightFX.huePulseScene();
    case 10: return NeewerLightFX.copCarScene();
    case 11: return NeewerLightFX.candlelightScene();
    case 12: return NeewerLightFX.hueLoopScene();
    case 13: return NeewerLightFX.cctLoopScene();
    case 14: return NeewerLightFX.intLoopScene();
    case 15: return NeewerLightFX.tvScreenScene();
    case 16: return NeewerLightFX.fireworkScene();
    case 17: return NeewerLightFX.partyScene();
    default: return NeewerLightFX.lightingScene();
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clamp(v, min, max) {
  if (Number.isNaN(v) || v === null || v === undefined) return min;
  if (v < min) return min;
  if (v > max) return max;
  return v;
}

function isValidPeripheralName(name) {
  return constants.isValidPeripheralName(name);
}

module.exports = {
  NeewerLight,
  isValidPeripheralName
};
