// electron/main.js
const path = require('path');
const { activateOrValidate, checkUpdates, enforceOrAskUpdate } = require('./license');
const { dialog, app, BrowserWindow, ipcMain } = require('electron');


function createWindow() {
  const win = new BrowserWindow({
    width: 1580,
    height: 1000,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  win.once('ready-to-show', () => win.show());
  const devUrl = process.env.VITE_DEV_SERVER_URL;

  if (devUrl) {
    win.loadURL(devUrl);
  } else {
    win.loadFile(path.join(__dirname, "..", "renderer", "dist", "index.html"));
  }
}
app.whenReady().then(async () => {
  ipcMain.handle('kc:getVersion', () => app.getVersion());
  try {
    return await boot();
  } catch {
    return app.quit();
  }
});

async function boot() {
  // 1) лицензия
  const lic = await activateOrValidate({ org: 'DefaultOrg' });
  if (!lic.ok) {
    dialog.showMessageBoxSync({ type: 'info', buttons: ['OK'], message: 'Нужно обновить лицензию' });
    app.quit();
    return;
  }

  // 2) обновление
  const upd = await checkUpdates(app.getVersion());
  const goOn = await enforceOrAskUpdate(upd);
  if (!goOn) return;              // <-- ВАЖНО: не закрываем сами, это сделает функция обновления

  // 3) UI
  createWindow();
}

// вместо прежнего app.whenReady(...):
app.whenReady().then(() => { boot().catch(() => app.quit()); });


app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
