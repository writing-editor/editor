import './editor.css';
import { debounce } from '../utils/debounce.js';
import { Editor as TipTapEditor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { BubbleMenu } from '@tiptap/extension-bubble-menu';
import CharacterCount from '@tiptap/extension-character-count';

export class Editor {
  constructor(controller, bookService) {
    this.controller = controller;
    this.bookService = bookService;
    this.element = document.getElementById('editor-pane');
    this.toolbar = this.createToolbarElement();
    this.wordCountEl = document.getElementById('word-count-display');
    this.scrollPane = document.getElementById('editor-pane');

    this.isReady = false;

    this.debouncedSave = debounce(() => {
      if (this.bookService.currentViewId) {
        this.bookService.saveView(
          this.bookService.currentViewId,
          this.instance.getJSON()
        );
      }
    }, 20000);

    this.instance = new TipTapEditor({
      element: this.element,
      extensions: [
        StarterKit.configure({
          heading: { levels: [2, 3] }, // Limit to H2 and H3 for simplicity
        }),
        BubbleMenu.configure({
          element: this.toolbar,
          pluginKey: 'editorBubbleMenu', 
          tippyOptions: {
            duration: 100,
            placement: 'top',
            delay: [250, 150],
            getReferenceClientRect: () => {
              const { from, to } = this.instance.state.selection;
              const { view } = this.instance;
              return view.coordsAtPos(from, to);
            },
          },
          shouldShow: ({ editor, view, state, from, to }) => {
            if (!this.isReady) {
              return false;
            }

            const { empty } = state.selection;
            const hasFocus = view.hasFocus();
            const h2Button = this.toolbar.querySelector('[data-action="h2"]');
            if (h2Button) {
              const isChapterView = this.bookService._isChapterId(this.bookService.currentViewId);
              h2Button.style.display = isChapterView ? '' : 'none';
            }
            
            return hasFocus && !empty && editor.isEditable;
          },
        }),
        CharacterCount,
      ],
      content: '<h2>Welcome</h2>',
      onUpdate: () => {
        this.isReady = true;
        if (this.instance.isEditable) {
          this.debouncedSave();
        }
        this.updateWordCount();
      },
      onTransaction: () => {
        this.updateToolbarState();
        if (this.instance.state.selection.empty) {
            this.toolbar.style.display = 'none';
        } else {
            this.toolbar.style.display = '';
        }
      },
    });

    this.setupToolbarListeners();
    this.scrollPane.addEventListener('scroll', () => this.handleScroll());
  }

  updateWordCount() {
    if (!this.wordCountEl || !this.instance) return;

    const stats = this.instance.storage.characterCount;
    const words = stats.words();
    const chars = stats.characters();

    this.wordCountEl.innerHTML = `${words} | ${chars}`;
  }

  handleScroll() {
    if (!this.wordCountEl) return;

    const { scrollTop, scrollHeight, clientHeight } = this.scrollPane;
    // Check if the user has scrolled to the very bottom (with a small tolerance)
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 5;

    // Hide the counter if scrolled more than 50px down, UNLESS we are at the bottom
    if (scrollTop > 50 && !isAtBottom) {
      this.wordCountEl.classList.add('is-hidden');
    } else {
      this.wordCountEl.classList.remove('is-hidden');
    }
  }


  createToolbarElement() {
    const el = document.createElement('div');
    el.className = 'editor-toolbar';
    el.innerHTML = `
      <!-- Formatting Buttons -->
      <button class="toolbar-btn" data-action="bold" title="Bold (Ctrl+B)">
        <svg viewBox="0 0 24 24"><path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"></path><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"></path></svg>
      </button>
      <button class="toolbar-btn" data-action="italic" title="Italic (Ctrl+I)">
        <svg viewBox="0 0 24 24"><line x1="19" y1="4" x2="10" y2="4"></line><line x1="14" y1="20" x2="5" y2="20"></line><line x1="15" y1="4" x2="9" y2="20"></line></svg>
      </button>
      <button class="toolbar-btn" data-action="h2" title="Heading 2">H2</button>
      <button class="toolbar-btn" data-action="h3" title="Heading 3">H3</button>
      
      <div class="toolbar-divider"></div>
      
      <!-- AI Action Buttons -->
      <button class="toolbar-btn" data-action="analyze" title="Analyze Selection">
        <svg viewBox="0 0 24 24"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.2 0 .5 0 .7-.1-.5-.8-.7-1.7-.7-2.9 0-3.3 2.7-6 6-6 .9 0 1.8.2 2.5.6 1.1-1.9 1.5-4.1 1.5-6.6C22 6.5 17.5 2 12 2zm4.1 12.3c-.3.1-.6.2-.9.2-2.2 0-4-1.8-4-4s1.8-4 4-4c.3 0 .6 0 .9.1.5-2.2-.2-4.6-2-6.1C8.7 5.6 6 8.6 6 12s2.7 6.4 6.1 7.7c1.8-1.5 2.5-3.9 2-6.1zM17 14v-2h-2v-2h2V8l4 4-4 4z"></path></svg>
      </button>
      <button class="toolbar-btn" data-action="rewrite" title="Rewrite Selection">
         <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path><path d="m15 5 3 3"></path></svg>
      </button>
    `;
    document.body.appendChild(el);
    return el;
  }

  setupToolbarListeners() {
    this.toolbar.addEventListener('click', (e) => {
      const btn = e.target.closest('.toolbar-btn');
      if (!btn) return;

      const action = btn.dataset.action;
      const chain = this.instance.chain().focus();

      switch (action) {
        case 'bold':
          chain.toggleBold().run();
          break;
        case 'italic':
          chain.toggleItalic().run();
          break;
        case 'h2':
          chain.toggleHeading({ level: 2 }).run();
          break;
        case 'h3':
          chain.toggleHeading({ level: 3 }).run();
          break;
        case 'analyze':
          this.controller.showCommandPalette('analyze');
          break;
        case 'rewrite':
          this.controller.showCommandPalette('rewrite');
          break;
      }
    });
  }

  updateToolbarState() {
    this.toolbar.querySelector('[data-action="bold"]').classList.toggle('is-active', this.instance.isActive('bold'));
    this.toolbar.querySelector('[data-action="italic"]').classList.toggle('is-active', this.instance.isActive('italic'));
    this.toolbar.querySelector('[data-action="h2"]').classList.toggle('is-active', this.instance.isActive('heading', { level: 2 }));
    this.toolbar.querySelector('[data-action="h3"]').classList.toggle('is-active', this.instance.isActive('heading', { level: 3 }));
  }

  render(content) {
    this.instance.commands.setContent(content, false);
    setTimeout(() => {
        this.updateWordCount();
        this.handleScroll();
    }, 0);
  }

  setEditable(isEditable) {
    this.instance.setOptions({ editable: isEditable });
    setTimeout(() => {
        this.updateWordCount();
        this.handleScroll();
    }, 0);
  }

  replaceText(range, newText) {
    if (!range) return;
    this.instance.chain().focus()
      .deleteRange(range)
      .insertContent(newText)
      .run();
  }

}