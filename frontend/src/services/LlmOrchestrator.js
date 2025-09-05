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
        const settings = SettingsPalette.getSettings();
        const client = this.clients[settings.provider];

        if (!client) {
            const message = `LLM provider "${settings.provider}" is not supported.`;
            console.error(message);
            alert(`Error: ${message}`);
            return null;
        }

        if (!settings.apiKey) {
            alert('API Key is not set. Please set it in the Settings panel.');
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