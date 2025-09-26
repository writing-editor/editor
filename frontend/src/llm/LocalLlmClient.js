import { BaseLlm } from './BaseLlm.js';

export class LocalLlmClient extends BaseLlm {
  async execute(prompt, settings, isJson = false) {
    const { llmUrl, modelName } = settings;
    if (!llmUrl) {
      throw new Error('Local LLM URL is missing from settings.');
    }
    if (!modelName) {
      throw new Error('Local LLM Model Name is missing from settings.');
    }

    // A more robust way to construct the final URL
    const endpoint = new URL('/v1/chat/completions', llmUrl).href;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: modelName,
          messages: [{ role: 'user', content: prompt }],
          ...(isJson && { response_format: { type: "json_object" } }),
          temperature: 0.7,
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Local LLM API Error:", errorData);
        throw new Error(errorData.error?.message || 'Local LLM API request failed');
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content;

      if (!content) {
        throw new Error("Invalid response structure from local LLM API.");
      }
      return content;

    } catch (error) {
      console.error("Failed to execute Local LLM call:", error);
      if (error instanceof TypeError) { // Network error
        return `Error: Could not connect to the local LLM at ${endpoint}. Please ensure the server is running and the URL is correct.`;
      }
      return `Error: ${error.message}`;
    }
  }
}