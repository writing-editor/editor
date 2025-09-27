export class AiStudio {
  constructor(controller) {
    this.controller = controller;
    this.containerEl = document.getElementById('ai-studio-container');
    this.studioEl = document.getElementById('ai-studio');

    this.commandListEl = null;
    this.detailPanelEl = null;

    this.selectedCommand = null;
    this.selectedContext = null;
    this.searchQuery = '';
    this.availableCommands = [];

    this.containerEl.addEventListener('click', (e) => this.handleClick(e));
    this.containerEl.addEventListener('input', (e) => this.handleInput(e));
    document.addEventListener('keydown', (e) => this.handleKeydown(e));

    this.controller.subscribe('config:updated', () => this.updateAvailableCommands());
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
      this.render(); // Re-render the whole studio to update the list
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

  updateAvailableCommands() {
    const allAgents = this.controller.agentService.getAgents();
    this.availableCommands = allAgents
      .filter(agent => agent.triggers && agent.triggers.ai_studio)
      .map(agent => ({
        id: agent.id,
        name: agent.name,
        description: agent.description,
        requiresInput: agent.prompt.user.includes('{user_request}'),
        inputLabel: "Enter your request...", // Can be customized in manifest later
        defaultContext: agent.prompt.user.includes('{selected_text}') ? 'selection' : 'view'
      }));
  }

  show() {
    this.updateAvailableCommands();
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
    this.selectedCommand = this.availableCommands.find(c => c.id === commandId);
    if (!this.selectedCommand) return;

    const editorContext = this.controller.getContext().context;
    this.selectedContext = (this.selectedCommand.defaultContext === 'selection' && editorContext.type === 'selection') ? 'selection' : 'view';

    this.studioEl.classList.add('is-detail-view');

    this._updateCommandListSelection();
    this.detailPanelEl.innerHTML = this.renderDetailPanel(); // Only re-render the detail panel
    document.getElementById('cp-user-input')?.focus();
  }

  selectContext(contextType) {
    this.selectedContext = contextType;
    this.render();
  }

  async handleRunCommand() {
    if (!this.selectedCommand || !this.selectedContext) return;

    const payload = this.controller.getContext();
    const noteFiles = await this.controller.storageService.getAllFilesBySuffix('.note');
    payload.all_notes = noteFiles.map(file => file.content);

    if (this.selectedCommand.requiresInput) {
      const inputEl = document.getElementById('cp-user-input');
      payload.user_request = inputEl.value.trim();
      if (!payload.user_request) {
        this.controller.showIndicator("Input is required.", { isError: true, duration: 3000 });
        return;
      }
    }
    if (this.selectedContext === 'selection' && payload.context.type !== 'selection') {
      this.controller.showIndicator("Please select text to run this command.", { isError: true, duration: 3000 });
      return;
    }
    if (this.selectedContext === 'view') payload.context.type = 'global';

    this.hide();
    const agent = this.controller.agentService.getAgentById(this.selectedCommand.id);
    const ai_response = await this.controller.runAgent(this.selectedCommand.id, payload);

    if (ai_response) {
      if (this.selectedCommand.id === 'core.find_notes' && ai_response.relevant_note_ids) {
        this.controller.showIndicator(`${ai_response.relevant_note_ids.length} related notes found.`, { duration: 3000 });
        return;
      }
      const blockData = {
        type: 'development',
        title: agent.name,
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
                    <input type="search" id="cp-search-input" placeholder="Search commands..." value="${this.searchQuery}">
                </div>
                <div id="cp-command-list"></div>
            </div>`;
    const detailPanel = `<div id="cp-detail-panel"></div>`;

    this.studioEl.innerHTML = `${header}<div id="cp-main-content">${leftPanel}${detailPanel}</div>`;

    this.commandListEl = this.studioEl.querySelector('#cp-command-list');
    this.detailPanelEl = this.studioEl.querySelector('#cp-detail-panel');

    this.commandListEl.innerHTML = this.renderCommandList();
    this.detailPanelEl.innerHTML = this.renderDetailPanel();
  }

  _updateCommandListSelection() {
    if (!this.commandListEl) return;
    this.commandListEl.querySelectorAll('.cp-command-btn').forEach(btn => {
      btn.classList.toggle('is-selected', btn.dataset.commandId === this.selectedCommand?.id);
    });
  }

  renderCommandList() {
    const query = this.searchQuery.toLowerCase().trim();
    let commands = this.availableCommands;
    if (query) {
      commands = commands.filter(cmd => cmd.name.toLowerCase().includes(query) || cmd.description.toLowerCase().includes(query));
    }
    if (commands.length === 0) {
      return `<div class="cp-no-results">No commands found.</div>`;
    }

    return commands.map(cmd => `
            <button class="cp-command-btn ${this.selectedCommand?.id === cmd.id ? 'is-selected' : ''}" data-command-id="${cmd.id}">
                <span class="cp-command-name">${cmd.name}</span>
                <span class="cp-command-desc">${cmd.description}</span>
            </button>`).join('');
  }

  renderDetailPanel() {
    if (!this.selectedCommand) {
      return `<div class="cp-no-results">Select a command from the list to continue.</div>`;
    }

    const canUseSelection = this.controller.getContext().context.type === 'selection';
    const contextButtons = `
            <button class="cp-context-btn ${this.selectedContext === 'selection' ? 'active' : ''}" data-context="selection" ${!canUseSelection ? 'disabled' : ''}>Selection</button>
            <button class="cp-context-btn ${this.selectedContext === 'view' ? 'active' : ''}" data-context="view">Current View</button>
        `;
    let inputHtml = '';
    if (this.selectedCommand.requiresInput) {
      inputHtml = `
                <div class="cp-input-group is-flexible">
                    <label for="cp-user-input">${this.selectedCommand.inputLabel}</label>
                    <div class="textarea-wrapper">
                        <textarea id="cp-user-input" rows="8"></textarea>
                    </div>
                </div>`;
    }

    return `
            <div class="cp-detail-body">
                <div class="cp-controls-wrapper">
                    <div class="cp-input-group">
                        <label>Context</label>
                        <div class="cp-context-selector">${contextButtons}</div>
                    </div>
                    <button id="cp-run-btn" class="run-agent-icon-btn" title="Run Agent (Ctrl+Enter)">
                        <svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>
                    </button>
                </div>
                ${inputHtml}
            </div>`;
  }
}