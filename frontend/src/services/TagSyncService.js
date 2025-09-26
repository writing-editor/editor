export class TagSyncService {
    constructor(controller, storageService) {
        this.controller = controller;
        this.storageService = storageService;
        this.isRunning = false;
        this.DEBOUNCE_DELAY = 10000; // 10 seconds
        this.run = this.debounce(this.run.bind(this), this.DEBOUNCE_DELAY);
    }

    async run() {
        if (this.isRunning) {
            console.log("Auto-tagging is already in progress. Skipping.");
            return;
        }

        const agent = this.controller.agentService.getAgentById('core.autotag');
        if (!agent || !agent.enabled) {
            console.log("Auto-tagging agent is disabled. Skipping.");
            return;
        }

        this.isRunning = true;
        console.log("Starting automatic note tagging process...");

        try {
            const noteFiles = await this.storageService.getAllFilesBySuffix('.note');
            const notes = noteFiles.map(file => file.content);
            const untaggedNotes = notes.filter(note => !note.tags || note.tags.length === 0);

            if (untaggedNotes.length === 0) {
                console.log("No untagged notes to process.");
                return;
            }

            const payload = {
                // Pass the notes in the format the executor expects
                all_notes: untaggedNotes.map(n => ({ id: n.id, plain_text: n.plain_text })),
                // Context is not needed for this agent, but we provide an empty object
                context: {}
            };

            // Execute the agent via the central controller method
            const result = await this.controller.runAgent('core.autotag', payload);

            if (result && result.notes_with_tags) {
                let updatedCount = 0;
                for (const noteWithTags of result.notes_with_tags) {
                    const originalNote = notes.find(n => n.id === noteWithTags.id);
                    if (originalNote) {
                        originalNote.tags = noteWithTags.tags;
                        await this.storageService.saveFile(`${originalNote.id}.note`, originalNote);
                        updatedCount++;
                    }
                }
                console.log(`Successfully tagged ${updatedCount} notes.`);
                if (updatedCount > 0) {
                    this.controller.publish('notes:updated');
                }
            } else {
                console.log("Auto-tagging agent returned no valid tags.");
            }
        } catch (error) {
            console.error("An error occurred during the auto-tagging process:", error);
        } finally {
            this.isRunning = false;
        }
    }

    // Simple debounce implementation
    debounce(func, delay) {
        let timeout;
        return function (...args) {
            const context = this;
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(context, args), delay);
        };
    }
}