import './RightDrawer.css';
import './AssistantPane.css'; 
import { renderBlocks } from '../utils/renderBlocks.js';

export class AssistantPane {
  constructor(controller, bookService) {
    this.controller = controller;
    this.bookService = bookService;
    this.element = document.getElementById('assistant-drawer');

    this.element.addEventListener('click', (e) => {
      const actionBtn = e.target.closest('.block-action-btn');
      if (!actionBtn) return;

      const blockId = actionBtn.dataset.blockId;
      const currentViewId = this.bookService.currentViewId;
      if (!currentViewId) return;

      if (actionBtn.title === 'Pin Suggestion') {
        this.controller.togglePinMarginBlock(currentViewId, blockId);
      } else if (actionBtn.title === 'Dismiss') {
        this.controller.deleteMarginBlock(currentViewId, blockId);
      }
    });
  }

  render(blocksArray) {
    const blocks = blocksArray || [];
    this.element.innerHTML = `<div id="assistant-content-wrapper">${renderBlocks(blocks)}</div>`;
  }

  renderRewriteSuggestion(payload) {
    const html = `<div id="assistant-content-wrapper">${`
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

    document.getElementById('accept-suggestion-btn').addEventListener('click', async () => {
      this.controller.replaceEditorText(payload.range, payload.suggested_text);
      this.controller.closeRightDrawer();
      await this.controller.restoreDefaultMargin();
    });

    document.getElementById('reject-suggestion-btn').addEventListener('click', async () => {
      await this.controller.restoreDefaultMargin();
      this.controller.closeRightDrawer();
    });
  }
}