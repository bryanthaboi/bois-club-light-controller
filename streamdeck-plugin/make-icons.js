// Pure-Node PNG generator for Bois Club Light Controller icons.
// Draws an actual light-bulb shape (glass + neck + screw base) in the centre
// of a rounded-square background. Each icon family uses a different glow
// colour: warm gold (plugin), cool blue (neewer), green (govee), magenta
// (preset), white (all-lights). Pure Node — no native deps.
//
// Run from the plugin root: `node make-icons.js`.

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT = path.join(__dirname, 'com.boisclub.lightcontroller.sdPlugin', 'images');
fs.mkdirSync(OUT, { recursive: true });

// ---------- PNG plumbing ----------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}
function hex2rgb(hex) {
  hex = hex.replace('#', '');
  return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
}

// ---------- canvas helpers ----------
function setPx(raw, W, x, y, rgba) {
  if (x < 0 || x >= W || y < 0) return;
  const off = y * (1 + W * 4) + 1 + x * 4;
  if (off + 3 >= raw.length) return;
  // alpha blend: rgba is { r, g, b, a } with a 0..255
  const a = rgba[3] / 255;
  raw[off]     = Math.round(raw[off]     * (1 - a) + rgba[0] * a);
  raw[off + 1] = Math.round(raw[off + 1] * (1 - a) + rgba[1] * a);
  raw[off + 2] = Math.round(raw[off + 2] * (1 - a) + rgba[2] * a);
  raw[off + 3] = Math.max(raw[off + 3], rgba[3]);
}

function roundedMask(x, y, W, H, radius) {
  const r = radius;
  if (x < r && y < r) return ((r - x) ** 2 + (r - y) ** 2) <= r * r;
  if (x < r && y >= H - r) return ((r - x) ** 2 + (y - (H - r - 1)) ** 2) <= r * r;
  if (x >= W - r && y < r) return ((x - (W - r - 1)) ** 2 + (r - y) ** 2) <= r * r;
  if (x >= W - r && y >= H - r) return ((x - (W - r - 1)) ** 2 + (y - (H - r - 1)) ** 2) <= r * r;
  return true;
}

// ---------- bulb geometry ----------
// Coordinates in canvas pixels. The bulb sits roughly centred horizontally,
// with the glass globe in the upper 60% and the screw base in the lower 30%.
function bulbColor(x, y, W, H, palette) {
  const cx = W / 2;
  const cy = H * 0.36;
  const R = W * 0.28;            // bulb glass radius
  const dx = x - cx, dy = y - cy;
  const distSq = dx * dx + dy * dy;

  // Glass globe
  if (distSq < R * R) {
    // Outline ring
    if (distSq > (R - 1.5) * (R - 1.5)) return palette.outline;
    // Inner glow gradient — radial falloff towards the centre
    const norm = Math.sqrt(distSq) / R;
    const glow = palette.glow;
    const glass = palette.glass;
    // norm=0 → all glow; norm=1 → all glass
    return mix(glow, glass, norm * 0.85 + 0.05);
  }

  // Neck (trapezoid) — between glass bottom and base top
  const neckTop = cy + R * 0.70;
  const neckBot = cy + R * 1.05;
  if (y > neckTop && y < neckBot) {
    const t = (y - neckTop) / (neckBot - neckTop);
    const halfTop = R * 0.55;
    const halfBot = R * 0.46;
    const halfW = halfTop + (halfBot - halfTop) * t;
    if (Math.abs(dx) < halfW) {
      if (Math.abs(dx) > halfW - 1.5) return palette.outline;
      return palette.base;
    }
  }

  // Screw base — rectangle with stripes
  const baseTop = neckBot;
  const baseBot = neckBot + R * 0.75;
  const halfBase = R * 0.46;
  if (y >= baseTop && y < baseBot) {
    if (Math.abs(dx) < halfBase) {
      // Outline
      if (Math.abs(dx) > halfBase - 1.5) return palette.outline;
      // Threads: two darker stripes at 35% and 70% of base height
      const localY = (y - baseTop) / (baseBot - baseTop);
      if (Math.abs(localY - 0.35) < 0.06 || Math.abs(localY - 0.70) < 0.06) {
        return palette.thread;
      }
      return palette.base;
    }
  }

  // Tip — narrowing rectangle below screw
  const tipTop = baseBot;
  const tipBot = baseBot + R * 0.16;
  if (y >= tipTop && y < tipBot) {
    const t = (y - tipTop) / (tipBot - tipTop);
    const halfW = halfBase * (1 - t * 0.55);
    if (Math.abs(dx) < halfW) {
      if (Math.abs(dx) > halfW - 1.5) return palette.outline;
      return palette.tip;
    }
  }

  return null;
}

function mix(a, b, t) {
  return [
    Math.round(a[0] * (1 - t) + b[0] * t),
    Math.round(a[1] * (1 - t) + b[1] * t),
    Math.round(a[2] * (1 - t) + b[2] * t),
    255
  ];
}

function withAlpha(rgb, a) { return [rgb[0], rgb[1], rgb[2], a]; }

