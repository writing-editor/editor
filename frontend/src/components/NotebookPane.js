import './NotebookPane.css';
import { noteBlockWrapper } from '../utils/noteBlockWrapper.js';
import { Editor as TipTapEditor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import FlexSearch from 'flexsearch'; 

function tiptapJsonToText(tiptapJson) {
    let text = "";
    if (!tiptapJson || !tiptapJson.content) return "";
    for (const node of tiptapJson.content) {
        if (node.content) {
            text += tiptapJsonToText(node) + " ";
        }
        if (node.text) {
            text += node.text + " ";
        }
    }
    return text.trim();
}

export class NotebookPane {
    constructor(controller, storageService) {
        this.controller = controller;
        this.storageService = storageService;
        this.element = document.getElementById('notebook-drawer');

        this.allNotes = [];
        this.searchQuery = '';
        this.noteSearchResults = null;
        this.isAiSearchComplete = false; 
        this.isEditorVisible = false;
        this.editingNoteId = null;
        this.mainEditorInstance = null;
        this.activeFilterTag = null;
        this.activeFilterTags = new Set();

        this.noteIndex = new FlexSearch.Document({
            document: { id: "id", index: "plain_text", store: true },
            tokenize: "forward"
        });

        this.element.addEventListener('click', this.handleClick.bind(this));
        this.element.addEventListener('input', this.handleInput.bind(this));
        this.element.addEventListener('keydown', this.handleKeydown.bind(this));
        this.controller.subscribe('tags:updated', () => this.fetchAllNotes());
    }

    async initialize() {
        await this.fetchAllNotes();
        this.controller.runAutoTagging();
    }

    async fetchAllNotes() {
        const notes = await this.storageService.getFile('notes.json');
        this.allNotes = notes || [];
        this.buildNoteIndex();
        this.renderUI();
    }

    // Method to build the local search index
    buildNoteIndex() {
        this.noteIndex.clear();
        this.allNotes.forEach(note => {
            this.noteIndex.add({
                id: note.id,
                plain_text: note.plain_text,
                doc: note
            });
        });
    }

    renderUI() {
        // --- 1. Filter Logic ---
        let notesToDisplay;
        if (this.noteSearchResults !== null) {
            notesToDisplay = this.noteSearchResults; // Use search results if they exist
        } else {
            notesToDisplay = this.allNotes; // Otherwise, use all notes
        }

        // Apply multi-tag "OR" filter if any tags are active
        if (this.activeFilterTags.size > 0) {
            notesToDisplay = notesToDisplay.filter(note =>
                note.tags && note.tags.some(tag => this.activeFilterTags.has(tag))
            );
        }

        const sortedNotes = [...notesToDisplay].sort((a, b) => {
            if (a.pinned && !b.pinned) return -1;
            if (!a.pinned && b.pinned) return 1;
            return (b.id || '').localeCompare(a.id || '');
        });

        // --- 2. Dynamic UI Rendering ---
        const filterChipsHtml = Array.from(this.activeFilterTags).map(tag => `
            <div class="filter-chip tag-chip" data-tag="${tag}">
                <span class="chip-label">#${tag}</span>
                <button class="chip-close-btn" data-action="remove-tag" data-tag="${tag}" title="Remove tag">&times;</button>
            </div>
        `).join('');

        let searchChipHtml = '';
        let deepSearchButtonHtml = '';
        if (this.searchQuery) {
            const searchType = this.isAiSearchComplete ? 'AI Search' : 'Search';
            searchChipHtml = `
                <div class="filter-chip search-chip">
                    <span class="chip-label">${searchType}: "${this.searchQuery}"</span>
                    <button class="chip-close-btn" data-action="clear-search" title="Clear search">&times;</button>
                </div>
            `;
            if (!this.isAiSearchComplete) {
                deepSearchButtonHtml = `<button id="deep-search-btn" class="deep-search-button">Deep Search (AI)</button>`;
            }
        }

        this.element.innerHTML = `
            <div class="notebook-header">
                <input type="search" id="note-search-input" placeholder="Search notes... (Ctrl+Enter)" value="${this.searchQuery}">
                <button id="note-add-btn" class="new-note-btn" title="New Note">+</button>
            </div>
            <div class="notebook-filter-area">
                ${filterChipsHtml}
                ${searchChipHtml}
                ${deepSearchButtonHtml}
            </div>
            ${this.isEditorVisible ? `<div id="main-note-editor-container" class="note-editor-container"></div>` : ''}
            <div id="note-blocks-container">
                ${sortedNotes.map(note => noteBlockWrapper(note)).join('')}
            </div>
        `;

        // --- 3. Editor & State Update ---
        if (this.isEditorVisible) {
            this.initializeMainEditor();
            if (this.editingNoteId) {
                const noteToEdit = this.allNotes.find(n => n.id === this.editingNoteId);
                if (noteToEdit) this.mainEditorInstance.commands.setContent(noteToEdit.content_json, false);
            }
        } else if (this.mainEditorInstance) {
            this.mainEditorInstance.destroy();
            this.mainEditorInstance = null;
        }
        this.updateEditingHighlight();
    }

    initializeMainEditor() {
        const editorElement = this.element.querySelector('#main-note-editor-container');
        if (!editorElement || this.mainEditorInstance) return;

        this.mainEditorInstance = new TipTapEditor({
            element: editorElement,
            extensions: [StarterKit, Placeholder.configure({ placeholder: 'Start writing a new note...' })],
            editorProps: { attributes: { class: 'note-editor-prosemirror' } },
        });
    }

    updateEditingHighlight() {
        this.element.querySelectorAll('.note-block').forEach(el => el.classList.remove('is-editing'));
        if (this.editingNoteId) {
            const el = this.element.querySelector(`[data-note-id="${this.editingNoteId}"]`);
            if (el) el.classList.add('is-editing');
        }
    }

    async handleClick(e) {
        const target = e.target;
        const button = target.closest('button');

        // Handle clicks on tags within note blocks
        if (target.matches('.note-tag')) {
            this.activeFilterTags.add(target.dataset.tag);
            this.renderUI();
            return;
        }

        if (!button) return;
        const action = button.dataset.action || button.id;
        const noteBlock = button.closest('.note-block');
        const noteId = noteBlock?.dataset.noteId;


        switch (action) {
            case 'deep-search-btn': this.performAiSearch(); break;
            case 'remove-tag':
                this.activeFilterTags.delete(button.dataset.tag);
                this.renderUI();
                break;
            case 'clear-search':
                this.searchQuery = '';
                this.noteSearchResults = null;
                document.getElementById('note-search-input').value = '';
                this.renderUI();
                break;
            case 'note-add-btn':
                this.isEditorVisible = !this.isEditorVisible;
                if (!this.isEditorVisible) this.editingNoteId = null;
                this.renderUI();
                if (this.isEditorVisible) this.mainEditorInstance.commands.focus();
                break;
            case 'edit-note':
                if (!this.isEditorVisible) {
                    this.isEditorVisible = true;
                    this.renderUI();
                }
                this.loadNoteIntoEditor(noteId);
                break;
            case 'delete-note':
                const isConfirmed = await this.controller.confirm(
                    'Delete Note', 'Are you sure you want to permanently delete this note?'
                );
                if (isConfirmed) this.deleteNote(noteId);
                break;
            case 'pin-note':
                this.togglePinNote(noteId);
                break;
        }
    }

    handleInput(e) {
        if (e.target.id === 'note-search-input') {
            this.searchQuery = e.target.value;
        }
    }

    handleKeydown(e) {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            const editorEl = this.element.querySelector('#main-note-editor-container');
            const searchEl = this.element.querySelector('#note-search-input');
            if (editorEl && editorEl.contains(document.activeElement)) {
                e.preventDefault();
                this.handleSave();
            } else if (searchEl && searchEl === document.activeElement) {
                e.preventDefault();
                this.performLocalSearch(this.searchQuery);
            }
        }
    }

    loadNoteIntoEditor(noteId) {
        const noteToEdit = this.allNotes.find(n => n.id === noteId);
        if (noteToEdit) {
            this.editingNoteId = noteId;
            this.mainEditorInstance.commands.setContent(noteToEdit.content_json);
            this.updateEditingHighlight();
            this.mainEditorInstance.commands.focus();
        }
    }


    async handleSave() {
        const contentJson = this.mainEditorInstance.getJSON();
        if (!this.mainEditorInstance.state.doc.textContent.trim()) return;

        const indicatorId = this.controller.showIndicator('Saving Note...');
        try {
            const plainText = tiptapJsonToText(contentJson);
            let noteTitle = plainText.split(/\s+/).slice(0, 5).join(" ");
            if (plainText.split(/\s+/).length > 5) noteTitle += "...";

            // Manual tags are preserved. Auto-tagger will skip notes that have tags.
            const manualTags = [...new Set((plainText.match(/#(\w+)/g) || []).map(tag => tag.substring(1).toLowerCase()))];

            if (this.editingNoteId) {
                const noteIndex = this.allNotes.findIndex(n => n.id === this.editingNoteId);
                if (noteIndex > -1) {
                    this.allNotes[noteIndex].content_json = contentJson;
                    this.allNotes[noteIndex].plain_text = plainText;
                    this.allNotes[noteIndex].title = noteTitle;
                    // Only update tags if they were manually changed.
                    if (manualTags.length > 0) this.allNotes[noteIndex].tags = manualTags;
                }
            } else {
                const newNote = { id: `note_${Date.now()}`, type: "note", title: noteTitle, pinned: false, content_json: contentJson, plain_text: plainText, tags: manualTags };
                this.allNotes.unshift(newNote);
            }

            await this.storageService.saveFile('notes.json', this.allNotes);
            this.controller.showIndicator('Note Saved!', { duration: 2000 });

            this.editingNoteId = null;
            this.isEditorVisible = false;
            await this.fetchAllNotes(); // Use await here
            this.controller.runAutoTagging(); // Trigger auto-tagger after save
        } finally {
            this.controller.hideIndicator(indicatorId);
        }
    }

    async deleteNote(noteId) {
        const indicatorId = this.controller.showIndicator('Deleting Note...');
        try {
            this.allNotes = this.allNotes.filter(note => note.id !== noteId);
            await this.storageService.saveFile('notes.json', this.allNotes);
            this.controller.showIndicator('Note Deleted', { duration: 2000 });
            if (this.editingNoteId === noteId) {
                this.editingNoteId = null;
                this.isEditorVisible = false;
            }
            await this.fetchAllNotes(); // Use await here
        } finally {
            this.controller.hideIndicator(indicatorId);
        }
    }

    async togglePinNote(noteId) {
        const note = this.allNotes.find(n => n.id === noteId);
        if (note) {
            note.pinned = !note.pinned;
            await this.storageService.saveFile('notes.json', this.allNotes);
            this.renderUI();
        }
    }

    // This is now the first stage (local search)
    performLocalSearch(query) {
        const trimmedQuery = query.trim();
        if (!trimmedQuery) {
            this.noteSearchResults = null;
            this.renderUI();
            return;
        }
        const results = this.noteIndex.search(trimmedQuery, { enrich: true });
        // Flatten and get the full document from the stored results
        const uniqueDocs = new Map();
        results.forEach(fieldResult => {
            fieldResult.result.forEach(doc => {
                if (!uniqueDocs.has(doc.id)) {
                    uniqueDocs.set(doc.id, doc.doc.doc); // Access the stored 'doc' object
                }
            });
        });

        this.noteSearchResults = Array.from(uniqueDocs.values());
        this.isAiSearchComplete = false; // Mark that this was a local search
        this.renderUI();
    }

    // This is the second stage (AI search)
    async performAiSearch() {
        const trimmedQuery = this.searchQuery.trim();
        if (!trimmedQuery) return;

        const payload = { query: trimmedQuery, all_notes: this.allNotes };
        const filtered_notes = await this.controller.runFindNotes(payload);

        this.noteSearchResults = filtered_notes;
        this.isAiSearchComplete = true; // Mark that AI search is done
        this.renderUI();
    }
}