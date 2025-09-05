import './CommandPalette.css';

export class CommandPalette {
  constructor(controller, bookService, storageService) {
    this.controller = controller;
    this.bookService = bookService;
    this.storageService = storageService;
    this.containerEl = document.getElementById('command-palette-container');
    this.formEl = document.getElementById('cp-form');
    this.tabBar = document.getElementById('cp-tab-bar');
    this.contentArea = document.getElementById('cp-content-area');
    this.contextIndicator = document.getElementById('cp-context-indicator');

    this.activeTab = 'analyze';
    this.promptTemplates = {};
    this.capturedContext = null;

    this.containerEl.addEventListener('click', this.handlePaletteClick.bind(this));
    document.addEventListener('keydown', this.handleGlobalKeydown.bind(this));
  }

  handlePaletteClick(e) {
    const tabBtn = e.target.closest('.cp-tab-btn');
    if (tabBtn) {
      if (tabBtn.dataset.tab !== this.activeTab) {
        this.activeTab = tabBtn.dataset.tab;
        this.renderActiveTab();
      }
    } else if (e.target === this.containerEl) {
      this.hide();
    }
  }

  handleGlobalKeydown(e) {
    if (this.containerEl.classList.contains('hidden')) return;

    if (e.key === 'Escape') {
      this.hide();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      this.executeCommand();
    }
  }

  async executeCommand() {
    const action = this.activeTab.toUpperCase();
    const uiPayload = this.buildUiPayload();

    if (this.activeTab === 'analyze' || this.activeTab === 'rewrite') {
      const mainPromptEl = this.contentArea.querySelector('#cp-main-prompt');
      if (mainPromptEl) {
        const currentPromptInEditor = mainPromptEl.value;
        const originalPrompt = (this.activeTab === 'rewrite')
          ? (this.promptTemplates.REWRITE || '---').split('---')[1].trim()
          : this.promptTemplates.ANALYZE;

        if (currentPromptInEditor !== originalPrompt) {
          await this.savePromptTemplate(action, currentPromptInEditor);
        }
      }
    }

    const finalPayload = { ...uiPayload, ...this.capturedContext };
    this.hide();

    if (action === 'ANALYZE') {
      const ai_response = await this.controller.runAnalyst(finalPayload);
      if (ai_response) {
        const blockData = {
          type: 'analysis',
          title: "AI Analysis",
          id: `analysis_${Date.now()}`,
          content: { type: 'markdown', text: ai_response }
        };
        this.controller.addMarginBlock(this.bookService.currentViewId, blockData);
        this.controller.openRightDrawer('assistant');
      }
    } else if (action === 'REWRITE') {
      try {
        const rewritten_text = await this.controller.runRewrite(finalPayload);
        if (rewritten_text) {
          const suggestionPayload = {
            original_text: finalPayload.context.selected_text,
            suggested_text: rewritten_text,
            range: finalPayload.context.range
          };
          this.controller.renderRewriteSuggestion(suggestionPayload);
          this.controller.openRightDrawer('assistant');
        }
      } catch (error) {
        this.controller.showIndicator(error.message, { isError: true, duration: 3000 });
      }
    }
  }

  async show(activeTab = 'analyze') {
    this.containerEl.classList.remove('hidden');
    this.activeTab = activeTab;

    this.capturedContext = this.controller.getContext();

    if (Object.keys(this.promptTemplates).length === 0) {
      const analyzePrompt = await this.storageService.getFile('ANALYZE.txt');
      const rewritePrompt = await this.storageService.getFile('REWRITE.txt');
      this.promptTemplates = {
        ANALYZE: analyzePrompt || '',
        REWRITE: rewritePrompt || '',
      };
    }
    this.updateContextIndicator();
    this.renderActiveTab();
  }

