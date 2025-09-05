import './SettingsPalette.css';
import { loadHTML } from '../utils/htmlLoader.js';

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

  constructor(controller) {
    this.controller = controller;
    this.containerEl = document.getElementById('settings-palette-container');
    this.activeTab = 'appearance';
  }

  async renderShell() {
      this.containerEl.innerHTML = await loadHTML('html-templates/settings-palette.html');
      this.contentArea = document.getElementById('settings-content');
  }
  
  renderPanels() {
      if (!this.contentArea) return;
      this.contentArea.innerHTML = `
        <div class="settings-tab-panel active" data-panel="appearance">${this._renderAppearancePanel()}</div>
        <div class="settings-tab-panel" data-panel="ai-settings">${this._renderAiPanel()}</div>
        <div class="settings-tab-panel" data-panel="data-management">${this._renderDataPanel()}</div>
      `;
  }

  initialize() {
    this.saveBtn = document.getElementById('settings-save-btn');
    this.tabBar = this.containerEl.querySelector('.settings-tab-bar');
    this.tabButtons = this.containerEl.querySelectorAll('.settings-tab-btn');
    this.tabPanels = this.containerEl.querySelectorAll('.settings-tab-panel');
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
    this.manageCloudBtn = document.getElementById('settings-gdrive-manage-btn');
    this.disconnectBtn = document.getElementById('settings-disconnect-btn');

    this.setupEventListeners();
    this.applyAllSettings();
  }

  setupEventListeners() {
    this.saveBtn.addEventListener('click', () => this.saveAndApply());
    this.containerEl.addEventListener('click', (e) => { if (e.target === this.containerEl) this.hide(); });
    this.themeSelect.addEventListener('change', () => this.applyLiveTheme());

    this.tabBar.addEventListener('click', (e) => {
      const tabButton = e.target.closest('.settings-tab-btn');
      if (tabButton) this.setActiveTab(tabButton.dataset.tab);
    });

    this.providerSelect.addEventListener('change', () => this._onProviderChange());

    this.exportBtn.addEventListener('click', () => this.controller.exportLocal());
    this.importBtn.addEventListener('click', () => { this.hide(); this.controller.importLocal(); });
    this.exportLatexBtn.addEventListener('click', () => { if (this.exportDocSelect.value) this.controller.exportBookAsLatex(this.exportDocSelect.value); });
    this.exportDocxBtn.addEventListener('click', () => { if (this.exportDocSelect.value) this.controller.exportBookAsDocx(this.exportDocSelect.value); });
    this.manageCloudBtn.addEventListener('click', () => this.controller.showDataManager());

    this.disconnectBtn.addEventListener('click', async () => {
      this.hide();
      const isConfirmed = await this.controller.confirm(
        'Confirm Disconnect',
        'Are you sure? This will delete all local data and reload the app.'
      );
      if (isConfirmed) {
        this.controller.uninstall();
      }
    });
  }

  setActiveTab(tabName) {
    this.activeTab = tabName;
    this.tabButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tabName));
    this.tabPanels.forEach(panel => panel.classList.toggle('active', panel.dataset.panel === tabName));
  }

  async show() {
    if (!this.containerEl.hasChildNodes()) {
        await this.renderShell();
    }
    this.renderPanels();
    this.initialize(); 
    
    this.loadSettings();
    this.populateDocumentExportList();
    this.setActiveTab('appearance');
    this.containerEl.classList.remove('hidden');
  }

  hide() {
    this.containerEl.classList.add('hidden');
  }

  populateDocumentExportList() {
    const books = this.controller.getAvailableBooks(); // Needs to be added to controller
    const currentBookFilename = this.controller.getCurrentBookFilename(); // Needs to be added

    this.exportDocSelect.innerHTML = '';

    if (books && books.length > 0) {
      books.forEach(book => {
        if (book.filename === 'user-manual') return;
        const option = document.createElement('option');
        option.value = book.filename;
        option.textContent = book.title;
        if (book.filename === currentBookFilename) option.selected = true;
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

  loadSettings() {
    const settings = SettingsPalette.getSettings();
    this.providerSelect.value = settings.provider;
    this.apiKeyInput.value = settings.apiKey;
    this.modelNameSelect.value = settings.modelName;
    this.themeSelect.value = settings.theme;
    this.fontFamilySelect.value = settings.fontFamily;
    this.fontSizeInput.value = settings.fontSize;
    this._onProviderChange(); // Ensure model list is correct on load
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
    this.controller.showIndicator('Settings Saved!', { duration: 2000 });
    this.hide();
  }

  applyAllSettings() {
    const settings = SettingsPalette.getSettings();
    this.applyTheme(settings.theme);
    this.applyEditorFont(settings.fontFamily, settings.fontSize);
  }

  applyTheme(theme) {
    document.body.classList.remove(
      'theme-dark', 'theme-nord', 'theme-solarized-dark', 'theme-monokai',
      'theme-cyan-light', 'theme-lime'
    );
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

  _onProviderChange() {
    const provider = this.providerSelect.value;
    const apiKeyLabel = document.getElementById('setting-api-key-label');
    apiKeyLabel.textContent = provider === 'google' ? 'Google Gemini API Key' : 'Anthropic API Key';
    this.containerEl.querySelectorAll('.provider-option').forEach(option => {
      option.hidden = !option.classList.contains(`${provider}-option`);
    });
    const firstVisibleModel = this.modelNameSelect.querySelector(`.${provider}-option:not([hidden])`);
    if (firstVisibleModel) {
      this.modelNameSelect.value = firstVisibleModel.value;
    }
  }

  _renderAppearancePanel() {
    return `
      <div class="settings-section">
        <div class="setting-item">
          <label for="setting-theme">Theme</label>
          <select id="setting-theme">
            <option value="light">Light</option>
            <option value="lime">Lime</option>
            <option value="dark">Dark (Blue Tint)</option>
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
            <option value="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif">Sans-Serif</option>
            <option value="monospace">Monospace</option>
          </select>
        </div>
        <div class="setting-item">
          <label for="setting-font-size">Editor Font Size (px)</label>
          <input type="number" id="setting-font-size" min="12" max="24" step="1">
        </div>
      </div>
    `;
  }

  _renderAiPanel() {
    const settings = SettingsPalette.getSettings();
    return `
      <div class="settings-section">
        <div class="setting-item">
          <label for="setting-provider">AI Provider</label>
          <select id="setting-provider">
            <option value="google">Google Gemini</option>
            <option value="anthropic">Anthropic Claude</option>
          </select>
        </div>
        <div class="setting-item">
          <label id="setting-api-key-label" for="setting-api-key">API Key</label>
          <input type="password" id="setting-api-key" placeholder="Enter your API key here">
        </div>
        <div class="setting-item">
          <label for="setting-model-name">AI Model</label>
          <select id="setting-model-name">
            <option class="provider-option google-option" value="gemini-2.5-flash-lite">Gemini 1.5 Flash (Recommended)</option>
            <option class="provider-option google-option" value="gemini-2.5-pro">Gemini 1.5 Pro</option>
            <option class="provider-option anthropic-option" value="claude-3-haiku-20240307">Claude 3 Haiku (Fast)</option>
            <option class="provider-option anthropic-option" value="claude-3-sonnet-20240229">Claude 3 Sonnet</option>
          </select>
        </div>
      </div>
    `;
  }

  _renderDataPanel() {
    return `
      <div class="settings-section">
        <!-- Item 1: Local Backup -->
        <div class="setting-item-full">
          <label class="setting-label">Local Backup</label>
          <p class="setting-description">Save a complete backup of all documents and notes to a local file, or restore from a backup file.</p>
          <div class="data-actions">
            <button id="settings-export-btn" class="settings-action-btn" title="Export to File"><svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg></button>
            <button id="settings-import-btn" class="settings-action-btn" title="Import from File"><svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg></button>
          </div>
        </div>

        <!-- Item 2: Export Single Document -->
        <div class="setting-item-full">
          <label class="setting-label">Export Single Document</label>
          <p class="setting-description">Export the content of a single document to a specific format like LaTeX or DOCX.</p>
          <div class="data-actions-export">
            <select id="settings-export-doc-select"></select>
            <button id="settings-export-latex-btn" class="settings-action-btn" title="Export as LaTeX"><span class="export-format-tag">TEX</span></button>
            <button id="settings-export-docx-btn" class="settings-action-btn" title="Export as .docx"><svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg></button>
          </div>
        </div>
        
        <!-- NEW, RESTRUCTURED SECTION -->
        <div class="setting-item-full">
          <label class="setting-label">Account & Cloud Data</label>
          <p class="setting-description">View your synchronized files on Google Drive or perform a full reset of the application.</p>
          <div class="data-actions">
            <button id="settings-gdrive-manage-btn" class="settings-action-btn" title="Manage Cloud Files">
              <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
            </button>
            <button id="settings-disconnect-btn" class="settings-action-btn" title="Disconnect and Clear All Local Data">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none"
                stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-2 14H7L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    `;
  }
}