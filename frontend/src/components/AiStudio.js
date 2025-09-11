const COMMANDS_CONFIG = [
  {
    id: 'custom_request',
    name: 'Custom Request',
    description: 'An open-ended prompt for any complex task.',
    promptKey: 'DEVELOP',
    requiresInput: true,
    inputLabel: "Enter your request (e.g., 'check for inconsistencies with Chapter 2')...",
    defaultContext: 'full_document'
  },
  {
    id: 'find_related_notes',
    name: 'Find Related Notes',
    description: 'Searches your notebook for ideas related to the current text.',
    promptKey: 'COMMAND_FIND_NOTES',
    requiresInput: false,
    defaultContext: 'selection'
  },
  {
    id: 'summarize',
    name: 'Summarize',
    description: 'Condense the text into a concise summary.',
    promptKey: 'COMMAND_SUMMARIZE',
    requiresInput: false,
    defaultContext: 'selection'
  },
  {
    id: 'change_tone',
    name: 'Change Tone',
    description: 'Rewrite the selection with a different style.',
    promptKey: 'COMMAND_CHANGE_TONE',
    requiresInput: true,
    inputLabel: 'Enter the desired tone (e.g., formal, confident)...',
    defaultContext: 'selection'
  },
  {
    id: 'generate_titles',
    name: 'Suggest Titles',
    description: 'Generate 5 alternative titles for the current section.',
    promptKey: 'COMMAND_TITLES',
    requiresInput: false,
    defaultContext: 'view'
  },
  {
    id: 'generate_outline',
    name: 'Generate Outline',
    description: 'Create a hierarchical outline for the current view.',
    promptKey: 'COMMAND_OUTLINE',
    requiresInput: false,
    defaultContext: 'view'
  }
];

export class AiStudio {
  constructor(controller, storageService) { // --- ADD storageService ---
    this.controller = controller;
    // --- NEW: Need direct access to storage for fetching notes ---
    this.storageService = storageService; 
    this.containerEl = document.getElementById('ai-studio-container');
    this.studioEl = document.getElementById('ai-studio');
    this.selectedCommand = null;
    this.selectedContext = null;
    this.searchQuery = '';
    this.containerEl.addEventListener('click', (e) => this.handleClick(e));
    this.containerEl.addEventListener('input', (e) => this.handleInput(e));
    document.addEventListener('keydown', (e) => this.handleKeydown(e));
  }

  handleClick(e) {
    if (e.target === this.containerEl) this.hide();
    const commandBtn = e.target.closest('.cp-command-btn');
    const contextBtn = e.target.closest('.cp-context-btn');
    const runBtn = e.target.closest('#cp-run-btn');
    if (commandBtn) {
      this.selectCommand(commandBtn.dataset.commandId);
    } else if (contextBtn) {
      this.selectContext(contextBtn.dataset.context);
    } else if (runBtn) {
      this.handleRunCommand();
    }
  }
  handleInput(e) {
    if (e.target.id === 'cp-search-input') {
        this.searchQuery = e.target.value;
        const commandListEl = document.getElementById('cp-command-list');
        if (commandListEl) {
            commandListEl.innerHTML = this.renderCommandList();
        }
    }
  }
  handleKeydown(e) {
    if (e.key === 'Escape' && !this.containerEl.classList.contains('hidden')) {
      this.hide();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        const runBtn = document.getElementById('cp-run-btn');
        if (runBtn) {
            e.preventDefault();
            this.handleRunCommand();
        }
    }
  }
  show() {
    this.selectedCommand = null;
    this.searchQuery = ''; 
    this.render();
    this.containerEl.classList.remove('hidden');
    this.studioEl.classList.remove('is-detail-view');
    document.getElementById('cp-search-input')?.focus();
  }
  hide() {
    this.containerEl.classList.add('hidden');
  }
  selectCommand(commandId) {
    this.selectedCommand = COMMANDS_CONFIG.find(c => c.id === commandId);
    if (!this.selectedCommand) return;
    const editorContext = this.controller.getContext().context;
    if (this.selectedCommand.defaultContext === 'selection' && editorContext.type === 'selection') {
        this.selectedContext = 'selection';
    } else if (this.selectedCommand.defaultContext === 'full_document') {
        this.selectedContext = 'full_document';
    } else {
        this.selectedContext = 'view';
    }
    this.studioEl.classList.add('is-detail-view');
    this.render();
    const input = document.getElementById('cp-user-input');
    if (input) input.focus();
  }
  selectContext(contextType) {
    this.selectedContext = contextType;
    this.renderDetailPanel();
  }

