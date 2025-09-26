import { debounce } from '../utils/debounce.js';

const DEFAULT_USER_MANUAL = {
  metadata: { title: "User Manual" },
  chapters: [
    {
      id: "ch_manual_1",
      title: "Welcome to Your Editor",
      content_json: {
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "Welcome! This manual is a fully functional document. You can navigate it, see how it's structured, and get a feel for the writing experience. The editor is designed to be a clean, focused space for writers and researchers." }] },
          { type: "paragraph", content: [{ type: "text", text: "Let's explore the key areas of the application." }] }
        ]
      },
      sections: [
        {
          id: "sec_manual_1_1",
          title: "The Three Panes of Your Workspace",
          content_json: {
            type: "doc",
            content: [
              { type: "paragraph", content: [{ type: "text", text: "The interface is divided into three main areas:" }] },
              { type: "paragraph", content: [{ type: "text", text: "1. ", marks: [{ type: "bold" }] }, { type: "text", text: "The Navigator (Left):", marks: [{ type: "bold" }] }, { type: "text", text: " Opened with the hamburger icon (☰), this is where you manage your documents, chapters, and sections." }] },
              { type: "paragraph", content: [{ type: "text", text: "2. ", marks: [{ type: "bold" }] }, { type: "text", text: "The Editor (Center):", marks: [{ type: "bold" }] }, { type: "text", text: " The main text area where you are reading and writing now." }] },
              { type: "paragraph", content: [{ type: "text", text: "3. ", marks: [{ type: "bold" }] }, { type: "text", text: "The Drawers (Right):", marks: [{ type: "bold" }] }, { type: "text", text: " Home to the AI Assistant and your Notebook, toggled by the icons in the top-right." }] }
            ]
          }
        },
        {
          id: "sec_manual_1_2",
          title: "Writing and Formatting",
          content_json: {
            type: "doc",
            content: [
              { type: "paragraph", content: [{ type: "text", text: "Simply start typing in the center pane. To format text, select it with your mouse. A bubble menu will appear, allowing you to apply " }, { type: "text", text: "bold", marks: [{ type: "bold" }] }, { type: "text", text: ", " }, { type: "text", text: "italic", marks: [{ type: "italic" }] }, { type: "text", text: ", and heading styles (H2 and H3)." }] },
              { type: "paragraph", content: [{ type: "text", text: "Your work is saved automatically in the background. You can also manually save at any time using the keyboard shortcut Ctrl+S (or Cmd+S on Mac)." }] }
            ]
          }
        }
      ]
    },
    {
      id: "ch_manual_2",
      title: "Organizing Your Work",
      content_json: {
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "The Navigator is the heart of your project's structure. It has two primary views: the Library and the Contents." }] }
        ]
      },
      sections: [
        {
          id: "sec_manual_2_1",
          title: "The Document Library",
          content_json: {
            type: "doc",
            content: [
              { type: "paragraph", content: [{ type: "text", text: "When you first open the Navigator, you'll see your Document Library. From here, you can create a new document, switch between existing ones, delete a document, or set a default document to open on startup using the pin icon." }] }
            ]
          }
        },
        {
          id: "sec_manual_2_2",
          title: "Book Contents and Structure",
          content_json: {
            type: "doc",
            content: [
              { type: "paragraph", content: [{ type: "text", text: "Once you select a document, the Navigator switches to show its contents. This manual, for example, is structured into chapters (like this one) and sections (like this specific one). You can create new chapters and sections using the '+' buttons. This structure is automatically used when exporting your work." }] }
            ]
          }
        }
      ]
    },
    {
      id: "ch_manual_3",
      title: "AI Tools and Assistance",
      content_json: {
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "The editor integrates powerful AI tools to assist your writing process. You will need to add your own API key in the Settings panel to enable these features." }] }
        ]
      },
      sections: [
        {
          id: "sec_manual_3_1",
          title: "The Bubble Menu: Analyze & Rewrite",
          content_json: {
            type: "doc",
            content: [
              { type: "paragraph", content: [{ type: "text", text: "When you select text, the bubble menu appears with two AI actions:" }] },
              { type: "paragraph", content: [{ type: "text", text: "Analyze:", marks: [{ type: "bold" }] }, { type: "text", text: " This sends the selected text to the AI for a critique. The response appears in the AI Assistant drawer, offering you questions and insights to improve your work." }] },
              { type: "paragraph", content: [{ type: "text", text: "Rewrite:", marks: [{ type: "bold" }] }, { type: "text", text: " This asks the AI to proofread and correct the selected text. The suggestion appears in the AI Assistant, where you can accept or reject the change." }] }
            ]
          }
        },
        {
          id: "sec_manual_3_2",
          title: "The AI Workbench",
          content_json: {
            type: "doc",
            content: [
              { type: "paragraph", content: [{ type: "text", text: "For more complex tasks, press Ctrl+K (or Cmd+K) to open the AI Workbench. This is a powerful, general-purpose tool. You can ask it to summarize a selection, generate ideas, suggest alternative titles, check for inconsistencies across the entire document, and much more. The AI's response will be added to the Assistant drawer." }] }
            ]
          }
        },
        {
          id: "sec_manual_3_3",
          title: "The Notebook and Auto-Tagging",
          content_json: {
            type: "doc",
            content: [
              { type: "paragraph", content: [{ type: "text", text: "The Notebook (page icon in the top-right) is your personal scratchpad. You can jot down ideas, save snippets, and keep research notes. If you enable Auto-Tagging in the AI Settings, the system will periodically read your untagged notes and suggest relevant conceptual tags to help you organize your thoughts." }] }
            ]
          }
        }
      ]
    },
    {
      id: "ch_manual_4",
      title: "Data and Portability",
      content_json: {
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "Your data belongs to you. The application is built to be reliable offline and to make your work portable." }] }
        ]
      },
      sections: [
        {
          id: "sec_manual_4_1",
          title: "Syncing, Backups, and Conflicts",
          content_json: {
            type: "doc",
            content: [
              { type: "paragraph", content: [{ type: "text", text: "All your work is saved in your browser (local-first). If you sign in with a Google account, your documents and notes will sync automatically to a private folder in your Google Drive." }] },
              { type: "paragraph", content: [{ type: "text", text: "The sync system includes conflict detection.", marks: [{ type: "bold" }] }, { type: "text", text: " If you edit the same file on two devices without syncing, your work is never lost. The app will save your local changes as a new file labeled \"(conflict)\" and download the cloud version. You can then merge any changes manually." }] },
              { type: "paragraph", content: [{ type: "text", text: "You can also perform a full backup of all your data to a local JSON file via the Settings panel." }] }
            ]
          }
        },
        {
          id: "sec_manual_4_2",
          title: "Exporting Your Work",
          content_json: {
            type: "doc",
            content: [
              { type: "paragraph", content: [{ type: "text", text: "When you're ready to share or publish, go to the Settings panel (gear icon). In the Data Management tab, you can export any of your documents to standard formats, including LaTeX (.tex) and Microsoft Word (.docx)." }] }
            ]
          }
        }
      ]
    }
  ]
};

