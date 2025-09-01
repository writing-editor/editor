// frontend/src/services/BookService.js

import { debounce } from '../utils/api.js';
// We no longer import request here, as BookService should not make API calls for core ops.
// It will only be used for optional sync/backup features later.

// --- Default content for a first-time run ---
const DEFAULT_USER_MANUAL = {
  metadata: { title: "User Manual" },
  chapters: [{
    id: "ch_manual_1",
    title: "Welcome to the Intelligent Editor",
    content_json: {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Welcome!" }] },
        { type: "paragraph", content: [{ type: "text", text: "This is your user manual. It is also a fully functional document you can explore." }] },
        { type: "heading", attrs: { level: 3 }, content: [{ type: "text", text: "The Navigator" }] },
        { type: "paragraph", content: [{ type: "text", text: "Use the hamburger menu icon (☰) in the top-left to open the navigator. From there, you can see all your documents or the chapter/section structure of the current document." }] },
        { type: "heading", attrs: { level: 3 }, content: [{ type: "text", text: "AI Assistant & Notebook" }] },
        { type: "paragraph", content: [{ type: "text", text: "Use the icons in the top-right to open the AI Assistant and your personal Notebook. Select some text in the editor and press Ctrl+K (or Cmd+K) to open the Command Palette and interact with the AI." }] }
      ]
    }
  }]
};

const DEFAULT_PROMPTS = {
  'ANALYZE.txt': "Your task is to provide a detailed analysis of the following text. Focus on {user_request}. Text to analyze:\n---\n{text_to_analyze}",
  'REWRITE.txt': "You are a professional editor. Rewrite the following text to address the user's request. Only return the rewritten text, with no extra commentary or markdown.\n---\nUser Request: {user_request}\nText to rewrite:\n{text_to_analyze}"
};


/**
 * Manages all book-related data and state using the browser's IndexedDB via StorageService.
 * This class is the single source of truth for all document and prompt data.
 */
export class BookService {
  constructor(appController, storageService) { // <-- Receives storageService
    this.appController = appController;
    this.storageService = storageService; // <-- Store the reference

    // --- State Management ---
    this.currentBook = null;
    this.currentViewId = null;
    this.pinnedBook = null;
    this.availableBooks = [];
    this.navigatorView = 'contents';
    this.metadata = {};

    this.saveMetadata = debounce(this._saveMetadata.bind(this), 2000);
  }

  // --- Public State Accessor ---
  getStateForNavigator() {
    return {
      navigatorView: this.navigatorView,
      availableBooks: this.availableBooks,
      currentBook: this.currentBook,
      pinnedBook: this.pinnedBook
    };
  }

  // --- Data Loading and Initialization ---

  async loadInitialBook() {
    await this.checkForFirstRun(); // Check if we need to seed the database
    await this.refreshLibrary();

    const pinnedBookFilename = await this.storageService.getFile('pinned.txt');
    if (pinnedBookFilename) {
      // Check if the pinned book actually exists in the DB
      const bookExists = this.availableBooks.some(book => book.filename === pinnedBookFilename);
      if (bookExists) {
        await this.switchBook(pinnedBookFilename);
      } else {
        // Pinned book is invalid, clear it
        await this.storageService.deleteFile('pinned.txt');
        console.warn("Cleared invalid pinned book reference.");
      }
    } else {
      console.log("No pinned book found. Displaying library.");
      // If no book is pinned, we simply remain in the library view.
    }
  }

  async checkForFirstRun() {
    const hasRunFlag = await this.storageService.getFile('initial_setup_complete');
    if (hasRunFlag) {
      return; // Not the first run
    }

    console.log("Performing first-time setup: Seeding database with default content...");
    // 1. Save the user manual
    await this.storageService.saveFile('user-manual.book', DEFAULT_USER_MANUAL);
    // 2. Save the default prompts
    for (const [filename, content] of Object.entries(DEFAULT_PROMPTS)) {
      await this.storageService.saveFile(filename, content);
    }
    // 3. Pin the user manual as the default book to show
    await this.storageService.saveFile('pinned.txt', 'user-manual');
    // 4. Set the flag so this doesn't run again
    await this.storageService.saveFile('initial_setup_complete', true);
    console.log("First-time setup complete.");
  }

