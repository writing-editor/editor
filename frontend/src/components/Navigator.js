export class Navigator {
  constructor(controller, bookService) {
    this.controller = controller;
    this.bookService = bookService;
    this.drawerEl = document.getElementById('navigator-drawer');
    this.isEditingTitle = false;
    this.clickTimer = null;

    this.drawerEl.addEventListener('click', this.handleClick.bind(this));
    this.drawerEl.addEventListener('dblclick', this.handleDoubleClick.bind(this));
  }

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

    if (action === 'show-library') this.showLibrary();
    else if (action === 'pin-book') this.pinBook(target.dataset.filename);
    else if (action === 'switch-book') { this.bookService.switchBook(target.dataset.filename); this.close(); }
    else if (action === 'new-book') this.createNewBook();
    else if (action === 'delete-document') this.deleteDocument(target.dataset.filename, target.dataset.title);
    else if (action === 'new-section') { e.stopPropagation(); this.createNewSection(target.dataset.chapterId); }
    else if (action === 'new-chapter') { e.stopPropagation(); this.createNewChapter(); }
    else if (viewId) { this.bookService.changeView(viewId); this.close(); }
  }

  async createNewBook() {
    const title = await this.controller.prompt('Create New Book', 'Enter book title...');
    if (title) {
      const indicatorId = this.controller.showIndicator('Creating Book...');
      try {
        const { filename } = await this.bookService.createNewBook(title);
        if (filename) {
          await this.showLibrary();
          await this.bookService.switchBook(filename);
          this.open();
        } else {
          this.controller.showIndicator('Error Creating Book', { isError: true, duration: 3000 });
        }
      } finally {
        this.controller.hideIndicator(indicatorId);
      }
    }
  }

  async createNewChapter() {
    const title = await this.controller.prompt('Create New Chapter', 'Enter chapter title...');
    if (title) {
      await this.bookService.createNewChapter(title);
    }
  }

  async createNewSection(chapterId) {
    const title = await this.controller.prompt('Create New Section', 'Enter section title...');
    if (title) {
      await this.bookService.createNewSection(chapterId, title);
    }
  }

  async renameBook(newTitle) {
    return await this.bookService.renameBook(newTitle);
  }

  async deleteDocument(filename, title) {
    const isConfirmed = await this.controller.confirm(
      'Delete Document',
      `Are you sure you want to permanently delete "${title}"? This cannot be undone.`
    );
    if (isConfirmed) {
      const indicatorId = this.controller.showIndicator('Deleting...');
      try {
        await this.bookService.deleteBook(filename);
        await this.controller.rebuildSearchIndex();
        this.controller.showIndicator('Document Deleted', { duration: 2000 });

        if (this.bookService.currentBook && this.bookService.currentBook.filename === filename) {
          await this.bookService.loadInitialBook();
        } else {
          await this.showLibrary();
        }
      } finally {
        this.controller.hideIndicator(indicatorId);
      }
    }
  }

  async pinBook(filename) {
    const indicatorId = this.controller.showIndicator('Setting default...');
    try {
      await this.bookService.pinBook(filename);
      this.controller.showIndicator('Default book set!', { duration: 1500 });
      await this.showLibrary();
    } finally {
      this.controller.hideIndicator(indicatorId);
    }
  }

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
      const pinButtonClass = isPinned ? 'nav-action-btn pin-btn is-pinned' : 'nav-action-btn pin-btn';
      const pinButtonTitle = isPinned ? 'Default document' : 'Set as default';

      html += `
        <div class="nav-library-item">
          <span class="nav-item-text nav-link" data-action="switch-book" data-filename="${doc.filename}">
            ${doc.title}
          </span>
          <div class="nav-item-actions">
            <button class="${pinButtonClass}" data-action="pin-book" data-filename="${doc.filename}" title="${pinButtonTitle}">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none"
                stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 2v6l3 2-9 9-3-3 9-9-2-3H2V2h10z"/>
              </svg>
            </button>
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

    // The HTML construction is correct...
    let html = `
      <button class="app-back-btn nav-back-btn" data-action="show-library" title="Back to Library">
        <svg viewBox="0 0 24 24"><path d="M19 12H5m7 7-7-7 7-7"/></svg>
      </button>
    `;
    html += `<div class="book-title-container"><h2 class="nav-link" data-view-id="${book.id}" data-action="edit-book-title">${bookTitle}</h2></div>`;

    chapters.forEach(chapter => {
      html += `
          <details class="nav-chapter-group" open>
            <summary class="nav-chapter-summary">
              <!-- Add the 'nav-link' class here -->
              <span class="nav-chapter-text nav-link" data-view-id="${chapter.id}">${chapter.title || 'Untitled Chapter'}</span>
              <span class="nav-new-section-btn" data-action="new-section" data-chapter-id="${chapter.id}" title="New Section">+</span>
            </summary>
            <div class="nav-section-container">
              <!-- Add the 'nav-link' class here -->
              ${(chapter.sections || []).map(s => `<div class="nav-item nav-section nav-link" data-view-id="${s.id}">${s.title}</div>`).join('')}
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