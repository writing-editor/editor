import { Extension } from '@tiptap/core';
import Suggestion from '@tiptap/suggestion';
import { SuggestionList } from './SuggestionList.js';
import { getCommands } from './commands.js';
import tippy from 'tippy.js';

export const SlashCommand = Extension.create({
  name: 'slashCommand',

  addOptions() {
    return {
      controller: null, 
      suggestion: {
        char: '/',
        command: ({ editor, range, props }) => {
          editor.chain().focus().deleteRange(range).run();
          props.action(editor, props.controller, props.query);
        },
        allow: ({ state, range }) => {
          const $from = state.doc.resolve(range.from);
          return $from.parent.type.name === 'paragraph';
        },
      },
    };
  },

  addProseMirrorPlugins() {
    let component;
    let popup; // Tippy instance
    const controller = this.options.controller;

    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
        items: ({ query }) => {
          const commands = getCommands(controller);
          return commands
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

              // Use Tippy.js to create a smart, auto-flipping popup
              popup = tippy('body', {
                getReferenceClientRect: props.clientRect,
                appendTo: () => document.body,
                content: component.element,
                showOnCreate: true,
                interactive: true,
                trigger: 'manual',
                placement: 'bottom-start', // Tippy will auto-flip to 'top-start' if needed
              });
            },
            onUpdate(props) {
              if (!component || !popup) return;

              component.update(props.items);

              // Tell Tippy to update its position
              popup[0].setProps({
                getReferenceClientRect: props.clientRect,
              });
            },
            onKeyDown(props) {
              if (!component) return false;
              if (props.event.key === 'Escape') {
                popup[0].hide();
                return true;
              }
              return component.onKeyDown(props);
            },
            onExit() {
              if (popup) popup[0].destroy();
              if (component) component.destroy();
            },
          };
        },
      }),
    ];
  },
});