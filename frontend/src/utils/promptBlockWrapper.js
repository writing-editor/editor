// frontend/src/utils/promptBlockWrapper.js

// We no longer need the 'marked' library here.

// A small helper to prevent any accidental HTML in the prompt from rendering.
function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}


export function promptBlockWrapper(config) {
  const { id, title, content } = config;

  // THE FIX: Instead of parsing Markdown, we safely escape the text
  // and wrap it in a <pre> tag to preserve line breaks and spacing.
  const safeContent = escapeHtml(content || '*No prompt content found. Click edit to add.*');
  const previewHtml = `<pre class="prompt-preview-text">${safeContent}</pre>`;

  return `
    <details class="block-container prompt-block" data-prompt-id="${id}">
      <summary class="block-header">
        <div class="prompt-header-content">
            <span class="block-title">${title}</span>
        </div>
        <div class="block-actions">
          <button class="block-action-btn edit-btn" data-action="edit-prompt" title="Edit Prompt">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none"
              stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 20h9"/>
              <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4 12.5-12.5z"/>
            </svg>
          </button>
        </div>
      </summary>
      <div class="block-content">${previewHtml}</div>
    </details>
  `;
}