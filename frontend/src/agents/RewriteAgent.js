import { BaseAgent } from './BaseAgent.js';

export class RewriteAgent extends BaseAgent {
    async run(payload) {
        const { prompt_template, user_request, context } = payload;

        if (context.type !== "selection" || !context.selected_text) {
            throw new Error("Please select text to rewrite.");
        }

        let final_prompt = prompt_template.replace('{user_request}', user_request || "general improvements");
        final_prompt = final_prompt.replace('{text_to_analyze}', context.selected_text);

        const indicatorId = this.controller.showIndicator('Thinking...');
        try {
            return await this.orchestrator.execute(final_prompt);
        } finally {
            this.controller.hideIndicator(indicatorId);
        }
    }
}