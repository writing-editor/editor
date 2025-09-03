import { BaseLlm } from './BaseLlm.js';

export class GeminiClient extends BaseLlm {
  constructor() {
    super();
    this.BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models/";
  }

  async execute(prompt, apiKey, modelName, isJson = false) {
    if (!apiKey) {
      throw new Error('API Key is missing for GeminiClient.');
    }

    const url = `${this.BASE_URL}${modelName}:generateContent?key=${apiKey}`;
    const body = {
      contents: [{ parts: [{ text: prompt }] }],
    };

    // For Gemini, we can suggest JSON output via the prompt itself,
    // as the API doesn't have a structured output toggle like some others.

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
      // Return a user-friendly error message
      return `Error: ${error.message}`;
    }
  }
}