  async refreshLibrary() {
    this.navigatorView = 'library';
    this.pinnedBook = await this.storageService.getFile('pinned.txt');
    const bookFiles = await this.storageService.getAllFilesBySuffix('.book');
    this.availableBooks = bookFiles.map(file => ({
      filename: file.id.replace('.book', ''),
      title: file.content.metadata.title,
    }));
    this.appController.renderNavigator(this.getStateForNavigator());
  }

  async switchBook(filename) {
    this.navigatorView = 'contents';
    const bookFileContent = await this.storageService.getFile(`${filename}.book`);

    if (bookFileContent) {
      this.currentBook = {
        filename: filename,
        title: bookFileContent.metadata.title,
        ...bookFileContent,
        structure: this._getBookStructure(bookFileContent),
      };

      await this.loadMetadata(filename); // Metadata is also in IndexedDB now
      this.appController.renderNavigator(this.getStateForNavigator());

      const firstViewId = this.currentBook.structure.chapters[0]?.id;
      if (firstViewId) {
        this.changeView(firstViewId);
      } else {
        this.appController.renderEditor({ type: 'doc', content: [] });
        this.appController.renderAssistantPane([]);
      }
    }
  }

  async changeView(viewId) {
    this.currentViewId = viewId;
    const viewData = this._getViewData(viewId); // Gets data from in-memory state
    if (viewData) {
      this.appController.renderEditor(viewData.editor_content);
      const marginBlocks = this.metadata.margin_blocks?.[viewId] || [];
      this.appController.renderAssistantPane(marginBlocks);
      const isEditable = viewId !== 'full_book';
      this.appController.setEditorEditable(isEditable);
      const shouldDisableAgents = this.currentBook.filename === 'user-manual';
      this.appController.setAgentButtonsDisabled(shouldDisableAgents);
    }
  }

  // --- Metadata Management (Now uses StorageService) ---

  async loadMetadata(filename) {
    const metadata = await this.storageService.getFile(`${filename}.metadata.json`);
    this.metadata = metadata || {};
  }

  async _saveMetadata() {
    if (!this.currentBook) return;
    const indicatorId = this.appController.showIndicator('Syncing analysis...');
    await this.storageService.saveFile(`${this.currentBook.filename}.metadata.json`, this.metadata);
    this.appController.hideIndicator(indicatorId);
  }

  // --- Book Manipulation Methods (Create, Rename, etc.) ---

  async createNewBook(title) {
    let filename = title.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, '');
    const existingBooks = await this.storageService.getAllFilesBySuffix('.book');
    const filenameExists = existingBooks.some(book => book.id === `${filename}.book`);

    if (filenameExists || !filename) {
      filename = `${filename}-${Date.now()}`;
    }

    const newBookContent = {
      metadata: { title: title },
      chapters: [{ id: "ch1", title: "Chapter 1", content_json: { type: "doc", content: [] } }]
    };

