
import { SimplePromptExecutor } from '../executors/SimplePromptExecutor.js';
import { JsonResponseExecutor } from '../executors/JsonResponseExecutor.js';

export class AgentService {
    constructor(configService, llmOrchestrator, controller) {
        this.configService = configService;
        this.executors = {
            simplePrompt: new SimplePromptExecutor(llmOrchestrator, controller),
            jsonResponse: new JsonResponseExecutor(llmOrchestrator, controller)
        };
    }

    getAgents() {
        const agents = this.configService.get('agents', []);
        return agents.filter(agent => agent.enabled);
    }

    getAgentById(agentId) {
        const agents = this.configService.get('agents', []);
        return agents.find(agent => agent.id === agentId);
    }

    async executeAgent(agentId, payload) {
        const manifest = this.getAgentById(agentId);
        if (!manifest) {
            console.error(`Agent with ID "${agentId}" not found.`);
            return null;
        }

        const executor = this.executors[manifest.executor];
        if (!executor) {
            console.error(`Executor "${manifest.executor}" for agent "${agentId}" not found.`);
            return null;
        }
        if (manifest.prompt.user.includes('{all_notes}')) {
            const noteFiles = await this.controller.storageService.getAllFilesBySuffix('.note');
            payload.all_notes = noteFiles.map(file => file.content);
        }

        const ai_response = await executor.run(manifest, payload);

        if (ai_response) {
            const handler = manifest.output?.handler || 'assistantPane';
            switch (handler) {
                case 'replaceSelection':
                    this.controller.renderRewriteSuggestion({
                        original_text: payload.context.selected_text,
                        suggested_text: ai_response,
                        range: payload.context.range
                    });
                    this.controller.openRightDrawer('assistant');
                    break;
                case 'newNote':
                    this.controller.createNewNoteFromAgent(ai_response, manifest.name);
                    break;
                case 'filterNotes':
                    if (ai_response && Array.isArray(ai_response.relevant_note_ids)) {
                        this.controller.filterNotesById(ai_response.relevant_note_ids);
                        this.controller.openRightDrawer('notebook');
                    }
                    break;
                case 'assistantPane':
                default:
                    const blockData = {
                        type: 'development',
                        title: manifest.name,
                        id: `dev_${Date.now()}`,
                        content: { type: 'markdown', text: ai_response },
                        is_open_by_default: true,
                    };
                    this.controller.addMarginBlock(payload.current_view_id, blockData);
                    this.controller.openRightDrawer('assistant');
                    break;
            }
        }
    }
}