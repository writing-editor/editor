import { BaseAgent } from './BaseAgent.js';

export class TagGenerationAgent extends BaseAgent {
    async run(payload) {
        // --- CHANGED: Payload now only expects 'notes'. ---
        const { notes } = payload;

        if (!notes || notes.length === 0) {
            console.log("Tag Generation: No notes provided.");
            return null;
        }
        const promptsFile = await this.controller.storageService.getFile('prompts.json');
        const prompts = promptsFile ? promptsFile.content : null;

        if (!prompts || !prompts.AUTOTAG) {
            console.error("Tagging Error: Prompt for 'AUTOTAG' could not be loaded from prompts.json.");
            // No user-facing indicator needed for this background task.
            return null;
        }

        const notes_string = JSON.stringify(notes);

        // --- NEW: Combine system and user prompts safely. ---
        const promptConfig = prompts.AUTOTAG;
        let final_prompt = `${promptConfig.system}\n\n${promptConfig.user}`;
        final_prompt = final_prompt.replace('{notes_json_string}', notes_string);

        try {
            // true for JSON mode is still required
            const response_text = await this.orchestrator.execute(final_prompt, true); 
            const tags_data = JSON.parse(response_text);
            return tags_data.notes_with_tags || [];
        } catch (error) {
            console.error("Failed to generate or parse tags from LLM:", error);
            return null;
        }
    }
}