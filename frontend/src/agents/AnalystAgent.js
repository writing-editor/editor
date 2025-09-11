// Path: frontend/src/agents/AnalystAgent.js
import { BaseAgent } from './BaseAgent.js';

export class AnalystAgent extends BaseAgent {
    async run(payload) {
        const { context } = payload;

        // NEW: Fetch the single, structured prompts file.
        const promptsFile = await this.controller.storageService.getFile('prompts.json');
        const prompts = promptsFile ? promptsFile.content : null;

        if (!prompts || !prompts.ANALYZE) {
            console.error("Analysis Error: Prompt for 'ANALYZE' could not be loaded from prompts.json.");
            this.controller.showIndicator("Analysis prompt is missing.", { isError: true, duration: 4000 });
            return null;
        }

        const text_to_analyze = context.type === 'selection' ? context.selected_text : '';
        if (!text_to_analyze) {
            this.controller.showIndicator("Please select text to analyze.", { isError: true, duration: 3000 });
            return null;
        }

        // NEW: Combine system and user prompts safely.
        const promptConfig = prompts.ANALYZE;
        let final_prompt = `${promptConfig.system}\n\n${promptConfig.user}`;
        final_prompt = final_prompt.replace('{text_to_analyze}', text_to_analyze);
        
        const indicatorId = this.controller.showIndicator('Thinking...');
        try {
            // The orchestrator is now a simple execution engine.
            return await this.orchestrator.execute(final_prompt);
        } finally {
            this.controller.hideIndicator(indicatorId);
        }
    }
}