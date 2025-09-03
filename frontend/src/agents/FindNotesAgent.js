import { BaseAgent } from './BaseAgent.js';

export class FindNotesAgent extends BaseAgent {
    async run(payload) {
        const { query, all_notes } = payload;

        // Create the structured prompt for the LLM
        const notes_json_string = JSON.stringify(
            all_notes.map(note => ({ id: note.id, content: note.plain_text }))
        );

        const prompt = `
            You are a semantic search engine for a user's personal notebook.
            Your task is to find the most relevant notes based on the user's query.
            
            User's search query: "${query}"
            Full library of notes: ${notes_json_string}

            Analyze the query and the notes. Return a single, valid JSON object with one key: "relevant_note_ids".
            This key should be a list of the string IDs of the notes that are most conceptually relevant.
            Return up to 5 of the most relevant IDs. If no notes are relevant, return an empty list.
            MUST: Do not include any other text or markdown formatting in your response.
        `;

        const indicatorId = this.app.showIndicator('Searching...');
        const response_text = await this.orchestrator.execute(prompt, true); // true for isJson hint
        this.app.hideIndicator(indicatorId);

        // Process the response
        try {
            const relevant_ids_data = JSON.parse(response_text);
            const relevant_ids = new Set(relevant_ids_data.relevant_note_ids || []);
            const filtered_notes = all_notes.filter(note => relevant_ids.has(note.id));
            return filtered_notes;
        } catch (error) {
            console.error("Failed to parse LLM search response:", error);
            // Fallback to simple keyword search
            return all_notes.filter(note =>
                note.plain_text.toLowerCase().includes(query.toLowerCase())
            );
        }
    }
}