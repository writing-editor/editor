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
  constructor(app, bookService) { 
    this.app = app;
    this.bookService = bookService;
    this.element = document.getElementById('editor-pane');

    // --- NEW: Debounced save function ---
    // We will call the App's save method after 2 min of inactivity.
    //this.debouncedSave = debounce(() => {
        //this.bookService.saveCurrentView(this.instance.getJSON());
    //}, 120000);

    this.instance = new TipTapEditor({
      element: this.element,
      extensions: [
        StarterKit.configure({
            heading: {
                // --- THE FIX: Explicitly define allowed heading levels ---
                levels: [2, 3, 4, 5, 6], // Allow H2 through H6, but NOT H1
            },
        }),
      ],
      content: '<h2>Welcome</h2>',
      //onUpdate: () => {
        //this.debouncedSave();
      //},
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
