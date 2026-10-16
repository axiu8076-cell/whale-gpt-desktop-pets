const { app, BrowserWindow, ipcMain, safeStorage, dialog } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn, execFile } = require('node:child_process');
const { createInterface } = require('node:readline');
const { pathToFileURL } = require('node:url');
const { parseBattery, loginPlist, publicTelemetry } = require('./platform.cjs');
const data = process.env.WHALE_HOME;
const root = path.resolve(__dirname, '../..');
const settingsFile = path.join(data, 'mac-settings.json');
const keyFile = path.join(data, 'api-key.encrypted');
const loginFile = path.join(os.homedir(), 'Library/LaunchAgents/io.github.axiu8076.whale.login.plist');
const testMode = !!process.env.WHALE_MAC_TEST_HOME;
const installedApp = () => {
  const location = path.resolve(process.execPath, '../../..');
  return ['/Applications', path.join(os.homedir(), 'Applications')].includes(path.dirname(location)) && location.endsWith('.app');
};
let settings, settingsWindow, firstRun, writeJson, ConfigStore;
let probeProcess, timer, hostState = { hostAlive: false }, hostAt = 0, battery = { present: false }, closing = false, lastProbeStart = 0;
let control, keyError = '';
const read = (file, fallback) => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; } };
function cleanEnv() {
  const env = { ...process.env };
  for (const key of Object.keys(env)) if (/key|token|secret|password/i.test(key)) delete env[key];
  return env;
}
async function configureConnection() {
  const store = new ConfigStore({ dataDir: data });
  const config = store.prepare({ monitorSessions: settings.clientIntegration,
    connectionMode: 'fixed', selectedConnection: 'deepseek-official', connections: [{
      id: 'deepseek-official', name: 'DeepSeek 官方 API', baseUrl: 'https://api.deepseek.com',
      keyEnv: 'DEEPSEEK_WHALE_API_KEY', balance: { adapter: process.env.DEEPSEEK_WHALE_API_KEY ? 'deepseek' : 'none', mapping: { currency: 'CNY', confirmed: true } }
    }] });
  writeJson(path.join(data, 'api-settings.json'), config);
}
async function initialize() {
  ({ writeJson } = await import(pathToFileURL(path.join(root, 'runtime/paths.mjs'))));
  ({ ConfigStore } = await import(pathToFileURL(path.join(root, 'runtime/config.mjs'))));
  firstRun = !fs.existsSync(settingsFile);
  settings = { clientIntegration: false, startup: false, ...read(settingsFile, {}) };
  process.env.WHALE_CLIENT_ACTIVITY = settings.clientIntegration ? '1' : '0';
  if (fs.existsSync(keyFile)) {
    try {
      if (!safeStorage.isEncryptionAvailable()) throw new Error('unavailable');
      process.env.DEEPSEEK_WHALE_API_KEY = safeStorage.decryptString(fs.readFileSync(keyFile));
    } catch { keyError = '钥匙串暂时不能解密已保存的 Key。可先使用动作，稍后重新填写 Key。'; }
  }
  if (firstRun || !fs.existsSync(path.join(data, 'api-settings.json'))) await configureConnection();
  const follow = read(path.join(data, 'follow-config.json'), {});
  writeJson(path.join(data, 'follow-config.json'), { ...follow, enabled: true, mode: follow.mode || 'standalone', platform: 'darwin', launchMode: 'macos-standalone-app' });
  if (firstRun) writeJson(path.join(data, 'companion-settings.json'), { temperature: false, desktopDelete: false });
  writeJson(settingsFile, settings);
  ipcMain.handle('whale-mac-settings-read', event => {
    if (!accepts(event)) return null;
    return { ...settings, hasKey: fs.existsSync(keyFile), keyError, startupAvailable: !testMode && installedApp() };
  });
  ipcMain.handle('whale-mac-settings-save', async (event, value) => {
    if (!accepts(event)) return { ok: false };
    try {
      if (typeof value?.clientIntegration !== 'boolean' || typeof value?.startup !== 'boolean' || typeof value?.key !== 'string' || typeof value?.clearKey !== 'boolean') throw new Error('设置格式无效');
      const key = value.key.trim();
      if (key && (key.length > 1024 || /\s/.test(key))) throw new Error('Key 格式无效');
      const appPath = path.resolve(process.execPath, '../../..');
      if (value.startup && (testMode || !installedApp())) throw new Error('请先把鲸鲸.app 放进「应用程序」，再启用登录启动。');
      // Fail closed: never write a plaintext key when the Keychain is locked.
      if (key) {
        if (!safeStorage.isEncryptionAvailable()) throw new Error('系统钥匙串暂不可用，请解锁登录钥匙串后重试。');
        const encrypted = safeStorage.encryptString(key);
        if (safeStorage.decryptString(encrypted) !== key) throw new Error('钥匙串加密校验失败');
        fs.writeFileSync(keyFile, encrypted, { mode: 0o600 });
        process.env.DEEPSEEK_WHALE_API_KEY = key;
      } else if (value.clearKey) { fs.rmSync(keyFile, { force: true }); delete process.env.DEEPSEEK_WHALE_API_KEY; }
      settings = { clientIntegration: value.clientIntegration, startup: value.startup };
      if (!testMode) {
        if (settings.startup) { fs.mkdirSync(path.dirname(loginFile), { recursive: true }); fs.writeFileSync(loginFile, loginPlist(appPath), { mode: 0o600 }); }
        else fs.rmSync(loginFile, { force: true });
      }
      writeJson(settingsFile, settings);
      await configureConnection();
      // Restart workers to drop a revoked task-reading permission immediately.
      app.relaunch(); app.quit();
      return { ok: true };
    } catch (error) { return { ok: false, error: String(error.message) }; }
  });
}
function accepts(event) { return settingsWindow && !settingsWindow.isDestroyed() && event.sender === settingsWindow.webContents && event.senderFrame === settingsWindow.webContents.mainFrame; }
async function openSettings() {
  if (settingsWindow && !settingsWindow.isDestroyed()) { settingsWindow.show(); settingsWindow.focus(); return; }
  settingsWindow = new BrowserWindow({ width: 540, height: 590, title: '鲸鲸 · 连接与启动设置', resizable: false, show: false,
    webPreferences: { preload: path.join(__dirname, 'settings-preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  const own = settingsWindow;
  own.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  own.webContents.on('will-navigate', event => event.preventDefault());
  own.on('closed', () => { if (settingsWindow === own) settingsWindow = null; });
  await own.loadFile(path.join(__dirname, 'settings.html'));
  own.show(); own.focus();
}
function startProbe() {
  if (probeProcess || closing || Date.now() - lastProbeStart < 5000) return;
  lastProbeStart = Date.now();
  const executable = path.join(root, 'bin/window-probe');
  const child = spawn(executable, ['--interval-ms', '250'], { env: cleanEnv(), stdio: ['ignore', 'pipe', 'ignore'] });
  probeProcess = child;
  createInterface({ input: child.stdout }).on('line', line => {
    if (line.length > 65536) return;
    try {
      const value = JSON.parse(line);
      if (typeof value.hostAlive !== 'boolean') return;
      hostState = value; hostAt = Date.now();
      // The Electron host owns standalone geometry; the probe only follows in follow mode.
      const mode = read(path.join(data, 'follow-config.json'), {}).mode;
      void control.setHost(mode === 'standalone' ? { ...value, attached: false, nativeFollowing: false } : value);
    } catch {}
  });
  const clear = () => { if (probeProcess === child) probeProcess = null; };
  child.once('error', clear); child.once('exit', clear);
}
function poll() {
  if (closing) return;
  startProbe();
  const fresh = Date.now() - hostAt < 5000;
  writeJson(path.join(data, 'macos-telemetry.json'), publicTelemetry(fresh ? hostState : null, battery));
  if (!fresh) void control.setHost({ hostAlive: false, visible: false, attached: false, fullscreen: false });
  execFile('/usr/bin/pmset', ['-g', 'batt'], { timeout: 2500, maxBuffer: 8192, env: cleanEnv() }, (error, stdout) => {
    battery = error ? { present: false } : parseBattery(stdout);
  });
}
async function attach(value) {
  control = value; poll(); timer = setInterval(poll, 2000);
  const cleanup = () => { closing = true; clearInterval(timer); probeProcess?.kill(); };
  app.once('before-quit', cleanup);
  app.on('activate', () => { control.show(); void control.panel.open(); });
  app.on('second-instance', () => { control.show(); void control.panel.open(); });
  if (firstRun && !testMode) await openSettings();
  else if (!process.argv.includes('--login-start')) await control.panel.open();
}
module.exports = { initialize, attach, openSettings };
