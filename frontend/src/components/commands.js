const getPreviousNodeText = (editor) => {
    const { state } = editor;
    const { $from } = state.selection;
    // nodeBefore can be null or a text node, we want the block node before that
    const blockNode = $from.node($from.depth - 1);
    return blockNode ? blockNode.textContent : '';
};

export const getCommands = (controller) => ([
  // --- Basic Blocks ---
  {
    title: 'Heading 2',
    aliases: ['h2', 'heading2', 'title'],
    action: (editor) => editor.chain().focus().setNode('heading', { level: 2 }).run()
  },
  {
    title: 'Heading 3',
    aliases: ['h3', 'heading3', 'subtitle'],
    action: (editor) => editor.chain().focus().setNode('heading', { level: 3 }).run()
  },
  {
    title: 'Bulleted List',
    aliases: ['bu', 'list', 'bullet'],
    action: (editor) => editor.chain().focus().toggleBulletList().run()
  },
  {
    title: 'Numbered List',
    aliases: ['nu', 'ordered'],
    action: (editor) => editor.chain().focus().toggleOrderedList().run()
  },
  {
    title: 'Blockquote',
    aliases: ['bl', 'quote'],
    action: (editor) => editor.chain().focus().toggleBlockquote().run()
  },
  {
    title: 'Divider',
    aliases: ['di', 'hr', 'rule'],
    action: (editor) => editor.chain().focus().setHorizontalRule().run()
  },

  // --- AI Commands ---
  {
    title: 'Summarize',
    aliases: ['summ'],
    description: 'Summarize the paragraph above.',
    action: (editor) => {
        const text = getPreviousNodeText(editor);
        if (text) {
            controller.runSummarizeOnText(text);
        }
    }
  },
  {
    title: 'Find Related Notes',
    aliases: ['find', 'notes', 'related'],
    description: 'Search your notebook for related ideas.',
    action: (editor) => {
        const text = getPreviousNodeText(editor);
        if (text) {
            controller.runFindNotesOnText(text);
        }
    }
  },
  {
    title: 'Ask AI',
    aliases: ['custom', 'request'],
    description: 'Open the AI Command Palette.',
    action: (editor, _, query) => {
      // This command will be handled specially to pass the query
      controller.showAiStudio('custom_request', query);
    }
  }
]);