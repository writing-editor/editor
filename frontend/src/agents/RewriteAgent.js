import { BaseAgent } from './BaseAgent.js';

export class RewriteAgent extends BaseAgent {
    async run(payload) {
        const { prompt_template, user_request, context } = payload;

        if (context.type !== "selection" || !context.selected_text) {
            alert("Please select text to rewrite.");
            return null;
        }

        // Build the final prompt
        let final_prompt = prompt_template.replace('{user_request}', user_request || "general improvements");
        final_prompt = final_prompt.replace('{text_to_analyze}', context.selected_text);

        const indicatorId = this.app.showIndicator('Thinking...');
        const rewritten_text = await this.orchestrator.execute(final_prompt);
        this.app.hideIndicator(indicatorId);

        return rewritten_text;
    }
}