export class BaseExecutor {
    constructor(llmOrchestrator, controller) {
        this.llmOrchestrator = llmOrchestrator;
        this.controller = controller;
    }

    async run(manifest, payload) {
        throw new Error("Executor must implement a 'run' method.");
    }

    // Utility method to replace placeholders in prompts
    _preparePrompt(promptTemplate, payload) {
        const { context, user_request, all_notes, note_content } = payload;
        let prompt = promptTemplate;

        if (prompt.includes('{selected_text}')) {
            const selected_text = context.type === 'selection' ? context.selected_text : '';
            prompt = prompt.replace('{selected_text}', selected_text);
        }
        if (prompt.includes('{context_text}')) {
            const context_text = context.type === 'selection' ? context.selected_text : context.view_content;
            prompt = prompt.replace('{context_text}', context_text);
        }
        if (prompt.includes('{view_content}')) {
            prompt = prompt.replace('{view_content}', context.view_content || '');
        }
        if (prompt.includes('{user_request}')) {
            prompt = prompt.replace('{user_request}', user_request || '');
        }
        if (prompt.includes('{notes_json_string}')) {
            const notes_json_string = JSON.stringify(
                all_notes.map(note => ({ id: note.id, content: note.plain_text }))
            );
            prompt = prompt.replace('{notes_json_string}', notes_json_string);
        }
        if (prompt.includes('{book_structure}')) {
            prompt = prompt.replace('{book_structure}', payload.book_structure || '');
        }
        if (prompt.includes('{full_book_content}')) {
            prompt = prompt.replace('{full_book_content}', payload.full_book_content || '');
        }
        if (prompt.includes('{all_notes}')) {
            const notes_json_string = JSON.stringify(
                (payload.all_notes || []).map(note => ({ id: note.id, content: note.plain_text }))
            );
            prompt = prompt.replace('{all_notes}', notes_json_string);
        }
        if (prompt.includes('{note_content}')) {
            prompt = prompt.replace('{note_content}', note_content || '');
        }
        return prompt;
    }
}