const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const url = require('url');
const { OAuth2Client } = require('google-auth-library');
const log = require('electron-log');
const { default: Store } = require('electron-store');

const store = new Store();
let oAuth2Client;

const CREDENTIALS_PATH = path.join(__dirname, 'credentials.json');

function initializeAuthClient() {
  try {
    const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH));
    const { client_id, client_secret, redirect_uris } = credentials.installed;
    oAuth2Client = new OAuth2Client(client_id, client_secret, redirect_uris[0]);

    const tokens = store.get('google-oauth-tokens');
    if (tokens) {
      log.info('Found stored tokens. Attempting to authenticate.');
      oAuth2Client.setCredentials(tokens);
    }
  } catch (error) {
    log.error('Failed to initialize auth client:', error);
  }
}

async function signInWithGoogle() {
  const { default: open } = await import('open');

  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      try {
        const query = url.parse(req.url, true).query;
        if (!query.code && !query.error) {
          res.end('Request ignored. You can close this tab.');
          return;
        }
        if (query.error) {
          throw new Error(`Google responded with an error: ${query.error}`);
        }
        const code = query.code;

        res.end('<h1>Authentication successful!</h1><p>You can now close this tab.</p>');
        server.close();

        const { tokens } = await server.localOAuthClient.getToken(code);
        server.localOAuthClient.setCredentials(tokens);

        store.set('google-oauth-tokens', tokens);
        log.info('Google Sign-In successful, tokens have been stored.');

        const mainWindow = BrowserWindow.getAllWindows()[0];
        if (mainWindow) {
          mainWindow.webContents.send('google-signin-token', tokens);
        }

        resolve(true);
      } catch (e) {
        log.error('Error getting OAuth token:', e);
        reject(e);
      }
    }).listen(0, () => {
      const { port } = server.address();
      const redirectUri = `http://localhost:${port}`;
      log.info(`Temporary auth server listening on ${redirectUri}`);

      const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH));
      const { client_id, client_secret } = credentials.installed;

      server.localOAuthClient = new OAuth2Client(client_id, client_secret, redirectUri);

      const authUrl = server.localOAuthClient.generateAuthUrl({
        access_type: 'offline',
        scope: [
          'https://www.googleapis.com/auth/drive.file',
          'https://www.googleapis.com/auth/userinfo.profile'
        ],
      });
      open(authUrl);
    });
  });
}

ipcMain.on('log-message', (event, { level, message }) => {
  if (log[level]) {
    log[level](`[Renderer] ${message}`);
  } else {
    log.info(`[Renderer] ${message}`);
  }
});

ipcMain.handle('google-signout', () => {
  log.info('Signing out and deleting stored tokens.');
  store.delete('google-oauth-tokens');
  oAuth2Client = null;
  initializeAuthClient();
  return true;
});

ipcMain.handle('google-signin', signInWithGoogle);

ipcMain.handle('get-initial-auth-token', () => {
  if (oAuth2Client && oAuth2Client.credentials.access_token) {
    log.info('Providing initial auth token to renderer.');
    return oAuth2Client.credentials;
  }
  log.info('No initial auth token found.');
  return null;
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'Editor App',
    backgroundColor: '#FFFFF0',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      spellcheck: true,
    },
  });

  win.setAutoHideMenuBar(true);
  //  Menu.setApplicationMenu(null);
  win.webContents.session.setSpellCheckerLanguages(['en-GB']);

  if (app.isPackaged) {
    win.loadFile(path.join(__dirname, 'dist', 'index.html'));
  } else {
    const viteDevServerUrl = 'http://localhost:5173'; // Make sure this is your Vite dev server URL
    const loadVite = () => {
      win.loadURL(viteDevServerUrl).catch(() => {
        console.log('Vite server not ready, retrying in 200ms...');
        setTimeout(loadVite, 200);
      });
    };

    loadVite();

    win.webContents.openDevTools();
  }
}

app.whenReady().then(() => {
  initializeAuthClient();
  createWindow();
});

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