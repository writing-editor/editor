//frontend/src/components/SettingsPalette.js
import './SettingsPalette.css';

// Define the default settings as a constant
const DEFAULT_SETTINGS = {
    provider: 'google',
    apiKey: '',
    modelName: 'gemini-2.5-flash-lite',
    theme: 'lime',
    fontFamily: 'Georgia, serif',
    fontSize: '18',
};

export class SettingsPalette {

    static getSettings() {
        const savedSettings = localStorage.getItem('app-settings');
        return savedSettings ? { ...DEFAULT_SETTINGS, ...JSON.parse(savedSettings) } : DEFAULT_SETTINGS;
    }

    constructor(app) {
        this.app = app;
        this.containerEl = document.getElementById('settings-palette-container');
        this.activeTab = 'appearance';
        this.render();
    }

    initialize() {
        this.closeBtn = document.getElementById('settings-close-btn');
        this.saveBtn = document.getElementById('settings-save-btn');

        // --- Tab UI ---
        this.tabBar = this.containerEl.querySelector('.settings-tab-bar');
        this.tabButtons = this.containerEl.querySelectorAll('.settings-tab-btn');
        this.tabPanels = this.containerEl.querySelectorAll('.settings-tab-panel');

        // --- All Setting Elements ---
        this.providerSelect = document.getElementById('setting-provider');
        this.apiKeyInput = document.getElementById('setting-api-key');
        this.modelNameSelect = document.getElementById('setting-model-name');
        this.themeSelect = document.getElementById('setting-theme');
        this.fontFamilySelect = document.getElementById('setting-font-family');
        this.fontSizeInput = document.getElementById('setting-font-size');
        this.exportBtn = document.getElementById('settings-export-btn');
        this.importBtn = document.getElementById('settings-import-btn');
        this.exportDocSelect = document.getElementById('settings-export-doc-select');
        this.exportLatexBtn = document.getElementById('settings-export-latex-btn');
        this.exportDocxBtn = document.getElementById('settings-export-docx-btn');
        this.gdriveUploadBtn = document.getElementById('settings-gdrive-upload-btn');
        this.gdriveDownloadBtn = document.getElementById('settings-gdrive-download-btn');
        this.manageCloudBtn = document.getElementById('settings-gdrive-manage-btn');
        this.setupEventListeners();
        this.applyAllSettings();
    }

