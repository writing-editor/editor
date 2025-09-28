export const getCommands = (controller) => ([
  // --- AI Command ---
  {
    title: 'AI Command Palette',
    aliases: ['ai', 'ask', 'run'],
    description: 'Open the AI Command Palette to run any agent.',
    action: () => {
      // This action simply opens the AI Studio, which is exactly what we want.
      controller.showAiStudio();
    }
  },

  // --- Basic Blocks (These are useful and can remain) ---
  {
    title: 'Chapter',
    aliases: ['h2', 'chapter', 'title'],
    action: (editor) => editor.chain().focus().setNode('heading', { level: 2 }).run()
  },
  {
    title: 'Section',
    aliases: ['h3', 'section', 'subtitle'],
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
  }
]);