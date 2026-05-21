// Full Swift-based logic, including getNewPowerCommand and others.
const logger = require('./logger.js');

class NeewerLightConstant {
    static Constants = {
      NeewerBleServiceUUID: '69400001-B5A3-F393-E0A9-E50E24DCCA99',
      NeewerDeviceCtlCharacteristicUUID: '69400002-B5A3-F393-E0A9-E50E24DCCA99',
      NeewerGattCharacteristicUUID: '69400003-B5A3-F393-E0A9-E50E24DCCA99'
    };
  
    // Swift's BleCommand struct
    static BleCommand = {
      prefixTag: 0x78,       // 120
      setLongCCTLightBrightnessTag: 0x82,
      setLongCCTLightCCTTag: 0x83,
      setRGBLightTag: 0x86,
      setCCTLightTag: 0x87,
      setNewRGBLightTag: 0x8f,
      setNewRGBLightSubTag: 0x86,
  
      setSceneTag: 0x88,
      setSCESubTag: 0x8B,
  
      setHSVDataTag: 0x89,
      setCCTDataTag: 0x90,
      setSCEDataTag: 0x91,
  
      // Original Swift had powerOn, powerOff as Data objects:
      powerOn: Buffer.from([0x78, 0x81, 0x01, 0x01, 0xFB]),
      powerOff: Buffer.from([0x78, 0x81, 0x01, 0x02, 0xFC]),
  
      powerNewTag: 0x8D,
      powerNewSubTag: 0x81,
      powerNewOnSubTag: [0x01],
      powerNewOffSubTag: [0x02],
  
      // readRequest in Swift
      readRequest: Buffer.from([0x78, 0x84, 0x00, 0xFC])
    };
  
    // In Swift: getNewPowerLightTypes -> [42] typically
    static getNewPowerLightTypes() {
      return [42];
    }
    static getNewRGBLightTypes() {
      return [42];
    }
  
    // Canned list from Swift
    static getRGBLightTypes() {
      return [5, 8, 9, 11, 12, 15, 16, 18, 19, 20, 21, 22, 25, 26, 29, 32, 34, 39, 40, 42, 43, 56, 57, 59];
    }
  
    static getCCTGMLightTypes() {
      return [22, 25, 26, 42];
    }
  
    static getMusicSupportLightTypes() {
      return [
        8, 18, 43, 20, 21, 40, 14, 34, 25, 30, 38, 28, 19, 26, 42, 16, 27, 32,
        37, 31, 22, 44, 46, 42, 45, 47, 49, 50, 51, 52, 53, 54, 55, 39, 58, 56,
        57, 59, 60, 61, 62, 63
      ];
    }
  
    static getRGBLightTypesThatSupport17FX() {
      return [8, 16, 20, 22, 25, 34, 40, 42];
    }
  
    static getRGBLightTypesThatSupport9FX() {
      return [3, 5, 42];
    }
  
    // Swift isValidPeripheralName
    static isValidPeripheralName(peripheralName) {
      const name = peripheralName.toLowerCase();
      if (
        name.includes('nwr') ||
        name.includes('neewer') ||
        name.includes('sl') ||
        name.startsWith('nw-') ||
        name.startsWith('neewer-') ||
        name.includes('nee')
      ) {
        return true;
      }
      return false;
    }
  
    // Swift's CCTRange
    static CCTRange(lightType = 42, projectName = '') {
        // Default CCT range
        return {
            minCCT: 32,  // 3200K
            maxCCT: 56   // 5600K
        };
    }
  
