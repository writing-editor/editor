// --- NEW FILE: src/components/FindReplace.js ---

import { Decoration, DecorationSet } from 'prosemirror-view';
import { Plugin, PluginKey } from 'prosemirror-state';

// A unique key for our find-and-replace plugin
const findPluginKey = new PluginKey('find');

export class FindReplace {
    constructor(controller, editorInstance) {
        this.controller = controller;
        this.editor = editorInstance;
        this.container = document.getElementById('find-replace-container');
        this.findInput = document.getElementById('fr-find-input');
        this.replaceInput = document.getElementById('fr-replace-input');
        this.matchesCountEl = document.getElementById('fr-matches-count');

        this.matches = [];
        this.currentIndex = -1;

        this.setupEventListeners();
        this.addPlugin();
    }

    setupEventListeners() {
        this.findInput.addEventListener('input', () => this.find());
        this.replaceInput.addEventListener('input', () => this.updateButtonState());

        this.findInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                e.shiftKey ? this.goToPrev() : this.goToNext();
            }
        });

        document.getElementById('fr-next-btn').addEventListener('click', () => this.goToNext());
        document.getElementById('fr-prev-btn').addEventListener('click', () => this.goToPrev());
        document.getElementById('fr-replace-btn').addEventListener('click', () => this.replace());
        document.getElementById('fr-replace-all-btn').addEventListener('click', () => this.replaceAll());
        document.getElementById('fr-close-btn').addEventListener('click', () => this.hide());
    }

    addPlugin() {
        const plugin = new Plugin({
            key: findPluginKey,
            state: {
                init: () => ({ decorations: DecorationSet.empty }),
                apply: (tr, value) => {
                    const findState = tr.getMeta(findPluginKey);
                    if (findState) {
                        return findState;
                    }
                    if (tr.docChanged && value.decorations.size) {
                        return { decorations: value.decorations.map(tr.mapping, tr.doc) };
                    }
                    return value;
                },
            },
            props: {
                decorations(state) {
                    const findState = this.getState(state);
                    return findState ? findState.decorations : null;
                },
            },
        });
        
        // This is a bit of a hack, but necessary to append a new plugin to the editor's state
        // after it has already been initialized.
        const currentPlugins = this.editor.state.plugins;
        const newPlugins = [...currentPlugins, plugin];
        const newState = this.editor.state.reconfigure({ plugins: newPlugins });
        this.editor.view.updateState(newState);
    }
    
    show() {
        this.container.classList.remove('hidden');
        this.findInput.focus();
        this.findInput.select();
        this.find(); // Perform a search immediately if there's text
    }

    hide() {
        this.container.classList.add('hidden');
        this.clearDecorations();
    }

    find() {
        const query = this.findInput.value;
        this.matches = [];
        this.currentIndex = -1;

        if (!query) {
            this.clearDecorations();
            this.updateMatchesCount();
            return;
        }

        const docText = this.editor.state.doc.textContent;
        const regex = new RegExp(query, 'gi');
        let match;
        while ((match = regex.exec(docText)) !== null) {
            this.matches.push({ from: match.index + 1, to: match.index + 1 + query.length });
        }

        if (this.matches.length > 0) {
            this.currentIndex = 0;
        }

        this.updateDecorations();
        this.updateMatchesCount();
        this.scrollToCurrentMatch();
    }

    goToNext() {
        if (this.matches.length === 0) return;
        this.currentIndex = (this.currentIndex + 1) % this.matches.length;
        this.updateDecorations();
        this.updateMatchesCount();
        this.scrollToCurrentMatch();
    }

    goToPrev() {
        if (this.matches.length === 0) return;
        this.currentIndex = (this.currentIndex - 1 + this.matches.length) % this.matches.length;
        this.updateDecorations();
        this.updateMatchesCount();
        this.scrollToCurrentMatch();
    }

    replace() {
        if (this.currentIndex === -1 || this.matches.length === 0) return;

        const { from, to } = this.matches[this.currentIndex];
        const replacement = this.replaceInput.value;
        
        this.editor.chain().focus()
            .setTextSelection({ from, to })
            .insertContent(replacement)
            .run();
        
        // After replacing, re-run the find to update matches
        this.find();
    }

    replaceAll() {
        if (this.matches.length === 0) return;
        const replacement = this.replaceInput.value;
        const tr = this.editor.state.tr;

        // Iterate backwards to avoid position shifts
        for (let i = this.matches.length - 1; i >= 0; i--) {
            const { from, to } = this.matches[i];
            tr.replaceWith(from, to, replacement);
        }
        
        this.editor.view.dispatch(tr);
        this.find(); // Clear decorations
    }

    updateDecorations() {
        const decorations = this.matches.map((match, index) => {
            const className = `search-match ${index === this.currentIndex ? 'active' : ''}`;
            return Decoration.inline(match.from, match.to, { class: className });
        });

        const decorationSet = DecorationSet.create(this.editor.state.doc, decorations);
        
        const tr = this.editor.state.tr.setMeta(findPluginKey, { decorations: decorationSet });
        this.editor.view.dispatch(tr);
    }
    
    clearDecorations() {
        const tr = this.editor.state.tr.setMeta(findPluginKey, { decorations: DecorationSet.empty });
        this.editor.view.dispatch(tr);
    }

    scrollToCurrentMatch() {
        if (this.currentIndex !== -1 && this.matches.length > 0) {
            const { from } = this.matches[this.currentIndex];
            this.editor.commands.scrollIntoView();
        }
    }
    
    updateMatchesCount() {
        const total = this.matches.length;
        const current = total > 0 ? this.currentIndex + 1 : 0;
        this.matchesCountEl.textContent = `${current}/${total}`;
        this.updateButtonState();
    }

    updateButtonState() {
        const hasMatches = this.matches.length > 0;
        const hasReplacementText = this.replaceInput.value.length > 0;
        document.getElementById('fr-prev-btn').disabled = !hasMatches;
        document.getElementById('fr-next-btn').disabled = !hasMatches;
        document.getElementById('fr-replace-btn').disabled = !hasMatches;
        document.getElementById('fr-replace-all-btn').disabled = !hasMatches;
    }
}