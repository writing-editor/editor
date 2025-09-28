import { loadHTML } from '../utils/htmlLoader.js';

export class SettingsPalette {
  constructor(controller, configService, agentService) {
    this.controller = controller;
    this.configService = configService;
    this.agentService = agentService;
    this.containerEl = document.getElementById('settings-palette-container');
    this.agentModalWrapper = document.getElementById('agent-editor-modal-wrapper');
    this.modelModalWrapper = document.getElementById('model-editor-modal-wrapper');
    this.activeView = 'appearance';
  }

  async show() {
    // Load HTML content only if it's not already there
    if (!this.containerEl.hasChildNodes()) {
      const html = await loadHTML('html-templates/settings-palette.html');
      this.containerEl.innerHTML = html;

      // Find elements after they are loaded
      this.navEl = document.getElementById('settings-nav');
      this.contentEl = document.getElementById('settings-content');

      // Bind event listeners once
      document.getElementById('settings-back-btn').addEventListener('click', () => this.hide());

      this.navEl.addEventListener('click', (e) => {
        const navItem = e.target.closest('.settings-nav-item');
        if (navItem) this.navigateTo(navItem.dataset.view);
      });

      // Add escape key listener for closing
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !this.containerEl.classList.contains('hidden')) {
          this.hide();
        }
      });
    }
    this.containerEl.classList.remove('hidden');
    this.navigateTo(this.activeView);
  }

  hide() {
    this.containerEl.classList.add('hidden');
  }

  navigateTo(viewName) {
    this.activeView = viewName;
    this.navEl.querySelectorAll('.settings-nav-item').forEach(item => {
      item.classList.toggle('is-active', item.dataset.view === viewName);
    });
    switch (viewName) {
      case 'agents': this.renderAgentManager(); break;
      case 'ai-provider': this.renderAiProvider(); break;
      case 'appearance': this.renderAppearance(); break;
      case 'export': this.renderExport(); break;
      case 'data': this.renderData(); break;
    }
  }

  renderAgentManager() {
    const agents = this.configService.get('agents', []);
    this.contentEl.innerHTML = `
      <div class="settings-section">
        <ul id="agent-list">
          ${agents.map(agent => this._getAgentListItemHTML(agent)).join('')}
        </ul>
        <button id="add-agent-btn" class="settings-button" style="margin-top: 16px;">+ Add New Agent</button>
      </div>
    `;
    this._bindAgentManagerEvents();
  }


  _getAgentListItemHTML(agent) {
    const agentIndex = this.configService.get('agents').findIndex(a => a.id === agent.id);
    const isCore = agent.id.startsWith('core.');

    const nonDeletableCoreAgents = ['core.autotag', 'core.find_notes'];
    const canDelete = !nonDeletableCoreAgents.includes(agent.id);
    return `
      <li class="agent-list-item" data-agent-id="${agent.id}">
        <div class="agent-info">
          <strong>${agent.name} ${isCore ? '<span class="core-badge">(Core)</span>' : ''}</strong>
          <p>${agent.description}</p>
        </div>
        <div class="agent-actions">
          <label class="switch">
            <input type="checkbox" data-agent-index="${agentIndex}" ${agent.enabled ? 'checked' : ''}>
            <span class="slider round"></span>
          </label>
          <button class="settings-action-btn" data-action="edit-agent" title="Edit Agent">
            <svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>
          </button>
          ${canDelete ? `
            <button class="settings-action-btn delete-btn" data-action="delete-agent" title="Delete Agent">
              <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14H7L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
            </button>
          ` : ''}
        </div>
      </li>
    `;
  }

  _bindAgentManagerEvents() {
    this.contentEl.addEventListener('change', async (e) => {
      if (e.target.type === 'checkbox' && e.target.dataset.agentIndex) {
        const index = e.target.dataset.agentIndex;
        await this.configService.setConfig(`agents.${index}.enabled`, e.target.checked);
        this.controller.showIndicator('Agent status updated.', { duration: 2000 });
      }
    });

    this.contentEl.addEventListener('click', async (e) => {
      const button = e.target.closest('button');
      if (!button) return;

      if (button.id === 'add-agent-btn') {
        this._openAgentEditor();
      } else if (button.dataset.action === 'edit-agent') {
        const agentId = button.closest('.agent-list-item').dataset.agentId;
        this._openAgentEditor(agentId);
      } else if (button.dataset.action === 'delete-agent') {
        const agentId = button.closest('.agent-list-item').dataset.agentId;
        const confirmed = await this.controller.confirm('Delete Agent?', 'Are you sure you want to delete this agent? This cannot be undone.');
        if (confirmed) {
          const agents = this.configService.get('agents');
          const updatedAgents = agents.filter(a => a.id !== agentId);
          await this.configService.set('agents', updatedAgents);
          this.navigateTo('agents');
        }
      }
    });
  }

  async _openAgentEditor(agentId = null) {
    this.agentModalWrapper.innerHTML = await loadHTML('html-templates/agent-editor-modal.html');

    const modalContainer = document.getElementById('agent-editor-modal-container');
    modalContainer.addEventListener('click', (e) => {
      if (e.target === modalContainer) {
        this.agentModalWrapper.innerHTML = '';
      }
    });
    // Get all form elements
    const titleEl = document.getElementById('agent-editor-title');
    const nameInput = document.getElementById('agent-name');
    const descInput = document.getElementById('agent-desc');
    const systemPromptInput = document.getElementById('agent-system-prompt');
    const userPromptInput = document.getElementById('agent-user-prompt');
    const aiStudioTrigger = document.getElementById('trigger-ai-studio');
    const bubbleMenuTrigger = document.getElementById('trigger-bubble-menu');
    const bubbleMenuOptions = document.getElementById('bubble-menu-options');
    const bubbleLabelInput = document.getElementById('agent-bubble-label');
    const bubbleIconInput = document.getElementById('agent-bubble-icon');
    const outputHandlerSelect = document.getElementById('agent-output-handler');

    if (agentId) {
      const agent = this.agentService.getAgentById(agentId);
      titleEl.textContent = `Edit ${agent.name}`;

      nameInput.value = agent.name;
      descInput.value = agent.description;
      systemPromptInput.value = agent.prompt.system;
      userPromptInput.value = agent.prompt.user;

      // Populate triggers
      aiStudioTrigger.checked = !!agent.triggers?.ai_studio;
      bubbleMenuTrigger.checked = !!agent.triggers?.tiptap_bubble_menu;

      if (bubbleMenuTrigger.checked) {
        bubbleMenuOptions.classList.remove('hidden');
        bubbleLabelInput.value = agent.triggers.tiptap_bubble_menu.label || '';
        bubbleIconInput.value = agent.triggers.tiptap_bubble_menu.icon || '';
      }
      if (agent.output && agent.output.handler) {
        outputHandlerSelect.value = agent.output.handler;
      }
    }

    // Event listener to show/hide bubble menu options
    bubbleMenuTrigger.addEventListener('change', () => {
      bubbleMenuOptions.classList.toggle('hidden', !bubbleMenuTrigger.checked);
    });

    document.getElementById('agent-editor-save-btn').onclick = () => this._handleAgentSave(agentId);
    document.getElementById('agent-editor-cancel-btn').onclick = () => this.agentModalWrapper.innerHTML = '';
  }

  async _handleAgentSave(agentId) {
    const isEditing = !!agentId;
    const agents = this.configService.get('agents');
    const agentIndex = isEditing ? agents.findIndex(a => a.id === agentId) : -1;
    const originalAgent = isEditing ? agents[agentIndex] : {};

    // Build the new triggers object
    const newTriggers = {};
    if (document.getElementById('trigger-ai-studio').checked) {
      newTriggers.ai_studio = true;
    }
    if (document.getElementById('trigger-bubble-menu').checked) {
      newTriggers.tiptap_bubble_menu = {
        label: document.getElementById('agent-bubble-label').value.trim(),
        // Provide a default icon if empty
        icon: document.getElementById('agent-bubble-icon').value.trim() || `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.82 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`
      };
    }

    const newAgentData = {
      ...originalAgent, // Preserve fields like 'executor' from the original
      id: agentId || `custom.${Date.now()}`,
      name: document.getElementById('agent-name').value.trim(),
      description: document.getElementById('agent-desc').value.trim(),
      enabled: isEditing ? originalAgent.enabled : true,
      executor: isEditing ? originalAgent.executor : 'simplePrompt',
      output: {
        handler: document.getElementById('agent-output-handler').value
      },
      triggers: newTriggers,
      prompt: {
        system: document.getElementById('agent-system-prompt').value.trim(),
        user: document.getElementById('agent-user-prompt').value.trim(),
      }
    };

    if (isEditing) {
      agents[agentIndex] = newAgentData;
    } else {
      agents.push(newAgentData);
    }

    await this.configService.set('agents', agents);
    this.agentModalWrapper.innerHTML = '';
    this.navigateTo('agents');
    this.controller.showIndicator('Agent saved!', { duration: 2000 });
  }

  renderAppearance() {
    const currentTheme = this.configService.getConfig('ui.theme');
    const currentFontSize = this.configService.getConfig('ui.editor_font_size');
    const currentFontFamily = this.configService.getConfig('ui.editor_font_family');
    const fontOptions = this.configService.get('settings_options.fonts', []);
    const fontSizeValue = parseInt(currentFontSize, 10);

    this.contentEl.innerHTML = `
            <div class="settings-form-group">
                <label for="theme-selector">Theme</label>
                <select id="theme-selector" class="settings-select">
                    <option value="theme-dark" ${currentTheme === 'theme-dark' ? 'selected' : ''}>Modern Slate (Dark)</option>
                    <option value="theme-light" ${currentTheme === 'theme-light' ? 'selected' : ''}>Modern Slate (Light)</option>
                </select>
            </div>
             <div class="settings-form-group">
                <label for="font-family-selector">Editor Font Family</label>
                <select id="font-family-selector" class="settings-select">
                    ${fontOptions.map(font => `<option value="${font.value}" ${currentFontFamily === font.value ? 'selected' : ''}>${font.name}</option>`).join('')}
                </select>
            </div>
             <div class="settings-form-group">
          <label for="font-size-slider">Editor Font Size <span id="font-size-preview">${fontSizeValue}px</span></label>
          <input type="range" id="font-size-slider" min="12" max="24" step="1" value="${fontSizeValue}">
      </div>
        `;

    this.contentEl.querySelector('#theme-selector').addEventListener('change', async (e) => {
      document.body.className = e.target.value;
      await this.configService.setConfig('ui.theme', e.target.value);
    });
    this.contentEl.querySelector('#font-family-selector').addEventListener('change', async (e) => {
      document.documentElement.style.setProperty('--editor-font-family', e.target.value);
      await this.configService.setConfig('ui.editor_font_family', e.target.value);
    });

    const slider = this.contentEl.querySelector('#font-size-slider');
    const preview = this.contentEl.querySelector('#font-size-preview');

    slider.addEventListener('input', () => {
      const newSize = `${slider.value}px`;
      preview.textContent = newSize;
      document.documentElement.style.setProperty('--editor-font-size', newSize);
    });

    slider.addEventListener('change', async () => {
      const newSize = `${slider.value}px`;
      await this.configService.setConfig('ui.editor_font_size', newSize);
    });
  }

  renderAiProvider() {
    const userConfig = this.configService.get('user', {});
    const providers = this.configService.get('settings_options.ai_providers', []);
    this.contentEl.innerHTML = `
            <div class="settings-form-group">
                <label for="ai-provider-selector">AI Provider</label>
                <select id="ai-provider-selector" class="settings-select">
                    ${providers.map(p => `<option value="${p.value}" ${userConfig.llm_provider === p.value ? 'selected' : ''}>${p.name}</option>`).join('')}
                </select>
            </div>

            <div id="api-key-section" class="settings-form-group">
                <label for="api-key-input">API Key</label>
                <input type="password" id="api-key-input" class="settings-input" placeholder="Enter your API key">
            </div>

            <div id="model-section" class="settings-form-group">
                <label for="ai-model-selector">Model</label>
                <select id="ai-model-selector" class="settings-select"></select>
            </div>

            <div id="local-llm-section">
                <div class="settings-form-group">
                    <label for="local-url-input">Ollama URL</label>
                    <input type="text" id="local-url-input" class="settings-input" value="${userConfig.local_llm_url || ''}">
                </div>
                <div class="settings-form-group">
                    <label for="local-model-input">Model Name (e.g., llama3)</label>
                    <input type="text" id="local-model-input" class="settings-input" value="${userConfig.local_llm_model_name || ''}">
                </div>
            </div>
        `;

    this.updateAiProviderView();
    this.setupAiProviderListeners();
  }

  updateAiProviderView() {
    const userConfig = this.configService.get('user', {});
    const provider = userConfig.llm_provider;
    const allModels = this.configService.get('settings_options.ai_models', []);

    const apiKeySection = this.contentEl.querySelector('#api-key-section');
    const modelSection = this.contentEl.querySelector('#model-section'); // <-- KEEP this one
    const localLlmSection = this.contentEl.querySelector('#local-llm-section');
    const apiKeyInput = this.contentEl.querySelector('#api-key-input');
    const modelSelector = this.contentEl.querySelector('#ai-model-selector');

    apiKeySection.style.display = (provider === 'gemini' || provider === 'anthropic') ? 'block' : 'none';
    modelSection.style.display = (provider === 'gemini' || provider === 'anthropic') ? 'block' : 'none';
    localLlmSection.style.display = (provider === 'local') ? 'block' : 'none';

    if (provider === 'gemini') {
      apiKeyInput.value = localStorage.getItem('gemini_api_key') || '';
    }
    if (provider === 'anthropic') {
      apiKeyInput.value = localStorage.getItem('anthropic_api_key') || '';
    }

    const modelsForProvider = allModels.filter(m => m.provider === provider);
    // Update the <select> dropdown first
    modelSelector.innerHTML = modelsForProvider.map(m => `<option value="${m.value}" ${userConfig.model_name === m.value ? 'selected' : ''}>${m.name}</option>`).join('');

    // NEW: Render the model list for the current provider
    const modelListHtml = allModels
      .filter(m => m.provider === provider)
      .map(model => `
        <li class="agent-list-item">
          <div class="agent-info"><strong>${model.name}</strong><p>${model.value}</p></div>
          <button class="settings-action-btn delete-btn" data-action="delete-model" data-model-value="${model.value}" title="Delete Model">
            <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14H7L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          </button>
        </li>
      `).join('');

    let modelListContainer = modelSection.querySelector('#model-list-container');
    if (!modelListContainer) {
      modelListContainer = document.createElement('div');
      modelListContainer.id = 'model-list-container';
      modelSection.appendChild(modelListContainer);
    }

    modelListContainer.innerHTML = `
      <div class="settings-section" style="margin-top: 24px;">
        <h4>Available Models for ${provider}</h4>
        <ul id="model-list" class="agent-list">${modelListHtml}</ul>
        <button id="add-model-btn" class="settings-button" style="margin-top: 16px;">+ Add New Model</button>
      </div>
    `;
  }


  setupAiProviderListeners() {
    this.contentEl.querySelector('#ai-provider-selector').addEventListener('change', async (e) => {
      await this.configService.setConfig('user.llm_provider', e.target.value);
      this.updateAiProviderView();
      this.controller.llmOrchestrator.updateConfig();
    });

    this.contentEl.querySelector('#api-key-input').addEventListener('change', async (e) => {
      const provider = this.configService.getConfig('user.llm_provider');
      if (provider === 'gemini') {
        localStorage.setItem('gemini_api_key', e.target.value);
      }
      if (provider === 'anthropic') {
        localStorage.setItem('anthropic_api_key', e.target.value);
      }
      this.controller.llmOrchestrator.updateConfig();
      this.controller.showIndicator('API Key saved locally.', { duration: 2000 });
    });

    this.contentEl.querySelector('#ai-model-selector').addEventListener('change', async (e) => {
      await this.configService.setConfig('user.model_name', e.target.value);
      this.controller.llmOrchestrator.updateConfig();
    });

    this.contentEl.querySelector('#local-url-input').addEventListener('change', async (e) => {
      await this.configService.setConfig('user.local_llm_url', e.target.value);
      this.controller.llmOrchestrator.updateConfig();
    });

    this.contentEl.querySelector('#local-model-input').addEventListener('change', async (e) => {
      await this.configService.setConfig('user.local_llm_model_name', e.target.value);
      this.controller.llmOrchestrator.updateConfig();
    });

    this.contentEl.addEventListener('click', async e => {
      const button = e.target.closest('button');
      if (!button) return;

      if (button.id === 'add-model-btn') {
        this._openModelEditor();
      } else if (button.dataset.action === 'delete-model') {
        const modelValue = button.dataset.modelValue;
        const confirmed = await this.controller.confirm('Delete Model?', 'Are you sure you want to remove this model definition?');
        if (confirmed) {
          const models = this.configService.get('settings_options.ai_models');
          const updatedModels = models.filter(m => m.value !== modelValue);
          await this.configService.setConfig('settings_options.ai_models', updatedModels);
          this.navigateTo('ai-provider');
        }
      }
    });
  }

  async _openModelEditor() {
    this.modelModalWrapper.innerHTML = await loadHTML('html-templates/model-editor-modal.html');

    const modalContainer = document.getElementById('model-editor-modal-container');
    const modelBox = document.getElementById('model-editor-box');

    modalContainer.addEventListener('click', (e) => {
      if (e.target === modalContainer) {
        this.modelModalWrapper.innerHTML = '';
      }
    });

    document.getElementById('model-editor-save-btn').onclick = () => this._handleModelSave();
    document.getElementById('model-display-name').focus();
  }

  async _handleModelSave() {
    const provider = this.configService.get('user.llm_provider');
    const newModel = {
      name: document.getElementById('model-display-name').value.trim(),
      value: document.getElementById('model-api-id').value.trim(),
      provider: provider
    };

    if (!newModel.name || !newModel.value) {
      this.controller.showIndicator('Both fields are required.', { isError: true, duration: 3000 });
      return;
    }

    const models = this.configService.get('settings_options.ai_models');
    models.push(newModel);
    await this.configService.setConfig('settings_options.ai_models', models);

    this.modelModalWrapper.innerHTML = '';
    this.navigateTo('ai-provider');
    this.controller.showIndicator('Model added!', { duration: 2000 });
  }

  renderExport() {
    const books = this.controller.getAvailableBooks();
    this.contentEl.innerHTML = `
            <div class="settings-form-group">
                <label for="book-export-selector">Select Book to Export</label>
                <select id="book-export-selector" class="settings-select" ${books.length === 0 ? 'disabled' : ''}>
                    ${books.length > 0 ? books.map(book => `<option value="${book.filename}">${book.title}</option>`).join('') : '<option>No books available</option>'}
                </select>
            </div>
            <div class="settings-section">
                <h4>Export Formats</h4>
                <p class="settings-section-desc">Choose your desired file type.</p>
                <div class="settings-button-group">
                     <button id="export-docx-btn" class="settings-button" ${books.length === 0 ? 'disabled' : ''}>Export as .docx</button>
                     <button id="export-latex-btn" class="settings-button" ${books.length === 0 ? 'disabled' : ''}>Export as .tex</button>
                </div>
            </div>
        `;

    const selector = this.contentEl.querySelector('#book-export-selector');
    this.contentEl.querySelector('#export-docx-btn').addEventListener('click', () => {
      this.hide();
      this.controller.exportBookAsDocx(selector.value);
    });
    this.contentEl.querySelector('#export-latex-btn').addEventListener('click', () => {
      this.hide();
      this.controller.exportBookAsLatex(selector.value);
    });
  }

  renderData() {
    this.contentEl.innerHTML = `
            <div class="settings-section">
                <h4>Local Data</h4>
                <p class="settings-section-desc">Export your entire local database to a single file, or import a backup.</p>
                <div class="settings-button-group">
                     <button id="export-local-btn" class="settings-button">Export Local Backup</button>
                     <button id="import-local-btn" class="settings-button">Import from Backup</button>
                </div>
            </div>

            <div class="settings-section">
                <h4>Cloud Data</h4>
                <p class="settings-section-desc">Manage the application data stored in your Google Drive account.</p>
                <div class="settings-button-group">
                     <button id="data-manager-btn" class="settings-button">Manage Cloud Files</button>
                </div>
            </div>

            <div class="settings-section danger-zone">
                <h4>Danger Zone</h4>
                <p class="settings-section-desc">Permanently delete all local data and disconnect the application.</p>
                <div class="settings-button-group">
                     <button id="uninstall-btn" class="settings-button danger">Uninstall Application</button>
                </div>
            </div>
        `;

    this.contentEl.querySelector('#export-local-btn').addEventListener('click', () => {
      this.hide();
      this.controller.exportLocal();
    });
    this.contentEl.querySelector('#import-local-btn').addEventListener('click', () => {
      this.hide();
      this.controller.importLocal();
    });
    this.contentEl.querySelector('#data-manager-btn').addEventListener('click', () => {
      this.hide();
      this.controller.showDataManager();
    });
    this.contentEl.querySelector('#uninstall-btn').addEventListener('click', async () => {
      const confirmed = await this.controller.confirm(
        'Are you sure?',
        'This will delete all local data, including unsynced work, and reset the application. This cannot be undone.'
      );
      if (confirmed) {
        this.hide();
        this.controller.uninstall();
      }
    });
  }
}