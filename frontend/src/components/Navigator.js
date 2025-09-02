// frontend/src/components/Navigator.js
import './navigator.css';
export class Navigator {
  constructor(app, bookService) {
    this.app = app; // For modals, indicators
    this.bookService = bookService; // The single source of truth for data ops
    this.drawerEl = document.getElementById('navigator-drawer');
    this.isEditingTitle = false;
    this.clickTimer = null;

    this.drawerEl.addEventListener('click', this.handleClick.bind(this));
    this.drawerEl.addEventListener('dblclick', this.handleDoubleClick.bind(this));
  }

  // --- Event Handlers ---

  handleDoubleClick(e) {
    const titleTarget = e.target.closest('[data-action="edit-book-title"]');
    if (titleTarget) {
      clearTimeout(this.clickTimer);
      this.clickTimer = null;
      this.makeTitleEditable(titleTarget);
    }
  }

  handleClick(e) {
    const target = e.target.closest('[data-view-id], [data-action]');
    if (!target) return;

    const action = target.dataset.action;
    const viewId = target.dataset.viewId;

    if (action === 'edit-book-title') {
      e.preventDefault();
      if (!this.clickTimer) {
        this.clickTimer = setTimeout(() => {
          this.bookService.changeView('full_book');
          this.close();
          this.clickTimer = null;
        }, 250);
      }
      return;
    }

    // Actions now delegate to bookService or are pure UI
    if (action === 'show-library') this.showLibrary();
    else if (action === 'pin-book') this.pinBook(target.dataset.filename);
    else if (action === 'switch-book') { this.bookService.switchBook(target.dataset.filename); this.close(); }
    else if (action === 'new-book') this.createNewBook();
    else if (action === 'delete-document') this.deleteDocument(target.dataset.filename, target.dataset.title);
    else if (action === 'new-section') { e.stopPropagation(); this.createNewSection(target.dataset.chapterId); }
    else if (action === 'new-chapter') { e.stopPropagation(); this.createNewChapter(); }
    else if (viewId) { this.bookService.changeView(viewId); this.close(); }
  }

  // --- Data Manipulation Methods (Simplified to delegate to BookService) ---

  async createNewBook() {
    const title = await this.app.modalInput.show('Create New Book', 'Enter book title...');
    if (title) {
      const indicatorId = this.app.showIndicator('Creating Book...');
      // The BookService now handles creating the book in IndexedDB
      const { filename } = await this.bookService.createNewBook(title);
      this.app.hideIndicator(indicatorId);

      if (filename) {
        await this.showLibrary(); // Refresh the navigator view from IndexedDB
        await this.bookService.switchBook(filename);
        this.open();
      } else {
        this.app.showIndicator('Error Creating Book', { isError: true, duration: 3000 });
      }
    }
  }

  async createNewChapter() {
    const title = await this.app.modalInput.show('Create New Chapter', 'Enter chapter title...');
    if (title) {
      await this.bookService.createNewChapter(title);
    }
  }

  async createNewSection(chapterId) {
    const title = await this.app.modalInput.show('Create New Section', 'Enter section title...');
    if (title) {
      await this.bookService.createNewSection(chapterId, title);
    }
  }

  async renameBook(newTitle) {
    return await this.bookService.renameBook(newTitle);
  }

  async deleteDocument(filename, title) {
    const isConfirmed = await this.app.confirmationModal.show(
      'Delete Document',
      `Are you sure you want to permanently delete "${title}"? This cannot be undone.`
    );
    if (isConfirmed) {
      const indicatorId = this.app.showIndicator('Deleting...');
      await this.bookService.deleteBook(filename); // Delegate to BookService
      await this.app.rebuildSearchIndex();
      this.app.hideIndicator(indicatorId);
      this.app.showIndicator('Document Deleted', { duration: 2000 });

      // If the active book was deleted, the bookService will handle the state change.
      // We just need to refresh the library view.
      if (this.bookService.currentBook && this.bookService.currentBook.filename === filename) {
        await this.bookService.loadInitialBook();
      } else {
        await this.showLibrary();
      }
    }
  }

  async pinBook(filename) {
    const indicatorId = this.app.showIndicator('Setting default...');

    await this.bookService.pinBook(filename);

    this.app.hideIndicator(indicatorId);
    this.app.showIndicator('Default book set!', { duration: 1500 });
    await this.showLibrary();
  }

  // --- UI and Helper Methods ---

  async showLibrary() {
    await this.bookService.refreshLibrary();
  }

