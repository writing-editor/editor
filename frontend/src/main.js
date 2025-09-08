import './main.css';
import { App } from './App.js';
import { loadHTML } from './utils/htmlLoader.js';

const rootElement = document.getElementById('root');

async function initializeUI() {
    if (rootElement && !rootElement.hasChildNodes()) {

        rootElement.innerHTML = await loadHTML('html-templates/main-layout.html');

        setTimeout(() => { new App(); }, 0);

    } else {
        console.warn("Vite double-load detected. Preventing second App initialization.");
    }
}

initializeUI();