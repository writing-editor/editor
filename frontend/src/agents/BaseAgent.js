export class BaseAgent {
    constructor(orchestrator, controller) {
        if (!orchestrator || !controller) {
            throw new Error("BaseAgent requires an LlmOrchestrator and a Controller instance.");
        }
        this.orchestrator = orchestrator;
        this.controller = controller;
    }

    async run(payload) {
        throw new Error("Agents must implement a 'run' method.");
    }
}