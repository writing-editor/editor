import { AiStudio } from './components/AiStudio.js';
import './components/AiStudio.css';
import { AssistantPane } from './components/AssistantPane.js';
import './components/AssistantPane.css';
import { ConfirmationModal } from './components/ConfirmationModal.js';
import './components/ConfirmationModal.css';
import { ConnectivityStatus } from './components/ConnectivityStatus.js';
import './components/ConnectivityStatus.css';
import './components/ContextualScrollbar.css';
import { DataManager } from './components/DataManager.js';
import './components/DataManager.css'
import { Editor } from './components/Editor.js';
import './components/Editor.css';
import './components/EditorToolbar.css'
import { MergeConflictModal } from './components/MergeConflictModal.js';
import './components/MergeConflictModal.css';
import { ModalInput } from './components/ModalInput.js';
import './components/ModalInput.css';
import { Navigator } from './components/Navigator.js';
import './components/Navigator.css';
import { NotebookPane } from './components/NotebookPane.js';
import './components/NotebookPane.css';
import { PromptsPane } from './components/PromptsPane.js';
import './components/PromptsPane.css';
import './components/RightDrawer.css';
import { SearchPane } from './components/SearchPane.js';
import { SettingsPalette } from './components/SettingsPalette.js';
import './components/SettingsPalette.css';
import { FindReplace } from './components/FindReplace.js';
import './components/FindReplace.css';
import './ui/print.css'
import './components/SuggestionList.css';
import { LlmOrchestrator } from './services/LlmOrchestrator.js';
import { BookService } from './services/BookService.js';
import { StorageService } from './services/StorageService.js';
import { AnalystAgent } from './agents/AnalystAgent.js';
import { RewriteAgent } from './agents/RewriteAgent.js';
import { FindNotesAgent } from './agents/FindNotesAgent.js';
import { DevelopmentAgent } from './agents/DevelopmentAgent.js';
import { SyncService } from './services/SyncService.js';
import { GoogleSyncService } from './services/GoogleSyncService.js';
import { SearchService } from './services/SearchService.js';
import { EventBus } from './utils/EventBus.js';
import { IndicatorManager } from './ui/IndicatorManager.js';
import { ExportService } from './services/ExportService.js';
import { uninstallApp } from './utils/uninstall.js';
import { TagGenerationAgent } from './agents/TagGenerationAgent.js';
import { TagSyncService } from './services/TagSyncService.js';

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

    // STEP 2: CREATE THE CONTROLLER AND DEPENDENT SERVICES
    const controller = this.createController();
    this.exportService = new ExportService(controller);
    this.storageService.setController(controller);
    this.googleSyncService = new GoogleSyncService(controller);
    this.syncService = new SyncService(this.storageService, controller, this.googleSyncService);
    this.llmOrchestrator = new LlmOrchestrator(controller);

    // Agents now receive the main controller for UI interactions
    this.analystAgent = new AnalystAgent(this.llmOrchestrator, controller);
    this.rewriteAgent = new RewriteAgent(this.llmOrchestrator, controller);
    this.findNotesAgent = new FindNotesAgent(this.llmOrchestrator, controller);
    this.developmentAgent = new DevelopmentAgent(this.llmOrchestrator, controller);
    this.tagGenerationAgent = new TagGenerationAgent(this.llmOrchestrator, controller);
    this.tagSyncService = new TagSyncService(controller, this.storageService);

    // ====================================================================
    //  STEP 3: INITIALIZE UI COMPONENTS
    // ====================================================================
    this.navigator = new Navigator(controller, this.bookService);
    this.editor = new Editor(controller, this.bookService);
    this.findReplace = new FindReplace(controller, this.editor.instance);
    this.palette = new AiStudio(controller, this.storageService);
    this.modalInput = new ModalInput();
    this.assistantPane = new AssistantPane(controller, this.bookService);
    this.notebookPane = new NotebookPane(controller, this.storageService);
    this.promptsPane = new PromptsPane(controller, this.storageService);
    this.confirmationModal = new ConfirmationModal();
    this.searchPane = new SearchPane(controller);
    this.settingsPalette = new SettingsPalette(controller);
    this.dataManager = new DataManager(controller);
    this.connectivityStatus = new ConnectivityStatus(controller);
    this.mergeConflictModal = new MergeConflictModal();

    // --- UI State Management (remains in App.js) ---
    this.activeRightDrawer = null;
    this.drawers = {
      assistant: document.getElementById('assistant-drawer'),
      notebook: document.getElementById('notebook-drawer'),
      search: document.getElementById('search-drawer'),
      prompts: document.getElementById('prompts-drawer'),
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
      this.promptsPane.initialize();
      this.eventBus.subscribe('app:online', () => this.reconcileOnline());
    });
  }


  async checkInitialAuthStatus() {
    const userHasInitiatedSignIn = localStorage.getItem('userHasInitiatedSignIn');
    if (!userHasInitiatedSignIn) {
      console.log("User has not initiated sign-in before. Skipping silent auth.");
      if (navigator.onLine) {
        this.connectivityStatus.setState('signed-out');
      }
      return;
    }

    await this.googleSyncService.initialize();
    const isSignedIn = await this.googleSyncService.trySilentAuth();
    if (isSignedIn) {
      const user = await this.googleSyncService.getUserProfile();
      if (user && user.name) {
        this.connectivityStatus.setState('signed-in', {
          name: user.name,
          picture: user.picture
        });
      } else {
        this.connectivityStatus.setState('signed-in', 'User');
      }

      if (navigator.onLine) {
        await this.syncService.performInitialSync();
      } else {
        console.log("Skipping initial sync: Application is offline.");
      }
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
      showMergeConflict: (payload) => this.mergeConflictModal.show(payload),

      // Editor & Context
      getContext: () => this.getContextPayload(),
      replaceEditorText: (...args) => this.editor.replaceText(...args),
      getEditorState: () => this.editor.instance.state,

      // Agent Execution
      runAnalyst: (payload) => this.analystAgent.run(payload),
      runRewrite: (payload) => this.rewriteAgent.run(payload),
      runFindNotes: (payload) => this.findNotesAgent.run(payload),
      runDeveloper: (payload) => this.developmentAgent.run(payload),
      runTagger: (payload) => this.tagGenerationAgent.run(payload),
      runAutoTagging: () => this.tagSyncService.run(),

      renderRewriteSuggestion: (payload) => this.assistantPane.renderRewriteSuggestion(payload),
      // UI & Navigation
      openRightDrawer: (drawerName) => this.openRightDrawer(drawerName),
      closeRightDrawer: () => this.closeRightDrawer(),
      navigateTo: (filename, viewId) => this.navigateTo(filename, viewId),
      showAiStudio: (tabName) => this.palette.show(tabName),
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
      bookService: this.bookService,
      signIn: async () => {
        try {
          const user = await this.googleSyncService.signIn();
          if (user) {
            if (user.name) {
              this.connectivityStatus.setState('signed-in', {
                name: user.name,
                picture: user.picture
              });
              this.indicatorManager.show(`Signed in as ${user.name}`, { duration: 3000 });
            } else {
              this.connectivityStatus.setState('signed-in', 'User');
              this.indicatorManager.show(`Signed in successfully`, { duration: 3000 });
            }
            localStorage.setItem('userHasInitiatedSignIn', 'true');
            await this.syncService.performInitialSync();
            await this.bookService.loadInitialBook();
            await this.rebuildSearchIndex();
          }
        } catch (error) {
          console.error("Sign-in failed:", error);
          this.indicatorManager.show('Sign-in failed. See console for details.', { isError: true, duration: 5000 });
        }
      },
      signOut: async () => {
        await this.googleSyncService.signOut();
        localStorage.removeItem('userHasInitiatedSignIn');
        this.connectivityStatus.setState('signed-out');
        this.indicatorManager.show('You have been signed out.', { duration: 3000 });
      },
      checkSignInStatus: () => this.googleSyncService.checkSignInStatus(),

      setSyncState: (state) => {
        if (this.connectivityStatus.state === 'signed-in' || this.connectivityStatus.state === 'syncing') {
          this.connectivityStatus.setState(state);
        }
      },

      // Event Bus
      publish: (eventName, data) => this.eventBus.publish(eventName, data),
      subscribe: (eventName, callback) => this.eventBus.subscribe(eventName, callback),

      runSummarizeOnText: (text) => {
        const payload = this.getContextPayload();
        payload.promptKey = 'COMMAND_SUMMARIZE';
        payload.context.type = 'selection'; // Treat it like a selection
        payload.context.selected_text = text;

        this.runDeveloperAndShowResult(payload);
      },

      runFindNotesOnText: (text) => {
        const payload = this.getContextPayload();
        payload.promptKey = 'COMMAND_FIND_NOTES';
        payload.context.type = 'selection';
        payload.context.selected_text = text;

        this.runDeveloperAndShowResult(payload);
      },

      showAiStudio: (commandId, query) => {
        this.palette.show(commandId, query);
      }
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
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        this.searchPane.show();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        this.findReplace.show();
        return;
      }

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
            this.palette.show('settings');
            break;
          case 'b':
            e.preventDefault();
            this.navigator.toggle();
            document.body.classList.toggle('drawer-is-open', this.navigator.isOpen());
            break;
        }
      }
      if (e.key === 'Escape') {
        if (!this.findReplace.container.classList.contains('hidden')) {
          this.findReplace.hide();
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

  async runDeveloperAndShowResult(payload) {
    const ai_response = await this.developmentAgent.run(payload);
    if (ai_response) {
      const blockData = {
        type: 'development',
        title: "Slash Command Result",
        id: `dev_${Date.now()}`,
        content: { type: 'markdown', text: ai_response },
        is_open_by_default: true,
      };
      this.bookService.addMarginBlock(payload.current_view_id, blockData);
      this.openRightDrawer('assistant');
    }
  }

  getContextPayload() {
    const selection = this.editor.instance.state.selection;
    let context = {};

    if (!selection.empty) {
      context = {
        type: 'selection',
        selected_text: this.editor.instance.state.doc.textBetween(selection.from, selection.to),
        range: { from: selection.from, to: selection.to },
        view_content: this.editor.instance.getText(), // Keep full content available
      };
    } else {
      context = {
        type: 'global',
        view_content: this.editor.instance.getText()
      };
    }

    return {
      context: context,
      current_book_filename: this.bookService.currentBook?.filename,
      current_view_id: this.bookService.currentViewId,
      book_structure: this.bookService.currentBook?.structure || 'No book loaded.',
    };
  }

  async reconcileOnline() {
    const isSignedIn = await this.googleSyncService.checkSignInStatus();
    if (!isSignedIn) {
      console.log("Reconciliation skipped: User not signed in.");
      return;
    }
    // This will be our new smart sync function
    await this.syncService.reconcileAllFiles();
    // After syncing, we should reload the book to reflect any merged changes
    await this.bookService.loadInitialBook();
    await this.rebuildSearchIndex();
  }
}