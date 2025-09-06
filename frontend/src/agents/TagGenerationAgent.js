import { BaseAgent } from './BaseAgent.js';

export class TagGenerationAgent extends BaseAgent {
    async run(payload) {
        // Expects payload of format: { notes: [{id: "note_123", content: "text..."}, ...], prompt_template: "..." }
        const { notes, prompt_template } = payload;

        if (!notes || notes.length === 0) {
            console.log("Tag Generation: No notes provided.");
            return null;
        }

        const notes_string = JSON.stringify(notes);

        let final_prompt = prompt_template.replace('{notes_json_string}', notes_string);

        // This agent runs in the background, so no indicator is needed.
        try {
            const response_text = await this.orchestrator.execute(final_prompt, true); // true for JSON mode
            // The prompt will ask for a specific JSON structure.
            const tags_data = JSON.parse(response_text);
            return tags_data.notes_with_tags || [];
        } catch (error) {
            console.error("Failed to generate or parse tags from LLM:", error);
            return null;
        }
    }
}