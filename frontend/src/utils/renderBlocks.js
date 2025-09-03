import { marked } from 'marked';

/**
 * Takes an array of block data objects and returns an HTML string.
 * This is used by both the MarginPane and the CommandPalette's "Find Notes" tab.
 * @param {Array<object>} blocks - The array of block objects to render.
 * @returns {string} The generated HTML string.
 */
export function renderBlocks(blocks) {
  if (!blocks || blocks.length === 0) {
    return '<p class="margin-placeholder">No items to display.</p>';
  }

  // Sort blocks: Pinned items first, then by newest ID.
  const sortedBlocks = blocks.sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    // Assuming IDs are timestamp-based, this sorts newest first
    return (b.id || '').localeCompare(a.id || '');
  });

  // Map each block object to its HTML representation
  return sortedBlocks.map(block => {
    const contentHtml = marked.parse(block.content?.text || '');
    const isPinnedClass = block.pinned ? 'is-pinned' : '';

    return `
    <details class="block-container" ${block.is_open_by_default ? 'open' : ''}>
      <summary class="block-header">
        <!-- Pin Button -->
        <button class="block-action-btn ${isPinnedClass}" data-block-id="${block.id}" title="Pin Suggestion">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none"
            stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2v6l3 2-9 9-3-3 9-9-2-3H2V2h10z"/>
          </svg>
        </button>

        <span class="block-title">${block.title || 'Untitled'}</span>

        <div class="block-actions">
          <!-- Dismiss Button -->
          <button class="block-action-btn" data-block-id="${block.id}" title="Dismiss">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none"
              stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-2 14H7L5 6"/>
              <path d="M10 11v6"/>
              <path d="M14 11v6"/>
              <path d="M9 6V4h6v2"/>
            </svg>
          </button>
        </div>
      </summary>
      <div class="block-content">
        ${block.context_title ? `<div class="block-context-title">${block.context_title}</div>` : ''}
        ${contentHtml}
      </div>
    </details>
  `;
  }).join('');
}