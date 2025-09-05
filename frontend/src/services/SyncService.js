import { debounce } from '../utils/debounce.js';

/**
 * Manages data synchronization with local files and cloud providers.
 */
export class SyncService {
  constructor(storageService, controller, googleSyncService) {
    this.storageService = storageService;
    this.controller = controller;
    this.googleSyncService = googleSyncService;

    this.debouncedSyncers = new Map();
    this.SYNC_DEBOUNCE_DELAY = 20000; // 5 seconds

    this.controller.subscribe('database:changed', (payload) => this.scheduleSync(payload));
  }

  // --- Background Sync Logic ---

  /**
   * Schedules a file to be synced to the cloud after a debounce delay.
   * @param {object} payload - The event payload from StorageService { fileId, action }.
   */
  scheduleSync({ fileId, action }) {
    // We don't want to auto-sync the user manual or pinned book setting.
    if (fileId === 'user-manual.book' || fileId === 'pinned.txt') return;

    console.log(`Scheduling sync for "${fileId}", action: ${action}`);

    if (!this.debouncedSyncers.has(fileId)) {
      this.debouncedSyncers.set(fileId, debounce(async (latestAction) => {
        // The debounced function receives the *last* action for this fileId
        await this._syncFile(fileId, latestAction);
        this.debouncedSyncers.delete(fileId); // Clean up the map after execution
      }, this.SYNC_DEBOUNCE_DELAY));
    }
    // Call the debounced function, passing the most recent action
    this.debouncedSyncers.get(fileId)(action);
  }

  /**
 * Performs the actual file sync operation with Google Drive.
 * @param {string} fileId - The name of the file to sync.
 * @param {string} action - 'saved' or 'deleted'.
 * @private
 */
  async _syncFile(fileId, action) {
    const isSignedIn = await this.googleSyncService.checkSignInStatus();
    if (!isSignedIn) {
      console.log('Sync skipped: User not signed in.');
      return;
    }

    this.controller.setSyncState('syncing');
    try {
      if (action === 'saved') {
        const content = await this.storageService.getFile(fileId);
        // If content is null, the file was likely deleted before the sync triggered.
        // We can treat this as a deletion.
        if (content === null) {
          await this.googleSyncService.deleteFile(fileId);
        } else {
          await this.googleSyncService.uploadFile(fileId, content);
        }
      } else if (action === 'deleted') {
        await this.googleSyncService.deleteFile(fileId);
      }
      console.log(`Successfully synced "${fileId}" (${action}) to Google Drive.`);
    } catch (error) {
      console.error(`Failed to sync "${fileId}":`, error);
      this.controller.showIndicator(`Sync failed for ${fileId}`, { isError: true, duration: 4000 });
    } finally {
      this.controller.setSyncState('signed-in'); // Revert to normal signed-in state
    }
  }

