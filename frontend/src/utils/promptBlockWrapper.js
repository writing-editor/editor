// frontend/src/utils/promptBlockWrapper.js

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

  // NEW: Content is now an object. We preview the user-editable part.
  const userContent = content ? content.user : '*No prompt content found. Click edit to add.*';
  const safeContent = escapeHtml(userContent);
  const previewHtml = `<pre class="prompt-preview-text">${safeContent}</pre>`;

  return `
    <details class="block-container prompt-block" data-prompt-id="${id}">
      <summary class="block-header">
        <div class="prompt-header-content">
            <span class="block-title">${title}</span>
        </div>
        <div class="block-actions">
          <button class="block-action-btn edit-btn" data-action="edit-prompt" title="Edit Prompt">
            <svg xmlns="http://www.w.org/2000/svg" width="16" height="16" fill="none"
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