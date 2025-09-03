// frontend/src/llm/AnthropicClient.js
import { BaseLlm } from './BaseLlm.js';

// NOTE: This is a placeholder implementation.
// The actual Anthropic API might have slightly different request/response formats.
export class AnthropicClient extends BaseLlm {
  constructor() {
    super();
    // Anthropic's API endpoint is different.
    this.API_URL = "https://api.anthropic.com/v1/messages"; 
  }

  async execute(prompt, apiKey, modelName) {
    if (!apiKey) {
      throw new Error('API Key is missing for AnthropicClient.');
    }

    try {
      const response = await fetch(this.API_URL, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          model: modelName,
          max_tokens: 4096, // Anthropic requires max_tokens
          messages: [{ role: 'user', content: prompt }]
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Anthropic API request failed');
      }

      const data = await response.json();
      return data.content[0].text;

    } catch (error) {
      console.error("Failed to execute Anthropic call:", error);
      return `Error: ${error.message}`;
    }
  }
}