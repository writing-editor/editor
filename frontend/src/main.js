import './main.css';
import { App } from './App.js';

const rootElement = document.getElementById('root');

if (rootElement && !rootElement.hasChildNodes()) {

  // Dynamically create the application's entire HTML structure.

  rootElement.innerHTML =
    `<div id="app">
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
      <div id="search-drawer" class="right-drawer"></div>

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
            <svg class="settings-icon" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="3"></circle>
              <path
                d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z">
              </path>
            </svg>
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
              <button class="cp-tab-btn active" data-tab="analyze" type="button">[ Analyze ]</button>
              <button class="cp-tab-btn" data-tab="rewrite" type="button">[ Rewrite ]</button>
            </div>
            <div id="cp-content-area">
              <div class="cp-tab-panel active" data-panel="analyze"></div>
              <div class="cp-tab-panel" data-panel="rewrite"></div>
            </div>
            <button type="submit" style="display: none;"></button>
          </form>
        </div>
      </div>

      <div id="settings-palette-container" class="hidden"></div>


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
      <div id="confirmation-modal-container" class="hidden">...</div>

      <!-- NEW DATA MANAGER MODAL -->
      <div id="data-manager-modal-container" class="hidden"></div>
      <div id="status-indicator-container"></div>
    </div>
    <input type="file" id="import-file-input" style="display: none;" accept=".json,application/json" />`;

  setTimeout(() => {
    // Now that the DOM is guaranteed to be ready, create the App instance.
    new App();
  }, 0);

} else {
  console.warn("Vite double-load detected. Preventing second App initialization.");
}