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
            return null;
        }

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