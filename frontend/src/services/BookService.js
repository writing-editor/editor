import { debounce } from '../utils/debounce.js';

// --- Default content now uses the NEW hierarchical structure ---
const DEFAULT_USER_MANUAL = {
  metadata: { title: "User Manual" },
  chapters: [{
    id: "ch_manual_1",
    title: "Welcome to the Editor",
    content_json: {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "This is your user manual. It is also a fully functional document you can explore." }] }
      ]
    },
    sections: [
      {
        id: crypto.randomUUID(),
        title: "The Navigator",
        content_json: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Use the hamburger menu icon (☰) in the top-left to open the navigator." }] }] }
      },
      {
        id: crypto.randomUUID(),
        title: "AI Assistant & Notebook",
        content_json: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Use the icons in the top-right to open the AI Assistant and your personal Notebook." }] }] }
      }
    ]
  }]
};

const DEFAULT_PROMPTS = {
  'ANALYZE.txt': "Your task is to provide a detailed analysis of the following text. Focus on {user_request}. Text to analyze:\n---\n{text_to_analyze}",
  'REWRITE.txt': "You are a professional editor. Rewrite the following text to address the user's request. Only return the rewritten text, with no extra commentary or markdown.\n---\nUser Request: {user_request}\nText to rewrite:\n{text_to_analyze}"
};

/**
 * Manages all book-related data using a hierarchical chapter/section model.
 */