    // Swift getProjectName(idx)
    static getProjectName(idx) {
      switch (idx) {
        case 8:   return "RGB1";
        case 14:  return "SL90";
        case 18:  return "RGB1200";
        case 21:  return "RGB C80";
        case 22:  return "CB60 RGB";
        case 24:  return "Apollo 150D";
        case 25:  return "MS60C";
        case 26:  return "BH-30S RGB";
        case 28:  return "CB200B";
        case 30:  return "MS60B";
        case 31:  return "CB60B";
        case 32:  return "TL60 RGB";
        case 34:  return "SL90 Pro";
        case 40:  return "RGB62";
        case 42:  return "BH-30S RGB";
        case 43:  return "RGB1200";
        case 47:  return "CB300B";
        case 49:  return "CB100C";
        case 50:  return "TL120C";
        case 53:  return "FS230 5600K";
        case 54:  return "FS150 5600K";
        case 55:  return "FS230B";
        case 58:  return "AS600B";
        case 59:  return "TL60 RGB";
        case 60:  return "PL60C";
        case 63:  return "RP19C";
        case 64:  return "TL97C";
        case 65:  return "VL67C";
        case 66:  return "HS60B";
        case 67:  return "TL40";
        case 68:  return "Q200";
        case 69:  return "TL21C";
        case 73:  return "MS150C";
        case 74:  return "CB200C";
        case 75:  return "FS150C";
        case 78:  return "MS60";
        case 79:  return "MS150";
        case 82:  return "CB300C";
        case 84:  return "CB120B";
        case 83:  return "AP150C-2";
        default:  return "";
      }
    }
  
    // Swift getProjectName(str)
    static getProjectNameByString(str) {
      switch (str) {
        case "20200015": return "RGB1";
        case "20200037": return "SL90";
        case "20200049": return "RGB1200";
        case "20210006": return "Apollo 150D";
        case "20210007": return "RGB C80";
        case "20210012": return "CB60 RGB";
        case "20210018": return "BH-30S RGB";
        case "20210034": return "MS60B";
        case "20210035": return "MS60C";
        case "20210036": return "TL60 RGB";
        case "20210037": return "CB200B";
        case "20220014": return "CB60B";
        case "20220016": return "PL60C";
        case "20220035": return "MS150B";
        case "20220041": return "AS600B";
        case "20220043": return "FS150B";
        case "20220046": return "RP19C";
        case "20220051": return "CB100C";
        case "20220055": return "CB300B";
        case "20220057": return "SL90 Pro";
        case "20230021": return "BH-30S RGB";
        case "20230025": return "RGB1200";
        case "20230031": return "TL120C";
        case "20230050": return "FS230 5600K";
        case "20230051": return "FS230B";
        case "20230052": return "FS150 5600K";
        case "20230064": return "TL60 RGB";
        default: return "";
      }
    }
  
    // Swift isRGBOther
    static isRGBOther(str) {
      const upper = str.toUpperCase();
      return (
        upper === "RGB480" ||
        upper === "RGB530" ||
        upper === "RGB660" ||
        upper === "RGB530 PRO" ||
        upper === "RGB660 PRO" ||
        upper === "RGB-P200" ||
        upper === "RGB450" ||
        upper === "RGB650"
      );
    }
  
    // Swift getLightNames(rawName, identifier)
    static getLightNames(rawName, identifier) {
      let nickName = "";
      let projectName = "";
      const name = rawName || "";
      const suffix = identifier ? "-" + identifier.slice(-6) : "";
  
      if (name.startsWith("NWR")) {
        projectName = name.substring(3 + 1); // "NWR" => skip 4 chars
      } else if (name.startsWith("NEEWER")) {
        projectName = name.substring(6 + 1); // skip 7
      } else if (!name.startsWith("NW") || !name.includes("&")) {
        projectName = name.startsWith("NW") ? name.substring(3) : name;
      } else {
        const ampIndex = name.lastIndexOf("&");
        if (ampIndex > 3) {
          const substring = name.substring(3, ampIndex);
          const numericVal = parseInt(substring, 10);
          if (!isNaN(numericVal)) {
            projectName = NeewerLightConstant.getProjectNameByString(substring);
          } else {
            projectName = substring;
          }
        } else {
          projectName = name.substring(3);
        }
      }
      nickName = projectName + suffix;
      return { nickName, projectName };
    }
  
