import { BaseAgent } from './BaseAgent.js';

export class DevelopmentAgent extends BaseAgent {
    async run(payload) {
        const { user_request, context, book_structure, current_book_filename, promptKey, all_notes } = payload;
        
        const promptsFile = await this.controller.storageService.getFile('prompts.json');
        const prompts = promptsFile ? promptsFile.content : null;

        if (!prompts || !prompts[promptKey]) {
            console.error(`Execution Error: Prompt for '${promptKey}' could not be loaded.`);
            this.controller.showIndicator("Required prompt is missing.", { isError: true, duration: 4000 });
            return null;
        }

        const promptConfig = prompts[promptKey];
        let final_prompt = `${promptConfig.system}\n\n${promptConfig.user}`;

        if (final_prompt.includes('{context_summary}')) {
            const context_summary = `The user is working on the document "${current_book_filename}".\nThe overall book structure is:\n${JSON.stringify(book_structure, null, 2)}\n\nThe content of the current view is:\n---\n${context.view_content}\n---`;
            final_prompt = final_prompt.replace('{context_summary}', context_summary);
        }

        if (final_prompt.includes('{context_text}')) {
            const context_text = context.type === 'selection' ? context.selected_text : context.view_content;
            final_prompt = final_prompt.replace('{context_text}', context_text);
        }

        if (final_prompt.includes('{notes_json_string}')) {
            const notes_json_string = JSON.stringify(
                all_notes.map(note => ({ id: note.id, content: note.plain_text }))
            );
            final_prompt = final_prompt.replace('{notes_json_string}', notes_json_string);
        }

        if (final_prompt.includes('{user_request}')) {
            final_prompt = final_prompt.replace('{user_request}', user_request || '');
        }

        const indicatorId = this.controller.showIndicator('Agent is working...');
        try {
            return await this.orchestrator.execute(final_prompt);
        } finally {
            this.controller.hideIndicator(indicatorId);
        }
    }
}