    render() {
        this.containerEl.innerHTML = `
<div id="settings-palette">
  <!-- THE NEW, THIN HEADER -->

  <div id="settings-header">
    <div class="settings-tab-bar">
      <!-- The <i> icon tags are now removed for a cleaner look -->
      <button class="settings-tab-btn active" data-tab="appearance" title="Appearance">Appearance</button>
      <button class="settings-tab-btn" data-tab="ai-settings" title="AI Settings">AI Settings</button>
      <button class="settings-tab-btn" data-tab="data-management" title="Data Management">Data Management</button>
    </div>
    <button id="settings-save-btn" title="Save Settings">
      <i class="icon-save"></i>
      <span>Save</span>
    </button>
  </div>



  <!-- THE SCROLLABLE CONTENT AREA -->
  <div id="settings-content">
    <!-- Panel for Appearance Settings -->
    <div class="settings-tab-panel active" data-panel="appearance">
      <div class="settings-section">
        <div class="setting-item">
          <label for="setting-theme">Theme</label>
          <select id="setting-theme">
            <option value="light">Light</option>
            <option value="lime">Lime</option>
            <option value="dark">Dark</option>
            <option value="cyan-light">Cyan Light</option>
            <option value="nord">Nord</option>
            <option value="solarized-dark">Solarized Dark</option>
            <option value="monokai">Monokai</option>
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

    <!-- Panel for AI Settings -->
    <div class="settings-tab-panel" data-panel="ai-settings">
      <div class="settings-section">
        <div class="setting-item">
          <label for="setting-provider">AI Provider</label>
          <select id="setting-provider">
            <option value="google">Google Gemini</option>
          </select>
        </div>
        <div class="setting-item">
          <label for="setting-api-key">Google Gemini API Key</label>
          <input type="password" id="setting-api-key" placeholder="Enter your API key here">
        </div>
        <div class="setting-item">
          <label for="setting-model-name">AI Model</label>
          <select id="setting-model-name">
            <option value="gemini-2.5-flash-lite">gemini-2.5-flash-lite (Recommended)</option>
            <option value="gemini-1.0-pro">Gemini 1.0 Pro</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Panel for Data Management -->
    <div class="settings-tab-panel" data-panel="data-management">
      <div class="settings-section">

        <!-- Item 1: Local Backup -->
        <div class="setting-item-full">
          <label class="setting-label">Local Backup</label>
          <p class="setting-description">Save a complete backup to a file, or restore from a backup.</p>
          <div class="data-actions">
            <button id="settings-export-btn" class="settings-action-btn" title="Export to File">
              <svg viewBox="0 0 24 24">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
            </button>
            <button id="settings-import-btn" class="settings-action-btn" title="Import from File">
              <svg viewBox="0 0 24 24">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="17 8 12 3 7 8"></polyline>
                <line x1="12" y1="3" x2="12" y2="15"></line>
              </svg>
            </button>
          </div>
        </div>

        <!-- Item 2: Cloud Sync -->
        <div class="setting-item-full">
          <label class="setting-label">Cloud Sync</label>
          <p class="setting-description">Connect to Google Drive to back up and restore your data.</p>
          <div class="data-actions">
            <button id="settings-gdrive-upload-btn" class="settings-action-btn" title="Upload to Google Drive">
              <svg viewBox="0 0 24 24">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                <polyline points="15 3 21 3 21 9"></polyline>
                <line x1="10" y1="14" x2="21" y2="3"></line>
              </svg>
            </button>
            <button id="settings-gdrive-download-btn" class="settings-action-btn" title="Download from Google Drive">
              <svg viewBox="0 0 24 24">
                <path d="M8 17l-6 6l6-6"></path>
                <path d="M7 11l6.5-6.5a2.25 2.25 0 1 1 3.182 3.182L10 14"></path>
                <path d="M15 5l3 3"></path>
                <path d="M22 12a10 10 0 1 0-10 10"></path>
              </svg>
            </button>
            <button id="settings-gdrive-manage-btn" class="settings-action-btn" title="Manage Cloud Data">
        <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
    </button>
          </div>
        </div>

        <!-- Item 3: Export Single Document -->
        <div class="setting-item-full">
      <label class="setting-label">Export Single Document</label>
      <p class="setting-description">Export the content of a single document to a specific format.</p>
      <div class="data-actions-export">
        <select id="settings-export-doc-select"></select>
        <button id="settings-export-latex-btn" class="settings-action-btn" title="Export as LaTeX">
            <span class="export-format-tag">TEX</span>
        </button>
        <button id="settings-export-docx-btn" class="settings-action-btn" title="Export as .docx">
            <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
        </button>
      </div>
    </div>

      </div>
    </div>
  </div>
</div>`;
    }


    setupEventListeners() {
        this.saveBtn.addEventListener('click', () => this.saveAndApply());
        this.containerEl.addEventListener('click', (e) => { if (e.target === this.containerEl) this.hide(); });
        this.themeSelect.addEventListener('change', () => this.applyLiveTheme());

        // --- NEW: Tab Bar Click Listener ---
        this.tabBar.addEventListener('click', (e) => {
            const tabButton = e.target.closest('.settings-tab-btn');
            if (tabButton) {
                this.setActiveTab(tabButton.dataset.tab);
            }
        });

        // Data Management Listeners
        this.exportBtn.addEventListener('click', () => this.app.syncService.exportToLocalFile());
        this.importBtn.addEventListener('click', () => { this.hide(); this.app.syncService.importFromLocalFile(); });
        this.exportLatexBtn.addEventListener('click', () => { if (this.exportDocSelect.value) this.app.exportBookAsLatex(this.exportDocSelect.value); });
        this.exportDocxBtn.addEventListener('click', () => { if (this.exportDocSelect.value) this.app.exportBookAsDocx(this.exportDocSelect.value); });
        this.gdriveUploadBtn.addEventListener('click', () => this.app.syncService.uploadToGoogleDrive());
        this.gdriveDownloadBtn.addEventListener('click', () => this.app.syncService.downloadFromGoogleDrive());
        this.manageCloudBtn.addEventListener('click', () => this.app.dataManager.show());
    }

