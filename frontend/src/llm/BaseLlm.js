// frontend/src/llm/BaseLlm.js
export class BaseLlm {
  async execute(prompt, apiKey, modelName) {
    throw new Error("LLM clients must implement an 'execute' method.");
  }
}