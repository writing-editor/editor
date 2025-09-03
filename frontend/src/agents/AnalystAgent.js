import { BaseAgent } from './BaseAgent.js';

export class AnalystAgent extends BaseAgent {
    async run(payload) {
        const { prompt_template, user_request, context } = payload;

        if (!prompt_template) {
            console.error("Analysis Error: Prompt template was missing.");
            return null;
        }

        const text_to_analyze = context.type === 'selection' ? context.selected_text : '';
        if (!text_to_analyze) {
            console.error("Analysis Error: No text was provided to analyze.");
            return null; // Or return a specific error message object
        }

        // Build the final prompt on the frontend
        let final_prompt = prompt_template.replace('{user_request}', user_request || "a general analysis");
        final_prompt = final_prompt.replace('{text_to_analyze}', text_to_analyze);

        // Execute the prompt via the orchestrator
        const indicatorId = this.app.showIndicator('Thinking...');
        const ai_response = await this.orchestrator.execute(final_prompt);
        this.app.hideIndicator(indicatorId);

        return ai_response;
    }
}