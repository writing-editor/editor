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
            const noteFiles = await this.storageService.getAllFilesBySuffix('.note') || [];
            const allNotes = noteFiles.map(file => file.content);
            const untaggedNotes = allNotes.filter(note => !note.tags || note.tags.length === 0);

            if (untaggedNotes.length === 0) {
                console.log("No untagged notes to process.");
                return;
            }

            console.log(`Found ${untaggedNotes.length} untagged notes. Processing...`);
            const untaggedNotesPayload = untaggedNotes.map(n => ({ id: n.id, content: n.plain_text }));

            const payload = {
                notes: untaggedNotesPayload,
            };

            const results = await this.controller.runTagger(payload);

            if (results && results.length > 0) {
                const tagsMap = new Map(results.map(item => [item.id, item.tags]));
                const savePromises = [];

                allNotes.forEach(note => {
                    if (tagsMap.has(note.id)) {
                        note.tags = tagsMap.get(note.id);
                        savePromises.push(this.storageService.saveFile(`${note.id}.note`, note));
                    }
                });

                if (savePromises.length > 0) {
                    await Promise.all(savePromises);
                    this.controller.publish('tags:updated', {});
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