function tiptapToText(nodes) {
  let text = '';
  if (!Array.isArray(nodes)) return '';
  for (const node of nodes) {
    if (node.type === 'text' && node.text) {
      text += node.text + ' ';
    }
    if (node.content) {
      text += tiptapToText(node.content);
    }
  }
  return text;
}
export class BookService {
  constructor(appController, storageService, configService) {
    this.appController = appController;
    this.storageService = storageService;
    this.configService = configService;

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
    await this.checkForFirstRun();
    await this.refreshLibrary();

    const pinnedBookFilename = this.configService.get('user.pinned_book', null);
    if (pinnedBookFilename) {
      const bookExists = this.availableBooks.some(book => book.filename === pinnedBookFilename);
      if (bookExists) {
        await this.switchBook(pinnedBookFilename);
      } else {
        await this.configService.setConfig('user.pinned_book', null);
        console.warn("Cleared invalid pinned book reference from config.");
      }
    } else {
      console.log("No pinned book found. Displaying library.");
    }
  }

  async checkForFirstRun() {
    const hasRunFlagRecord = await this.storageService.getFile('initial_setup_complete');
    if (hasRunFlagRecord) {
      return;
    }
    console.log("Performing first-time setup: Seeding database with default content...");
    await this.storageService.saveFile('user-manual.book', DEFAULT_USER_MANUAL);
    await this.storageService.saveFile('initial_setup_complete', true);
    console.log("First-time setup complete.");
  }

