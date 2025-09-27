import './main.css';
import { App } from './App.js';
import { loadHTML } from './utils/htmlLoader.js';

function setupElectronLogging() {
    if (window.electronAPI?.isElectron) {
        console.log = (...args) => window.electronAPI.log('info', args.join(' '));
        console.warn = (...args) => window.electronAPI.log('warn', args.join(' '));
        console.error = (...args) => window.electronAPI.log('error', args.join(' '));
        console.info = (...args) => window.electronAPI.log('info', args.join(' '));
        console.debug = (...args) => window.electronAPI.log('debug', args.join(' '));
        console.log("Console logging is now piped to the Electron main process.");
    }
}

const rootElement = document.getElementById('root');

async function initializeUI() {
    setupElectronLogging();
    if (rootElement && !rootElement.hasChildNodes()) {

        rootElement.innerHTML = await loadHTML('html-templates/main-layout.html');

        setTimeout(() => { new App(); }, 0);

    } else {
        console.warn("Vite double-load detected. Preventing second App initialization.");
    }
}

initializeUI();