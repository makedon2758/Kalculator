// hwid.js — стабильный HWID без прав админа
const os = require('os');
const crypto = require('crypto');

function getHWID() {
  const nets = os.networkInterfaces();
  const macs = []
    .concat(nets['Ethernet'] || [])
    .concat(nets['Wi-Fi']   || [])
    .filter(x => x && x.mac)
    .map(x => x.mac.toUpperCase());
  const raw = [
    os.hostname(), os.platform(), os.arch(),
    ...Array.from(new Set(macs))
  ].join('|');
  return 'WIN-' + crypto.createHash('sha256').update(raw).digest('hex').slice(0,16).toUpperCase();
}
module.exports = { getHWID };