export class BookService {
  constructor(appController, storageService) {
    this.appController = appController;
    this.storageService = storageService;

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
  // --- METHODS ADAPTED FOR THE NEW DATA STRUCTURE ---

  async switchBook(filename, viewId = null) {
    this.navigatorView = 'contents';
    const bookFileContent = await this.storageService.getFile(`${filename}.book`);

    if (bookFileContent) {
      this.currentBook = {
        filename: filename,
        title: bookFileContent.metadata.title,
        ...bookFileContent,
        structure: this._getBookStructure(bookFileContent),
      };

      await this.loadMetadata(filename);
      this.appController.renderNavigator(this.getStateForNavigator());

      const firstChapterId = this.currentBook.chapters[0]?.id;
      const targetViewId = viewId || firstChapterId;

      if (targetViewId) {
        this.changeView(targetViewId);
      } else {
        this.appController.renderEditor({ type: 'doc', content: [] });
        this.appController.renderAssistantPane([]);
      }
    }
  }

  async changeView(viewId) {
    this.currentViewId = viewId;
    this._updateNavigatorHighlight();

    const viewData = this._getViewData(viewId);
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

  // --- DATA MANIPULATION (All rewritten to be simpler) ---

  async createNewBook(title) {
    let filename = title.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, '');
    const existingBooks = await this.storageService.getAllFilesBySuffix('.book');
    const filenameExists = existingBooks.some(book => book.id === `${filename}.book`);

    if (filenameExists || !filename) {
      filename = `${filename}-${Date.now()}`;
    }

    const newBookContent = {
      metadata: { title: title },
      chapters: [{
        id: crypto.randomUUID(),
        title: "Chapter 1",
        content_json: { type: "doc", content: [] },
        sections: []
      }]
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
    const newChapter = {
      id: crypto.randomUUID(),
      title: title,
      content_json: { type: "doc", content: [] },
      sections: []
    };
    this.currentBook.chapters.push(newChapter);
    await this.saveCurrentBookToFile(); // Save the whole book
    this._updateBookState({ chapters: this.currentBook.chapters }, newChapter.id);
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

    const newSection = {
      id: crypto.randomUUID(),
      title: title,
      content_json: { type: "doc", content: [] }
    };
    chapter.sections.push(newSection);

    await this.saveCurrentBookToFile();
    this._updateBookState({ chapters: this.currentBook.chapters }, newSection.id);
  }

  // --- SAVE ENGINE ---

  /**
   * Saves the content from the editor for a given view (chapter or section).
   * This method acts as a safe entry point to the complex deconstruction logic.
   *
   * @param {string} viewId The ID of the chapter or section being edited.
   * @param {object} editorContent The full TipTap JSON content from the editor.
   */
  async saveView(viewId, editorContent) {
    if (!this.currentBook || !viewId || viewId === 'full_book' || viewId === this.currentBook.id) {
      console.log("Save prevented: View is not editable or book is not loaded.");
      return;
    }

    const indicatorId = this.appController.showIndicator('Saving...');

    // Create a safe, deep copy of the book data to perform surgery on.
    // This prevents corrupting the live state if an error occurs.
    const bookCopy = JSON.parse(JSON.stringify(this.currentBook));
    const nodes = editorContent.content || [];

    // --- Deconstruct the editor content and surgically update the book copy ---
    const navigateToId = this._deconstructAndSaveView(viewId, nodes, bookCopy);
    if (this.metadata.margin_blocks && navigateToId !== viewId) {
      // 1. Get a set of all valid IDs from the updated book structure.
      const validIds = new Set();
      bookCopy.chapters.forEach(chapter => {
        validIds.add(chapter.id);
        (chapter.sections || []).forEach(section => validIds.add(section.id));
      });

      // 2. Loop through existing metadata keys and delete any that are no longer valid.
      for (const metadataId in this.metadata.margin_blocks) {
        if (!validIds.has(metadataId)) {
          delete this.metadata.margin_blocks[metadataId];
        }
      }
    }

    // --- Finalize: Update the live state and save to storage ---
    this.currentBook = bookCopy;
    await this.saveCurrentBookToFile();

    this.appController.hideIndicator(indicatorId);
    this.appController.showIndicator('Saved!', { duration: 2000 });

    // Refresh the UI and navigate to the same view to reflect changes.
    this._updateBookState({ chapters: this.currentBook.chapters }, navigateToId);
  }

  /**
   * Finds the precise location (chapter, section, and their indices) of an item
   * within the book's hierarchical structure. This is critical for targeted updates.
   *
   * @param {string} id The ID of the chapter or section to find.
   * @param {object} book The book data structure to search within.
   * @returns {object} An object containing location details.
   */
  _findLocation(id, book) {
    for (let i = 0; i < book.chapters.length; i++) {
      const chapter = book.chapters[i];
      if (chapter.id === id) {
        return {
          isChapterView: true,
          chapter: chapter,
          chapterIndex: i,
          section: null,
          sectionIndex: -1,
        };
      }
      for (let j = 0; j < (chapter.sections || []).length; j++) {
        const section = chapter.sections[j];
        if (section.id === id) {
          return {
            isChapterView: false,
            chapter: chapter,
            chapterIndex: i,
            section: section,
            sectionIndex: j,
          };
        }
      }
    }
    return { chapter: null }; // Return a predictable "not found" state
  }

  /**
   * The core "disassembly" engine. It intelligently parses the flat list of editor
   * nodes back into a hierarchical structure and updates the book data.
   *
   * @param {string} viewId The ID of the view being saved.
   * @param {Array} nodes The array of TipTap nodes from the editor.
   * @param {object} book The deep copy of the book data to modify.
   */
  _deconstructAndSaveView(viewId, nodes, book) {
    let navigateToId = viewId;
    const location = this._findLocation(viewId, book);
    if (!location.chapter) {
      console.error("Save failed: Could not find the chapter or section being edited.", { viewId });
      return navigateToId;
    }

    // =======================================================
    //  LOGIC BRANCH 1: SAVING A SECTION VIEW
    // =======================================================
    if (location.isChapterView === false) {
      const { chapter, section, sectionIndex } = location;

      // SCENARIO 1.1: ORPHANED SECTION (user deleted the H3 title)
      // If the first node is not an H3, the section is orphaned and its content
      // must be merged with the preceding item.
      if (!nodes.length || nodes[0].type !== 'heading' || nodes[0].attrs?.level !== 3) {
        if (sectionIndex > 0) {
          // Merge into the previous section
          const mergeTarget = chapter.sections[sectionIndex - 1];
          mergeTarget.content_json.content.push(...nodes);
          navigateToId = mergeTarget.id; // << SET the correct navigation ID
        } else {
          // Merge into the parent chapter
          chapter.content_json.content.push(...nodes);
          navigateToId = chapter.id; // << SET the correct navigation ID
        }
        chapter.sections.splice(sectionIndex, 1); // Remove the original section
        return navigateToId; // Return the new, correct ID
      }

      // SCENARIO 1.2: NORMAL SECTION SAVE
      // This handles renaming, content changes, and splitting a section by adding new H3s.
      const newSectionsPayload = [];
      let currentSectionPayload = null;
      for (const node of nodes) {
        if (node.type === 'heading' && (node.attrs?.level === 3 || node.attrs?.level === 2)) {
          currentSectionPayload = {
            id: crypto.randomUUID(),
            title: node.content?.[0]?.text || 'Untitled Section',
            content_json: { type: 'doc', content: [] }
          };
          newSectionsPayload.push(currentSectionPayload);
        } else if (currentSectionPayload) {
          currentSectionPayload.content_json.content.push(node);
        }
      }

      if (newSectionsPayload.length > 0) {
        section.title = newSectionsPayload[0].title;
        section.content_json = newSectionsPayload[0].content_json;
        const newlyCreated = newSectionsPayload.slice(1);
        if (newlyCreated.length > 0) {
          chapter.sections.splice(sectionIndex + 1, 0, ...newlyCreated);
          navigateToId = newlyCreated[newlyCreated.length - 1].id;
        }
      }
      return navigateToId;
    }

    // =======================================================
    //  LOGIC BRANCH 2: SAVING A CHAPTER VIEW
    // =======================================================
    if (location.isChapterView === true) {
      const { chapter, chapterIndex } = location;

      // SCENARIO 2.1: ORPHANED CHAPTER (user deleted the H2 title)
      // This triggers a merge with the previous chapter, or a rename if it's the first chapter.
      if (!nodes.length || nodes[0].type !== 'heading' || nodes[0].attrs?.level !== 2) {
        navigateToId = this._handleOrphanedChapter(location, nodes, book);
        return navigateToId;
      }

      // SCENARIO 2.2: NORMAL CHAPTER SAVE
      // This handles renaming, content changes, section changes, and splitting the chapter by adding a new H2.
      const newChaptersPayload = [];
      let currentChapterPayload = null;
      let currentSectionPayload = null;

      for (const node of nodes) {
        if (node.type === 'heading' && node.attrs?.level === 2) {
          currentChapterPayload = {
            id: crypto.randomUUID(),
            title: node.content?.[0]?.text || 'Untitled Chapter',
            content_json: { type: 'doc', content: [] },
            sections: []
          };
          newChaptersPayload.push(currentChapterPayload);
          currentSectionPayload = null; // Reset section context for the new chapter
        } else if (node.type === 'heading' && node.attrs?.level === 3) {
          if (!currentChapterPayload) continue; // Ignore sections that appear before a chapter heading
          currentSectionPayload = {
            id: crypto.randomUUID(),
            title: node.content?.[0]?.text || 'Untitled Section',
            content_json: { type: 'doc', content: [] }
          };
          currentChapterPayload.sections.push(currentSectionPayload);
        } else { // It's body content
          if (currentSectionPayload) {
            currentSectionPayload.content_json.content.push(node);
          } else if (currentChapterPayload) {
            currentChapterPayload.content_json.content.push(node);
          }
        }
      }

      if (newChaptersPayload.length > 0) {
        // The first parsed chapter becomes the update for the one being edited.
        const updatedData = newChaptersPayload[0];
        chapter.title = updatedData.title;
        chapter.content_json = updatedData.content_json;
        chapter.sections = updatedData.sections;

        // Any subsequent H2s create new chapters inserted immediately after.
        const newlyCreated = newChaptersPayload.slice(1);
        if (newlyCreated.length > 0) {
          book.chapters.splice(chapterIndex + 1, 0, ...newlyCreated);
          navigateToId = newlyCreated[newlyCreated.length - 1].id;
        }
      }
    }
    return navigateToId;
  }

  /**
   * Handles the logic for when a chapter's main H2 title is deleted by the user.
   *
   * @param {object} location The location object for the chapter being deleted.
   * @param {Array} orphanedNodes The raw editor nodes that are now "headless".
   * @param {object} book The deep copy of the book data to modify.
   */
  _handleOrphanedChapter(location, orphanedNodes, book) {
    const { chapter: chapterToDelete, chapterIndex } = location;

    if (chapterIndex > 0) {
      // SCENARIO A: There is a previous chapter to merge into.
      const previousChapter = book.chapters[chapterIndex - 1];

      // --- CORRECTED LOGIC ---
      // First, deconstruct the orphaned content into its constituent parts:
      // 1. Body content (nodes before the first H3)
      // 2. Sections (nodes after H3s)
      const orphanedBodyContent = [];
      const newSectionsFromOrphan = [];
      let currentSectionPayload = null;

      for (const node of orphanedNodes) {
        if (node.type === 'heading' && node.attrs?.level === 3) {
          currentSectionPayload = {
            id: crypto.randomUUID(),
            title: node.content?.[0]?.text || 'Untitled Section',
            content_json: { type: 'doc', content: [] }
          };
          newSectionsFromOrphan.push(currentSectionPayload);
        } else {
          if (currentSectionPayload) {
            currentSectionPayload.content_json.content.push(node);
          } else {
            // This is orphaned body content. Collect it instead of merging directly.
            orphanedBodyContent.push(node);
          }
        }
      }

      // If there was any orphaned body content, wrap it in a new section.
      // This prevents it from polluting the previous chapter's body content.
      if (this._hasMeaningfulContent(orphanedBodyContent)) {
        const mergedContentSection = {
          id: crypto.randomUUID(),
          title: "Untitled Section", // Give it a default title
          content_json: { type: 'doc', content: orphanedBodyContent }
        };
        // Add this new section to the beginning of the list of sections to be merged.
        newSectionsFromOrphan.unshift(mergedContentSection);
      }

      // Now, append all the newly formed sections to the previous chapter's section list.
      previousChapter.sections.push(...newSectionsFromOrphan);

      // Finally, remove the original chapter that was edited.
      book.chapters.splice(chapterIndex, 1);
      return previousChapter.id;

    } else {
      // SCENARIO B: This is the first chapter. This logic remains unchanged and correct.
      chapterToDelete.title = "Chapter 1";
      chapterToDelete.content_json.content = [];
      chapterToDelete.sections = [];

      let currentSectionPayload = null;
      for (const node of orphanedNodes) {
        if (node.type === 'heading' && node.attrs?.level === 3) {
          currentSectionPayload = {
            id: crypto.randomUUID(),
            title: node.content?.[0]?.text || 'Untitled Section',
            content_json: { type: 'doc', content: [] }
          };
          chapterToDelete.sections.push(currentSectionPayload);
        } else {
          if (currentSectionPayload) {
            currentSectionPayload.content_json.content.push(node);
          } else {
            chapterToDelete.content_json.content.push(node);
          }
        }
      }
      return chapterToDelete.id;
    }
  }
  /**
   * Recursively checks if an array of TipTap nodes contains any meaningful text content.
   * This is more robust than a simple length check, as it ignores empty paragraphs.
   * @param {Array} nodes An array of TipTap nodes.
   * @returns {boolean} True if any node contains non-whitespace text.
   */
  _hasMeaningfulContent(nodes) {
    if (!nodes || nodes.length === 0) {
      return false;
    }
    // Using `some` for an efficient check that stops as soon as content is found.
    return nodes.some(node => {
      // Check for a text property with actual content
      if (node.text && node.text.trim() !== '') {
        return true;
      }
      // If the node has children, recursively check them
      if (node.content && this._hasMeaningfulContent(node.content)) {
        return true;
      }
      return false;
    });
  }

  // --- HELPER METHODS REWRITTEN FOR NEW STRUCTURE ---

  _getBookStructure(bookData) {
    const structure = { chapters: [] };
    for (const ch of bookData.chapters || []) {
      const chapterInfo = {
        id: ch.id,
        title: ch.title,
        sections: (ch.sections || []).map(s => ({ id: s.id, title: s.title }))
      };
      structure.chapters.push(chapterInfo);
    }
    return structure;
  }

  _getViewData(viewId) {
    if (!this.currentBook) return { editor_content: { type: 'doc', content: [] } };

    // --- NEW: Full Book View Logic ---
    if (viewId === this.currentBook.id || viewId === 'full_book') { // Handle full book view
      let allNodes = [];
      allNodes.push({ type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: this.currentBook.title }] });
      for (const chapter of this.currentBook.chapters) {
        allNodes.push({ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: chapter.title }] });
        allNodes.push(...(chapter.content_json?.content || []));
        for (const section of chapter.sections || []) {
          allNodes.push({ type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: section.title }] });
          allNodes.push(...(section.content_json?.content || []));
        }
      }
      return { editor_content: { type: 'doc', content: this._sanitizeTiptapContent(allNodes) } };
    }

    // --- Chapter and Section View Logic ---
    for (const chapter of this.currentBook.chapters) {
      if (chapter.id === viewId) { // Chapter View
        let content = [];
        content.push({ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: chapter.title }] });
        content.push(...(chapter.content_json?.content || []));
        for (const section of chapter.sections || []) {
          content.push({ type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: section.title }] });
          content.push(...(section.content_json?.content || []));
        }
        return { editor_content: { type: 'doc', content: this._sanitizeTiptapContent(content) } };
      }
      for (const section of chapter.sections || []) {
        if (section.id === viewId) { // Section View
          let content = [];
          content.push({ type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: section.title }] });
          content.push(...(section.content_json?.content || []));
          return { editor_content: { type: 'doc', content: this._sanitizeTiptapContent(content) } };
        }
      }
    }
    return { editor_content: { type: 'doc', content: [] } }; // Fallback
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

  _updateNavigatorHighlight() {
    const drawer = document.getElementById('navigator-drawer');
    if (!drawer) return;

    // Remove previous active state
    drawer.querySelectorAll('.is-active').forEach(el => el.classList.remove('is-active'));

    // Add new active state
    if (this.currentViewId) {
      const activeElement = drawer.querySelector(`[data-view-id="${this.currentViewId}"]`);
      if (activeElement) {
        activeElement.classList.add('is-active');
      }
    }
  }


  _isChapterId(viewId) {
    return this.currentBook.chapters.some(c => c.id === viewId);
  }

  async saveCurrentBookToFile() {
    // A simple helper to save the entire state of the current book.
    await this.storageService.saveFile(`${this.currentBook.filename}.book`, {
      metadata: this.currentBook.metadata,
      chapters: this.currentBook.chapters,
    });
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
}