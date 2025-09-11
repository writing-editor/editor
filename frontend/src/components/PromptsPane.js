import { promptBlockWrapper } from '../utils/promptBlockWrapper.js';
import { Editor as TipTapEditor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';

// A map to provide user-friendly titles for each prompt key.
const PROMPT_TITLES = {
    'DEVELOP': 'Custom Request Prompt (Workbench)',
    'REWRITE': 'Proofread Prompt (Rewrite)',
    'ANALYZE': 'Critique Prompt (Analyze)',
    'AUTOTAG': 'Automatic Tagging Prompt',
    'FINDNOTES': 'AI Note Search Prompt',
    'COMMAND_SUMMARIZE': 'Command: Summarize',
    'COMMAND_CHANGE_TONE': 'Command: Change Tone',
    'COMMAND_TITLES': 'Command: Suggest Titles',
    'COMMAND_OUTLINE': 'Command: Generate Outline'
};


export class PromptsPane {
    constructor(controller, storageService) {
        this.controller = controller;
        this.storageService = storageService;
        this.element = document.getElementById('prompts-drawer');

        this.promptTemplates = {}; // This will hold the entire prompts.json object
        this.isEditorVisible = false;
        this.editingPromptId = null;
        this.mainEditorInstance = null;

        this.element.addEventListener('click', this.handleClick.bind(this));
        this.element.addEventListener('keydown', this.handleKeydown.bind(this));
    }

    async initialize() {
        const fileRecord = await this.storageService.getFile('prompts.json');
        this.promptTemplates = fileRecord ? fileRecord.content : {};
        this.renderUI();
    }

    renderUI() {
        if (this.mainEditorInstance) {
            this.mainEditorInstance.destroy();
            this.mainEditorInstance = null;
        }

        this.element.innerHTML = `
            <div class="prompts-header">
                <h3>Manage Prompts</h3>
                <button id="close-prompts-drawer" class="close-drawer-btn" title="Close">&times;</button>
            </div>
            
            <div class="prompts-content-wrapper">
                ${this.isEditorVisible ? `
                    <div id="main-prompt-editor-container" class="note-editor-container">
                        <div class="prompt-system-instruction-host"></div>
                        <div class="prompt-tiptap-editor-host"></div>
                    </div>` : ''}
                <div id="note-blocks-container">
                    ${Object.keys(this.promptTemplates).map(key => {
            const config = {
                id: key,
                title: PROMPT_TITLES[key] || key,
                content: this.promptTemplates[key] // Pass the whole {system, user} object
            };
            return promptBlockWrapper(config);
        }).join('')}
                </div>
            </div>
        `;

        if (this.isEditorVisible) {
            this.initializeMainEditor();
            this.loadPromptIntoEditor(this.editingPromptId);
        }
        this.updateEditingHighlight();
    }

    initializeMainEditor() {
        const editorHost = this.element.querySelector('.prompt-tiptap-editor-host');
        if (!editorHost) return;

        this.mainEditorInstance = new TipTapEditor({
            element: editorHost,
            extensions: [StarterKit, Placeholder.configure({ placeholder: 'Enter prompt instructions here...' })],
            editorProps: { attributes: { class: 'note-editor-prosemirror' } },
        });
    }

    updateEditingHighlight() {
        this.element.querySelectorAll('.prompt-block').forEach(el => el.classList.remove('is-editing'));
        if (this.editingPromptId) {
            const el = this.element.querySelector(`[data-prompt-id="${this.editingPromptId}"]`);
            if (el) el.classList.add('is-editing');
        }
    }

    handleClick(e) {
        const button = e.target.closest('button');
        if (!button) return;

        const action = button.dataset.action || button.id;
        
        if (action === 'insert-variable') {
        if (this.mainEditorInstance) {
            this.mainEditorInstance.chain().focus().insertContent(button.dataset.variable).run();
        }
        return; 
    }
        
        const promptBlock = button.closest('.prompt-block');
        const newPromptId = promptBlock?.dataset.promptId;

        switch (action) {
            case 'close-prompts-drawer':
                this.controller.closeRightDrawer();
                break;
            case 'edit-prompt':
                if (this.isEditorVisible && this.editingPromptId === newPromptId) {
                    this.isEditorVisible = false;
                    this.editingPromptId = null;
                } else {
                    this.isEditorVisible = true;
                    this.editingPromptId = newPromptId;
                }
                this.renderUI();
                this.mainEditorInstance?.commands.focus('end');
                break;
        }
    }

    handleKeydown(e) {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            const editorEl = this.element.querySelector('#main-prompt-editor-container');
            if (editorEl && editorEl.contains(document.activeElement)) {
                e.preventDefault();
                this.handleSave();
            }
        }
    }

    loadPromptIntoEditor(promptId) {
        if (!this.mainEditorInstance || !promptId) return;

        const promptConfig = this.promptTemplates[promptId];
        if (!promptConfig) return;

        const systemHost = this.element.querySelector('.prompt-system-instruction-host');
        systemHost.textContent = promptConfig.system || 'No system prompt defined.';

        this.mainEditorInstance.commands.setContent(promptConfig.user || '', false);
        this.renderVariableHints(promptId); 
    }

    async handleSave() {
        if (!this.mainEditorInstance || !this.editingPromptId) return;

        const userContent = this.mainEditorInstance.getText({ blockSeparator: "\n\n" });
        if (!userContent.trim()) {
            this.controller.showIndicator("Prompt content cannot be empty.", { isError: true });
            return;
        }

        const indicatorId = this.controller.showIndicator('Saving Prompt...');
        try {
            // Update the in-memory object
            this.promptTemplates[this.editingPromptId].user = userContent;

            // Save the entire updated object back to the database
            await this.storageService.saveFile('prompts.json', this.promptTemplates);

            this.controller.showIndicator('Prompt Saved!', { duration: 2000 });

            this.isEditorVisible = false;
            this.editingPromptId = null;
            this.renderUI();
        } finally {
            this.controller.hideIndicator(indicatorId);
        }
    }

    renderVariableHints(promptId) {
        const promptConfig = this.promptTemplates[promptId];
        if (!promptConfig) return;

        // Combine both parts of the prompt to find all possible variables
        const fullPromptText = `${promptConfig.system} ${promptConfig.user}`;

        // Use a regular expression to find all instances of {variable_name}
        const variables = new Set(fullPromptText.match(/{[a-zA-Z_]+}/g));

        const editorContainer = this.element.querySelector('#main-prompt-editor-container');
        if (!editorContainer) return;

        // Remove any existing hints container
        const existingHints = editorContainer.querySelector('.prompt-variable-hints');
        if (existingHints) existingHints.remove();

        if (variables.size === 0) return; // Don't render anything if no variables are found

        const hintsContainer = document.createElement('div');
        hintsContainer.className = 'prompt-variable-hints';

        const pillsHtml = Array.from(variables).map(variable =>
            `<button class="prompt-variable-pill" data-action="insert-variable" data-variable="${variable}">
        ${variable}
      </button>`
        ).join('');

        hintsContainer.innerHTML = `
      <label>Available Variables</label>
      <div class="prompt-variable-pills-container">${pillsHtml}</div>
    `;

        // Append the hints below the editor
        editorContainer.appendChild(hintsContainer);
    }
}