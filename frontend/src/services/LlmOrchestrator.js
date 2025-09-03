import { GeminiClient } from '../llm/GeminiClient.js';
import { AnthropicClient } from '../llm/AnthropicClient.js';
import { SettingsPalette } from '../components/SettingsPalette.js';
export class LlmOrchestrator {
    constructor() {
        // Initialize instances of all available LLM clients
        this.clients = {
            google: new GeminiClient(),
            anthropic: new AnthropicClient(), 
        };
    }

    /**
     * The main execution method. It reads settings, selects the correct
     * provider, and executes the prompt.
     * @param {string} prompt - The full prompt to send to the LLM.
     * @param {boolean} [isJson=false] - A hint that we expect a JSON response.
     * @returns {Promise<string|null>} The text response from the LLM or null on error.
     */
    async execute(prompt, isJson = false) {
        const settings = SettingsPalette.getSettings();

        // 1. Select the correct client based on the provider setting.
        const client = this.clients[settings.provider];

        if (!client) {
            console.error(`LLM provider "${settings.provider}" is not supported.`);
            alert(`Error: LLM provider "${settings.provider}" is not supported.`);
            return null;
        }
        
        if (!settings.apiKey) {
            alert('API Key is not set. Please set it in the Settings panel.');
            return null;
        }

        // 2. Execute the call using the selected client.
        try {
            // We pass all necessary info to the client's execute method.
            const response = await client.execute(prompt, settings.apiKey, settings.modelName, isJson);
            return response;
        } catch (error) {
            console.error("LLM Orchestrator failed:", error);
            this.app.showIndicator(`AI Error: ${error.message}`, { isError: true, duration: 5000 });
            return null;
        }
    }
}