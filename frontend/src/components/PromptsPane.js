
import { promptBlockWrapper } from '../utils/promptBlockWrapper.js';
import { Editor as TipTapEditor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';

const PROMPT_CONFIG = {
    'DEVELOP': { title: 'Custom Request Prompt (Workbench)' },
    'REWRITE': { title: 'Proofread Prompt (Rewrite)' },
    'ANALYZE': { title: 'Critique Prompt (Analyze)' },
    'AUTOTAG': { title: 'Automatic Tagging Prompt' },
    'FINDNOTES': { title: 'AI Note Search Prompt' }
};

export class PromptsPane {
    constructor(controller, storageService) {
        this.controller = controller;
        this.storageService = storageService;
        this.element = document.getElementById('prompts-drawer');

        this.promptTemplates = {};
        this.isEditorVisible = false;
        this.editingPromptId = null;
        this.mainEditorInstance = null;

        this.element.addEventListener('click', this.handleClick.bind(this));
        this.element.addEventListener('keydown', this.handleKeydown.bind(this));
    }

    async initialize() {
        for (const key of Object.keys(PROMPT_CONFIG)) {
            const fileRecord = await this.storageService.getFile(`${key}.txt`);
            this.promptTemplates[key] = fileRecord ? fileRecord.content : null; 
        }
        this.renderUI();
    }

    renderUI() {
        if (this.mainEditorInstance) {
            this.mainEditorInstance.destroy();
            this.mainEditorInstance = null;
        }

        // --- Use class names from NotebookPane.css for consistency ---
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
                    ${Object.keys(PROMPT_CONFIG).map(key => {
            const config = PROMPT_CONFIG[key];
            return promptBlockWrapper({ ...config, id: key, content: this.promptTemplates[key] });
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
        if (!editorHost) return; // Guard against missing element

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
        const promptBlock = button.closest('.prompt-block');
        const newPromptId = promptBlock?.dataset.promptId;

        switch (action) {
            case 'close-prompts-drawer':
                this.controller.closeRightDrawer();
                break;
            case 'edit-prompt':
                // If the user clicks the same edit button, toggle the editor off
                if (this.isEditorVisible && this.editingPromptId === newPromptId) {
                    this.isEditorVisible = false;
                    this.editingPromptId = null;
                } else {
                    // Otherwise, show the editor for the new prompt
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
        if (!this.mainEditorInstance) return;

        const [system, user] = this.getPromptParts(promptId);
        const systemHost = this.element.querySelector('.prompt-system-instruction-host');
        systemHost.textContent = system || '';
        systemHost.style.display = system ? 'block' : 'none';

        this.mainEditorInstance.commands.setContent(user, false);
    }



    async handleSave() {
        if (!this.mainEditorInstance || !this.mainEditorInstance.state.doc.textContent.trim() || !this.editingPromptId) return;

        const indicatorId = this.controller.showIndicator('Saving Prompt...');
        try {
            const userContent = this.mainEditorInstance.getText({ blockSeparator: "\n\n" });
            const [system, _] = this.getPromptParts(this.editingPromptId);
            const newContent = system ? `${system.trim()}\n---\n${userContent}` : userContent;

            await this.storageService.saveFile(`${this.editingPromptId}.txt`, newContent);
            this.promptTemplates[this.editingPromptId] = newContent;

            this.controller.showIndicator('Prompt Saved!', { duration: 2000 });

            this.isEditorVisible = false;
            this.editingPromptId = null;
            this.renderUI();
        } finally {
            this.controller.hideIndicator(indicatorId);
        }
    }

    getPromptParts(promptId) {
        const content = this.promptTemplates[promptId] || '';
        if (['REWRITE', 'FINDNOTES', 'AUTOTAG'].includes(promptId)) {
            const parts = content.split('---');
            if (parts.length > 1) {
                return [parts[0].trim(), parts.slice(1).join('---').trim()];
            }
        }
        return [null, content];
    }
}