  makeTitleEditable(titleElement) {
    if (this.isEditingTitle) return;
    this.isEditingTitle = true;
    const currentTitle = titleElement.textContent;
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentTitle;
    input.className = 'nav-title-input';
    titleElement.replaceWith(input);
    input.focus();
    input.select();

    const finishEditing = async () => {
      input.removeEventListener('blur', finishEditing);
      input.removeEventListener('keydown', handleKeydown);
      const newTitle = input.value.trim();
      let renameSucceeded = false;
      if (newTitle && newTitle !== currentTitle) {
        renameSucceeded = await this.renameBook(newTitle);
      }
      if (!renameSucceeded) {
        input.replaceWith(titleElement);
      }
      this.isEditingTitle = false;
    };

    const handleKeydown = (e) => {
      if (e.key === 'Enter') finishEditing();
      if (e.key === 'Escape') { input.value = currentTitle; input.blur(); }
    };
    input.addEventListener('blur', finishEditing);
    input.addEventListener('keydown', handleKeydown);
  }

  render(navigatorState) {
    if (navigatorState.navigatorView === 'library') {
      this.renderLibraryView(navigatorState.availableBooks, navigatorState.pinnedBook);
    } else if (navigatorState.currentBook) {
      this.renderContentsView(navigatorState.currentBook);
    } else {
      this.renderLibraryView(navigatorState.availableBooks, navigatorState.pinnedBook);
    }
  }

  renderLibraryView(documents, pinnedBook) {
    let html = `<h2>Documents</h2><hr class="nav-divider">`;
    (documents || []).forEach(doc => {
      const isPinned = doc.filename === pinnedBook;
      // Conditionally add an 'is-pinned' class
      const pinButtonClass = isPinned ? 'nav-action-btn pin-btn is-pinned' : 'nav-action-btn pin-btn';
      // Change the title based on state
      const pinButtonTitle = isPinned ? 'Default document' : 'Set as default';

      html += `
        <div class="nav-library-item">
          <span class="nav-item-text" data-action="switch-book" data-filename="${doc.filename}">
            ${doc.title}
          </span>
          <div class="nav-item-actions">
            <!-- Pin Button now uses dynamic class and title -->
            <button class="${pinButtonClass}" data-action="pin-book" data-filename="${doc.filename}" title="${pinButtonTitle}">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none"
                stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 2v6l3 2-9 9-3-3 9-9-2-3H2V2h10z"/>
              </svg>
            </button>

            <!-- Delete Button -->
            <button class="nav-action-btn delete-btn" data-action="delete-document" data-filename="${doc.filename}" data-title="${doc.title}" title="Delete Document">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none"
                stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-2 14H7L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
              </svg>
            </button>
          </div>
        </div>
      `;
    });
    html += `<hr class="nav-divider"><div class="nav-item nav-action" data-action="new-book">+ New Document</div>`;
    this.drawerEl.innerHTML = html;
  }

  renderContentsView(book) {
    const bookTitle = book?.title || 'Untitled';
    const chapters = book?.structure?.chapters || [];
    let html = `<div class="nav-back-to-library" data-action="show-library" title="Back to Library">&larr;</div>`;
    html += `<div class="book-title-container"><div class="nav-item nav-action"><h2 data-view-id="${book.id}" data-action="edit-book-title">${bookTitle}</h2></div></div>`;

    chapters.forEach(chapter => {
      html += `
        <details class="nav-chapter-group" open>
          <summary class="nav-chapter-summary">
            <span class="nav-chapter-text" data-view-id="${chapter.id}">${chapter.title || 'Untitled Chapter'}</span>
            <span class="nav-new-section-btn" data-action="new-section" data-chapter-id="${chapter.id}" title="New Section">+</span>
          </summary>
          <div class="nav-section-container">
            ${(chapter.sections || []).map(s => `<div class="nav-item nav-section" data-view-id="${s.id}">${s.title}</div>`).join('')}
          </div>
        </details>`;
    });

    html += `<hr class="nav-divider"><div class="nav-item nav-action" data-action="new-chapter">+ New Chapter</div>`;
    this.drawerEl.innerHTML = html;
  }

  toggle() { this.drawerEl.classList.toggle('is-open'); }
  close() { this.drawerEl.classList.remove('is-open'); document.body.classList.remove('drawer-is-open'); }
  isOpen() { return this.drawerEl.classList.contains('is-open'); }
  open() { this.drawerEl.classList.add('is-open'); document.body.classList.add('drawer-is-open'); }
}