// frontend/src/agents/BaseAgent.js

export class BaseAgent {
    constructor(orchestrator, app) {
        if (!orchestrator || !app) {
            throw new Error("BaseAgent requires an LlmOrchestrator and App instance.");
        }
        this.orchestrator = orchestrator;
        this.app = app;
    }

    async run(payload) {
        throw new Error("Agents must implement a 'run' method.");
    }
}