    // Scenes placeholders
    static lightingScene() { return { id: 0x01, name: "Lighting" }; }
    static paparazziScene() { return { id: 0x02, name: "Paparazzi" }; }
    static defectiveBulbScene() { return { id: 0x03, name: "Defective bulb" }; }
    static explosionScene() { return { id: 0x04, name: "Explosion" }; }
    static weldingScene() { return { id: 0x05, name: "Welding" }; }
    static cctFlashScene() { return { id: 0x06, name: "CCT flash" }; }
    static hueFlashScene() { return { id: 0x07, name: "HUE flash" }; }
    static cctPulseScene() { return { id: 0x08, name: "CCT pulse" }; }
    static huePulseScene() { return { id: 0x09, name: "HUE pulse" }; }
    static copCarScene() { return { id: 0x0A, name: "Cop Car" }; }
    static candlelightScene() { return { id: 0x0B, name: "Candlelight" }; }
    static hueLoopScene() { return { id: 0x0C, name: "HUE Loop" }; }
    static cctLoopScene() { return { id: 0x0D, name: "CCT Loop" }; }
    static intLoopScene() { return { id: 0x0E, name: "INT loop" }; }
    static tvScreenScene() { return { id: 0x0F, name: "TV Screen" }; }
    static fireworkScene() { return { id: 0x10, name: "Firework" }; }
    static partyScene() { return { id: 0x11, name: "Party" }; }
  
    static getLightFX(lightType) {
      // Swift appended them all, ignoring the type param
      return [
        NeewerLightConstant.lightingScene(),
        NeewerLightConstant.paparazziScene(),
        NeewerLightConstant.defectiveBulbScene(),
        NeewerLightConstant.explosionScene(),
        NeewerLightConstant.weldingScene(),
        NeewerLightConstant.cctFlashScene(),
        NeewerLightConstant.hueFlashScene(),
        NeewerLightConstant.cctPulseScene(),
        NeewerLightConstant.huePulseScene(),
        NeewerLightConstant.copCarScene(),
        NeewerLightConstant.candlelightScene(),
        NeewerLightConstant.hueLoopScene(),
        NeewerLightConstant.cctLoopScene(),
        NeewerLightConstant.intLoopScene(),
        NeewerLightConstant.tvScreenScene(),
        NeewerLightConstant.fireworkScene(),
        NeewerLightConstant.partyScene()
      ];
    }
  
    // Light source placeholders
    static sunlightSource() { return { id: 0x01, name: "Sunlight" }; }
    static whiteHalogenSource() { return { id: 0x02, name: "White Halogen light" }; }
    static xenonShortarcLampSource() { return { id: 0x03, name: "Xenon short-arc lamp" }; }
    static horizonDaylightSource() { return { id: 0x04, name: "Horizon daylight" }; }
    static daylightSource() { return { id: 0x05, name: "Daylight" }; }
    static tungstenSource() { return { id: 0x06, name: "Tungsten" }; }
    static studioBulbSource() { return { id: 0x07, name: "Studio Bulb" }; }
    static modelingLightsSource() { return { id: 0x08, name: "Modeling Lights" }; }
    static dysprosicLampSource() { return { id: 0x09, name: "Dysprosic lamp" }; }
    static hmi6000Source() { return { id: 0x0A, name: "HMI6000" }; }
  
    static getLightSources(lightType) {
      return [
        NeewerLightConstant.sunlightSource(),
        NeewerLightConstant.whiteHalogenSource(),
        NeewerLightConstant.xenonShortarcLampSource(),
        NeewerLightConstant.horizonDaylightSource(),
        NeewerLightConstant.daylightSource(),
        NeewerLightConstant.tungstenSource(),
        NeewerLightConstant.studioBulbSource(),
        NeewerLightConstant.modelingLightsSource(),
        NeewerLightConstant.dysprosicLampSource(),
        NeewerLightConstant.hmi6000Source()
      ];
    }
  
