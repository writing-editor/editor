// frontend/src/App.js

import { Navigator } from './components/Navigator.js';
import { Editor } from './components/Editor.js';
import { CommandPalette } from './components/CommandPalette.js';
import { ModalInput } from './components/ModalInput.js';
import { AssistantPane } from './components/AssistantPane.js';
import { NotebookPane } from './components/NotebookPane.js';
import { ConfirmationModal } from './components/ConfirmationModal.js';
import { SettingsPalette } from './components/SettingsPalette.js';
import { LlmOrchestrator } from './services/LlmOrchestrator.js';
import { BookService } from './services/BookService.js';
import { StorageService } from './services/StorageService.js'; // Added import
import { AnalystAgent } from './agents/AnalystAgent.js';
import { RewriteAgent } from './agents/RewriteAgent.js';
import { FindNotesAgent } from './agents/FindNotesAgent.js';
import { SyncService } from './services/SyncService.js';
import { LatexConverter } from './utils/LatexConverter.js';
import { DocxConverter } from './utils/DocxConverter.js';
import { GoogleSyncService } from './services/GoogleSyncService.js';


let instance = null;

export class App {
  constructor() {
    if (instance) return instance;
    instance = this;
    console.log("Initializing SINGLE App instance with corrected order...");

    // ====================================================================
    //  STEP 1: INITIALIZE CORE SERVICES & AGENTS FIRST
    // ====================================================================

    

    this.storageService = new StorageService();
    // The googleSyncService only needs a small part of the controller
    const gSyncController = { 
        showIndicator: (...args) => this.showIndicator(...args),
        hideIndicator: (...args) => this.hideIndicator(...args)
    };
    this.googleSyncService = new GoogleSyncService(gSyncController);
    
    // Now, pass ALL dependencies to SyncService
    this.syncService = new SyncService(
        this.storageService, 
        {
            showIndicator: (...args) => this.showIndicator(...args),
            hideIndicator: (...args) => this.hideIndicator(...args),
            confirm: (...args) => this.confirmationModal.show(...args)
        },
        this.googleSyncService // <-- THE MISSING PIECE
    );
    this.llmOrchestrator = new LlmOrchestrator();

    // The appController is a bridge for the service to talk to the UI layer.
    // We can define it here, but it will be populated with UI component
    // references after they are created.
    const appController = {
      // We will fill these in after creating the components
      renderEditor: null,
      setEditorEditable: null,
      renderNavigator: null,
      renderAssistantPane: null,
      showIndicator: (...args) => this.showIndicator(...args),
      hideIndicator: (...args) => this.hideIndicator(...args),
      setAgentButtonsDisabled: (isDisabled) => {
        ['assistant-toggle-btn', 'notebook-toggle-btn'].forEach(id => {
          const btn = document.getElementById(id);
          if (btn) btn.disabled = isDisabled;
        });
      }
    };

    // Now, create the BookService. It is ready.
    this.bookService = new BookService(appController, this.storageService);

    // Create agents that depend on services
    this.analystAgent = new AnalystAgent(this.llmOrchestrator, this);
    this.rewriteAgent = new RewriteAgent(this.llmOrchestrator, this);
    this.findNotesAgent = new FindNotesAgent(this.llmOrchestrator, this);

    // ====================================================================
    //  STEP 2: INITIALIZE UI COMPONENTS THAT DEPEND ON SERVICES
    // ====================================================================
    this.navigator = new Navigator(this, this.bookService); // NOW this.bookService is defined!
    this.editor = new Editor(this); // Editor might need bookService soon, good practice
    this.palette = new CommandPalette(this, this.bookService, this.storageService);
    this.modalInput = new ModalInput();
    this.assistantPane = new AssistantPane(this, this.bookService);
    this.notebookPane = new NotebookPane(this, this.storageService);
    this.confirmationModal = new ConfirmationModal();
    this.settingsPalette = new SettingsPalette(this);

    // ====================================================================
    //  STEP 3: POPULATE THE APP CONTROLLER with UI references
    // ====================================================================
    appController.renderEditor = (content) => this.editor.render(content);
    appController.setEditorEditable = (isEditable) => this.editor.setEditable(isEditable);
    appController.renderNavigator = (state) => this.navigator.render(state);
    appController.renderAssistantPane = (blocks) => this.assistantPane.render(blocks);


    this.settingsPalette.initialize();

    // --- UI State Management (remains in App.js) ---
    this.activeRightDrawer = null;
    this.drawers = {
      assistant: document.getElementById('assistant-drawer'),
      notebook: document.getElementById('notebook-drawer'),
    };

    // ====================================================================
    //  STEP 4: SET UP LISTENERS AND KICK OFF THE APP
    // ====================================================================

    this.setupGlobalListeners();
    this.storageService.open().then(() => {
      console.log("Database is ready.");
      this.googleSyncService.initialize();
      this.bookService.loadInitialBook();
      this.notebookPane.initialize();
    });
  }

  // --- METHODS THAT DELEGATE TO BookService ---
  // These are now minimal and correct
  async switchBook(filename) { await this.bookService.switchBook(filename); }
  async changeView(viewId) { await this.bookService.changeView(viewId); }
  addMarginBlock(viewId, blockData) { this.bookService.addMarginBlock(viewId, blockData); }
  togglePinMarginBlock(viewId, blockId) { this.bookService.togglePinMarginBlock(viewId, blockId); }
  deleteMarginBlock(viewId, blockId) { this.bookService.deleteMarginBlock(viewId, blockId); }
  async restoreDefaultMargin() { await this.bookService.restoreDefaultMargin(); }

