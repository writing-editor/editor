import { generateHTML } from '@tiptap/html';
import StarterKit from '@tiptap/starter-kit';

export function noteBlockWrapper(note) {
  const isPinnedClass = note.pinned ? 'is-pinned' : '';

  const readOnlyContentHtml = generateHTML(note.content_json, [StarterKit]);

  let tagsHtml = '';
  if (note.tags && note.tags.length > 0) {
    tagsHtml = `
      <div class="block-tags">
        ${note.tags.map(tag =>
      `<span class="note-tag" data-action="filter-by-tag" data-tag="${tag}">#${tag}</span>`
    ).join('')}
      </div>
    `;
  }

  return `
    <details class="block-container note-block" id="container-${note.id}" data-note-id="${note.id}">
      <summary class="block-header">
        <!-- Pin Icon -->
        <button class="block-action-btn ${isPinnedClass}" data-block-id="${note.id}" data-action="pin-note" title="Pin Note">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" 
            stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2v6l3 2-9 9-3-3 9-9-2-3H2V2h10z"/>
          </svg>
        </button>

        <span class="block-title">${note.title}</span>
        ${tagsHtml}
        <div class="block-actions">
          <!-- Edit Icon -->
          <button class="block-action-btn edit-btn" data-action="edit-note" title="Edit Note">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none"
              stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 20h9"/>
              <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4 12.5-12.5z"/>
            </svg>
          </button>

          <!-- Delete Icon -->
          <button class="block-action-btn" data-action="delete-note" title="Delete Note">
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
      <div class="block-content read-only-view">${readOnlyContentHtml}</div>
    </details>
  `;
}