    // Swift getLightType(nickName, rawName, projectName)
    static getLightType(nickName, rawname, projectName) {
      let lightType = 8;
      const n = nickName || "";
      const r = rawname || "";
      const p = projectName || "";
  
      // Swift checks for "SRP", "RP18-P", etc.
      if (n.includes("SRP") || n.includes("RP18-P")) {
        return 1;
      }
      if (n.includes("RP18B PRO")) {
        return 51;
      }
      if (n.includes("SNL") || n.includes("NL")) {
        if (n.includes("SNL")) {
          if (n.includes("SNL960") || n.includes("SNL1320") || n.includes("SNL1920")) {
            return 13;
          }
          return 7;
        }
        return 2;
      }
      if (n.includes("GL1")) {
        if (n.includes("GL1 PRO")) return 33;
        else if (n.includes("GL1C")) return 39;
        else return 4;
      }
      if (n.includes("ZK-RY")) {
        return 17;
      }
      if (!n.includes("RGB") && !n.includes("SL")) {
        if (n.includes("ZY") || n.includes("ER1")) {
          return 23;
        }
        if (n.includes("DL200")) {
          return 35;
        }
        if (n.includes("X2")) {
          return 27;
        }
        if (n.includes("CB200B")) {
          return 28;
        }
        if (n.includes("Apollo 150D")) {
          return 24;
        }
        if (n.includes("MS60C")) {
          return 25;
        }
        if (n.includes("MS60B")) {
          return 30;
        }
        if (n.includes("CB60B")) {
          return 31;
        }
        if (n.includes("RGB62")) {
          return 40;
        }
        if (n.includes("GM16")) {
          return 36;
        }
        if (n.includes("FS150B")) {
          return 37;
        }
        if (n.includes("MS150B")) {
          return 38;
        }
        if (n.includes("DL300")) {
          return 41;
        }
        if (n.includes("T100C")) {
          return 44;
        }
        if (n.includes("A19C 220V")) {
          return 45;
        }
        if (n.includes("A19C(E26)")) {
          return 46;
        }
        if (n.includes("CB300") && (r.includes("20230111") || r === "NW-CB300")) {
          return 81;
        }
        if (n.includes("CB300B")) {
          return 47;
        }
        if (n.includes("R360")) {
          return 48;
        }
        if (n.includes("CB100C")) {
          return 49;
        }
        if (n.includes("TL120C")) {
          return 50;
        }
        if (n.includes("RL45B")) {
          return 52;
        }
        if (n.includes("FS230 5600K")) {
          return 53;
        }
        if (n.includes("FS150 5600K")) {
          return 54;
        }
        if (n.includes("FS230B")) {
          return 55;
        }
        if (n.includes("20220041")) {
          return 58;
        }
        if (n.includes("PL60C")) {
          return 60;
        }
        if (n.includes("BH40C")) {
          return 61;
        }
        if (n.includes("GR18C")) {
          return 62;
        }
        if (n.includes("RP19C")) {
          return 63;
        }
        if (n.includes("VL67C")) {
          return 65;
        }
        if (n.includes("TL97C")) {
          return 64;
        }
        if (n.includes("HS60B")) {
          return 66;
        }
        if (n.includes("TL40")) {
          return 67;
        }
        if (n.includes("Q200")) {
          return 68;
        }
        if (n.includes("TL21C")) {
          return 69;
        }
        if (n.includes("MS150C")) {
          return 73;
        }
        if (n.includes("CB200C")) {
          return 74;
        }
        if (n.includes("FS150C")) {
          return 75;
        }
        if (n.includes("MS60")) {
          return 78;
        }
        if (n.includes("MS150")) {
          return 79;
        }
        if (n.includes("CB300C")) {
          return 82;
        }
        if (n.includes("CB120B")) {
          return 84;
        }
        if (n.includes("AP150C-2")) {
          return 83;
        }
        if (!n.includes("T100C-2")) {
          if (n.includes("TL40-2")) {
            return 86;
          }
          return 0;
        }
        return 0;
      }
      // If we get here, it's either "RGB" or "SL"
      if (n.includes("RGB")) {
        if (p === "RGB1" || n.includes("RGB1-A")) {
          return 8;
        } else if (n.includes("RGB176")) {
          return n.includes("RGB176 A1") ? 20 : 5;
        } else if (n.includes("RGB18(II)")) {
          return 57;
        } else {
          if (n.includes("RGB18")) {
            lightType = 9;
          } else if (n.includes("RGB190")) {
            lightType = 11;
          } else if (n.includes("RGB960") || n.includes("RGB1320") || n.includes("RGB1920")) {
            lightType = 12;
          } else if (n.includes("RGB140")) {
            lightType = 15;
          } else if (n.includes("RGB168")) {
            lightType = 16;
          }
          if (n.includes("RGB1200")) {
            lightType = n.includes("20230025") ? 43 : 18;
          } else if (n.includes("CL124 RGB(II)")) {
            lightType = 56;
          } else {
            if (n.includes("CL124-RGB")) {
              lightType = 19;
            } else if (n.includes("RGB C80") || n.includes("RGBC80")) {
              lightType = 21;
            } else if (n.includes("CB60 RGB")) {
              lightType = 22;
            } else if (n.includes("RGB-P280")) {
              lightType = 29;
            }
            if (n.includes("BH-30S RGB")) {
              if (r.includes("20230021")) lightType = 42;
              else lightType = 26;
            } else if (n.includes("TL60 RGB")) {
              if (r.includes("20230064")) lightType = 59;
              else lightType = 32;
            } else if (n.includes("RGB62")) {
              lightType = 40;
            } else {
              if (NeewerLightConstant.isRGBOther(p)) {
                lightType = 3;
              }
            }
          }
        }
      } else if (n.includes("SL90 Pro")) {
        lightType = 34;
      } else if (n.includes("SL90")) {
        lightType = 14;
      } else {
        lightType = 6;
      }
      return lightType;
    }
  
