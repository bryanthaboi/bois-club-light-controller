// logger.js
// Tiny tag-prefixed logger. Level is controlled by NEEWER_LOG_LEVEL env var.
// Values (lowest to highest): debug, info, warn, error, off.

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40, off: 100 };

function envLevel() {
  const raw = (process.env.NEEWER_LOG_LEVEL || 'info').toLowerCase();
  if (raw in LEVELS) return LEVELS[raw];
  return LEVELS.info;
}

let threshold = envLevel();

function setLevel(name) {
  const n = String(name || '').toLowerCase();
  if (n in LEVELS) threshold = LEVELS[n];
}

function ts() {
  return new Date().toISOString();
}

function debug(msg) { if (threshold <= LEVELS.debug) console.log(`${ts()} [DEBUG] ${msg}`); }
function info(msg)  { if (threshold <= LEVELS.info)  console.log(`${ts()} [INFO]  ${msg}`); }
function warn(msg)  { if (threshold <= LEVELS.warn)  console.warn(`${ts()} [WARN]  ${msg}`); }
function error(msg) { if (threshold <= LEVELS.error) console.error(`${ts()} [ERROR] ${msg}`); }

module.exports = {
  setLevel,
  debug,
  info,
  warn,
  error
};
