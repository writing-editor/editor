import { BaseLlm } from './BaseLlm.js';

export class AnthropicClient extends BaseLlm {
  constructor() {
    super();
  }

  async execute(prompt, settings, isJson = false) {
    const { apiKey, modelName, apiUrl } = settings;
    if (!apiKey) {
      throw new Error('API Key is missing for AnthropicClient.');
    }
    if (!apiUrl) {
      throw new Error('API URL is missing from configuration for AnthropicClient.');
    }

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          model: modelName,
          max_tokens: 4096,
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