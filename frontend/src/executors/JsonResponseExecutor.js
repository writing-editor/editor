import { BaseExecutor } from './BaseExecutor.js';

export class JsonResponseExecutor extends BaseExecutor {
    async run(manifest, payload) {
        const systemPrompt = this._preparePrompt(manifest.prompt.system, payload);
        const userPrompt = this._preparePrompt(manifest.prompt.user, payload);
        const final_prompt = `${systemPrompt}\n\n${userPrompt}`;

        const indicatorId = this.controller.showIndicator(`Running ${manifest.name}...`);
        try {
            const responseText = await this.llmOrchestrator.execute(final_prompt, true);
            return JSON.parse(responseText);
        } catch (error) {
            console.error("Failed to parse LLM JSON response:", error);
            this.controller.showIndicator("AI response was not valid.", { isError: true, duration: 4000 });
            return null;
        } finally {
            this.controller.hideIndicator(indicatorId);
        }
    }
}