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
import { StorageService } from './services/StorageService.js';
import { AnalystAgent } from './agents/AnalystAgent.js';
import { RewriteAgent } from './agents/RewriteAgent.js';
import { FindNotesAgent } from './agents/FindNotesAgent.js';
import { SyncService } from './services/SyncService.js';
import { GoogleSyncService } from './services/GoogleSyncService.js';
import { SearchService } from './services/SearchService.js';
import { SearchPane } from './components/SearchPane.js';
import { DataManager } from './components/DataManager.js';
import { EventBus } from './utils/EventBus.js';
import { ConnectivityStatus } from './components/ConnectivityStatus.js';
import { IndicatorManager } from './ui/IndicatorManager.js'; // NEW
import { ExportService } from './services/ExportService.js'; // NEW
import { uninstallApp } from './utils/uninstall.js'; // NEW


let instance = null;

export class App {
  constructor() {
    if (instance) return instance;
    instance = this;
    console.log("Initializing App with new Controller pattern...");

    // STEP 1: INITIALIZE CORE SERVICES (that don't depend on the controller)
    this.eventBus = new EventBus();
    this.indicatorManager = new IndicatorManager();
    this.searchService = new SearchService();
    this.storageService = new StorageService();

    // STEP 2: CREATE THE CONTROLLER AND DEPENDENT SERVICES
    const controller = this.createController();
    this.exportService = new ExportService(controller);
    this.storageService.setController(controller);
    this.googleSyncService = new GoogleSyncService(controller);
    this.syncService = new SyncService(this.storageService, controller, this.googleSyncService);
    this.llmOrchestrator = new LlmOrchestrator(controller);

    // This is the controller for BookService -> UI communication
    const bookServiceController = {
      renderEditor: (content) => this.editor.render(content),
      setEditorEditable: (isEditable) => this.editor.setEditable(isEditable),
      renderNavigator: (state) => this.navigator.render(state),
      renderAssistantPane: (blocks) => this.assistantPane.render(blocks),
      showIndicator: (...args) => this.indicatorManager.show(...args),
      hideIndicator: (...args) => this.indicatorManager.hide(...args),
      setAgentButtonsDisabled: (isDisabled) => {
        ['assistant-toggle-btn', 'notebook-toggle-btn'].forEach(id => {
          const btn = document.getElementById(id);
          if (btn) btn.disabled = isDisabled;
        });
      }
    };
    this.bookService = new BookService(bookServiceController, this.storageService);

    // Agents now receive the main controller for UI interactions
    this.analystAgent = new AnalystAgent(this.llmOrchestrator, controller);
    this.rewriteAgent = new RewriteAgent(this.llmOrchestrator, controller);
    this.findNotesAgent = new FindNotesAgent(this.llmOrchestrator, controller);

    // ====================================================================
    //  STEP 3: INITIALIZE UI COMPONENTS
    // ====================================================================
    this.navigator = new Navigator(controller, this.bookService);
    this.editor = new Editor(controller, this.bookService);
    this.palette = new CommandPalette(controller, this.bookService, this.storageService);
    this.modalInput = new ModalInput();
    this.assistantPane = new AssistantPane(controller, this.bookService);
    this.notebookPane = new NotebookPane(controller, this.storageService);
    this.confirmationModal = new ConfirmationModal();
    this.searchPane = new SearchPane(controller);
    this.settingsPalette = new SettingsPalette(controller);
    this.dataManager = new DataManager(controller);
    this.connectivityStatus = new ConnectivityStatus(controller);


    // --- UI State Management (remains in App.js) ---
    this.activeRightDrawer = null;
    this.drawers = {
      assistant: document.getElementById('assistant-drawer'),
      notebook: document.getElementById('notebook-drawer'),
      search: document.getElementById('search-drawer'),
    };

    // ====================================================================
    //  STEP 4: SET UP LISTENERS AND KICK OFF THE APP
    // ====================================================================
    this.setupGlobalListeners();
    this.storageService.open().then(async () => {
      console.log("Database is ready.");
      this.checkInitialAuthStatus();
      const bookFiles = await this.storageService.getAllFilesBySuffix('.book');
      this.searchService.buildIndex(bookFiles);
      this.bookService.loadInitialBook();
      this.notebookPane.initialize();
    });
  }

  async checkInitialAuthStatus() {
    await this.googleSyncService.initialize();
    const isSignedIn = await this.googleSyncService.trySilentAuth(); 
    if (isSignedIn) {
      const user = await this.googleSyncService.getUserProfile();
      if (user && user.name) {
        this.connectivityStatus.setState('signed-in', user.name);
      } else {
        this.connectivityStatus.setState('signed-in', 'User');
      }
      await this.syncService.performInitialSync();
      await this.bookService.loadInitialBook(); 
      await this.rebuildSearchIndex();
    } else {
      if (navigator.onLine) {
        this.connectivityStatus.setState('signed-out');
      }
    }
  }

