
export class BaseLlm {
  async execute(prompt, settings, isJson = false) {
    throw new Error("LLM clients must implement an 'execute' method.");
  }
}