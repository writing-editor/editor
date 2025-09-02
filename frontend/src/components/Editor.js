// In frontend/src/components/Editor.js
import './editor.css'; // 

import { Editor as TipTapEditor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Heading from '@tiptap/extension-heading'; 

// --- DEBOUNCE HELPER ---
// This function delays executing a function until the user has stopped typing for a specified time.
function debounce(func, delay) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), delay);
    };
}

export class Editor {
  constructor(app, bookService) { // <-- Already receives bookService
    this.app = app;
    this.bookService = bookService; // <-- Already stores reference
    this.element = document.getElementById('editor-pane');

    this.debouncedSave = debounce(() => {
        // --- THIS IS THE FIX ---
        // Call the new saveView method, passing the current viewId
        // which the BookService already knows.
        if (this.bookService.currentViewId) {
            this.bookService.saveView(
                this.bookService.currentViewId, 
                this.instance.getJSON()
            );
        }
    }, 300000); // 5 minute auto-save

    this.instance = new TipTapEditor({
      element: this.element,
      extensions: [
        StarterKit.configure({
            heading: { levels: [2, 3, 4, 5, 6] },
        }),
      ],
      content: '<h2>Welcome</h2>',
      onUpdate: () => {
        // We only want to trigger auto-save if the view is actually editable.
        if (this.instance.isEditable) {
            this.debouncedSave();
        }
      },
    });
  }

  render(content) {
    this.instance.commands.setContent(content, false);
  }
  setEditable(isEditable) {
    this.instance.setOptions({ editable: isEditable });
  }
  replaceText(range, newText) {
    if (!range) return;
    this.instance.chain().focus()
      .deleteRange(range)
      .insertContent(newText)
      .run();
  }
}