// ---------- icon renderer ----------
function makeIcon(size, opts) {
  const { bg, palette, multi } = opts;
  const W = size, H = size;
  const radius = Math.round(size * 0.18);
  const raw = Buffer.alloc(H * (1 + W * 4));

  const bgRgb = hex2rgb(bg);

  // Fill background (rounded square)
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 4)] = 0;
    for (let x = 0; x < W; x++) {
      if (!roundedMask(x, y, W, H, radius)) continue;
      const off = y * (1 + W * 4) + 1 + x * 4;
      raw[off] = bgRgb[0];
      raw[off + 1] = bgRgb[1];
      raw[off + 2] = bgRgb[2];
      raw[off + 3] = 255;
    }
  }

  // Draw bulb(s). 'multi' = 3 small bulbs side-by-side for "all" variants.
  const draw = (offX, offY, scale) => {
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        // Transform (x,y) → bulb-local coords by scaling about (offX,offY)
        const lx = (x - offX) / scale + W / 2;
        const ly = (y - offY) / scale + H / 2;
        if (lx < 0 || lx >= W || ly < 0 || ly >= H) continue;
        const c = bulbColor(lx, ly, W, H, palette);
        if (!c) continue;
        if (!roundedMask(x, y, W, H, radius)) continue;
        setPx(raw, W, x, y, c);
      }
    }
  };

  if (multi) {
    // 3 stacked-up bulbs forming a row (smaller, offset)
    const s = 0.6;
    const dy = -W * 0.04;
    draw(W * 0.28, H / 2 + dy, s);
    draw(W * 0.5,  H / 2 + dy + W * 0.04, s);
    draw(W * 0.72, H / 2 + dy, s);
  } else {
    draw(W / 2, H / 2, 1.0);
  }

  // Soft outer halo around the bulb — additive glow into the background
  if (opts.halo) {
    const cx = W / 2;
    const cy = H * 0.36;
    const R = W * 0.28;
    const haloR = R * 1.65;
    const [hr, hg, hb] = hex2rgb(opts.halo);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const dx = x - cx, dy = y - cy;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d <= R || d >= haloR) continue;
        if (!roundedMask(x, y, W, H, radius)) continue;
        const t = 1 - (d - R) / (haloR - R);
        const a = Math.round(140 * t * t);
        // Skip pixels already painted by bulb (alpha 255 with non-bg)
        const off = y * (1 + W * 4) + 1 + x * 4;
        if (raw[off] !== bgRgb[0] || raw[off + 1] !== bgRgb[1] || raw[off + 2] !== bgRgb[2]) continue;
        setPx(raw, W, x, y, [hr, hg, hb, a]);
      }
    }
  }

  const sig = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

// ---------- palettes ----------
const PALETTES = {
  warm:    { glow: hex2rgb('#fff2a8').concat(255), glass: hex2rgb('#f7e08a').concat(255), base: hex2rgb('#bcbcbf').concat(255), thread: hex2rgb('#7d7d83').concat(255), tip: hex2rgb('#444448').concat(255), outline: hex2rgb('#2a2a30').concat(255) },
  blue:    { glow: hex2rgb('#dceefe').concat(255), glass: hex2rgb('#7eaff2').concat(255), base: hex2rgb('#bcbcbf').concat(255), thread: hex2rgb('#7d7d83').concat(255), tip: hex2rgb('#444448').concat(255), outline: hex2rgb('#152040').concat(255) },
  green:   { glow: hex2rgb('#d9fff0').concat(255), glass: hex2rgb('#7ce8b8').concat(255), base: hex2rgb('#bcbcbf').concat(255), thread: hex2rgb('#7d7d83').concat(255), tip: hex2rgb('#444448').concat(255), outline: hex2rgb('#0f3a2a').concat(255) },
  magenta: { glow: hex2rgb('#ffe4ff').concat(255), glass: hex2rgb('#d893ff').concat(255), base: hex2rgb('#bcbcbf').concat(255), thread: hex2rgb('#7d7d83').concat(255), tip: hex2rgb('#444448').concat(255), outline: hex2rgb('#2c1c50').concat(255) },
  white:   { glow: hex2rgb('#ffffff').concat(255), glass: hex2rgb('#f5f5fa').concat(255), base: hex2rgb('#bcbcbf').concat(255), thread: hex2rgb('#7d7d83').concat(255), tip: hex2rgb('#444448').concat(255), outline: hex2rgb('#1a1a20').concat(255) }
};

// ---------- icon set ----------
const ICONS = {
  // Plugin chrome — warm gold bulb on charcoal
  'plugin':      { bg: '#1f1f23', palette: 'warm',    halo: '#ffd169' },
  'category':    { bg: '#1f1f23', palette: 'warm',    halo: '#ffd169' },

  // Neewer family — cool blue
  'neewer':      { bg: '#101a30', palette: 'blue',    halo: '#5d9bff' },
  'neewer-key':  { bg: '#0a1124', palette: 'blue',    halo: '#5d9bff' },

  // Govee family — green
  'govee':       { bg: '#0a2a1d', palette: 'green',   halo: '#46d68a' },
  'govee-key':   { bg: '#051a12', palette: 'green',   halo: '#46d68a' },

  // Preset — magenta vibe
  'preset':      { bg: '#1d0d2c', palette: 'magenta', halo: '#c074ff' },
  'preset-key':  { bg: '#150821', palette: 'magenta', halo: '#c074ff' },

  // All — three bulbs in a row (white glow)
  'all':         { bg: '#1f1f23', palette: 'white',   halo: '#ffffff', multi: true },
  'all-key':     { bg: '#15151a', palette: 'white',   halo: '#ffffff', multi: true }
};

function writePair(name, spec) {
  for (const [suffix, size] of [['', 144], ['@2x', 288]]) {
    const palette = PALETTES[spec.palette];
    const png = makeIcon(size, {
      bg: spec.bg,
      palette,
      halo: spec.halo,
      multi: spec.multi
    });
    const p = path.join(OUT, `${name}${suffix}.png`);
    fs.writeFileSync(p, png);
    console.log('wrote', `${name}${suffix}.png`, png.length, 'bytes');
  }
}

for (const [name, spec] of Object.entries(ICONS)) writePair(name, spec);

console.log('done — bulbs rendered.');
