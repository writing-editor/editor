// Path: frontend/src/agents/AnalystAgent.js
import { BaseAgent } from './BaseAgent.js';

export class AnalystAgent extends BaseAgent {
    async run(payload) {
        // REMOVED: prompt_template is no longer expected in the payload.
        const { user_request, context } = payload;

        // NEW: The agent now fetches its own prompt template.
        const prompt_template = await this.controller.storageService.getFile('ANALYZE.txt');

        if (!prompt_template) {
            console.error("Analysis Error: Prompt template 'ANALYZE.txt' could not be loaded.");
            // Optionally, show an indicator to the user.
            this.controller.showIndicator("Analysis prompt is missing.", { isError: true, duration: 4000 });
            return null;
        }

        const text_to_analyze = context.type === 'selection' ? context.selected_text : '';
        if (!text_to_analyze) {
            // This check remains important for the bubble menu context.
            console.error("Analysis Error: No text was selected to analyze.");
            this.controller.showIndicator("Please select text to analyze.", { isError: true, duration: 3000 });
            return null;
        }

        // The new default prompt doesn't use {user_request}, but this remains for custom prompts.
        let final_prompt = prompt_template.replace('{user_request}', user_request || "a general analysis");
        final_prompt = final_prompt.replace('{text_to_analyze}', text_to_analyze);

        const indicatorId = this.controller.showIndicator('Thinking...');
        try {
            return await this.orchestrator.execute(final_prompt);
        } finally {
            this.controller.hideIndicator(indicatorId);
        }
    }
}