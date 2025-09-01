  // In frontend/src/services/SyncService.js
/**
 * Manages the import and export of the entire user database
 * to and from the local file system.
 */
export class SyncService {
  constructor(storageService, appController, googleSyncService) { 
    this.storageService = storageService;
    this.appController = appController;
    this.googleSyncService = googleSyncService; 
  }

  /**
   * Exports all data from IndexedDB to a single JSON file.
   */
  async exportToLocalFile() {
    const indicatorId = this.appController.showIndicator('Exporting data...');
    try {
      const allFiles = await this.storageService.getAllFiles();
      const filesToExport = allFiles.filter(file => 
        file.id !== 'user-manual.book' && 
        file.id !== 'initial_setup_complete'
      );
      const jsonData = JSON.stringify(filesToExport, null, 2);
      const blob = new Blob([jsonData], { type: 'application/json' });

      // Use the File System Access API to save the file
      if (window.showSaveFilePicker) {
        const handle = await window.showSaveFilePicker({
          suggestedName: `intelligent-editor-backup-${new Date().toISOString().split('T')[0]}.json`,
          types: [{
            description: 'JSON Files',
            accept: { 'application/json': ['.json'] },
          }],
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        this.appController.showIndicator('Export complete!', { duration: 3000 });
      } else {
        // Fallback for older browsers
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `intelligent-editor-backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        this.appController.showIndicator('Export complete!', { duration: 3000 });
      }
    } catch (err) {
      // Handle user cancellation of the save dialog gracefully
      if (err.name === 'AbortError') {
        console.log('User cancelled the save operation.');
      } else {
        console.error('Export failed:', err);
        this.appController.showIndicator('Export failed!', { isError: true, duration: 4000 });
      }
    } finally {
        this.appController.hideIndicator(indicatorId);
    }
  }

  /**
   * Imports data from a local JSON file, overwriting the current IndexedDB data.
   */
  async importFromLocalFile() {
    try {
      let fileContent;
      
      // Modern API path (Chrome, Edge)
      if (window.showOpenFilePicker) {
        console.log("Using File System Access API.");
        const [handle] = await window.showOpenFilePicker({
          types: [{
            description: 'JSON Files',
            accept: { 'application/json': ['.json'] },
          }],
        });
        const file = await handle.getFile();
        fileContent = await file.text();
      } else {
        // Fallback path (Firefox, Safari)
        console.log("Using file input fallback.");
        const fileInput = document.getElementById('import-file-input');
        if (!fileInput) throw new Error("File input element not found.");

        fileContent = await new Promise((resolve, reject) => {
          fileInput.onchange = (event) => {
            const file = event.target.files[0];
            if (!file) {
              reject(new Error("No file selected."));
              return;
            }
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(new Error("Error reading file."));
            reader.readAsText(file);
          };
          // Reset value to ensure 'onchange' fires even if the same file is selected again
          fileInput.value = ''; 
          fileInput.click();
        });
      }

      const importedData = JSON.parse(fileContent);

      if (!Array.isArray(importedData)) { // Simplified validation
          throw new Error('Invalid backup file format.');
      }

      const isConfirmed = await this.appController.confirm(
          'Confirm Import',
          'This will add new documents and notes from the file, and overwrite settings. Existing documents with the same name will be skipped. Continue?'
      );

      if (!isConfirmed) return;
      
      const indicatorId = this.appController.showIndicator('Merging data...');

      // --- NEW MERGE LOGIC ---

      // 1. Fetch existing data
      const existingBooks = await this.storageService.getAllFilesBySuffix('.book');
      const existingNotesFile = await this.storageService.getFile('notes.json');
      const existingNotes = existingNotesFile || [];
      
      const existingBookIds = new Set(existingBooks.map(b => b.id));
      const mergedNotesMap = new Map(existingNotes.map(n => [n.id, n]));

      // 2. Process the imported data
      for (const item of importedData) {
        if (item.id.endsWith('.book')) {
          // If book doesn't already exist, add it
          if (!existingBookIds.has(item.id)) {
            await this.storageService.saveFile(item.id, item.content);
          }
        } else if (item.id === 'notes.json') {
          // Merge notes, removing duplicates (imported notes take precedence)
          const importedNotes = item.content || [];
          for (const note of importedNotes) {
            mergedNotesMap.set(note.id, note);
          }
        } else {
          // For all other files (prompts, pinned.txt), simply overwrite
          await this.storageService.saveFile(item.id, item.content);
        }
      }

      // 3. Save the final merged notes list
      await this.storageService.saveFile('notes.json', Array.from(mergedNotesMap.values()));
      
      // --- END OF MERGE LOGIC ---

      this.appController.hideIndicator(indicatorId);
      this.appController.showIndicator('Merge complete! Reloading app...', { duration: 3000 });

      setTimeout(() => window.location.reload(), 1500);

    } catch (err) {
      if (err.name === 'AbortError' || err.message === 'No file selected.') {
        console.log('User cancelled the open operation.');
      } else {
        console.error('Import failed:', err);
        this.appController.showIndicator(`Import failed: ${err.message}`, { isError: true, duration: 4000 });
      }
    }
  }

  // --- NEW METHODS FOR GOOGLE DRIVE ---

  async uploadToGoogleDrive() {
    const indicatorId = this.appController.showIndicator('Preparing to upload...');
    try {
        await this.googleSyncService.authorize();
        let pInd = this.appController.showIndicator('Packaging data...');

        const allFiles = await this.storageService.getAllFiles();
        const filesToExport = allFiles.filter(file => file.id !== 'initial_setup_complete');
        const content = JSON.stringify(filesToExport);

        let uInd = this.appController.showIndicator('Uploading to Google Drive...');
        await this.googleSyncService.uploadBackup(content);
        this.appController.hideIndicator(pInd);
        this.appController.hideIndicator(uInd);
        this.appController.showIndicator('Upload complete!', { duration: 3000 });

    } catch (error) {
        console.error("Google Drive upload failed:", error);
        this.appController.showIndicator('Upload failed. See console for details.', { isError: true, duration: 4000 });
    } finally {
        this.appController.hideIndicator(indicatorId);
    }
  }

  async downloadFromGoogleDrive() {
    const indicatorId = this.appController.showIndicator('Connecting to Google Drive...');
    try {
        await this.googleSyncService.authorize();

        const content = await this.googleSyncService.downloadBackup();
        if (!content) {
            throw new Error("No backup file found in Google Drive.");
        }
        
        // Use the exact same merge logic as the local import
        const importedData = JSON.parse(content);
        
        const isConfirmed = await this.appController.confirm(
          'Confirm Download',
          'This will merge the data from your Google Drive with your local data. Continue?'
        );

        if (!isConfirmed) return;

        // ... (Paste the same merge logic from importFromLocalFile here)
        let Mind = this.appController.showIndicator('Merging data...');
        const existingBooks = await this.storageService.getAllFilesBySuffix('.book');
        const existingNotesFile = await this.storageService.getFile('notes.json');
        const existingNotes = existingNotesFile || [];
        const existingBookIds = new Set(existingBooks.map(b => b.id));
        const mergedNotesMap = new Map(existingNotes.map(n => [n.id, n]));
        for (const item of importedData) {
            if (item.id.endsWith('.book')) { if (!existingBookIds.has(item.id)) { await this.storageService.saveFile(item.id, item.content); } }
            else if (item.id === 'notes.json') { const importedNotes = item.content || []; for (const note of importedNotes) { mergedNotesMap.set(note.id, note); } }
            else { await this.storageService.saveFile(item.id, item.content); }
        }
        await this.storageService.saveFile('notes.json', Array.from(mergedNotesMap.values()));
        this.appController.hideIndicator(Mind);
        this.appController.showIndicator('Download & merge complete! Reloading...', { duration: 3000 });
        setTimeout(() => window.location.reload(), 1500);

    } catch(error) {
        console.error("Google Drive download failed:", error);
        this.appController.showIndicator(`Download failed: ${error.message}`, { isError: true, duration: 4000 });
    } finally {
        this.appController.hideIndicator(indicatorId);
    }
  }

  /**
   * Helper method to clear all data from the 'files' object store.
   */
  async clearDatabase() {
    return new Promise((resolve, reject) => {
        const transaction = this.storageService.db.transaction(['files'], 'readwrite');
        const store = transaction.objectStore('files');
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
  }

}