    await this.storageService.saveFile(`${filename}.book`, newBookContent);
    return { filename, title };
  }

  async renameBook(newTitle) {
    if (!this.currentBook) return false;
    this.currentBook.metadata.title = newTitle;
    await this.storageService.saveFile(`${this.currentBook.filename}.book`, {
      metadata: this.currentBook.metadata,
      chapters: this.currentBook.chapters,
    });
    // Update the in-memory state and UI
    this.currentBook.title = newTitle;
    await this.refreshLibrary(); // To update the title in the library list
    this.appController.renderNavigator(this.getStateForNavigator());
    return true;
  }

  async createNewChapter(title) {
    if (!this.currentBook) return;
    const newChapterId = `ch${Date.now()}`;
    const newChapter = {
      id: newChapterId,
      title: title,
      content_json: { type: "doc", content: [] }
    };
    this.currentBook.chapters.push(newChapter);
    await this.storageService.saveFile(`${this.currentBook.filename}.book`, {
      metadata: this.currentBook.metadata,
      chapters: this.currentBook.chapters,
    });
    this._updateBookState({ chapters: this.currentBook.chapters }, newChapterId);
  }

  async deleteBook(filename) {
    await this.storageService.deleteFile(`${filename}.book`);
    await this.storageService.deleteFile(`${filename}.metadata.json`);
    // Also check if this was the pinned book
    const pinned = await this.storageService.getFile('pinned.txt');
    if (pinned === filename) {
      await this.storageService.deleteFile('pinned.txt');
    }
  }

  async pinBook(filename) {
    await this.storageService.saveFile('pinned.txt', filename);
  }


  async createNewSection(chapterId, title) {
    if (!this.currentBook) return;
    const chapter = this.currentBook.chapters.find(c => c.id === chapterId);
    if (!chapter) return;

    const newSectionHeading = {
      type: "heading", attrs: { "level": 3 },
      content: [{ type: "text", text: title }]
    };
    const newParagraph = { type: "paragraph", content: [] };

    const insertionIndex = chapter.content_json.content.length;
    const navigateToId = `${chapterId}_sec${insertionIndex}`;

    chapter.content_json.content.push(newSectionHeading, newParagraph);

    await this.storageService.saveFile(`${this.currentBook.filename}.book`, {
      metadata: this.currentBook.metadata,
      chapters: this.currentBook.chapters,
    });
    this._updateBookState({ chapters: this.currentBook.chapters }, navigateToId);
  }


  async saveCurrentView(editorContent) {
    const isEditable = this.currentViewId !== 'full_book';
    if (!isEditable) {
      console.log("Save prevented: Current view is not editable.");
      return; // Stop execution immediately.
    }

    if (!this.currentBook || !this.currentViewId) return;
    const indicatorId = this.appController.showIndicator('Saving...');
    const { updatedBookData, navigateToId } = this._intelligentSave(this.currentViewId, editorContent);

    // Save the ENTIRE new book data to IndexedDB
    await this.storageService.saveFile(`${this.currentBook.filename}.book`, updatedBookData);

    this.appController.hideIndicator(indicatorId);
    this.appController.showIndicator('Saved!', { duration: 2000 });
    this._updateBookState(updatedBookData, navigateToId);
  }

  /**
   * Replicates the backend's intelligent save logic on the client-side.
   * It reconstructs the entire book from a partial edit.
   * @returns {object} An object containing the updated book data and the ID to navigate to.
   */
  _intelligentSave(viewId, editorContent) {
    // 1. Get current book data and create an ID map for preservation
    const oldIdMap = new Map(this.currentBook.chapters.map(ch => [ch.title, ch.id]));

    // 2. Reconstitute the "Future State" of the document's full node list.
    let allFutureNodes = [];
    if (viewId === 'full_book') {
      allFutureNodes = editorContent.content || [];
    } else {
      // Rebuild the full document node list from current data
      for (const chapter of this.currentBook.chapters) {
        allFutureNodes.push({
          type: 'heading', attrs: { level: 2 },
          content: [{ type: 'text', text: chapter.title }]
        });
        allFutureNodes.push(...(chapter.content_json.content || []));
      }

      // Now, find where to apply the patch from the user's edit.
      const structure = this._getBookStructure(this.currentBook);
      const targetChapterId = viewId.split('_sec')[0];
      let startIndex = -1;
      let chapterOffset = 0;

      for (const chapStruct of structure.chapters) {
        const chapterObj = this.currentBook.chapters.find(c => c.id === chapStruct.id);
        if (!chapterObj) continue;

        if (chapStruct.id === targetChapterId) {
          if (viewId.includes('_sec')) {
            const section = chapStruct.sections.find(s => s.id === viewId);
            if (section) {
              startIndex = chapterOffset + 1 + parseInt(viewId.split('_sec')[1], 10);
            }
          } else { // Chapter view
            startIndex = chapterOffset;
          }
          break;
        }
        chapterOffset += 1 + (chapterObj.content_json.content || []).length;
      }

      if (startIndex !== -1) {
        let endIndex = startIndex + 1;
        while (endIndex < allFutureNodes.length &&
          (
            allFutureNodes[endIndex].type !== 'heading' ||
            (viewId.includes('_sec') && allFutureNodes[endIndex].attrs?.level >= 3) ||
            (!viewId.includes('_sec') && allFutureNodes[endIndex].attrs?.level > 2)
          )
        ) {
          endIndex++;
        }

        allFutureNodes.splice(startIndex, endIndex - startIndex, ...(editorContent.content || []));
      }
    }

    // 3. Rebuild chapters from scratch, preserving IDs.
    const newChapters = [];
    let currentChapterContent = [];
    let orphanContent = [];
    const sanitizedNodes = this._sanitizeTiptapContent(allFutureNodes);

    for (const node of sanitizedNodes) {
      if (node.type === 'heading' && (node.attrs?.level === 1 || node.attrs?.level === 2)) {
        if (newChapters.length > 0) {
          newChapters[newChapters.length - 1].content_json.content = currentChapterContent;
        }
        const newTitle = node.content?.[0]?.text || 'New Chapter';
        const chapterId = oldIdMap.get(newTitle) || `ch${Date.now() + newChapters.length}`;
        newChapters.push({
          id: chapterId,
          title: newTitle,
          content_json: { type: 'doc', content: [] }
        });
        currentChapterContent = [];
      } else {
        if (newChapters.length > 0) currentChapterContent.push(node);
        else orphanContent.push(node);
      }
    }

    if (newChapters.length > 0) {
      newChapters[newChapters.length - 1].content_json.content = currentChapterContent;
    }

    if (orphanContent.length > 0) {
      if (newChapters.length > 0) {
        newChapters[0].content_json.content.unshift(...orphanContent);
      } else {
        newChapters.push({
          id: `ch${Date.now()}`, title: 'Chapter 1',
          content_json: { type: 'doc', content: orphanContent }
        });
      }
    }

    // 4. Create the final book data object to be saved
    const updatedBookData = {
      metadata: this.currentBook.metadata,
      chapters: newChapters,
    };

    // (Garbage collection for metadata would happen here if needed)

    // 5. Determine where to navigate
    const finalStructure = this._getBookStructure(updatedBookData);
    let navigateToId = 'full_book';
    const originalViewExists = finalStructure.chapters.some(ch =>
      ch.id === viewId.split('_sec')[0] && (
        !viewId.includes('_sec') || ch.sections.some(s => s.id === viewId)
      )
    );
    if (originalViewExists) navigateToId = viewId;

    return { updatedBookData, navigateToId };
  }

  /**
   * Generates the navigator structure from raw book data.
   * Replicates backend logic.
   */
  _getBookStructure(bookData) {
    const structure = { chapters: [] };
    for (const ch of bookData.chapters || []) {
      const chapterInfo = { id: ch.id, title: ch.title, sections: [] };
      const contentNodes = ch.content_json?.content || [];
      if (contentNodes) {
        contentNodes.forEach((node, i) => {
          if (node.type === 'heading' && node.attrs?.level === 3) {
            const sectionTitle = node.content?.[0]?.text || "Untitled Section";
            chapterInfo.sections.push({ id: `${ch.id}_sec${i}`, title: sectionTitle });
          }
        });
      }
      structure.chapters.push(chapterInfo);
    }
    return structure;
  }

  /**
   * Generates the content for a specific view from the full book data.
   * Replicates backend logic.
   */
  _getViewData(viewId) {
    const editorContent = { type: 'doc', content: [] };
    if (viewId === 'full_book') {
      let allNodes = [];
      allNodes.push({
        type: 'heading', attrs: { level: 1 },
        content: [{ type: 'text', text: this.currentBook.title }]
      });
      for (const chapter of this.currentBook.chapters) {
        allNodes.push({
          type: 'heading', attrs: { level: 2 },
          content: [{ type: 'text', text: chapter.title || "Untitled Chapter" }]
        });
        allNodes.push(...(chapter.content_json?.content || []));
      }
      editorContent.content = this._sanitizeTiptapContent(allNodes);
    } else {
      const targetChapterId = viewId.split('_sec')[0];
      const chapter = this.currentBook.chapters.find(ch => ch.id === targetChapterId);
      if (!chapter) return { editor_content: editorContent };

      let nodesToRender = [];
      if (viewId.includes('_sec')) {
        const sectionIndex = parseInt(viewId.split('_sec')[1], 10);
        const sectionNodes = chapter.content_json?.content || [];
        if (sectionIndex < sectionNodes.length) {
          nodesToRender.push(sectionNodes[sectionIndex]);
          let currentIndex = sectionIndex + 1;
          while (currentIndex < sectionNodes.length && sectionNodes[currentIndex].type !== 'heading') {
            nodesToRender.push(sectionNodes[currentIndex]);
            currentIndex++;
          }
        }
      } else {
        nodesToRender.push({
          type: 'heading', attrs: { level: 1 },
          content: [{ type: 'text', text: chapter.title || "Untitled Chapter" }]
        });
        nodesToRender.push(...(chapter.content_json?.content || []));
      }
      editorContent.content = this._sanitizeTiptapContent(nodesToRender);
    }
    return { editor_content: editorContent };
  }

  _updateBookState(updatedBookData, navigateToId) {
    if (updatedBookData && this.currentBook) {
      // Merge new data into the current book state
      Object.assign(this.currentBook, updatedBookData);
      // Regenerate the structure
      this.currentBook.structure = this._getBookStructure(this.currentBook);

      this.appController.renderNavigator(this.getStateForNavigator());

      if (navigateToId) {
        this.changeView(navigateToId);
      }
      return true;
    }
    return false;
  }
  /**
   * Recursively removes empty text nodes from TipTap content.
   * Replicates backend logic.
   */
  _sanitizeTiptapContent(nodes) {
    if (!Array.isArray(nodes)) return [];
    const sanitizedNodes = [];
    for (const node of nodes) {
      if (typeof node !== 'object' || node === null) continue;

      if (node.content && Array.isArray(node.content)) {
        const sanitizedChildContent = this._sanitizeTiptapContent(node.content);
        if (sanitizedChildContent.length === 0 && node.type !== 'text') {
          continue; // Optional: removes empty paragraphs, etc.
        }
        node.content = sanitizedChildContent;
      }

      if (node.type === 'text') {
        if (node.text) sanitizedNodes.push(node);
      } else {
        sanitizedNodes.push(node);
      }
    }
    return sanitizedNodes;
  }

  addMarginBlock(viewId, blockData) {
    if (!this.metadata.margin_blocks) {
      this.metadata.margin_blocks = {};
    }
    if (!this.metadata.margin_blocks[viewId]) {
      this.metadata.margin_blocks[viewId] = [];
    }
    this.metadata.margin_blocks[viewId].unshift(blockData); // Add to the top
    this.saveMetadata(); // Trigger a debounced save

    // Re-render the assistant pane with the updated data for this view
    this.appController.renderAssistantPane(this.metadata.margin_blocks[viewId] || []);
  }

  togglePinMarginBlock(viewId, blockId) {
    const blocks = this.metadata.margin_blocks?.[viewId] || [];
    const block = blocks.find(b => b.id === blockId);
    if (block) {
      block.pinned = !block.pinned;
      this.saveMetadata();
      this.appController.renderAssistantPane(blocks);
    }
  }

  deleteMarginBlock(viewId, blockId) {
    if (!this.metadata.margin_blocks?.[viewId]) return;
    this.metadata.margin_blocks[viewId] = this.metadata.margin_blocks[viewId].filter(b => b.id !== blockId);
    this.saveMetadata();
    this.appController.renderAssistantPane(this.metadata.margin_blocks[viewId]);
  }

  async restoreDefaultMargin() {
    if (!this.currentBook || !this.currentViewId) {
      this.appController.renderAssistantPane([]); // Just clear the pane
      return;
    }

    // Since we no longer store default margin content, we can just clear the pane
    // to "restore" it to its empty/default state for this view.
    const marginBlocks = this.metadata.margin_blocks?.[this.currentViewId] || [];
    this.appController.renderAssistantPane(marginBlocks);
  }
}