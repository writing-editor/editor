import { BaseAgent } from './BaseAgent.js';

export class FindNotesAgent extends BaseAgent {
    async run(payload) {
        const { query, all_notes } = payload;

        // NEW: Fetch the single, structured prompts file.
        const promptsFile = await this.controller.storageService.getFile('prompts.json');
        const prompts = promptsFile ? promptsFile.content : null;

        if (!prompts || !prompts.FINDNOTES) {
            console.error("FindNotes Error: Prompt for 'FINDNOTES' could not be loaded from prompts.json.");
            this.controller.showIndicator("AI Note Search prompt is missing.", { isError: true, duration: 4000 });
            // Fallback to local search on missing prompt
            return all_notes.filter(note =>
                note.plain_text.toLowerCase().includes(query.toLowerCase())
            );
        }

        const notes_json_string = JSON.stringify(
            all_notes.map(note => ({ id: note.id, content: note.plain_text }))
        );

        // NEW: Combine system and user prompts safely.
        const promptConfig = prompts.FINDNOTES;
        let final_prompt = `${promptConfig.system}\n\n${promptConfig.user}`;
        final_prompt = final_prompt.replace('{query}', query);
        final_prompt = final_prompt.replace('{notes_json_string}', notes_json_string);

        const indicatorId = this.controller.showIndicator('Searching...');
        try {
            // Note the 'true' flag to request JSON output from the LLM
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