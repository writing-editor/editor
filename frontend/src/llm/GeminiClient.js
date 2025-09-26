import { BaseLlm } from './BaseLlm.js';

export class GeminiClient extends BaseLlm {
  constructor() {
    super();
  }

  async execute(prompt, settings, isJson = false) {
    const { apiKey, modelName, apiUrl } = settings;
    if (!apiKey) {
      throw new Error('API Key is missing for GeminiClient.');
    }
    if (!apiUrl) {
      throw new Error('API URL is missing from configuration for GeminiClient.');
    }

    const url = `${apiUrl}${modelName}:generateContent?key=${apiKey}`;

    const body = {
      contents: [{ parts: [{ text: prompt }] }],
      ...(isJson && {
        generationConfig: {
          response_mime_type: "application/json",
        },
      }),
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Gemini API Error:", errorData);
        throw new Error(errorData.error?.message || 'API request failed');
      }

      const data = await response.json();
      if (!data.candidates || !data.candidates[0].content.parts[0].text) {
        throw new Error("Invalid response structure from Gemini API.");
      }
      return data.candidates[0].content.parts[0].text;

    } catch (error) {
      console.error("Failed to execute Gemini call:", error);
      return `Error: ${error.message}`;
    }
  }
}