    // from Swift: getNewPowerCommand, getCCTLightCommand, etc.
    static getNewPowerCommand(turnOn, mac) {
        // Following Swift's composeSingleCommandWithMac logic:
        // 1. Command structure: prefix(0x78), tag(0x8D), size(byteCount + 7), MAC(6 bytes), subtag(0x81), value(0x01/0x02), checksum
        
        const vals = turnOn ? [0x01] : [0x02];  // powerNewOnSubTag or powerNewOffSubTag
        const byteCount = vals.length;
        const totalLength = byteCount + 11;  // matches Swift's array size
        
        const arr = new Array(totalLength).fill(0);
        arr[0] = 0x78;  // prefixTag
        arr[1] = 0x8D;  // powerNewTag
        arr[2] = byteCount + 7;  // size calculation from Swift
        
        // Process MAC address like Swift
        //logger.info(`Processing MAC address: ${mac}`);
        const macParts = (mac || '').split(':')
            .map(part => {
                const val = parseInt(part, 16);
              //  logger.info(`MAC part ${part} -> ${val}`);
                return isNaN(val) ? 0 : val;
            });
        while (macParts.length < 6) macParts.push(0);
        
        // Copy MAC bytes (positions 3-8)
        for (let i = 0; i < 6; i++) {
            arr[3 + i] = macParts[i];
        }
        
        arr[9] = 0x81;  // powerNewSubTag
        arr[10] = vals[0];  // power value
        
        // Calculate checksum like Swift
        let checksum = 0;
        for (let i = 0; i < arr.length - 1; i++) {
            // Handle negative values like Swift
            const val = arr[i] < 0 ? arr[i] + 0x100 : arr[i];
            checksum += val;
        }
        arr[arr.length - 1] = checksum & 0xFF;
        
        // Log the final command
        logger.info(`Command array: ${arr.map(v => v.toString(16).padStart(2, '0')).join(' ')}`);
        
        // Convert to Buffer, handling negative values
        const buffer = Buffer.from(arr.map(val => val < 0 ? val + 0x100 : val));
        return buffer;
    }
    static composeSingleCommand(tag, ...values) {
        const arr = [0x78, tag, values.length];  // prefix, tag, size
        arr.push(...values);
        
        // Calculate checksum
        let sum = arr.reduce((acc, cur) => acc + cur, 0);
        arr.push(sum & 0xFF);
        
        return arr;
    }
    static composeSingleCommandWithMac(tag, mac, subtag, vals) {
        const byteCount = vals.length;
        const arr = new Array(byteCount + 11).fill(0);
        
        arr[0] = this.BleCommand.prefixTag;  // 0x78
        arr[1] = tag;
        arr[2] = byteCount + 7;
        
        // Process MAC address
        const macParts = (mac || 'E2:E4:8B:96:83:B7').split(':')
            .map(part => parseInt(part, 16))
            .map(val => isNaN(val) ? 0 : val);
        while (macParts.length < 6) macParts.push(0);
        
        // Copy MAC bytes
        for (let i = 0; i < 6; i++) {
            arr[3 + i] = macParts[i];
        }
        
        arr[9] = subtag;
        
        // Copy values
        let idx = 10;
        for (const val of vals) {
            arr[idx] = val;
            idx++;
        }
        
        // Calculate checksum
        let checksum = 0;
        for (let i = 0; i < arr.length; i++) {
            checksum += arr[i];
        }
        arr.push(checksum & 0xFF);
        
        return arr;
    }
    static getCCTLightCommand(brightness, cct, gm, mac) {
        const arr = new Array(16).fill(0);
        
        // Header
        arr[0] = 0x78;
        arr[1] = 0x90;
        arr[2] = 0x0C;
        
        // MAC address
        const macParts = (mac || 'E2:E4:8B:96:83:B7').split(':')
            .map(part => parseInt(part, 16))
            .map(val => isNaN(val) ? 0 : val);
        while (macParts.length < 6) macParts.push(0);
        for (let i = 0; i < 6; i++) {
            arr[3 + i] = macParts[i];
        }
        
        // CCT Light subtag
        arr[9] = 0x87;
        
        // Values exactly as captured
        arr[10] = Math.max(0x14, Math.min(0x64, Math.floor(brightness)));  // 20-100
        arr[11] = Math.max(0x1B, Math.min(0x39, Math.floor(cct/100)));    // 27-57
        arr[12] = Math.max(0x00, Math.min(0x64, Math.floor(gm + 50)));    // 0-100
        arr[13] = 0x00;  // Fixed padding
        
        // Calculate checksum
        let sum = 0;
        for (let i = 0; i < arr.length - 1; i++) {
            sum += arr[i];
        }
        arr[15] = sum & 0xFF;
        
        return Buffer.from(arr);
    }
  