  async handleRunCommand() {
    if (!this.selectedCommand || !this.selectedContext) return;

    const payload = this.controller.getContext();
    payload.promptKey = this.selectedCommand.promptKey;

    const noteFiles = await this.storageService.getAllFilesBySuffix('.note');
    payload.all_notes = noteFiles.map(file => file.content);
    // --- END of new logic ---

    if (this.selectedCommand.requiresInput) {
        const inputEl = document.getElementById('cp-user-input');
        payload.user_request = inputEl.value.trim();
        if (!payload.user_request) {
            this.controller.showIndicator("Input is required for this command.", { isError: true, duration: 3000 });
            return;
        }
    }
    if (this.selectedContext === 'selection' && payload.context.type !== 'selection') {
        this.controller.showIndicator("Please select some text to run this command.", { isError: true, duration: 3000 });
        return;
    }
    if (this.selectedContext === 'view') {
        payload.context.type = 'global';
    }
    
    this.hide();
    const ai_response = await this.controller.runDeveloper(payload);

    if (ai_response) {
      const blockData = {
        type: 'development',
        title: this.selectedCommand.name,
        id: `dev_${Date.now()}`,
        content: { type: 'markdown', text: ai_response },
        is_open_by_default: true,
      };
      this.controller.addMarginBlock(payload.current_view_id, blockData);
      this.controller.openRightDrawer('assistant');
    }
  }
  
  render() {
    const header = `<div id="ai-studio-header"><h4>AI Command Palette</h4></div>`;
    const leftPanel = `
      <div id="cp-left-panel">
        <div id="cp-search-bar">
          <input type="search" id="cp-search-input" placeholder="Search commands...">
        </div>
        <div id="cp-command-list">
          ${this.renderCommandList()}
        </div>
      </div>
    `;
    const detailPanel = `<div id="cp-detail-panel"></div>`;
    this.studioEl.innerHTML = `
      ${header}
      <div id="cp-main-content">
        ${leftPanel}
        ${detailPanel}
      </div>
    `;
    if (this.selectedCommand) {
        this.renderDetailPanel();
    }
  }
  renderCommandList() {
    const query = this.searchQuery.toLowerCase().trim();
    let commands = COMMANDS_CONFIG;
    if (query) {
      commands = COMMANDS_CONFIG.filter(cmd => 
        cmd.name.toLowerCase().includes(query) || 
        cmd.description.toLowerCase().includes(query)
      );
    }
    if (commands.length === 0) {
        return `<div class="cp-no-results">No commands found.</div>`;
    }
    return commands.map(cmd => `
      <button class="cp-command-btn" data-command-id="${cmd.id}">
        <span class="cp-command-name">${cmd.name}</span>
        <span class="cp-command-desc">${cmd.description}</span>
      </button>
    `).join('');
  }
  renderDetailPanel() {
      if (!this.selectedCommand) return;
      const detailPanel = document.getElementById('cp-detail-panel');
      const editorContext = this.controller.getContext().context;
      const canUseSelection = editorContext.type === 'selection';
      const contextButtons = `
        <button class="cp-context-btn ${this.selectedContext === 'selection' ? 'active' : ''}" 
                data-context="selection" ${!canUseSelection ? 'disabled' : ''}>
          Selection
        </button>
        <button class="cp-context-btn ${this.selectedContext === 'view' ? 'active' : ''}" 
                data-context="view">
          Current View
        </button>
        <button class="cp-context-btn ${this.selectedContext === 'full_document' ? 'active' : ''}" 
                data-context="full_document">
          Full Document
        </button>
      `;
      let inputHtml = '';
      if (this.selectedCommand.requiresInput) {
          inputHtml = `
            <div class="cp-input-group">
              <label for="cp-user-input">${this.selectedCommand.inputLabel}</label>
              <textarea id="cp-user-input" rows="4"></textarea>
            </div>
          `;
      }
      detailPanel.innerHTML = `
        <div class="cp-detail-header">
          <h5>${this.selectedCommand.name}</h5>
          <p>${this.selectedCommand.description}</p>
        </div>
        <div class="cp-detail-body">
          <div class="cp-input-group">
            <label>Context</label>
            <div class="cp-context-selector">${contextButtons}</div>
          </div>
          ${inputHtml}
        </div>
        <div class="cp-detail-footer">
          <button id="cp-run-btn">Run (Ctrl+Enter)</button>
        </div>
      `;
  }
}