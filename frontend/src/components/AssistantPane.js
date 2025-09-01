// frontend/src/components/AssistantPane.js
import './RightDrawer.css';
import { renderBlocks } from '../utils/renderBlocks.js';

export class AssistantPane {
  constructor(app, bookService) { // <-- Receive bookService
    this.app = app; // For UI methods (drawers, etc.)
    this.bookService = bookService; // For data context
    this.element = document.getElementById('assistant-drawer');

    this.element.addEventListener('click', (e) => {
      const actionBtn = e.target.closest('.block-action-btn');
      if (!actionBtn) return;

      const blockId = actionBtn.dataset.blockId;
      // CORRECT: Get currentViewId from the single source of truth
      const currentViewId = this.bookService.currentViewId; 
      if (!currentViewId) return; // Safety check

      if (actionBtn.title === 'Pin Suggestion') {
        // We now call the service method directly via the App instance
        this.app.togglePinMarginBlock(currentViewId, blockId);
      } else if (actionBtn.title === 'Dismiss') {
        this.app.deleteMarginBlock(currentViewId, blockId);
      }
    });
  }

  render(blocksArray) {
    const blocks = blocksArray || [];
    this.element.innerHTML = `<div id="assistant-content-wrapper">${renderBlocks(blocks)}</div>`;
  }

  renderRewriteSuggestion(payload) {
    const html = `<div id="assistant-content-wrapper">${
    `
      <div class="suggestion-container"> 
        <h3>Rewrite Suggestion</h3>
        <div class="margin-block suggestion-block">
          <div class="suggestion-diff">
            <p><strong>Original:</strong> <del>${payload.original_text}</del></p>
            <hr>
            <p><strong>Suggestion:</strong> <ins>${payload.suggested_text}</ins></p>
          </div>
          <div class="suggestion-actions">
            <button id="accept-suggestion-btn">Accept</button>
            <button id="reject-suggestion-btn">Reject</button>
          </div>
        </div>
      </div>
    `}</div>`;
    this.element.innerHTML = html;

    // These event listeners are fine as they call App-level methods
    document.getElementById('accept-suggestion-btn').addEventListener('click', async () => {
      this.app.editor.replaceText(payload.range, payload.suggested_text);
      await this.app.restoreDefaultMargin();
      this.app.closeRightDrawer();
    });

    document.getElementById('reject-suggestion-btn').addEventListener('click', async () => {
      await this.app.restoreDefaultMargin();
      this.app.closeRightDrawer();
    });
  }
}