    static getNewRGBLightCommand(mac, brightness, hue360, saturation) {
      // prefix=0x78, 0x8f, length=0x0c, mac, subtag=0x86, then hueLow,hueHigh, satInt, brr,0, sum
      const arr = [];
      arr.push(0x78);
      arr.push(0x8f);
      arr.push(0x0c);
  
      let macParts = (mac || 'E2:E4:8B:96:83:B7').split(':');
      while (macParts.length < 6) macParts.push('00');
      macParts.forEach(part => {
        let val = parseInt(part, 16);
        if (isNaN(val)) val = 0;
        arr.push(val);
      });
      arr.push(0x86);
  
      const clampBrr = Math.max(0, Math.min(100, Math.floor(brightness)));
      const clampHue = Math.max(0, Math.min(360, Math.floor(hue360)));
      let clampSat = saturation > 1.0 ? saturation / 100.0 : saturation;
      clampSat = Math.max(0, Math.min(1.0, clampSat));
      const satInt = Math.floor(clampSat * 100);
  
      arr.push(clampHue & 0xff);
      arr.push((clampHue >> 8) & 0xff);
      arr.push(satInt);
      arr.push(clampBrr);
      arr.push(0x00);
  
      let sum = arr.reduce((acc, cur) => acc + cur, 0);
      arr.push(sum & 0xff);
  
      return Buffer.from(arr);
    }
  