    // --- NEW: Tab Switching Logic ---
    setActiveTab(tabName) {
        this.activeTab = tabName;
        this.tabButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });
        this.tabPanels.forEach(panel => {
            panel.classList.toggle('active', panel.dataset.panel === tabName);
        });
    }

    show() {
        this.loadSettings();
        this.populateDocumentExportList();
        this.setActiveTab('appearance'); // Always reset to the first tab when opening
        this.containerEl.classList.remove('hidden');
    }

    hide() {
        this.containerEl.classList.add('hidden');
    }


    // --- Core Logic Methods ---

    getSettings() {
        return SettingsPalette.getSettings();
    }

    // --- NEW: Populate the document list for export ---
    populateDocumentExportList() {
        const books = this.app.bookService.availableBooks;
        const currentBookFilename = this.app.bookService.currentBook?.filename;

        this.exportDocSelect.innerHTML = ''; // Clear existing options

        if (books && books.length > 0) {
            books.forEach(book => {
                // Don't include the user manual in the export list
                if (book.filename === 'user-manual') return;

                const option = document.createElement('option');
                option.value = book.filename;
                option.textContent = book.title;
                if (book.filename === currentBookFilename) {
                    option.selected = true;
                }
                this.exportDocSelect.appendChild(option);
            });
            this.exportLatexBtn.disabled = false;
            this.exportDocxBtn.disabled = false;
        } else {
            const option = document.createElement('option');
            option.textContent = 'No documents to export';
            option.disabled = true;
            this.exportDocSelect.appendChild(option);
            this.exportLatexBtn.disabled = true;
            this.exportDocxBtn.disabled = true;
        }
    }

    // --- Settings Logic (largely unchanged) ---
    loadSettings() {
        const settings = SettingsPalette.getSettings();
        this.providerSelect.value = settings.provider;
        this.apiKeyInput.value = settings.apiKey;
        this.modelNameSelect.value = settings.modelName;
        this.themeSelect.value = settings.theme;
        this.fontFamilySelect.value = settings.fontFamily;
        this.fontSizeInput.value = settings.fontSize;
    }

    saveAndApply() {
        const newSettings = {
            provider: this.providerSelect.value,
            apiKey: this.apiKeyInput.value.trim(),
            modelName: this.modelNameSelect.value,
            theme: this.themeSelect.value,
            fontFamily: this.fontFamilySelect.value,
            fontSize: this.fontSizeInput.value,
        };
        localStorage.setItem('app-settings', JSON.stringify(newSettings));
        this.applyAllSettings();
        this.app.showIndicator('Settings Saved!', { duration: 2000 });
        this.hide();
    }

    applyAllSettings() {
        const settings = SettingsPalette.getSettings();
        this.applyTheme(settings.theme);
        this.applyEditorFont(settings.fontFamily, settings.fontSize);
    }

    applyTheme(theme) {
        // Add the new theme classes to the list of themes to remove
        document.body.classList.remove(
            'theme-dark',
            'theme-nord',
            'theme-solarized-dark',
            'theme-monokai',
            'theme-cyan-light',
            'theme-lime',
            'theme-cyan'
        );

        // Add the specific theme class if it's not the default light theme.
        if (theme !== 'light') {
            document.body.classList.add(`theme-${theme}`);
        }

        if (this.themeSelect) {
            this.themeSelect.value = theme;
        }
    }

    applyEditorFont(fontFamily, fontSize) {
        document.documentElement.style.setProperty('--editor-font-family', fontFamily);
        document.documentElement.style.setProperty('--editor-font-size', `${fontSize}px`);
    }

    applyLiveTheme() {
        this.applyTheme(this.themeSelect.value);
    }

}