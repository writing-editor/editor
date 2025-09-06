import { BaseAgent } from './BaseAgent.js';

export class FindNotesAgent extends BaseAgent {
    async run(payload) {
        const { query, all_notes } = payload;

        let prompt_template = await this.controller.storageService.getFile('FINDNOTES.txt');

        const notes_json_string = JSON.stringify(
            all_notes.map(note => ({ id: note.id, content: note.plain_text }))
        );

        let final_prompt = prompt_template.replace('{query}', query);
        final_prompt = final_prompt.replace('{notes_json_string}', notes_json_string);

        const indicatorId = this.controller.showIndicator('Searching...');
        try {
            const response_text = await this.orchestrator.execute(final_prompt, true);
            const relevant_ids_data = JSON.parse(response_text);
            const relevant_ids = new Set(relevant_ids_data.relevant_note_ids || []);
            return all_notes.filter(note => relevant_ids.has(note.id));
        } catch (error) {
            console.error("Failed to parse LLM search response:", error);
            // Fallback to local search on error
            return all_notes.filter(note =>
                note.plain_text.toLowerCase().includes(query.toLowerCase())
            );
        } finally {
            this.controller.hideIndicator(indicatorId);
        }
    }
}