    static getSceneValue(mac, scene, brightness, speed) {
        // Following Swift's getSceneValue implementation
        // Command structure: prefix(0x78), tag(0x88), size(0x02), brightness, scene, checksum
        
        // Clamp brightness to 0-100
        const brrValue = Math.max(0, Math.min(100, Math.floor(brightness)));
        
        // Clamp scene to 1-9
        const sceneValue = scene;
        
        const arr = new Array(6).fill(0);
        arr[0] = 0x78;  // prefixTag
        arr[1] = 0x88;  // setSceneTag
        arr[2] = 0x02;  // byteCount
        arr[3] = brrValue;
        arr[4] = sceneValue;
        
        // Calculate checksum
        let checksum = 0;
        for (let i = 0; i < arr.length - 1; i++) {
            checksum += arr[i];
        }
        arr[arr.length - 1] = checksum & 0xFF;
        
        return Buffer.from(arr);
    }
  
    static getSceneCommand(mac, fx) {
        /*
        Command structure from Swift:
        CMD TAG SIZE MAC(6) SCE_TAG SCE_ID BRR COLOR SPEED checksum
        78  91  0B  MAC    8B      11     07  01    03    4F
        */
        
        // Calculate needed size based on FX parameters
        let byteCount = 8;  // Base size for MAC + tags
        
        // Add space for required parameters
        if (fx.needBrr) byteCount += 1;
        if (fx.needBrrUpperBound) byteCount += 1;
        if (fx.needHue) byteCount += 2;
        if (fx.needHueUpperBound) byteCount += 2;
        if (fx.needSat) byteCount += 1;
        if (fx.needCct) byteCount += 1;
        if (fx.needCctUpperBound) byteCount += 1;
        if (fx.needGm) byteCount += 1;
        if (fx.needColor && fx.colors?.length > 0) byteCount += 1;
        if (fx.needSpeed) byteCount += 1;
        if (fx.needSparks && fx.sparkLevel?.length > 0) byteCount += 1;
        
        const arr = new Array(byteCount + 4).fill(0);  // +4 for prefix, tag, size, checksum
        
        // Basic command structure
        arr[0] = 0x78;  // prefixTag
        arr[1] = 0x91;  // setSCEDataTag
        arr[2] = byteCount;
        
        // Process MAC address
        const macParts = (mac || 'E2:E4:8B:96:83:B7').split(':')
            .map(part => parseInt(part, 16))
            .map(val => isNaN(val) ? 0 : val);
        while (macParts.length < 6) macParts.push(0);
        
        // Copy MAC bytes
        for (let i = 0; i < 6; i++) {
            arr[3 + i] = macParts[i];
        }
        
        arr[9] = 0x8B;  // setSCESubTag
        arr[10] = fx.id;
        
        let idx = 11;
        
        // Add parameters based on FX needs
        if (fx.needBrr) {
            arr[idx] = Math.max(0, Math.min(100, Math.floor(fx.brrValue)));
            idx += 1
        }
        
        if (fx.needBrrUpperBound) {
            arr[idx] = Math.max(0, Math.min(100, Math.floor(fx.brrUpperValue)));
            idx += 1
        }
        
        if (fx.needHue) {
            const hue = Math.max(0, Math.min(360, Math.floor(fx.hueValue)));
            arr[idx] = hue & 0xFF;
            idx += 1
            arr[idx] = (hue & 0xFF00) >> 8;
            idx += 1
        }
        
        if (fx.needHueUpperBound) {
            const hue = Math.max(0, Math.min(360, Math.floor(fx.hueUpperValue)));
            arr[idx] = hue & 0xFF;
            idx += 1
            arr[idx] = (hue & 0xFF00) >> 8;
            idx += 1
        }
        
        if (fx.needSat) {
            arr[idx] = Math.max(0, Math.min(100, Math.floor(fx.satValue)));
            idx += 1
        }
        
        if (fx.needCct) {
            const cctRange = this.CCTRange(fx.lightType, fx.projectName);
            arr[idx] = Math.max(cctRange.minCCT, Math.min(cctRange.maxCCT, Math.floor(fx.cctValue)));
            idx += 1
        }
        
        if (fx.needCctUpperBound) {
            const cctRange = this.CCTRange(fx.lightType, fx.projectName);
            arr[idx] = Math.max(cctRange.minCCT, Math.min(cctRange.maxCCT, Math.floor(fx.cctUpperValue)));
            idx += 1
        }
        
        if (fx.needGm) {
            arr[idx] = Math.max(-50, Math.min(50, Math.floor(fx.gmValue))) + 50;
            idx += 1
        }
        
        if (fx.needColor && fx.colors?.length > 0) {
            arr[idx] = Math.max(0, Math.min(fx.colors.length, Math.floor(fx.colorValue)));
            idx += 1
        }
        
        if (fx.needSpeed) {
            //arr[idx] = Math.max(1, Math.min(10, Math.floor(fx.speedValue)));
            arr[idx] = fx.speedValue;
            idx += 1
        }
        
        if (fx.needSparks && fx.sparkLevel?.length > 0) {
           // arr[idx] = Math.max(1, Math.min(fx.sparkLevel.length, Math.floor(fx.sparksValue)));
            arr[idx] = 8;
            idx += 1
        }
        
        // Calculate checksum
        let checksum = 0;
        for (let i = 0; i < arr.length - 1; i++) {
            const val = arr[i] < 0 ? arr[i] + 0x100 : arr[i];
            checksum += val;
        }
        arr[arr.length - 1] = checksum & 0xFF;
        
        return Buffer.from(arr.map(val => val < 0 ? val + 0x100 : val));
    }
  
