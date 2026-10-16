const path = require('node:path');
function parseBattery(text) {
  const percent = text.match(/(\d+)%;\s*([^;\n]+)/);
  if (!percent) return { present: false };
  const plugged = /Now drawing from 'AC Power'/.test(text);
  return { present: true, percent: Math.min(100, Number(percent[1])), plugged,
    charging: plugged && /^charging\b/.test(percent[2]) };
}
function loginPlist(appPath) {
  if (!path.isAbsolute(appPath) || !appPath.endsWith('.app')) throw new Error('Invalid application path');
  const xml = value => value.replace(/[<>&"']/g, c => ({ '<':'&lt;', '>':'&gt;', '&':'&amp;', '"':'&quot;', "'":'&apos;' })[c]);
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict><key>Label</key><string>io.github.axiu8076.whale.login</string>
<key>ProgramArguments</key><array><string>/usr/bin/open</string><string>-a</string><string>${xml(appPath)}</string><string>--args</string><string>--login-start</string></array>
<key>RunAtLoad</key><true/><key>LimitLoadToSessionType</key><string>Aqua</string></dict></plist>\n`;
}
function publicTelemetry(probe, battery, now = Date.now()) {
  return { at: now, clientOpen: probe?.hostAlive === true, battery,
    cpuTemp: null, gpuTemp: null, gpuLoad: null, vramTotal: null, vramUsed: null,
    platform: 'darwin', sensors: 'CPU、内存、电池；Apple Silicon 温度和 GPU 传感器暂不支持' };
}
module.exports = { parseBattery, loginPlist, publicTelemetry };
