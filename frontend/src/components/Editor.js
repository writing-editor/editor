import './editor.css'; // 
import {debounce} from '../utils/debounce.js';

import { Editor as TipTapEditor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
export class Editor {
  constructor(app, bookService) {
    this.app = app;
    this.bookService = bookService;
    this.element = document.getElementById('editor-pane');

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
