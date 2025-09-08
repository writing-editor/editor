export class AiStudio {
  constructor(controller) {
    this.controller = controller;
    this.containerEl = document.getElementById('ai-studio-container');

    this.containerEl.addEventListener('click', this.handleClick.bind(this));
    document.addEventListener('keydown', this.handleKeydown.bind(this));

    this.formEl = document.getElementById('cp-form');
    this.formEl.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleWorkbenchSubmit();
    });
  }

  handleClick(e) {
    if (e.target === this.containerEl) {
      this.hide();
    }
  }

  handleKeydown(e) {
    if (e.key === 'Escape' && !this.containerEl.classList.contains('hidden')) {
      this.hide();
    }
  }

  // The show() method is now much simpler.
  show() {
    this.render();
    this.containerEl.classList.remove('hidden');
    this.updateWorkbenchContext();
    const workbenchInput = document.getElementById('workbench-input');
    workbenchInput?.focus();
  }

  hide() {
    this.containerEl.classList.add('hidden');
  }

  // Renders the simple, static UI for the workbench.
  render() {
    const panel = this.containerEl.querySelector('[data-panel="workbench"]');
    if (panel && !panel.querySelector('#workbench-input')) {
      panel.innerHTML = `
            <div class="workbench-container">
                <textarea id="workbench-input" placeholder="Ask the agent to... (e.g., 'summarize this section', 'suggest three alternative titles', 'check for inconsistencies')"></textarea>
                <div class="workbench-footer">
                    <span id="workbench-context-display">Context: Entire document</span>
                </div>
            </div>
        `;
      const workbenchInput = document.getElementById('workbench-input');
      if (workbenchInput) {
        workbenchInput.addEventListener('keydown', (e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault(); // Prevent new line in textarea
            this.formEl.requestSubmit();
            this.hide();
          }
        });
      }
    }
  }

  // Updates the context display based on editor selection.
  updateWorkbenchContext() {
    const contextDisplay = document.getElementById('workbench-context-display');
    if (!contextDisplay) return;

    const context = this.controller.getContext();
    if (context.context.type === 'selection') {
      contextDisplay.textContent = 'Context: Selected Text';
    } else {
      contextDisplay.textContent = 'Context: Entire Document';
    }
  }

  // Handles the core logic of running the DevelopmentAgent.
  async handleWorkbenchSubmit() {
    const userInput = document.getElementById('workbench-input')?.value.trim();
    if (!userInput) return;

    const payload = this.controller.getContext();
    payload.user_request = userInput; // Add the user's request to the payload

    const indicatorId = this.controller.showIndicator('Agent is working...');
    try {
      const ai_response = await this.controller.runDeveloper(payload);

      if (ai_response) {
        const blockData = {
          type: 'development',
          title: "Workbench Result",
          id: `dev_${Date.now()}`,
          content: { type: 'markdown', text: ai_response },
          is_open_by_default: true, // Auto-expand the result
        };
        this.controller.addMarginBlock(payload.current_view_id, blockData);
        this.hide(); // Hide the studio after submission
        this.controller.openRightDrawer('assistant'); // Show the result
      } else {
        this.controller.showIndicator('Agent returned no response.', { isError: true, duration: 3000 });
      }
    } catch (error) {
      console.error("Workbench execution failed:", error);
      this.controller.showIndicator(`Agent Error: ${error.message}`, { isError: true, duration: 5000 });
    } finally {
      this.controller.hideIndicator(indicatorId);
    }
  }
}