  // --- UI-SPECIFIC LOGIC ---
  setupGlobalListeners() {
    document.body.addEventListener('click', (e) => {
      const navToggleBtn = document.getElementById('navigator-toggle-btn');
      const assistantToggleBtn = document.getElementById('assistant-toggle-btn');
      const notebookToggleBtn = document.getElementById('notebook-toggle-btn');
      const settingsToggleBtn = document.getElementById('settings-toggle-btn');
      if (navToggleBtn.contains(e.target)) {
        this.navigator.toggle();
        document.body.classList.toggle('drawer-is-open', this.navigator.isOpen());
        return;
      }
      if (this.navigator.isOpen() && !this.navigator.drawerEl.contains(e.target)) {
        this.navigator.close();
        document.body.classList.remove('drawer-is-open');
      }
      if (assistantToggleBtn.contains(e.target)) {
        this.toggleRightDrawer('assistant');
      } else if (notebookToggleBtn.contains(e.target)) {
        this.toggleRightDrawer('notebook');
      } else if (settingsToggleBtn && settingsToggleBtn.contains(e.target)) {
        this.settingsPalette.show();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 's':
            e.preventDefault();
            this.bookService.saveCurrentView(this.editor.instance.getJSON());
            break;
          case 'k':
            e.preventDefault();
            this.palette.show();
            break;
          case 'b':
            e.preventDefault();
            this.navigator.toggle();
            document.body.classList.toggle('drawer-is-open', this.navigator.isOpen());
            break;
        }
      }
    });
  }

  toggleRightDrawer(drawerName) {
    if (this.activeRightDrawer === drawerName) { this.closeRightDrawer(); }
    else { this.openRightDrawer(drawerName); }
  }

  openRightDrawer(drawerName) {
    if (this.activeRightDrawer && this.activeRightDrawer !== drawerName) {
      this.drawers[this.activeRightDrawer].classList.remove('is-visible');
    }
    this.activeRightDrawer = drawerName;
    document.body.classList.add('right-drawer-is-open');
    this.drawers[drawerName].classList.add('is-visible');
    document.getElementById('assistant-toggle-btn').classList.toggle('is-active', drawerName === 'assistant');
    document.getElementById('notebook-toggle-btn').classList.toggle('is-active', drawerName === 'notebook');
  }

  closeRightDrawer() {
    if (!this.activeRightDrawer) return;
    document.body.classList.remove('right-drawer-is-open');
    this.drawers[this.activeRightDrawer].classList.remove('is-visible');
    this.activeRightDrawer = null;
    document.getElementById('assistant-toggle-btn').classList.remove('is-active');
    document.getElementById('notebook-toggle-btn').classList.remove('is-active');
  }

  getContextPayload() {
    const selection = this.editor.instance.state.selection;
    let context = {};
    if (!selection.empty) {
      context = {
        type: 'selection',
        selected_text: this.editor.instance.state.doc.textBetween(selection.from, selection.to),
        range: { from: selection.from, to: selection.to }
      };
    } else {
      context = { type: 'global', view_content: this.editor.instance.getJSON() };
    }
    // Correctly get data from the service
    return {
      context: context,
      current_book_filename: this.bookService.currentBook?.filename,
      current_view_id: this.bookService.currentViewId,
    };
  }

  // --- INDICATOR SYSTEM ---
  showIndicator(message, options = {}) {
    const { isError = false, duration = null } = options;
    const container = document.getElementById('status-indicator-container');
    const id = `indicator-${Date.now()}-${Math.random()}`;
    const indicatorEl = document.createElement('div');
    indicatorEl.id = id;
    indicatorEl.className = 'status-indicator-item';
    indicatorEl.textContent = message;
    if (isError) indicatorEl.classList.add('is-error');
    container.appendChild(indicatorEl);
    if (duration) setTimeout(() => this.hideIndicator(id), duration);
    return id;
  }

  hideIndicator(id) {
    const indicatorEl = document.getElementById(id);
    if (indicatorEl) {
      indicatorEl.style.transition = 'opacity 0.5s ease';
      indicatorEl.style.opacity = '0';
      setTimeout(() => indicatorEl.remove(), 500);
    }
  }


  // ==== download to latex or docx logic ====
  downloadFile(filename, content) {
    const element = document.createElement('a');
    const file = new Blob([content], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = filename;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  }

  async exportBookAsLatex(filename) {
    const indicatorId = this.showIndicator('Converting to LaTeX...');

    try {
      const bookData = await this.storageService.getFile(`${filename}.book`);
      if (!bookData) {
        throw new Error('Could not find book data to export.');
      }

      // --- USE THE NEW JS CONVERTER ---
      const converter = new LatexConverter(bookData, bookData.metadata.title);
      const latexContent = converter.convert();

      // The filename for download
      const downloadFilename = filename.endsWith('.tex') ? filename : `${filename}.tex`;

      this.downloadFile(downloadFilename, latexContent);

    } catch (error) {
      console.error("LaTeX export failed:", error);
      this.showIndicator(`Export failed: ${error.message}`, { isError: true, duration: 4000 });
    } finally {
      this.hideIndicator(indicatorId);
    }
  }

  async exportBookAsDocx(filename) {
    const indicatorId = this.showIndicator('Converting to .docx...');
    try {
      const bookData = await this.storageService.getFile(`${filename}.book`);
      if (!bookData) {
        throw new Error('Could not find book data to export.');
      }

      const converter = new DocxConverter(bookData, bookData.metadata.title);
      await converter.convertAndSave(); // This handles the download internally

    } catch (error) {
      console.error("DOCX export failed:", error);
      this.showIndicator(`Export failed: ${error.message}`, { isError: true, duration: 4000 });
    } finally {
      this.hideIndicator(indicatorId);
    }
  }

}