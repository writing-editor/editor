import './RightDrawer.css';
import './NotebookPane.css';
import { noteBlockWrapper } from '../utils/noteBlockWrapper.js';
import { Editor as TipTapEditor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { generateHTML } from '@tiptap/html';

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
        this.isEditorVisible = false;
        this.editingNoteId = null;
        this.mainEditorInstance = null;
        this.activeFilterTag = null;

        this.element.addEventListener('click', this.handleClick.bind(this));
        this.element.addEventListener('input', this.handleInput.bind(this));
        this.element.addEventListener('keydown', this.handleKeydown.bind(this));
    }

    async initialize() {
        await this.fetchAllNotes();
    }

    async fetchAllNotes() {
        const notes = await this.storageService.getFile('notes.json');
        this.allNotes = notes || [];
        this.renderUI();
    }

    renderUI() {
        let notesToDisplay = this.noteSearchResults !== null ? this.noteSearchResults : this.allNotes;

        if (this.activeFilterTag) {
            notesToDisplay = notesToDisplay.filter(note =>
                note.tags && note.tags.includes(this.activeFilterTag)
            );
        }

        const sortedNotes = [...notesToDisplay].sort((a, b) => {
            if (a.pinned && !b.pinned) return -1;
            if (!a.pinned && b.pinned) return 1;
            return (b.id || '').localeCompare(a.id || '');
        });

        let filterBarHtml = '';
        if (this.activeFilterTag) {
            filterBarHtml = `
                <div class="notebook-filter-bar">
                    <span>Filtering by:</span>
                    <span class="active-filter-tag">#${this.activeFilterTag}</span>
                    <button id="clear-filter-btn" title="Clear Filter">&times;</button>
                </div>`;
        }

        this.element.innerHTML = `
            <div class="notebook-header">
                <input type="search" id="note-search-input" placeholder="Search notes... (Ctrl+Enter)" value="${this.searchQuery}">
                <button id="note-add-btn" class="new-note-btn" title="New Note">+</button> 
            </div>
            ${filterBarHtml}
            ${this.isEditorVisible ? `<div id="main-note-editor-container" class="note-editor-container"></div>` : ''}
            <hr class="notebook-divider" />
            <div id="note-blocks-container">
                ${sortedNotes.map(note => noteBlockWrapper(note)).join('')}
            </div>
        `;

        if (this.isEditorVisible) {
            this.initializeMainEditor();
            if (this.editingNoteId) {
                const noteToEdit = this.allNotes.find(n => n.id === this.editingNoteId);
                if (noteToEdit) {
                    this.mainEditorInstance.commands.setContent(noteToEdit.content_json, false);
                }
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
        const target = e.target; // We need the specific element clicked
        const action = target.dataset.action || target.id;

        if (action === 'filter-by-tag') {
            this.activeFilterTag = target.dataset.tag;
            // Clear search results when applying a tag filter for clarity
            this.noteSearchResults = null;
            this.searchQuery = '';
            this.renderUI();
            return;
        }

        if (action === 'clear-filter-btn') {
            this.activeFilterTag = null;
            this.renderUI();
            return;
        }

        const button = target.closest('button');
        if (!button) return;

        const noteBlock = button.closest('.note-block');
        const noteId = noteBlock?.dataset.noteId;

        switch (button.dataset.action || button.id) {
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
                this.handleNoteSearch(this.searchQuery);
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

        const indicatorId = this.controller.showIndicator(this.editingNoteId ? 'Updating Note...' : 'Saving Note...');
        try {
            const plainText = tiptapJsonToText(contentJson);
            let noteTitle = plainText.split(/\s+/).slice(0, 5).join(" ");
            if (plainText.split(/\s+/).length > 5) noteTitle += "...";

            const tags = [...new Set(
                (plainText.match(/#(\w+)/g) || [])
                    .map(tag => tag.substring(1).toLowerCase())
            )];

            if (this.editingNoteId) {
                const noteIndex = this.allNotes.findIndex(n => n.id === this.editingNoteId);
                if (noteIndex > -1) {
                    this.allNotes[noteIndex].content_json = contentJson;
                    this.allNotes[noteIndex].plain_text = plainText;
                    this.allNotes[noteIndex].title = noteTitle;
                    this.allNotes[noteIndex].tags = tags;
                }
            } else {
                const newNote = { id: `note_${Date.now()}`, type: "note", title: noteTitle, pinned: false, content_json: contentJson, plain_text: plainText, tags: tags };
                this.allNotes.unshift(newNote);
            }

            await this.storageService.saveFile('notes.json', this.allNotes);
            this.controller.showIndicator(this.editingNoteId ? 'Note Updated!' : 'Note Saved!', { duration: 2000 });

            this.editingNoteId = null;
            this.isEditorVisible = false;
            this.fetchAllNotes();
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
            this.fetchAllNotes();
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

    async handleNoteSearch(query) {
        const trimmedQuery = query.trim();
        if (!trimmedQuery) {
            this.noteSearchResults = null;
            this.renderUI();
            return;
        }

        const payload = { query: trimmedQuery, all_notes: this.allNotes };
        const filtered_notes = await this.controller.runFindNotes(payload);
        this.noteSearchResults = filtered_notes;
        this.renderUI();
    }
}