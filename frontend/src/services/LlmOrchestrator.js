import { GeminiClient } from '../llm/GeminiClient.js';
import { AnthropicClient } from '../llm/AnthropicClient.js';
import { LocalLlmClient } from '../llm/LocalLlmClient.js';

export class LlmOrchestrator {
    constructor(controller) {
        this.controller = controller;
        this.clients = {
            gemini: new GeminiClient(),
            anthropic: new AnthropicClient(),
            local: new LocalLlmClient(),
        };
        this.config = {};
    }

    updateConfig() {
        const userConfig = this.controller.configService.get('user', {});
        const endpoints = this.controller.configService.get('llm_endpoints', {});
        const provider = userConfig.llm_provider;
        const isLocal = provider === 'local';

        // --- REVISED: Fetch API keys from localStorage ---
        let apiKey = null;
        if (provider === 'gemini') {
            apiKey = localStorage.getItem('gemini_api_key');
        } else if (provider === 'anthropic') {
            apiKey = localStorage.getItem('anthropic_api_key');
        }

        this.config = {
            provider: provider,
            apiKey: apiKey, // <-- This now holds the real key, or null if not set
            modelName: isLocal ? userConfig.local_llm_model_name : userConfig.model_name,
            apiUrl: endpoints[provider],
            llmUrl: userConfig.local_llm_url,
        };
        console.log("LLM Orchestrator config updated (API keys are kept secret).");
    }

    async execute(prompt, isJson = false) {
        const settings = this.config; // Use the internally synced config
        const client = this.clients[settings.provider];

        if (!client) {
            const message = `LLM provider "${settings.provider}" is not supported.`;
            this.controller.showIndicator(message, { isError: true, duration: 4000 });
            return null;
        }

        // For local LLM, we don't need an API key
        if (settings.provider !== 'local' && !settings.apiKey) {
            this.controller.showIndicator('API Key not set. Configure in AI settings', { isError: true, duration: 4000 });
            return null;
        }

        try {
            return await client.execute(prompt, settings, isJson);
        } catch (error) {
            console.error("LLM Orchestrator failed:", error);
            this.controller.showIndicator(`AI Error: ${error.message}`, { isError: true, duration: 5000 });
            return null;
        }
    }
}