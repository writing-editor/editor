// Path: frontend/src/agents/RewriteAgent.js
import { BaseAgent } from './BaseAgent.js';

export class RewriteAgent extends BaseAgent {
    async run(payload) {
        // REMOVED: prompt_template is no longer expected in the payload.
        const { user_request, context } = payload;
        
        // NEW: The agent now fetches its own prompt template.
        const promptFile = await this.controller.storageService.getFile('REWRITE.txt');
        const prompt_template = promptFile ? promptFile.content : null;

        if (!prompt_template) {
            console.error("Rewrite Error: Prompt template 'REWRITE.txt' could not be loaded.");
            this.controller.showIndicator("Proofread prompt is missing.", { isError: true, duration: 4000 });
            return null;
        }

        if (context.type !== "selection" || !context.selected_text) {
            // This error is now handled more gracefully in AnalystAgent, but throwing here is still valid.
            // Let's make it consistent and show an indicator instead.
            this.controller.showIndicator("Please select text to proofread.", { isError: true, duration: 3000 });
            return null; // Return null instead of throwing to prevent unhandled promise rejection.
        }

        // The new default prompt doesn't use {user_request}, but this remains for custom prompts.
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