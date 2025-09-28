import { BaseExecutor } from './BaseExecutor.js';

export class SimplePromptExecutor extends BaseExecutor {
    async run(manifest, payload) {
        const systemPrompt = this._preparePrompt(manifest.prompt.system, payload);
        const userPrompt = this._preparePrompt(manifest.prompt.user, payload);
        const final_prompt = `${systemPrompt}\n\n${userPrompt}`;

        const indicatorId = this.controller.showIndicator(`Running ${manifest.name}...`);
        try {
            return await this.llmOrchestrator.execute(final_prompt, false);
        } finally {
            this.controller.hideIndicator(indicatorId);
        }
    }
}