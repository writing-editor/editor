import { debounce } from '../utils/debounce.js';
import { Editor as TipTapEditor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { BubbleMenu } from '@tiptap/extension-bubble-menu';
import { FloatingMenu } from '@tiptap/extension-floating-menu';
import Link from '@tiptap/extension-link';
import CharacterCount from '@tiptap/extension-character-count';
import { SlashCommand } from './slashCommand.js';
import Document from '@tiptap/extension-document';
import { Footnote, Footnotes, FootnoteReference } from '@ditojs/tiptap-footnotes';

export class Editor {
  constructor(controller, bookService) {
    this.controller = controller;
    this.bookService = bookService;
    this.element = document.getElementById('editor-pane');
    this.toolbar = this.createToolbarElement();
    this.floatingMenu = this.createFloatingMenuElement();
    this.wordCountEl = document.getElementById('word-count-display');
    this.scrollPane = document.getElementById('editor-pane');
    this.contextualScrollbar = document.getElementById('contextual-scrollbar');

    // --- NEW: Debounced method for building the section map ---
    this.debouncedBuildMap = debounce(this.buildSectionMapAndIndex.bind(this), 250);

    this.isMouseInTooltip = false;
    // --- NEW: Properties for the dual-mode scrollbar ---
    this.sectionMap = [];
    this.scrollIndexEl = null; // Will hold the tooltip container
    this.isDragging = false;
    this.dragStartY = 0;

    // Create the thumb element
    this.thumbElement = document.createElement('div');
    this.thumbElement.id = 'scrollbar-thumb';
    this.contextualScrollbar.appendChild(this.thumbElement);

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
          heading: { levels: [2, 3] },
          bulletList: { keepMarks: true, keepAttributes: true },
          orderedList: { keepMarks: true, keepAttributes: true },
          blockquote: true,
          codeBlock: true,
          horizontalRule: true,
        }),
        Document.extend({
          content: 'block+ footnotes?', // Allows a 'footnotes' node at the end
        }),
        Footnotes,          // The <ol> list for all footnotes
        Footnote,           // The <li> item for a single footnote
        FootnoteReference,  // The superscript number in the main text

        Link.configure({
          openOnClick: false,
          autolink: true,
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
            if (!this.isReady) return false;
            const { empty } = state.selection;
            const hasFocus = view.hasFocus();
            return hasFocus && !empty && editor.isEditable;
          },
        }),
        FloatingMenu.configure({
          element: this.floatingMenu,
          pluginKey: 'editorFloatingMenu',
          tippyOptions: {
            duration: 100,
            placement: 'left',
            offset: [0, 8],
          },
          shouldShow: ({ editor, state }) => {
            const { selection } = state;
            const { $from, empty } = selection;
            const isRoot = $from.depth === 1;
            const isEmpty = $from.parent.nodeSize === 2;

            if (!editor.isEditable || !empty || !isRoot || !isEmpty) {
              return false;
            }

            const h2Button = this.floatingMenu.querySelector('[data-action="h2"]');
            if (h2Button) {
              const isChapterView = this.bookService._isChapterId(this.bookService.currentViewId);
              h2Button.style.display = isChapterView ? 'flex' : 'none';
            }

            return true;
          },
        }),
        CharacterCount,
        SlashCommand.configure({
          controller: this.controller
        })
      ],
      content: '<h2>Welcome</h2>',
      onUpdate: () => {
        this.isReady = true;
        if (this.instance.isEditable) {
          this.debouncedSave();
        }
        this.updateWordCount();
        // --- CHANGED: Call the map builder instead of old scrollbar logic ---
        this.debouncedBuildMap();
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
    this.setupFloatingMenuListeners();
    this.scrollPane.addEventListener('scroll', this.handleScroll.bind(this));
    this.thumbElement.addEventListener('mousedown', this.handleThumbMouseDown.bind(this));
    this.contextualScrollbar.addEventListener('mousemove', (e) => this.updateTooltipPosition(e));
    const resizeObserver = new ResizeObserver(() => this.debouncedBuildMap());
    resizeObserver.observe(this.element);
  }

  // --- START OF NEW/REWRITTEN METHODS ---

  /**
   * Analyzes the document, builds a map of all sections (headings),
   * and generates the clickable tooltip index for navigation.
   */
  buildSectionMapAndIndex() {
    if (!this.instance) return;

    // Remove old index if it exists
    if (this.scrollIndexEl) this.scrollIndexEl.remove();

    const editorContentEl = this.element.querySelector('.ProseMirror');
    if (!editorContentEl) return;

    const headingElements = Array.from(editorContentEl.querySelectorAll('h2, h3'));
    const { scrollHeight } = this.scrollPane;

    this.sectionMap = [];
    headingElements.forEach((el, index) => {
      const nextEl = headingElements[index + 1];
      this.sectionMap.push({
        element: el,
        title: el.textContent,
        level: el.tagName.toLowerCase(),
        startPosition: el.offsetTop,
        endPosition: nextEl ? nextEl.offsetTop : scrollHeight
      });
    });

    // Create the tooltip index container
    this.scrollIndexEl = document.createElement('div');
    this.scrollIndexEl.id = 'scrollbar-index';

    this.scrollIndexEl.addEventListener('mouseenter', () => { this.isMouseInTooltip = true; });
    this.scrollIndexEl.addEventListener('mouseleave', () => { this.isMouseInTooltip = false; });

    // Populate the index with clickable items
    this.sectionMap.forEach((section, index) => {
      const item = document.createElement('div');
      item.className = 'scrollbar-index-item';
      item.classList.add(section.level === 'h3' ? 'h3-item' : 'h2-item');
      item.textContent = section.title;
      item.dataset.index = index;
      item.addEventListener('click', () => {
        this.scrollPane.scrollTo({ top: section.startPosition, behavior: 'smooth' });
      });
      this.scrollIndexEl.appendChild(item);
    });

    this.contextualScrollbar.appendChild(this.scrollIndexEl);

    // Trigger an initial scroll handler to set the correct state
    this.handleScroll();
  }

  /**
   * Handles all scroll-related UI updates based on the dual-mode logic.
   */
  handleScroll() {
    const { scrollTop, scrollHeight, clientHeight } = this.scrollPane;
    const isScrollable = scrollHeight > clientHeight;

    // 1. Toggle overall visibility of the scrollbar
    this.contextualScrollbar.classList.toggle('is-scrollable', isScrollable);
    if (!isScrollable) {
      this.thumbElement.style.display = 'none';
      return;
    }
    this.thumbElement.style.display = '';

    // 2. Find the current active section
    let currentSection = this.sectionMap.find(section =>
      scrollTop >= section.startPosition && scrollTop < section.endPosition
    );

    // Fallback if no section is found (e.g., if content before first heading)
    if (!currentSection && this.sectionMap.length > 0) {
      currentSection = { startPosition: 0, endPosition: this.sectionMap[0].startPosition, title: "Introduction" };
    } else if (!currentSection) {
      currentSection = { startPosition: 0, endPosition: scrollHeight, title: "Document" };
    }

    // 3. Calculate LOCAL scroll progress within the current section
    const sectionLength = currentSection.endPosition - currentSection.startPosition;
    const progressInSection = (scrollTop - currentSection.startPosition);
    const localPercentage = sectionLength > 0 ? (progressInSection / sectionLength) : 0;

    // 4. Update the thumb's position
    const scrollbarHeight = this.contextualScrollbar.clientHeight;
    const thumbHeight = this.thumbElement.offsetHeight;
    const thumbPosition = localPercentage * (scrollbarHeight - thumbHeight);
    this.thumbElement.style.top = `${thumbPosition}px`;

    // 5. Update the active state in the tooltip index
    if (this.scrollIndexEl) {
      this.scrollIndexEl.querySelectorAll('.scrollbar-index-item').forEach(item => {
        const itemSection = this.sectionMap[item.dataset.index];
        item.classList.toggle('active', itemSection.startPosition === currentSection.startPosition);
      });
    }

    // 6. Handle word count visibility (unchanged)
    if (this.wordCountEl) {
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 5;
      if (scrollTop > 50 && !isAtBottom) {
        this.wordCountEl.classList.add('is-hidden');
      } else {
        this.wordCountEl.classList.remove('is-hidden');
      }
    }
  }

  handleThumbMouseDown(e) {
    e.preventDefault();
    this.isDragging = true;
    this.dragStartY = e.clientY;
    document.body.style.cursor = 'grabbing';
    document.addEventListener('mousemove', this.handleThumbMouseMove.bind(this));
    document.addEventListener('mouseup', this.handleThumbMouseUp.bind(this));
  }

  handleThumbMouseMove(e) {
    if (!this.isDragging) return;
    e.preventDefault();
    const deltaY = e.clientY - this.dragStartY;
    this.dragStartY = e.clientY;

    const { scrollTop } = this.scrollPane;

    let currentSection = this.sectionMap.find(section =>
      scrollTop >= section.startPosition && scrollTop < section.endPosition
    );
    if (!currentSection && this.sectionMap.length > 0) {
      currentSection = { startPosition: 0, endPosition: this.sectionMap[0].startPosition };
    } else if (!currentSection) {
      currentSection = { startPosition: 0, endPosition: this.scrollPane.scrollHeight };
    }

    const sectionLength = currentSection.endPosition - currentSection.startPosition;
    const scrollbarHeight = this.contextualScrollbar.clientHeight;
    const scrollRatio = deltaY / scrollbarHeight;

    this.scrollPane.scrollTop += scrollRatio * sectionLength;
  }

  handleThumbMouseUp(e) {
    e.preventDefault();
    this.isDragging = false;
    document.body.style.cursor = '';
    document.removeEventListener('mousemove', this.handleThumbMouseMove.bind(this));
    document.removeEventListener('mouseup', this.handleThumbMouseUp.bind(this));
  }

  // --- UNCHANGED METHODS BELOW ---

  updateWordCount() {
    if (!this.wordCountEl || !this.instance) return;

    const stats = this.instance.storage.characterCount;
    const words = stats.words();
    const chars = stats.characters();

    this.wordCountEl.innerHTML = `${words} | ${chars}`;
  }

  createToolbarElement() {
    const el = document.createElement('div');
    el.className = 'editor-toolbar';
    el.innerHTML = `
      <button class="toolbar-btn" data-action="bold" title="Bold (Ctrl+B)"><svg viewBox="0 0 24 24"><path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"></path><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"></path></svg></button>
      <button class="toolbar-btn" data-action="italic" title="Italic (Ctrl+I)"><svg viewBox="0 0 24 24"><line x1="19" y1="4" x2="10" y2="4"></line><line x1="14" y1="20" x2="5" y2="20"></line><line x1="15" y1="4" x2="9" y2="20"></line></svg></button>
      <button class="toolbar-btn" data-action="link" title="Add Link"><svg viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.72-1.71"></path></svg></button>
      <button class="toolbar-btn" data-action="footnote" title="Add Footnote"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 7h10M7 11h10M7 15h4m5.18-11.82a1.5 1.5 0 0 0-2.12 0l-5.5 5.5a1.5 1.5 0 0 0 0 2.12l5.5 5.5a1.5 1.5 0 0 0 2.12 0l5.5-5.5a1.5 1.5 0 0 0 0-2.12z"/></svg></button>
      <div class="toolbar-divider"></div>
      <button class="toolbar-btn" data-action="analyze" title="Analyze Selection"><svg viewBox="0 0 24 24"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.2 0 .5 0 .7-.1-.5-.8-.7-1.7-.7-2.9 0-3.3 2.7-6 6-6 .9 0 1.8.2 2.5.6 1.1-1.9 1.5-4.1 1.5-6.6C22 6.5 17.5 2 12 2zm4.1 12.3c-.3.1-.6.2-.9.2-2.2 0-4-1.8-4-4s1.8-4 4-4c.3 0 .6 0 .9.1.5-2.2-.2-4.6-2-6.1C8.7 5.6 6 8.6 6 12s2.7 6.4 6.1 7.7c1.8-1.5 2.5-3.9 2-6.1zM17 14v-2h-2v-2h2V8l4 4-4 4z"></path></svg></button>
      <button class="toolbar-btn" data-action="rewrite" title="Rewrite Selection"><svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path><path d="m15 5 3 3"></path></svg></button>
    `;
    document.body.appendChild(el);
    return el;
  }

  createFloatingMenuElement() {
    const el = document.createElement('div');
    el.className = 'floating-menu';
    el.innerHTML = `
        <button class="floating-menu-btn" data-action="h2" title="Heading 2 (New Chapter)"><svg viewBox="0 0 24 24"><path d="M4 12h8m-8 6h16m-8-12v12"/></svg></button>
        <button class="floating-menu-btn" data-action="h3" title="Heading 3 (New Section)"><svg viewBox="0 0 24 24"><path d="M4 12h8m-8 6h16m-8-12v12"/></svg></button>
        <button class="floating-menu-btn" data-action="bulletList" title="Bullet List"><svg viewBox="0 0 24 24"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg></button>
        <button class="floating-menu-btn" data-action="orderedList" title="Numbered List"><svg viewBox="0 0 24 24"><line x1="9" y1="6" x2="21" y2="6"></line><line x1="9" y1="12" x2="21" y2="12"></line><line x1="9" y1="18" x2="21" y2="18"></line><path d="M4.5 6H6v1"></path><path d="M4 12h2l-1 1 1 1H4"></path><path d="M5 18H4v-1a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1z"></path></svg></button>
        <button class="floating-menu-btn" data-action="blockquote" title="Blockquote"><svg viewBox="0 0 24 24"><path d="M3 21h18M3 10h12a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H3v-8zM3 8a2 2 0 0 1 2-2h10M17 10a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2"></path></svg></button>
        <button class="floating-menu-btn" data-action="codeBlock" title="Code Block"><svg viewBox="0 0 24 24"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg></button>
        <button class="floating-menu-btn" data-action="horizontalRule" title="Divider"><svg viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"></line></svg></button>
      `;
    document.body.appendChild(el);
    return el;
  }

  setupFloatingMenuListeners() {
    this.floatingMenu.addEventListener('mousedown', (e) => {
      e.preventDefault();
      const btn = e.target.closest('.floating-menu-btn');
      if (!btn) return;

      const action = btn.dataset.action;
      const chain = this.instance.chain().focus();

      switch (action) {
        case 'h2': chain.toggleHeading({ level: 2 }).run(); break;
        case 'h3': chain.toggleHeading({ level: 3 }).run(); break;
        case 'bulletList': chain.toggleBulletList().run(); break;
        case 'orderedList': chain.toggleOrderedList().run(); break;
        case 'blockquote': chain.toggleBlockquote().run(); break;
        case 'codeBlock': chain.toggleCodeBlock().run(); break;
        case 'horizontalRule': chain.setHorizontalRule().run(); break;
      }
    });
  }

  setupToolbarListeners() {
    this.toolbar.addEventListener('click', async (e) => {
      const btn = e.target.closest('.toolbar-btn');
      if (!btn) return;

      const action = btn.dataset.action;
      const chain = this.instance.chain().focus();
      const selection = this.instance.state.selection;
      const selectedText = this.instance.state.doc.textBetween(selection.from, selection.to);
      const payload = {
        context: {
          type: 'selection',
          selected_text: selectedText,
          range: { from: selection.from, to: selection.to }
        },
        current_book_filename: this.bookService.currentBook?.filename,
        current_view_id: this.bookService.currentViewId,
      };

      switch (action) {
        case 'bold': chain.toggleBold().run(); break;
        case 'italic': chain.toggleItalic().run(); break;
        case 'link': {
          const previousUrl = this.instance.getAttributes('link').href;

          const url = await this.controller.prompt('Enter URL', 'https://example.com', previousUrl);
          if (url === null) return;
          if (url === '') {
            chain.extendMarkRange('link').unsetLink().run();
          } else {
            chain.extendMarkRange('link').setLink({ href: url }).run();
          }
          break;
        }
        case 'footnote':  chain.setTextSelection(this.instance.state.selection.to).addFootnote().run(); break;
        case 'analyze': this.handleDirectAnalysis(payload); break;
        case 'rewrite': this.handleDirectRewrite(payload); break;
      }
    });
  }

  async handleDirectAnalysis(payload) {
    const ai_response = await this.controller.runAnalyst(payload);
    if (ai_response) {
      const blockData = {
        type: 'analysis',
        title: "AI Critique",
        id: `analysis_${Date.now()}`,
        content: { type: 'markdown', text: ai_response }
      };
      this.controller.addMarginBlock(payload.current_view_id, blockData);
      this.controller.openRightDrawer('assistant');
    }
  }

  async handleDirectRewrite(payload) {
    try {
      const rewritten_text = await this.controller.runRewrite(payload);
      if (rewritten_text) {
        const suggestionPayload = {
          original_text: payload.context.selected_text,
          suggested_text: rewritten_text,
          range: payload.context.range
        };
        this.controller.renderRewriteSuggestion(suggestionPayload);
        this.controller.openRightDrawer('assistant');
      }
    } catch (error) {
      this.controller.showIndicator(error.message, { isError: true, duration: 3000 });
    }
  }

  updateToolbarState() {
    this.toolbar.querySelector('[data-action="bold"]').classList.toggle('is-active', this.instance.isActive('bold'));
    this.toolbar.querySelector('[data-action="italic"]').classList.toggle('is-active', this.instance.isActive('italic'));
    this.toolbar.querySelector('[data-action="link"]').classList.toggle('is-active', this.instance.isActive('link'));
  }

  updateTooltipPosition(e) {
    if (this.isMouseInTooltip) return;

    if (!this.scrollIndexEl) return;

    const scrollbarRect = this.contextualScrollbar.getBoundingClientRect();
    // Calculate the mouse's Y position relative to the scrollbar container.
    let relativeY = e.clientY - scrollbarRect.top;

    // Clamp the position to prevent the tooltip from going off-screen.
    const tooltipHeight = this.scrollIndexEl.offsetHeight;
    const halfTooltipHeight = tooltipHeight / 2;
    relativeY = Math.max(halfTooltipHeight, relativeY);
    relativeY = Math.min(scrollbarRect.height - halfTooltipHeight, relativeY);

    // Apply the new position.
    this.scrollIndexEl.style.top = `${relativeY}px`;
  }

  render(content) {
    this.instance.commands.setContent(content, false);
    setTimeout(() => {
      this.updateWordCount();
      // --- CHANGED: Call the map builder on render ---
      this.buildSectionMapAndIndex();
    }, 0);
  }

  setEditable(isEditable) {
    this.instance.setOptions({ editable: isEditable });
    setTimeout(() => {
      this.updateWordCount();
      // --- CHANGED: Call the map builder on edit state change ---
      this.buildSectionMapAndIndex();
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