  async refreshLibrary() {
    this.navigatorView = 'library';
    this.pinnedBook = this.configService.get('user.pinned_book', null);

    const bookFiles = await this.storageService.getAllFilesBySuffix('.book');
    this.availableBooks = bookFiles
      .map(file => {
        if (file && file.content && file.content.metadata && file.content.metadata.title) {
          return {
            filename: file.id.replace('.book', ''),
            title: file.content.metadata.title,
          };
        }
        console.warn(`Found a malformed or incomplete book record with id: ${file.id}. It will be ignored.`);
        return null;
      })
      .filter(book => book !== null);

    this.appController.renderNavigator(this.getStateForNavigator());
  }

  async switchBook(filename, viewId = null) {
    this.navigatorView = 'contents';
    const bookFileRecord = await this.storageService.getFile(`${filename}.book`);

    if (bookFileRecord && bookFileRecord.content) {
      const bookFileContent = bookFileRecord.content;
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
    const pinned = this.configService.get('user.pinned_book');
    if (pinned === filename) {
      await this.configService.setConfig('user.pinned_book', null);
    }
  }

  async pinBook(filename) {
    await this.configService.setConfig('user.pinned_book', filename);
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
  async saveView(viewId, editorContent) {
    if (!this.currentBook || !viewId || viewId === 'full_book' || viewId === this.currentBook.id) {
      return;
    }

    const indicatorId = this.appController.showIndicator('Saving...');
    try {
      const bookCopy = JSON.parse(JSON.stringify(this.currentBook));
      const allNodesFromEditor = editorContent.content || [];

      let incomingFootnotesNode = null;
      const contentNodes = [];
      allNodesFromEditor.forEach(node => {
        if (node.type === 'footnotes') {
          incomingFootnotesNode = node;
        } else {
          contentNodes.push(node);
        }
      });

      const oldStructureJSON = JSON.stringify(this._getBookStructure(bookCopy));
      const navigateToId = this._deconstructAndSaveView(viewId, contentNodes, bookCopy);

      // --- THE DEFINITIVE FIX: MERGE INCOMING FOOTNOTES, DON'T REPLACE ---

      // 1. Get all existing footnotes from the book and put them in a Map for easy access.
      const existingFootnotesMap = new Map(
        (bookCopy.footnotes?.content || []).map(fn => [fn.attrs['data-id'], fn])
      );

      // 2. Get the new/updated footnotes from the current editor view.
      const incomingFootnotes = incomingFootnotesNode?.content || [];

      // 3. Merge the incoming footnotes into the map.
      // If a footnote with the same ID already exists, it will be updated.
      // If it's a new footnote, it will be added.
      for (const incomingNote of incomingFootnotes) {
        existingFootnotesMap.set(incomingNote.attrs['data-id'], incomingNote);
      }

      // 4. Reconstruct the final, complete footnotes block from the merged map.
      // This now contains both the preserved old notes and the updated new ones.
      const finalFootnotesNode = {
        type: 'footnotes',
        attrs: { class: 'footnotes' },
        content: Array.from(existingFootnotesMap.values())
      };

      // 5. Save the complete, merged list back to the top-level property.
      bookCopy.footnotes = finalFootnotesNode;

      // --- END OF THE MERGE FIX ---

      // Clean up any stray footnote blocks from inside chapter content (this is still good practice)
      for (const chapter of bookCopy.chapters) {
        if (chapter.content_json && chapter.content_json.content) {
          chapter.content_json.content = chapter.content_json.content.filter(n => n.type !== 'footnotes');
        }
        for (const section of chapter.sections) {
          if (section.content_json && section.content_json.content) {
            section.content_json.content = section.content_json.content.filter(n => n.type !== 'footnotes');
          }
        }
      }

      if (this.metadata.margin_blocks && navigateToId !== viewId) {
        const validIds = new Set();
        bookCopy.chapters.forEach(chapter => {
          validIds.add(chapter.id);
          (chapter.sections || []).forEach(section => validIds.add(section.id));
        });
        for (const metadataId in this.metadata.margin_blocks) {
          if (!validIds.has(metadataId)) {
            delete this.metadata.margin_blocks[metadataId];
          }
        }
      }

      this.currentBook = bookCopy;
      await this.saveCurrentBookToFile();

      this.appController.showIndicator('Saved!', { duration: 2000 });
      const newStructureJSON = JSON.stringify(this._getBookStructure(this.currentBook));
      if (oldStructureJSON !== newStructureJSON) {
        this._updateBookState({ chapters: this.currentBook.chapters }, navigateToId);
      }
    } finally {
      this.appController.hideIndicator(indicatorId);
    }
  }

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

    let viewNodes = [];
    const bookData = this.currentBook;

    // Step 1: Assemble the content for the specific view (this logic is unchanged)
    if (viewId === bookData.id || viewId === 'full_book') {
      viewNodes.push({ type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: bookData.title }] });
      for (const chapter of bookData.chapters) {
        viewNodes.push({ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: chapter.title }] });
        viewNodes.push(...(chapter.content_json?.content || []));
        for (const section of chapter.sections || []) {
          viewNodes.push({ type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: section.title }] });
          viewNodes.push(...(section.content_json?.content || []));
        }
      }
    } else {
      for (const chapter of bookData.chapters) {
        if (chapter.id === viewId) {
          viewNodes.push({ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: chapter.title }] });
          viewNodes.push(...(chapter.content_json?.content || []));
          for (const section of chapter.sections || []) {
            viewNodes.push({ type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: section.title }] });
            viewNodes.push(...(section.content_json?.content || []));
          }
          break;
        }
        for (const section of chapter.sections || []) {
          if (section.id === viewId) {
            viewNodes.push({ type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: section.title }] });
            viewNodes.push(...(section.content_json?.content || []));
            break;
          }
        }
      }
    }

    // Step 2: Find which footnotes are ACTUALLY referenced in this view.
    const referencedIds = this.collectFootnoteIds(viewNodes);

    // Step 3: If references exist, build a NEW footnotes block containing ONLY those notes.
    if (referencedIds.size > 0 && bookData.footnotes?.content) {
      const relevantFootnotes = bookData.footnotes.content.filter(fn =>
        referencedIds.has(fn.attrs['data-id'])
      );

      if (relevantFootnotes.length > 0) {
        viewNodes.push({
          type: 'footnotes',
          attrs: { class: 'footnotes' },
          content: relevantFootnotes
        });
      }
    }

    return { editor_content: { type: 'doc', content: this._sanitizeTiptapContent(viewNodes) } };
  }

  collectFootnoteIds(nodes) {
    const ids = new Set();

    function traverse(nodeList) {
      if (!nodeList) return;
      for (const node of nodeList) {
        if (node.type === 'footnoteReference') {
          ids.add(node.attrs['data-id']);
        }
        if (node.content) {
          traverse(node.content);
        }
      }
    }

    traverse(nodes);
    return ids;
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
    if (!this.currentBook) {
      return false;
    }
    return this.currentBook.chapters.some(c => c.id === viewId);
  }

  async saveCurrentBookToFile() {
    await this.storageService.saveFile(`${this.currentBook.filename}.book`, {
      metadata: this.currentBook.metadata,
      chapters: this.currentBook.chapters,
      footnotes: this.currentBook.footnotes,
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

    const marginBlocks = this.metadata.margin_blocks?.[this.currentViewId] || [];
    this.appController.renderAssistantPane(marginBlocks);
  }

  getBookStructureAsText() {
    if (!this.currentBook || !this.currentBook.structure) return 'No book loaded.';
    let text = `Book: ${this.currentBook.title}\n`;
    this.currentBook.structure.chapters.forEach(ch => {
      text += `- ${ch.title}\n`;
      ch.sections.forEach(s => {
        text += `  - ${s.title}\n`;
      });
    });
    return text;
  }

  getFullBookText() {
    if (!this.currentBook) return '';
    // This is a simplified text extraction. We can make it more robust if needed.
    let fullText = '';
    this.currentBook.chapters.forEach(ch => {
      fullText += `${ch.title}\n\n`;
      if (ch.content_json) fullText += tiptapToText(ch.content_json.content) + '\n\n';
      ch.sections.forEach(s => {
        fullText += `${s.title}\n\n`;
        if (s.content_json) fullText += tiptapToText(s.content_json.content) + '\n\n';
      });
    });
    return fullText;
  }

  // --- Metadata Management ---
  async loadMetadata(filename) {
    const metadataRecord = await this.storageService.getFile(`${filename}.metadata.json`);
    this.metadata = metadataRecord ? metadataRecord.content : {};
  }

  async _saveMetadata() {
    if (!this.currentBook) return;
    const indicatorId = this.appController.showIndicator('Syncing analysis...');
    try {
      await this.storageService.saveFile(`${this.currentBook.filename}.metadata.json`, this.metadata);
    } finally {
      this.appController.hideIndicator(indicatorId);
    }
  }
}