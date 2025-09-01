// In frontend/src/main.js
// --- NEW: PWA Service Worker Registration ---
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/src/service-worker.js')
      .then(registration => {
        console.log('Service Worker registered with scope:', registration.scope);
      })
      .catch(err => {
        console.error('Service Worker registration failed:', err);
      });
  });
}
import './main.css';
// Note: We will delete ChatPane.css and ChatPane.js later if they are not used.

import { App } from './App.js';

const rootElement = document.getElementById('root');

// --- THE DEFINITIVE FIX for the Vite double-load/double-call bug ---
// This check ensures that our application is only initialized ONCE.
if (rootElement && !rootElement.hasChildNodes()) {
  
  // 1. Dynamically create the application's entire HTML structure inside the #root div.
  // This provides a clean, predictable DOM for our App class to work with.
  rootElement.innerHTML = `<div id="app">
     <button id="navigator-toggle-btn">
      <div class="icon-hamburger">
        <span></span>
        <span></span>
        <span></span>
      </div>
    </button>
    <div id="navigator-drawer"></div>

    <div id="main-container">
      <div id="editor-pane"></div>
    </div>

    <div id="assistant-drawer" class="right-drawer"></div>
    <div id="notebook-drawer" class="right-drawer"></div>

    <div id="app-controls">
      <div id="top-right-controls">
        <!-- REVISED: Assistant toggle uses the new, consistent structure -->
        <button id="assistant-toggle-btn" class="app-control-btn" title="Toggle AI Assistant">
          <div class="icon-spark">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </button>
        <!-- REVISED: Notebook toggle uses the new, consistent structure -->
        <button id="notebook-toggle-btn" class="app-control-btn" title="Toggle Notebook">
          <div class="icon-pages">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </button>
      </div>
      <div id="bottom-right-controls">
       <button id="settings-toggle-btn" class="app-control-btn" title="Settings">
  <div class="icon-gear" aria-hidden="true">
    <!-- center hub -->
    <span class="gear-center"></span>
    <!-- teeth: horizontal + vertical -->
    <span class="tooth h"></span>
    <span class="tooth v"></span>
  </div>
</button>
      </div>
    </div>
    <!-- --- END OF NEW --- -->
    <!-- Floating UI Elements -->
    <div id="command-palette-container" class="hidden">
      <div id="command-palette">
        <div id="cp-context-indicator" class="hidden">&#x2713;</div>
        <form id="cp-form">
          <div id="cp-tab-bar">
            <button class="cp-tab-btn active" data-tab="analyze" type="button">[  Analyze  ]</button>
            <button class="cp-tab-btn" data-tab="rewrite" type="button">[  Rewrite  ]</button>
          </div>
          <div id="cp-content-area">
            <div class="cp-tab-panel active" data-panel="analyze"></div>
            <div class="cp-tab-panel" data-panel="rewrite"></div>
          </div>
          <button type="submit" style="display: none;"></button>
        </form>
      </div>
    </div>
    
    <div id="settings-palette-container" class="hidden">
      <div id="settings-palette">
        <div id="settings-header">
          <h2>Settings</h2>
          <button id="settings-close-btn" title="Close Settings">&times;</button>
        </div>
        <div id="settings-content">
          <div class="settings-section">
            <h3>API Configuration</h3>
            <!-- NEW: The LLM Provider Dropdown -->
            <div class="setting-item">
              <label for="setting-provider">AI Provider</label>
              <select id="setting-provider">
                <option value="google">Google Gemini</option>
                <!-- <option value="anthropic" disabled>Anthropic Claude (Coming Soon)</option> -->
              </select>
            </div>
            <div class="setting-item">
              <label for="setting-api-key">Google Gemini API Key</label>
              <input type="password" id="setting-api-key" placeholder="Enter your API key here">
              <small>Your key is saved securely in your browser's local storage.</small>
            </div>
            <div class="setting-item">
              <label for="setting-model-name">AI Model</label>
              <select id="setting-model-name">
                <option value="gemini-2.5-flash-lite">gemini-2.5-flash-lite(Recommended)</option>
                <option value="gemini-1.0-pro">Gemini 1.0 Pro</option>
              </select>
            </div>
          </div>
          <div class="settings-section">
  <h3>Data Management</h3>
  
  <!-- Local Backup Section -->
  <div class="setting-item-full">
    <label class="setting-label">Local Backup</label>
    <p class="setting-description">Save a complete backup of all your data to a single file on your computer, or restore from a backup file.</p>
    <div class="data-actions">
      <button id="settings-export-btn" class="settings-action-btn">
        <div class="icon-download"></div> <!-- We can reuse the export icon style -->
        Export to File
      </button>
      <button id="settings-import-btn" class="settings-action-btn">
        <div class="icon-upload"></div> <!-- We can reuse the export icon style -->
        Import from File
      </button>
    </div>
  </div>

  <!-- Cloud Sync Section -->
 <div class="setting-item-full">
    <label class="setting-label">Cloud Sync</label>
    <p class="setting-description">Connect to a cloud service to back up and sync your data. Your data is only ever stored in your own cloud account.</p>
    <div class="data-actions">
      <!-- Use the correct IDs: upload and download -->
      <button id="settings-gdrive-upload-btn" class="settings-action-btn">
        <div class="icon-upload"></div>
        Upload to Google Drive
      </button>
      <button id="settings-gdrive-download-btn" class="settings-action-btn">
        <div class="icon-download"></div>
        Download from Google Drive
      </button>
    </div>
  </div>

  <!-- Document Export Section -->
  <div class="setting-item-full">
    <label class="setting-label">Export Single Document</label>
    <p class="setting-description">Export the content of a single document to a specific format like LaTeX or DOCX.</p>
    <div class="data-actions-export">
      <select id="settings-export-doc-select"></select>
      <button id="settings-export-latex-btn" class="settings-action-btn">
        <span class="export-format-tag">.tex</span>
        Export LaTeX
      </button>
      <button id="settings-export-docx-btn" class="settings-action-btn" disabled>
        <div class="icon-file-doc"></div>
        Export .docx
      </button>
    </div>
  </div>

</div>
          <div class="settings-section">
            <h3>Appearance</h3>
            <div class="setting-item">
              <label for="setting-theme">Theme</label>
              <select id="setting-theme">
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </div>
            <div class="setting-item">
              <label for="setting-font-family">Editor Font</label>
              <select id="setting-font-family">
                <option value="Georgia, serif">Serif (Default)</option>
                <option value="-apple-system, sans-serif">Sans-Serif</option>
                <option value="monospace">Monospace</option>
              </select>
            </div>
            <div class="setting-item">
              <label for="setting-font-size">Editor Font Size (px)</label>
              <input type="number" id="setting-font-size" min="12" max="24" step="1">
            </div>
          </div>
        </div>
        <div id="settings-footer">
          <button id="settings-save-btn">Save Settings</button>
        </div>
      </div>
    </div>

    <div id="modal-input-container" class="hidden">
      <div id="modal-input-box">
        <h3 id="modal-title">Create New</h3>
        <input type="text" id="modal-input" placeholder="Enter title...">
      </div>
    </div>
     <!-- NEW: The Confirmation Modal -->
    <div id="confirmation-modal-container" class="hidden">
      <div id="confirmation-modal-box">
        <h3 id="confirmation-title">Are you sure?</h3>
        <p id="confirmation-message">This action cannot be undone.</p>
        <div id="confirmation-actions">
          <button id="confirm-btn-cancel">Cancel</button>
          <button id="confirm-btn-confirm">Confirm</button>
        </div>
      </div>
    </div>
    
    <div id="status-indicator-container"></div>
  </div>
  <input type="file" id="import-file-input" style="display: none;" accept=".json,application/json" />`;

  // 2. Now that the DOM is guaranteed to be ready and empty, create the App instance.
  new App();

} else {
  // This message will appear in the browser console if Vite attempts to run the script a second time.
  console.warn("Vite double-load detected. Preventing second App initialization. This is normal in dev mode.");
}