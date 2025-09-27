const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    isElectron: true,
    signInWithGoogle: () => ipcRenderer.invoke('google-signin'),
    signOut: () => ipcRenderer.invoke('google-signout'),
    getInitialToken: () => ipcRenderer.invoke('get-initial-auth-token'), 
    onGoogleSignInToken: (callback) => ipcRenderer.on('google-signin-token', (_event, tokens) => callback(tokens)),
    log: (level, message) => ipcRenderer.send('log-message', { level, message }),
});