  /**
   * Creates a controller object to pass to components. This is the public API
   * for components to interact with the rest of the application, promoting decoupling.
   */
  createController() {
    return {
      // Indicators & Modals
      showIndicator: (...args) => this.indicatorManager.show(...args),
      hideIndicator: (...args) => this.indicatorManager.hide(...args),
      confirm: (...args) => this.confirmationModal.show(...args),
      prompt: (...args) => this.modalInput.show(...args),

      // Editor & Context
      getContext: () => this.getContextPayload(),
      replaceEditorText: (...args) => this.editor.replaceText(...args),
      getEditorState: () => this.editor.instance.state,

      // Agent Execution
      runAnalyst: (payload) => this.analystAgent.run(payload),
      runRewrite: (payload) => this.rewriteAgent.run(payload),
      runFindNotes: (payload) => this.findNotesAgent.run(payload),

      renderRewriteSuggestion: (payload) => this.assistantPane.renderRewriteSuggestion(payload),
      // UI & Navigation
      openRightDrawer: (drawerName) => this.openRightDrawer(drawerName),
      closeRightDrawer: () => this.closeRightDrawer(),
      navigateTo: (filename, viewId) => this.navigateTo(filename, viewId),
      showCommandPalette: (tabName) => this.palette.show(tabName),
      hideSettingsPalette: () => this.settingsPalette.hide(),
      showDataManager: () => this.dataManager.show(),

      // Data & Sync Services
      addMarginBlock: (...args) => this.bookService.addMarginBlock(...args),
      togglePinMarginBlock: (...args) => this.bookService.togglePinMarginBlock(...args),
      deleteMarginBlock: (...args) => this.bookService.deleteMarginBlock(...args),
      restoreDefaultMargin: () => this.bookService.restoreDefaultMargin(),
      rebuildSearchIndex: () => this.rebuildSearchIndex(),
      exportLocal: () => this.syncService.exportToLocalFile(),
      importLocal: () => this.syncService.importFromLocalFile(),
      getCloudFileList: () => this.syncService.getCloudFileList(),
      deleteAllCloudFiles: () => this.syncService.deleteAllCloudFiles(),
      performInitialSync: () => this.syncService.performInitialSync(),
      deleteCloudAndLocalFile: async (cloudFileId, localFileName) => {
        const cloudSuccess = await this.syncService.deleteCloudFileById(cloudFileId);

        if (cloudSuccess) {
          try {
            const localFileExists = await this.storageService.getFile(localFileName);
            if (localFileExists) {
              await this.storageService.deleteFile(localFileName);
              console.log(`Successfully deleted local file: ${localFileName}`);
            } else {
              console.log(`Local file "${localFileName}" did not exist. No local deletion needed.`);
            }

            if (localFileName.endsWith('.book')) {
              await this.rebuildSearchIndex();
            }
            return true;
          } catch (error) {
            console.error(`An unexpected error occurred deleting local file "${localFileName}":`, error);
            this.indicatorManager.show('Cloud file deleted, but a local DB error occurred.', { isError: true, duration: 5000 });
            return false;
          }
        }
        return false;
      },
      exportBookAsLatex: (filename) => this.exportService.exportBookAsLatex(filename),
      exportBookAsDocx: (filename) => this.exportService.exportBookAsDocx(filename),
      uninstall: () => uninstallApp(this.storageService, this.indicatorManager.show.bind(this.indicatorManager)),
      getAvailableBooks: () => this.bookService.availableBooks,
      getCurrentBookFilename: () => this.bookService.currentBook?.filename,
      storageService: this.storageService,
      searchService: this.searchService,

      // Auth methods for the UI to call
      signIn: async () => {
        try {
          const user = await this.googleSyncService.signIn();
          if (user) {
            if (user.name) {
              this.connectivityStatus.setState('signed-in', user.name);
              this.indicatorManager.show(`Signed in as ${user.name}`, { duration: 3000 });
            } else {
              this.connectivityStatus.setState('signed-in', 'User');
              this.indicatorManager.show(`Signed in successfully`, { duration: 3000 });
            }
            await this.syncService.performInitialSync();
            await this.bookService.loadInitialBook();
            await this.rebuildSearchIndex();
          }
        } catch (error) {
          console.error("Sign-in failed:", error);
          this.indicatorManager.show('Sign-in failed. See console for details.', { isError: true });
        }
      },
      signOut: async () => {
        await this.googleSyncService.signOut();
        this.connectivityStatus.setState('signed-out');
        this.indicatorManager.show('You have been signed out.', { duration: 3000 });
      },

      setSyncState: (state) => {
        // Only change state if the user is currently signed in.
        // This prevents the "syncing" icon from overriding the "offline" or "signed-out" states.
        if (this.connectivityStatus.state === 'signed-in' || this.connectivityStatus.state === 'syncing') {
          this.connectivityStatus.setState(state);
        }
      },

      // Event Bus
      publish: (eventName, data) => this.eventBus.publish(eventName, data),
      subscribe: (eventName, callback) => this.eventBus.subscribe(eventName, callback),
    };
  }


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
      if (this.activeRightDrawer === 'search') {
        const searchDrawerEl = this.drawers.search;
        if (!searchDrawerEl.contains(e.target)) {
          this.closeRightDrawer();
        }
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
            if (this.bookService.currentViewId && this.editor.instance.isEditable) {
              this.bookService.saveView(
                this.bookService.currentViewId,
                this.editor.instance.getJSON()
              );
            }
            break;
          case 'k':
            e.preventDefault();
            this.palette.show();
            break;
          case 'f':
            e.preventDefault();
            this.searchPane.show();
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

  async navigateTo(filename, viewId) {
    await this.bookService.switchBook(filename);
    await this.bookService.changeView(viewId);
    this.closeRightDrawer();
  }

  async rebuildSearchIndex() {
    const bookFiles = await this.storageService.getAllFilesBySuffix('.book');
    await this.searchService.buildIndex(bookFiles);
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
    return {
      context: context,
      current_book_filename: this.bookService.currentBook?.filename,
      current_view_id: this.bookService.currentViewId,
    };
  }
}