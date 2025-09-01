// frontend/src/components/CommandPalette.js
import './CommandPalette.css';
import { request } from '../utils/api.js';

export class CommandPalette {
  constructor(app, bookService, storageService) {  // <-- Receive the bookService
    this.app = app; // For UI (modals, indicators, agents)
    this.bookService = bookService; // For data context
    this.storageService = storageService; // <-- Store reference
    this.containerEl = document.getElementById('command-palette-container');
    this.formEl = document.getElementById('cp-form');
    this.tabBar = document.getElementById('cp-tab-bar');
    this.contentArea = document.getElementById('cp-content-area');
    this.contextIndicator = document.getElementById('cp-context-indicator');

    this.activeTab = 'analyze';
    this.promptTemplates = {};

    this.containerEl.addEventListener('click', this.handlePaletteClick.bind(this));
    document.addEventListener('keydown', this.handleGlobalKeydown.bind(this));
  }

  // --- Main Event Handlers ---
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
    if (e.ctrlKey && e.key === 'Enter') {
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

    // CORRECTED: getContextPayload now works correctly
    const finalPayload = { ...uiPayload, ...this.getContextPayload() };
    this.hide();

    if (action === 'ANALYZE') {
      const ai_response = await this.app.analystAgent.run(finalPayload);
      if (ai_response) {
        const blockData = {
          type: 'analysis',
          title: "AI Analysis",
          id: `analysis_${Date.now()}`,
          content: { type: 'markdown', text: ai_response }
        };
        // CORRECT: Get currentViewId from the service
        this.app.addMarginBlock(this.bookService.currentViewId, blockData);
        this.app.openRightDrawer('assistant');
      }
    } else if (action === 'REWRITE') {
      const rewritten_text = await this.app.rewriteAgent.run(finalPayload);
      if (rewritten_text) {
        const suggestionPayload = {
          original_text: finalPayload.context.selected_text,
          suggested_text: rewritten_text,
          range: finalPayload.context.range
        };
        this.app.assistantPane.renderRewriteSuggestion(suggestionPayload);
        this.app.openRightDrawer('assistant');
      }
    }
  }

  async show() {
    this.containerEl.classList.remove('hidden');
    // Fetch all prompts from IndexedDB instead of the network
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
  }

  updateContextIndicator() {
    const selection = this.app.editor.instance.state.selection;
    const hasSelection = !selection.empty;
    this.contextIndicator.classList.toggle('hidden', !hasSelection);
    const rewriteTabButton = this.tabBar.querySelector('[data-tab="rewrite"]');
    if (rewriteTabButton) {
      rewriteTabButton.disabled = !hasSelection;
    }
    if (!hasSelection && this.activeTab === 'rewrite') {
      this.activeTab = 'analyze';
    }
  }

  // --- Payload and Context Helpers ---
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

  // --- THIS IS THE MAIN FIX ---
  getContextPayload() {
    const selection = this.app.editor.instance.state.selection;
    let context = {};
    if (!selection.empty) {
      context = {
        type: 'selection',
        selected_text: this.app.editor.instance.state.doc.textBetween(selection.from, selection.to),
        range: { from: selection.from, to: selection.to }
      };
    } else {
      context = {
        type: 'global',
        view_content: this.app.editor.instance.getJSON(),
      };
    }

    // CORRECT: Get state from the bookService, not the app instance.
    // Add optional chaining (?.) for safety during initialization.
    return {
      context: context,
      current_book_filename: this.bookService.currentBook?.filename,
      current_view_id: this.bookService.currentViewId,
    };
  }

  async savePromptTemplate(agentName, content) {
    let indicatorId = this.app.showIndicator('Saving Template...');
    let fullContent = content;

    // For rewrite, re-attach the locked system instruction
    if (agentName === 'REWRITE') {
      const system_instruction = (this.promptTemplates.REWRITE || '---').split('---')[0];
      fullContent = `${system_instruction}---\n${content}`;
    }

    // Save to IndexedDB
    await this.storageService.saveFile(`${agentName}.txt`, fullContent);

    // Refresh local cache
    this.promptTemplates[agentName] = fullContent;
    this.app.hideIndicator(indicatorId);
    this.app.showIndicator('Template Saved!', { duration: 2000 });
  }
}