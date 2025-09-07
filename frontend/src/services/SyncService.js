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
    this.SYNC_DEBOUNCE_DELAY = 5000; 
    this.controller.subscribe('database:changed', (payload) => this.scheduleSync(payload));
  }

  scheduleSync({ fileId, action }) {
    if (fileId === 'user-manual.book' || fileId === 'pinned.txt') return;

    console.log(`Scheduling sync for "${fileId}", action: ${action}`);

    if (!this.debouncedSyncers.has(fileId)) {
      this.debouncedSyncers.set(fileId, debounce(async (latestAction) => {
        await this._syncFile(fileId, latestAction);
        this.debouncedSyncers.delete(fileId);
      }, this.SYNC_DEBOUNCE_DELAY));
    }
    this.debouncedSyncers.get(fileId)(action);
  }

  async _syncFile(fileId, action) {
    const isSignedIn = await this.googleSyncService.checkSignInStatus();
    if (!isSignedIn) {
      console.log('Sync skipped: User not signed in.');
      return;
    }

    this.controller.setSyncState('syncing');
    const modifiedKey = `cloud_modified_${fileId}`;
    try {
      if (action === 'deleted') {
        await this.googleSyncService.deleteFileByName(fileId);
        localStorage.removeItem(modifiedKey);
        console.log(`Successfully synced deletion for "${fileId}" to Google Drive.`);
        return;
      }
      
      const localContent = await this.storageService.getFile(fileId);
      if (localContent === null) {
        await this.googleSyncService.deleteFileByName(fileId);
        localStorage.removeItem(modifiedKey);
        return;
      }

      const cloudMeta = await this.googleSyncService.getFileMetadata(fileId);
      const localMeta = (await this.storageService.getAllFiles()).find(f => f.id === fileId);
      const localModified = localMeta ? localMeta.lastModified : 0;
      const cloudModified = cloudMeta ? new Date(cloudMeta.modifiedTime).getTime() : 0;
      
      if (cloudMeta && cloudModified > localModified) {
        console.warn(`CONFLICT DETECTED for "${fileId}"! Cloud version is newer.`);
        const extension = fileId.substring(fileId.lastIndexOf('.'));
        const baseName = fileId.substring(0, fileId.lastIndexOf('.'));
        const dateStamp = new Date().toISOString().split('T')[0];
        const conflictFilename = `${baseName} (conflict ${dateStamp})${extension}`;
        
        await this.googleSyncService.uploadFile(conflictFilename, localContent);
        this.controller.showIndicator(
            `Conflict: Your local changes for ${baseName} were saved to a new file.`, 
            { isError: true, duration: 10000 }
        );
        
        const { content: cloudContent, modifiedTime: cloudTime } = await this.googleSyncService.downloadFileContent(cloudMeta.id);
        let parsedCloudContent = cloudContent;
        if (fileId.endsWith('.json') || fileId.endsWith('.book') || fileId.endsWith('.note')) {
            try { parsedCloudContent = JSON.parse(cloudContent); }
            catch (e) { console.error(`Failed to parse conflicting cloud file ${fileId}`, e); return; }
        }
        await this.storageService.saveFile(fileId, parsedCloudContent);
        localStorage.setItem(modifiedKey, cloudTime);

      } else {
        // --- NO CONFLICT: Safe to upload ---
        console.log(`Syncing saved file "${fileId}" to Google Drive.`);
        const newModifiedTime = await this.googleSyncService.uploadFile(fileId, localContent);
        localStorage.setItem(modifiedKey, newModifiedTime);
      }
      
    } catch (error) {
      console.error(`Failed to sync "${fileId}":`, error);
      this.controller.showIndicator(`Sync failed for ${fileId}`, { isError: true, duration: 4000 });
    } finally {
      this.controller.setSyncState('signed-in');
    }
  }

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

  async mergeData(importedData) {
    const existingBooks = await this.storageService.getAllFilesBySuffix('.book');
    const existingBookIds = new Set(existingBooks.map(b => b.id));

    for (const item of importedData) {
      if (item.id.endsWith('.book')) {
        if (!existingBookIds.has(item.id)) {
          await this.storageService.saveFile(item.id, item.content);
        }
      } else if (item.id.endsWith('.note')) {
        await this.storageService.saveFile(item.id, item.content);
      } else if (item.id === 'notes.json') {
        if (Array.isArray(item.content)) {
            for (const note of item.content) {
                await this.storageService.saveFile(`${note.id}.note`, note);
            }
        }
      } else {
        await this.storageService.saveFile(item.id, item.content);
      }
    }
  }
  
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
      await this.googleSyncService.deleteAllFilesAndFolder();
      this.controller.showIndicator('All cloud data deleted successfully.', { duration: 4000 });
    } catch (error) {
      console.error("Failed to delete all cloud files:", error);
      this.controller.showIndicator('Deletion failed. See console.', { isError: true });
    } finally {
      this.controller.hideIndicator(indicatorId);
    }
  }

  // --- REVISED: Now stores modifiedTime on download ---
  async performInitialSync() {
    const isSignedIn = await this.googleSyncService.checkSignInStatus();
    if (!isSignedIn) return;

    this.controller.setSyncState('syncing');
    const indicatorId = this.controller.showIndicator('Syncing with Google Drive...');

    try {
      const cloudFiles = await this.googleSyncService.listFiles();
      const localFiles = await this.storageService.getAllFiles();

      const cloudFilesMap = new Map(cloudFiles.map(f => [f.name, f]));
      const localFilesMap = new Map(localFiles.map(f => [f.id, f]));

      for (const [name, cloudFile] of cloudFilesMap.entries()) {
        const localFile = localFilesMap.get(name);
        const cloudModified = new Date(cloudFile.modifiedTime).getTime();

        if (!localFile || cloudModified > localFile.lastModified) {
          console.log(`Sync: Downloading ${localFile ? 'updated' : 'new'} file "${name}"`);
          const { content, modifiedTime } = await this.googleSyncService.downloadFileContent(cloudFile.id);
          let parsedContent = content;
          if (name.endsWith('.json') || name.endsWith('.book') || name.endsWith('.note')) {
              try { parsedContent = JSON.parse(content); }
              catch (e) { console.error(`Failed to parse JSON for ${name}`, e); continue; }
          }
          await this.storageService.saveFile(name, parsedContent);
          localStorage.setItem(`cloud_modified_${name}`, modifiedTime);
        }
      }

      for (const [id, localFile] of localFilesMap.entries()) {
        if (id === 'user-manual.book' || id === 'initial_setup_complete' || id === 'pinned.txt') continue;
        
        if (!cloudFilesMap.has(id)) {
          console.log(`Sync: Uploading new local file "${id}"`);
          const newModifiedTime = await this.googleSyncService.uploadFile(id, localFile.content);
          localStorage.setItem(`cloud_modified_${id}`, newModifiedTime);
        }
      }

    } catch (error) {
      console.error('Initial sync failed:', error);
      this.controller.showIndicator('Sync failed. Please try again.', { isError: true, duration: 4000 });
    } finally {
      this.controller.hideIndicator(indicatorId);
      this.controller.setSyncState('signed-in');
    }
  }
}
