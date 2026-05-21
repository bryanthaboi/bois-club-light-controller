// commandParameter.js
// Extracts parameters similar to Swift's CommandParameter
module.exports = {
    parse(req) {
      const q = req.query;
      return {
        lightName: () => {
          return q.light || null;
        },
        HUE: () => {
          if (!q.HUE) return null;
          const val = parseInt(q.HUE, 10);
          return isNaN(val) ? null : val;
        },
        CCT: () => {
          if (!q.CCT) return 3200;
          const val = parseInt(q.CCT, 10);
          return isNaN(val) ? 3200 : val;
        },
        GM: () => {
          if (!q.GM) return 0;
          const val = parseInt(q.GM, 10);
          return isNaN(val) ? 0 : val;
        },
        saturation: () => {
          if (!q.Saturation) return 1.0;
          let sat = parseFloat(q.Saturation);
          if (isNaN(sat)) sat = 1.0;
          if (sat > 1.0) sat = sat / 100.0;
          return sat;
        },
        brightness: () => {
          if (!q.Brightness) return null;
          const b = parseFloat(q.Brightness);
          return isNaN(b) ? null : b;
        },
        speed: () => {
          if (!q.Speed) return null;
          const sp = parseFloat(q.Speed);
          return isNaN(sp) ? null : sp;
        },
        scene: () => {
          if (!q.Scene) return 1;
          const valLow = q.Scene.toLowerCase();
          switch (valLow) {
            case 'squadcar':   return 1;
            case 'ambulance':  return 2;
            case 'fireengine': return 3;
            case 'fireworks':  return 4;
            case 'party':      return 5;
            case 'candlelight':return 6;
            case 'lighting':   return 7;
            case 'paparazzi':  return 8;
            case 'screen':     return 9;
            default: return 1;
          }
        },
        sceneId: () => {
          if (!q.SceneId) return null;
          const val = parseInt(q.SceneId, 10);
          return isNaN(val) ? null : val;
        }
      };
    }
  };
  