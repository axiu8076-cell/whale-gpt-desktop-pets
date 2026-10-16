// A regular, taskbar-visible window keeps the controls separate from the
// transparent, shaped desktop pet surface.
function createCompanionPanel({ BrowserWindow, screen, ipcMain, preload, icon }) {
  let window = null, ready = false, opening = null, error = null, readyResolve = null;
  const accepts = event => window && !window.isDestroyed() && event.sender === window.webContents && event.senderFrame === window.webContents.mainFrame;
  ipcMain.on('whale-panel-ready', event => { if (accepts(event)) { ready = true; readyResolve?.(); } });
  ipcMain.on('whale-panel-minimize', event => { if (accepts(event)) window.minimize(); });
  function bringForward() {
    if (window.isMinimized()) window.restore();
    window.show(); window.moveTop(); window.focus();
    window.webContents.send('whale-panel-open');
  }
  async function open() {
    if (opening) { await opening; bringForward(); return snapshot(); }
    if (window && !window.isDestroyed() && ready) { bringForward(); return snapshot(); }
    opening = (async () => {
      const area = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
      const width = Math.min(980, area.width), height = Math.min(820, area.height);
      ready = false; error = null;
      window = new BrowserWindow({ width, height, x: area.x + Math.round((area.width-width)/2), y: area.y + Math.round((area.height-height)/2), minWidth: Math.min(560,width), minHeight: Math.min(420,height), title: '双宠操作台 · 鲸鲸与 GPT 娘', icon, show: false, autoHideMenuBar: true, backgroundColor: '#f4f8ff', webPreferences: { preload, contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false } });
      const current = window;
      current.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
      current.webContents.on('will-navigate', (event,url) => { if (url !== 'whale://widget/companion-panel.html') event.preventDefault(); });
      current.on('closed', () => { if (window === current) { window = null; ready = false; } });
      current.webContents.on('render-process-gone', () => { error = '操作台页面已退出，请重新打开'; ready = false; current.destroy(); });
      let timeout;
      const rendered = new Promise((resolve,reject) => { readyResolve = resolve; timeout = setTimeout(() => reject(new Error('操作台页面加载超时')),12000); });
      // Observe rejection immediately even if navigation fails first.
      rendered.catch(() => {});
      try {
        await current.loadURL('whale://widget/companion-panel.html');
        await rendered;
        bringForward();
      } catch (e) {
        error = '操作台未能完成加载，请重试';
        if (!current.isDestroyed()) current.destroy();
        throw e;
      } finally { clearTimeout(timeout); readyResolve = null; }
    })();
    try { await opening; return snapshot(); } finally { opening = null; }
  }
  function snapshot() { return { ready, visible: !!window?.isVisible(), focused: !!window?.isFocused(), minimized: !!window?.isMinimized(), error }; }
  return { open, snapshot, dispose() { if (window && !window.isDestroyed()) window.destroy(); } };
}
module.exports = { createCompanionPanel };