  // --- LOCAL IMPORT/EXPORT (Unchanged) ---
  async exportToLocalFile() {
    const indicatorId = this.controller.showIndicator('Exporting data...');
    try {
      const allFiles = await this.storageService.getAllFiles();
      const filesToExport = allFiles.filter(file =>
        file.id !== 'user-manual.book' &&
        file.id !== 'initial_setup_complete'
      );
      const jsonData = JSON.stringify(filesToExport, null, 2);
      const blob = new Blob([jsonData], { type: 'application/json' });

      if (window.showSaveFilePicker) {
        const handle = await window.showSaveFilePicker({
          suggestedName: `editor-app-backup-${new Date().toISOString().split('T')[0]}.json`,
          types: [{ description: 'JSON Files', accept: { 'application/json': ['.json'] } }],
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `editor-app-backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
      this.controller.showIndicator('Export complete!', { duration: 3000 });
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Export failed:', err);
        this.controller.showIndicator('Export failed!', { isError: true, duration: 4000 });
      }
    } finally {
      this.controller.hideIndicator(indicatorId);
    }
  }

  async importFromLocalFile() {
    try {
      let fileContent;
      if (window.showOpenFilePicker) {
        const [handle] = await window.showOpenFilePicker({
          types: [{ description: 'JSON Files', accept: { 'application/json': ['.json'] } }],
        });
        const file = await handle.getFile();
        fileContent = await file.text();
      } else {
        const fileInput = document.getElementById('import-file-input');
        if (!fileInput) throw new Error("File input element not found.");
        fileContent = await new Promise((resolve, reject) => {
          fileInput.onchange = (event) => {
            const file = event.target.files[0];
            if (!file) return reject(new Error("No file selected."));
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = () => reject(new Error("Error reading file."));
            reader.readAsText(file);
          };
          fileInput.value = '';
          fileInput.click();
        });
      }

      const importedData = JSON.parse(fileContent);
      if (!Array.isArray(importedData)) throw new Error('Invalid backup file format.');

      const isConfirmed = await this.controller.confirm(
        'Confirm Import',
        'This will add new documents and notes from the file, and overwrite settings. Existing documents with the same name will be skipped. Continue?'
      );
      if (!isConfirmed) return;

      const indicatorId = this.controller.showIndicator('Merging data...');
      await this.mergeData(importedData);
      this.controller.hideIndicator(indicatorId);
      this.controller.showIndicator('Merge complete! Reloading app...', { duration: 3000 });
      setTimeout(() => window.location.reload(), 1500);

    } catch (err) {
      if (err.name !== 'AbortError' && err.message !== 'No file selected.') {
        console.error('Import failed:', err);
        this.controller.showIndicator(`Import failed: ${err.message}`, { isError: true, duration: 4000 });
      }
    }
  }

  /**
   * Universal merge logic for both local and cloud imports.
   * @param {Array<{id: string, content: any}>} importedData The data to merge into the local DB.
   */
  async mergeData(importedData) {
    const existingBooks = await this.storageService.getAllFilesBySuffix('.book');
    const existingNotesFile = await this.storageService.getFile('notes.json');
    const existingNotes = existingNotesFile || [];
    const existingBookIds = new Set(existingBooks.map(b => b.id));
    const mergedNotesMap = new Map(existingNotes.map(n => [n.id, n]));

    for (const item of importedData) {
      if (item.id.endsWith('.book')) {
        if (!existingBookIds.has(item.id)) {
          await this.storageService.saveFile(item.id, item.content);
        }
      } else if (item.id === 'notes.json' && Array.isArray(item.content)) {
        for (const note of item.content) {
          mergedNotesMap.set(note.id, note);
        }
      } else {
        await this.storageService.saveFile(item.id, item.content);
      }
    }
    await this.storageService.saveFile('notes.json', Array.from(mergedNotesMap.values()));
  }

  // --- DATA MANAGEMENT ---

  /**
   * Deletes a single, specific file from the cloud.
   * Renamed for clarity.
   * @param {string} fileId The Google Drive ID of the file to delete.
   * @returns {Promise<boolean>} True on success, false on failure.
   */
  async deleteCloudFileById(fileId) {
    const indicatorId = this.controller.showIndicator('Deleting cloud file...');
    try {
      await this.googleSyncService.authorize();
      await this.googleSyncService.deleteFileById(fileId);
      this.controller.showIndicator('File deleted from cloud.', { duration: 3000 });
      return true;
    } catch (error) {
      console.error("Failed to delete single cloud file:", error);
      this.controller.showIndicator('Cloud deletion failed. See console.', { isError: true, duration: 4000 });
      return false;
    } finally {
      this.controller.hideIndicator(indicatorId);
    }
  }
  
  async getCloudFileList() {
    try {
      await this.googleSyncService.authorize();
      // Use the new granular listFiles method
      return await this.googleSyncService.listFiles();
    } catch (error) {
      console.error("Failed to get cloud file list:", error);
      this.controller.showIndicator('Failed to connect to Drive.', { isError: true, duration: 6000});
      return null;
    }
  }

  async deleteAllCloudFiles() {
    const indicatorId = this.controller.showIndicator('Deleting cloud data...');
    try {
      await this.googleSyncService.authorize();
      // Use the new folder-aware deletion method
      await this.googleSyncService.deleteAllFilesAndFolder();
      this.controller.showIndicator('All cloud data deleted successfully.', { duration: 4000 });
    } catch (error) {
      console.error("Failed to delete all cloud files:", error);
      this.controller.showIndicator('Deletion failed. See console.', { isError: true });
    } finally {
      this.controller.hideIndicator(indicatorId);
    }
  }
}