  renderActiveTab() {
    this.tabBar.querySelectorAll('.cp-tab-btn').forEach(btn =>
      btn.classList.toggle('active', btn.dataset.tab === this.activeTab)
    );
    this.contentArea.querySelectorAll('.cp-tab-panel').forEach(panel => {
      panel.innerHTML = '';
      panel.classList.toggle('active', panel.dataset.panel === this.activeTab)
    });
    const panel = this.contentArea.querySelector(`.cp-tab-panel.active`);
    if (!panel) return;

    let html = '';
    switch (this.activeTab) {
      case 'analyze':
        html = `
          <div class="cp-input-group">
            <label class="cp-label">PROMPT TEMPLATE</label>
            <textarea class="cp-prompt-textarea" id="cp-main-prompt">${this.promptTemplates.ANALYZE || ''}</textarea>
          </div>
          <div class="cp-input-group">
            <label class="cp-label">SPECIFIC REQUEST (OPTIONAL)</label>
            <textarea class="cp-prompt-textarea" id="cp-user-request" placeholder="Example: 'Focus on the historical context.'"></textarea>
          </div>
        `;
        break;
      case 'rewrite':
        const [system_instruction = '', core_prompt = ''] = (this.promptTemplates.REWRITE || '---').split('---');
        html = `
          <div class="cp-input-group">
            <label class="cp-label">CORE PROMPT TEMPLATE</label>
            <textarea class="cp-prompt-textarea" id="cp-main-prompt">${core_prompt.trim()}</textarea>
          </div>
          <div class="cp-input-group">
            <label class="cp-label">SPECIFIC INSTRUCTION (OPTIONAL)</label>
            <textarea class="cp-prompt-textarea" id="cp-user-request" placeholder="Example: 'Make it more professional.'"></textarea>
          </div>
        `;
        break;
    }
    panel.innerHTML = html;
    panel.querySelector('textarea, input')?.focus();
  }

  hide() {
    this.containerEl.classList.add('hidden');
    this.capturedContext = null;
  }

  updateContextIndicator() {
    const hasSelection = this.capturedContext?.context?.type === 'selection';
    this.contextIndicator.classList.toggle('hidden', !hasSelection);

    const rewriteTabButton = this.tabBar.querySelector('[data-tab="rewrite"]');
    if (rewriteTabButton) {
      rewriteTabButton.disabled = !hasSelection;
    }

    if (!hasSelection && this.activeTab === 'rewrite') {
      this.activeTab = 'analyze';
    }
  }

  buildUiPayload() {
    let payload = {};
    const activePanel = this.contentArea.querySelector('.cp-tab-panel.active');
    const userInputEl = activePanel.querySelector('#cp-user-request');
    const mainPromptEl = activePanel.querySelector('#cp-main-prompt');

    if (this.activeTab === 'analyze') {
      payload = {
        prompt_template: mainPromptEl ? mainPromptEl.value : '',
        user_request: userInputEl ? userInputEl.value.trim() : '',
      };
    } else if (this.activeTab === 'rewrite') {
      const corePrompt = mainPromptEl ? mainPromptEl.value : '';
      const systemInstruction = (this.promptTemplates.REWRITE || '---').split('---')[0];
      const fullPromptTemplate = `${systemInstruction}---\n${corePrompt}`;
      payload = {
        prompt_template: fullPromptTemplate,
        user_request: userInputEl ? userInputEl.value.trim() : '',
      };
    }
    return payload;
  }

  async savePromptTemplate(agentName, content) {
    let indicatorId = this.controller.showIndicator('Saving Template...');
    let fullContent = content;

    if (agentName === 'REWRITE') {
      const system_instruction = (this.promptTemplates.REWRITE || '---').split('---')[0];
      fullContent = `${system_instruction}---\n${content}`;
    }

    await this.storageService.saveFile(`${agentName}.txt`, fullContent);

    this.promptTemplates[agentName] = fullContent;
    this.controller.hideIndicator(indicatorId);
    this.controller.showIndicator('Template Saved!', { duration: 2000 });
  }
}