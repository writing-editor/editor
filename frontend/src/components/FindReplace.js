import { Decoration, DecorationSet } from 'prosemirror-view';
import { Plugin, PluginKey } from 'prosemirror-state';

// A unique key for our find-and-replace plugin
const findPluginKey = new PluginKey('find');

export class FindReplace {
    constructor(controller, editorWrapper) {
        this.controller = controller;
        this.editorWrapper = editorWrapper;
        this.container = document.getElementById('find-replace-container');
        this.findInput = document.getElementById('fr-find-input');
        this.replaceInput = document.getElementById('fr-replace-input');
        this.matchesCountEl = document.getElementById('fr-matches-count');

        this.matches = [];
        this.currentIndex = -1;
        setTimeout(() => this.addPlugin(), 0);
        this.setupEventListeners();
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

        const editorInstance = this.editorWrapper.instance;
        const currentPlugins = editorInstance.state.plugins;
        const newPlugins = [...currentPlugins, plugin];
        const newState = editorInstance.state.reconfigure({ plugins: newPlugins });
        editorInstance.view.updateState(newState);
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

        const doc = this.editorWrapper.instance.state.doc;
        doc.descendants((node, pos) => {
            if (!node.isText) return true;
            const regex = new RegExp(query, 'gi');
            let match;
            while ((match = regex.exec(node.text)) !== null) {
                const from = pos + match.index;
                const to = from + match[0].length;
                this.matches.push({ from, to });
            }
        });

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

        this.editorWrapper.instance.chain().focus()
            .setTextSelection({ from, to })
            .insertContent(replacement)
            .run();

        this.find();
    }

    replaceAll() {
        if (this.matches.length === 0) return;
        const replacement = this.replaceInput.value;
        const tr = this.editorWrapper.instance.state.tr;

        for (let i = this.matches.length - 1; i >= 0; i--) {
            const { from, to } = this.matches[i];
            tr.replaceWith(from, to, replacement);
        }

        this.editorWrapper.instance.view.dispatch(tr);
        this.find();
    }

    updateDecorations() {
        const decorations = this.matches.map((match, index) => {
            const className = `search-match ${index === this.currentIndex ? 'active' : ''}`;
            return Decoration.inline(match.from, match.to, { class: className });
        });

        const editorInstance = this.editorWrapper.instance;
        const decorationSet = DecorationSet.create(editorInstance.state.doc, decorations);
        const tr = editorInstance.state.tr.setMeta(findPluginKey, { decorations: decorationSet });
        editorInstance.view.dispatch(tr);
    }

    clearDecorations() {
        const editorInstance = this.editorWrapper.instance;
        const tr = editorInstance.state.tr.setMeta(findPluginKey, { decorations: DecorationSet.empty });
        editorInstance.view.dispatch(tr);
    }

    scrollToCurrentMatch() {
        if (this.currentIndex !== -1 && this.matches.length > 0) {
            this.editorWrapper.instance.commands.scrollIntoView();
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