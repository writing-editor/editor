const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');

const VITE_DEV_SERVER_URL = 'http://localhost:5173';

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'Editor App',
    backgroundColor: '#FFFFF0',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  win.setAutoHideMenuBar(true);
  //  Menu.setApplicationMenu(null);

  if (app.isPackaged) {
    win.loadFile(path.join(__dirname, 'dist', 'index.html'));
  } else {
    const loadVite = () => {
      win.loadURL(VITE_DEV_SERVER_URL).catch(() => {
        console.log('Vite server not ready, retrying in 200ms...');
        setTimeout(loadVite, 200);
      });
    };

    loadVite();

    win.webContents.openDevTools();
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});