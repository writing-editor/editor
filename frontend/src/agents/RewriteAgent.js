// Path: frontend/src/agents/RewriteAgent.js
import { BaseAgent } from './BaseAgent.js';

export class RewriteAgent extends BaseAgent {
    async run(payload) {
        const { context } = payload;
        
        // NEW: Fetch the single, structured prompts file.
        const promptsFile = await this.controller.storageService.getFile('prompts.json');
        const prompts = promptsFile ? promptsFile.content : null;

        if (!prompts || !prompts.REWRITE) {
            console.error("Rewrite Error: Prompt for 'REWRITE' could not be loaded from prompts.json.");
            this.controller.showIndicator("Proofread prompt is missing.", { isError: true, duration: 4000 });
            return null;
        }

        if (context.type !== "selection" || !context.selected_text) {
            this.controller.showIndicator("Please select text to proofread.", { isError: true, duration: 3000 });
            return null;
        }

        // NEW: Combine system and user prompts safely.
        const promptConfig = prompts.REWRITE;
        let final_prompt = `${promptConfig.system}\n\n${promptConfig.user}`;
        final_prompt = final_prompt.replace('{text_to_analyze}', context.selected_text);

        const indicatorId = this.controller.showIndicator('Thinking...');
        try {
            return await this.orchestrator.execute(final_prompt);
        } finally {
            this.controller.hideIndicator(indicatorId);
        }
    }
}