    static getCCTLightCommand2(brr, cct) {
        let ratio = 100.0;
        if (brr >= 1.0) {
            ratio = 1.0;
        }
        
        const cctRange = this.CCTRange();
        const newCctValue = Math.max(cctRange.minCCT, Math.min(cctRange.maxCCT, Math.floor(cct/100)));
        const newBrrValue = Math.max(0, Math.min(100, Math.floor(brr * ratio)));

        if (newCctValue === 0) {
            // Only adjust brightness
            const bArr1 = this.composeSingleCommand(
                this.BleCommand.setCCTLightTag,
                newBrrValue
            );
            return Buffer.from(bArr1);
        }

        // Both brightness and CCT
        const bArr1 = this.composeSingleCommand(
            this.BleCommand.setCCTLightTag,
            newBrrValue,
            newCctValue
        );
        
        return Buffer.from(bArr1);
    }

    static getCCTOnlyLightCommand(brr, cct) {
        const cctRange = this.CCTRange();
        const newCctValue = Math.max(cctRange.minCCT, Math.min(cctRange.maxCCT, Math.floor(cct/100)));
        const newBrrValue = Math.max(0, Math.min(100, Math.floor(brr)));

        if (newCctValue === 0) {
            // Only adjust brightness
            const bArr1 = this.composeSingleCommand(
                this.BleCommand.setLongCCTLightBrightnessTag,
                newBrrValue
            );
            return Buffer.from(bArr1);
        }

        // Both brightness and CCT
        const bArr1 = this.composeSingleCommand(
            this.BleCommand.setLongCCTLightBrightnessTag,
            newBrrValue
        );
        const bArr2 = this.composeSingleCommand(
            this.BleCommand.setLongCCTLightCCTTag,
            newCctValue
        );
        
        return Buffer.from([...bArr1, ...bArr2]);
    }
  

  }
  
  module.exports = NeewerLightConstant;
  