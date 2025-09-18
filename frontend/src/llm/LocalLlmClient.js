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

    // Assuming an OpenAI-compatible API endpoint
    const endpoint = llmUrl.endsWith('/v1') ? `${llmUrl}/chat/completions` : llmUrl.endsWith('/') ? `${llmUrl}v1/chat/completions` : `${llmUrl}/v1/chat/completions`;


    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Most local LLMs don't require an API key, but an OpenAI-compatible server might.
          // Add a dummy one if your server is strict.
          // 'Authorization': `Bearer not-needed`
        },
        body: JSON.stringify({
          model: modelName,
          messages: [{ role: 'user', content: prompt }],
          ...(isJson && { response_format: { type: "json_object" } }), // OpenAI compatible JSON mode
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