//frontend/src/components/SettingsPalette.js
import './SettingsPalette.css';

// Define the default settings as a constant
const DEFAULT_SETTINGS = {
    provider: 'google',
    apiKey: '',
    modelName: 'gemini-2.5-flash-lite',
    theme: 'light',
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
        // The constructor ONLY gets the main container element.
        // It does not try to find any children yet.
        this.containerEl = document.getElementById('settings-palette-container');
    }

    // --- NEW: All setup logic is moved here ---
    initialize() {
        // Now that we know the DOM is ready, we can safely query for child elements.
        this.closeBtn = document.getElementById('settings-close-btn');
        this.saveBtn = document.getElementById('settings-save-btn');
        
        // API & Appearance
        this.providerSelect = document.getElementById('setting-provider');
        this.apiKeyInput = document.getElementById('setting-api-key');
        this.modelNameSelect = document.getElementById('setting-model-name');
        this.themeSelect = document.getElementById('setting-theme');
        this.fontFamilySelect = document.getElementById('setting-font-family');
        this.fontSizeInput = document.getElementById('setting-font-size');

        // Data Management
        this.exportBtn = document.getElementById('settings-export-btn');
        this.importBtn = document.getElementById('settings-import-btn');
        this.exportDocSelect = document.getElementById('settings-export-doc-select');
        this.exportLatexBtn = document.getElementById('settings-export-latex-btn');
        this.exportDocxBtn = document.getElementById('settings-export-docx-btn');
        this.gdriveUploadBtn = document.getElementById('settings-gdrive-upload-btn');
        this.gdriveDownloadBtn = document.getElementById('settings-gdrive-download-btn');
        
        this.setupEventListeners();
        this.applyAllSettings();
    }
    
    setupEventListeners() {
        this.closeBtn.addEventListener('click', () => this.hide());
        this.saveBtn.addEventListener('click', () => this.saveAndApply());
        this.containerEl.addEventListener('click', (e) => { if (e.target === this.containerEl) this.hide(); });
        this.themeSelect.addEventListener('change', () => this.applyLiveTheme());

        this.exportBtn.addEventListener('click', () => this.app.syncService.exportToLocalFile());
        this.importBtn.addEventListener('click', () => {
            this.hide();
            this.app.syncService.importFromLocalFile();
        });
        
        this.exportLatexBtn.addEventListener('click', () => {
            const selectedFilename = this.exportDocSelect.value;
            if (selectedFilename) this.app.exportBookAsLatex(selectedFilename);
        });
        this.exportDocxBtn.addEventListener('click', () => {
            const selectedFilename = this.exportDocSelect.value;
            if (selectedFilename) this.app.exportBookAsDocx(selectedFilename);
        });

        this.gdriveUploadBtn.addEventListener('click', () => this.app.syncService.uploadToGoogleDrive());
        this.gdriveDownloadBtn.addEventListener('click', () => this.app.syncService.downloadFromGoogleDrive());
    }

    show() {
        this.loadSettings();
        this.populateDocumentExportList();
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
        document.body.classList.toggle('theme-dark', theme === 'dark');
        this.themeSelect.value = theme;
    }

    applyEditorFont(fontFamily, fontSize) {
        document.documentElement.style.setProperty('--editor-font-family', fontFamily);
        document.documentElement.style.setProperty('--editor-font-size', `${fontSize}px`);
    }

    applyLiveTheme() {
        this.applyTheme(this.themeSelect.value);
    }

}