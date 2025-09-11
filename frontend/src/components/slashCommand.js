import { Extension } from '@tiptap/core';
import Suggestion from '@tiptap/suggestion';
import { SuggestionList } from './SuggestionList.js';
import { getCommands } from './commands.js';

export const SlashCommand = Extension.create({
  name: 'slashCommand',

  addOptions() {
    return {
      controller: null, // We will pass the controller here
      suggestion: {
        char: '/',
        command: ({ editor, range, props }) => {
          props.action(editor, props.controller, props.query);
          editor.chain().focus().deleteRange(range).run();
        },
        allow: ({ state, range }) => {
          const $from = state.doc.resolve(range.from);
          return $from.parent.type.name === 'paragraph';
        },
      },
    };
  },

  addProseMirrorPlugins() {
    const controller = this.options.controller;
    let component;

    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
        items: ({ query }) => {
          const allCommands = getCommands(controller);

          // Get the BookService from the controller to check the view context
          const bookService = controller.bookService;
          const isChapterView = bookService._isChapterId(bookService.currentViewId);

          // Filter the commands based on the view context
          const availableCommands = allCommands.filter(command => {
            // If the command is 'Heading 2' and we are NOT in a chapter view, hide it.
            if (command.title === 'Heading 2' && !isChapterView) {
              return false;
            }
            // Otherwise, show the command.
            return true;
          });

          // Now, filter the available commands by the user's search query
          return availableCommands
            .filter(item =>
              item.title.toLowerCase().startsWith(query.toLowerCase()) ||
              (item.aliases && item.aliases.some(alias => alias.startsWith(query.toLowerCase())))
            )
            .slice(0, 10);
        },
        render: () => {
          return {
            onStart: props => {
              component = new SuggestionList({
                onSelect: (item) => {
                  props.command({ ...item, controller });
                }
              });

              component.update(props.items);

              const rect = props.clientRect();
              if (!rect) return;

              this.editor.view.dom.parentNode.appendChild(component.element);
              component.element.style.position = 'absolute';
              component.element.style.left = `${rect.left}px`;
              component.element.style.top = `${rect.bottom + window.scrollY}px`;
            },
            onUpdate(props) {
              if (!component) return;
              component.update(props.items);
              const rect = props.clientRect();
              if (!rect) return;
              component.element.style.left = `${rect.left}px`;
              component.element.style.top = `${rect.bottom + window.scrollY}px`;
            },
            onKeyDown(props) {
              if (!component) return false;
              if (props.event.key === 'Escape') {
                props.editor.commands.focus();
                return true;
              }
              return component.onKeyDown(props);
            },
            onExit() {
              if (component) {
                component.destroy();
                component = null;
              }
            },
          };
        },
      }),
    ];
  },
});