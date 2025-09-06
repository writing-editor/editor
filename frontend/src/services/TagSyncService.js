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

        try {
            const allNotes = await this.storageService.getFile('notes.json') || [];
            const untaggedNotes = allNotes.filter(note => !note.tags || note.tags.length === 0);

            if (untaggedNotes.length === 0) {
                console.log("No untagged notes to process.");
                return;
            }

            console.log(`Found ${untaggedNotes.length} untagged notes. Processing in batches.`);
            const untaggedNotesPayload = untaggedNotes.map(n => ({ id: n.id, content: n.plain_text }));

            let autoTagPrompt = await this.storageService.getFile('AUTOTAG.txt');

            const payload = {
                notes: untaggedNotesPayload,
                prompt_template: autoTagPrompt
            };

            const results = await this.controller.runTagger(payload);

            if (results && results.length > 0) {
                const tagsMap = new Map(results.map(item => [item.id, item.tags]));
                let updated = false;

                allNotes.forEach(note => {
                    if (tagsMap.has(note.id)) {
                        note.tags = tagsMap.get(note.id);
                        updated = true;
                    }
                });

                if (updated) {
                    await this.storageService.saveFile('notes.json', allNotes);
                    this.controller.publish('tags:updated', {});
                    console.log("Successfully applied new tags.");
                }
            }
        } catch (error) {
            console.error("Error during auto-tagging sync:", error);
        } finally {
            this.isSyncing = false;
        }
    }
}