const { app, BrowserWindow, Menu, session } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1500,
    height: 950,
    backgroundColor: '#1a1a1a',
    minWidth: 900,
    minHeight: 600,
    title: 'FL Clone',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webSecurity: true,
      backgroundThrottling: false
    }
  });
  win.loadFile(path.join(__dirname, 'index.html'));
  win.setMenuBarVisibility(false);
}

app.whenReady().then(() => {
  // Allow audio-only capture for the local FL Clone UI. Do not grant media
  // permissions to arbitrary remote pages or enable Node access in the renderer.
  const appSession = session.defaultSession;
  appSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
    let appOwned = false;
    try { appOwned = !!webContents && webContents.getURL().startsWith('file://'); } catch (e) {}
    const mediaTypes = details && Array.isArray(details.mediaTypes) ? details.mediaTypes : null;
    const audioOnly = !mediaTypes || (mediaTypes.includes('audio') && !mediaTypes.includes('video'));
    callback(appOwned && permission === 'media' && audioOnly);
  });
  appSession.setPermissionCheckHandler((webContents, permission, requestingOrigin, details) => {
    let appOwned = false;
    try { appOwned = !!webContents && webContents.getURL().startsWith('file://'); } catch (e) {}
    const mediaTypes = details && Array.isArray(details.mediaTypes) ? details.mediaTypes : null;
    const audioOnly = !mediaTypes || (mediaTypes.includes('audio') && !mediaTypes.includes('video'));
    return appOwned && permission === 'media' && audioOnly;
  });
  Menu.setApplicationMenu(null);
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});