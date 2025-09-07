import { SettingsPalette } from '../components/SettingsPalette.js';

export class TagSyncService {
    constructor(controller, storageService) {
        this.controller = controller;
        this.storageService = storageService;
        this.isSyncing = false;
    }

    async run() {
        if (this.isSyncing) {
            console.log("Auto-tagging already in progress.");
            return;
        }

        const settings = SettingsPalette.getSettings();
        if (!settings.autoTag) {
            console.log("Auto-tagging is disabled in settings.");
            return;
        }
        this.isSyncing = true;
        console.log("Starting auto-tagging process...");

        try {
            // --- CHANGE 1: Fetch all individual .note files instead of notes.json ---
            const noteFiles = await this.storageService.getAllFilesBySuffix('.note') || [];
            const allNotes = noteFiles.map(file => file.content); // Extract the note object from the file content
            const untaggedNotes = allNotes.filter(note => !note.tags || note.tags.length === 0);

            if (untaggedNotes.length === 0) {
                console.log("No untagged notes to process.");
                return;
            }

            console.log(`Found ${untaggedNotes.length} untagged notes. Processing...`);
            const untaggedNotesPayload = untaggedNotes.map(n => ({ id: n.id, content: n.plain_text }));
            const autoTagPrompt = await this.storageService.getFile('AUTOTAG.txt');

            const payload = {
                notes: untaggedNotesPayload,
                prompt_template: autoTagPrompt
            };

            const results = await this.controller.runTagger(payload);

            if (results && results.length > 0) {
                const tagsMap = new Map(results.map(item => [item.id, item.tags]));
                const savePromises = [];

                // --- CHANGE 2: Iterate and save notes back to their individual files ---
                allNotes.forEach(note => {
                    if (tagsMap.has(note.id)) {
                        note.tags = tagsMap.get(note.id);
                        // Instead of just marking an update, we now save the individual file.
                        // We collect these save operations into an array of promises.
                        savePromises.push(this.storageService.saveFile(`${note.id}.note`, note));
                    }
                });

                if (savePromises.length > 0) {
                    await Promise.all(savePromises); // Execute all save operations concurrently
                    this.controller.publish('tags:updated', {}); // Notify the UI (NotebookPane) to refresh
                    console.log(`Successfully applied new tags to ${savePromises.length} notes.`);
                }
            }
        } catch (error) {
            console.error("Error during auto-tagging sync:", error);
        } finally {
            this.isSyncing = false;
        }
    }
}