import { GeminiClient } from '../llm/GeminiClient.js';
import { AnthropicClient } from '../llm/AnthropicClient.js';
import { SettingsPalette } from '../components/SettingsPalette.js';

export class LlmOrchestrator {
    constructor(controller) {
        this.controller = controller;
        this.clients = {
            google: new GeminiClient(),
            anthropic: new AnthropicClient(),
        };
    }

    async execute(prompt, isJson = false) {
        // REVISED: Fetches settings from the isolated AI settings source.
        const settings = SettingsPalette.getSettings();
        const client = this.clients[settings.provider];

        if (!client) {
            const message = `LLM provider "${settings.provider}" is not supported.`;
            this.controller.showIndicator(message, { isError: true, duration: 4000 });
            return null;
        }

        if (!settings.apiKey) {
            this.controller.showIndicator('API Key not set. Configure in AI settings', { isError: true, duration: 4000 });
            return null;
        }

        try {
            return await client.execute(prompt, settings.apiKey, settings.modelName, isJson);
        } catch (error) {
            console.error("LLM Orchestrator failed:", error);
            this.controller.showIndicator(`AI Error: ${error.message}`, { isError: true, duration: 5000 });
            return null;
        }
    }
}