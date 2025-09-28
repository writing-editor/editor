import { debounce } from '../utils/debounce.js';
import { diff_match_patch } from 'diff-match-patch';

export class SyncService {
  constructor(storageService, controller, googleSyncService) {
    this.storageService = storageService;
    this.controller = controller;
    this.googleSyncService = googleSyncService;
    this.dmp = new diff_match_patch();
    this.syncQueue = new Map();

    this.activeTombstones = new Set();
    this.idToFilenameMap = new Map();
    this.debouncedSyncers = new Map();
    this.SYNC_DEBOUNCE_DELAY = 5000;
    this.controller.subscribe('database:changed', (payload) => this.scheduleSync(payload));
    this.controller.subscribe('tombstone:added', (payload) => this.handleTombstoneAdded(payload));

    this.tombstoneCheckInterval = null;
    this.startTombstoneChecker();
  }

  startTombstoneChecker() {
    if (this.tombstoneCheckInterval) {
      clearInterval(this.tombstoneCheckInterval);
    }
    this.tombstoneCheckInterval = setInterval(async () => {
      if (navigator.onLine && await this.googleSyncService.checkSignInStatus()) {
        await this._processCloudTombstones();
      }
    }, 360000);
  }

  async _processCloudTombstones() {
    console.log("[Sync] Reconciling remote deletions...");
    const tombstoneMeta = await this.googleSyncService.getFileMetadata('tombstones.json');
    if (!tombstoneMeta) {
      return;
    }

    const downloadResult = await this.googleSyncService.downloadFileContent(tombstoneMeta.id);
    let cloudTombstoneMap = {};
    try {
      cloudTombstoneMap = typeof downloadResult.content === 'string' ? JSON.parse(downloadResult.content) : downloadResult.content;
    } catch (e) {
      console.warn("Could not parse cloud tombstones.json during periodic check.");
      return;
    }

    const localTombstones = await this.storageService.getAllTombstones();
    const localTombstoneIds = new Set(localTombstones.map(ts => ts.fileId));

    let refreshNotebook = false;
    const newTombstonesToAcknowledge = [];

    for (const uniqueId in cloudTombstoneMap) {
      if (!localTombstoneIds.has(uniqueId)) {
        const tombstoneInfo = cloudTombstoneMap[uniqueId];
        const filenameToDelete = tombstoneInfo.filename;

        if (filenameToDelete) {
          console.log(`[Sync] New remote deletion detected for "${filenameToDelete}". Deleting locally.`);
          await this.storageService.deleteFile(filenameToDelete);
          newTombstonesToAcknowledge.push({ fileId: uniqueId, filename: filenameToDelete, deletedAt: tombstoneInfo.deletedAt });

          if (filenameToDelete.endsWith('.note')) {
            refreshNotebook = true;
          }
        }
      }
    }

    if (newTombstonesToAcknowledge.length > 0) {
      for (const tombstone of newTombstonesToAcknowledge) {
        await this.storageService.addTombstone(tombstone.fileId, tombstone.filename);
      }
      console.log(`[Sync] Acknowledged and processed ${newTombstonesToAcknowledge.length} new remote deletions.`);
    }

    if (refreshNotebook) {
      this.controller.publish('notebook:needs-refresh', {});
    }
  }

  handleTombstoneAdded(payload) {
    if (payload.filename) {
      console.log(`[Sync] Acknowledged new tombstone for "${payload.filename}".`);
      this.activeTombstones.add(payload.filename);
    }
  }

  scheduleSync({ fileId, action }) {
    if (!navigator.onLine) {
      console.log(`Sync for "${fileId}" ignored: Application is offline.`);
      return;
    }

    if (fileId === 'user-manual.book' || fileId === 'initial_setup_complete') return;

    console.log(`Scheduling sync for "${fileId}", action: ${action}`);

    if (!this.debouncedSyncers.has(fileId)) {
      this.debouncedSyncers.set(fileId, debounce(async (latestAction) => {
        await this.reconcileFile(fileId, latestAction);
        this.debouncedSyncers.delete(fileId);
      }, this.SYNC_DEBOUNCE_DELAY));
    }
    this.debouncedSyncers.get(fileId)(action);
  }

  async reconcileFile(fileId, action = "sync") {
    if (!this.syncQueue.has(fileId)) {
      this.syncQueue.set(fileId, Promise.resolve());
    }

    const task = async () => {
      await this._reconcileFileInternal(fileId, action);
    };

    const newPromise = this.syncQueue.get(fileId).then(task, task);
    this.syncQueue.set(fileId, newPromise);
    return newPromise;
  }

  async _reconcileFileInternal(fileId, action) {
    function stableStringify(obj) {
      if (obj === null || typeof obj !== "object") {
        return JSON.stringify(obj);
      }
      if (Array.isArray(obj)) {
        return `[${obj.map(stableStringify).join(",")}]`;
      }
      const keys = Object.keys(obj).sort();
      return `{${keys.map(k => JSON.stringify(k) + ":" + stableStringify(obj[k])).join(",")}}`;
    }

    function normalize(content) {
      if (typeof content === "string") {
        return content.replace(/\r\n/g, "\n").trim();
      }
      if (content && typeof content === "object") {
        return stableStringify(content);
      }
      return String(content ?? "");
    }

    if (this.activeTombstones.has(fileId)) {
      console.log(`[Sync] Skipping reconcile for "${fileId}" due to active tombstone.`);
      try {
        await this.googleSyncService.deleteFileByName(fileId);
        console.log(`[Sync] Confirmed cloud deletion for "${fileId}".`);
      } catch (e) {
        // This is okay, it might have already been deleted.
      }
      return;
    }

    const isSignedIn = await this.googleSyncService.checkSignInStatus();
    if (!isSignedIn) {
      console.log(`[Sync] Skipped ${fileId}: user not signed in.`);
      return;
    }

    this.controller.setSyncState("syncing");
    const modifiedKey = `cloud_modified_${fileId}`;

    try {
      if (fileId === 'tombstones.json') {
        console.log(`[Sync] Local tombstones have changed. Syncing to cloud.`);
        const localTombstones = await this.storageService.getAllTombstones();
        const localTombstoneMap = localTombstones.reduce((acc, ts) => {
          acc[ts.fileId] = { deletedAt: ts.deletedAt, filename: ts.filename };
          return acc;
        }, {});

        const tombstoneMeta = await this.googleSyncService.getFileMetadata('tombstones.json');
        let cloudTombstones = {};
        if (tombstoneMeta) {
          const downloadResult = await this.googleSyncService.downloadFileContent(tombstoneMeta.id);
          try {
            cloudTombstones = typeof downloadResult.content === 'string' ? JSON.parse(downloadResult.content) : downloadResult.content;
          } catch (e) {
            console.warn("Could not parse cloud tombstones.json, starting fresh.");
            cloudTombstones = {};
          }
        }
        const mergedTombstones = { ...cloudTombstones, ...localTombstoneMap };
        await this.googleSyncService.uploadFile('tombstones.json', mergedTombstones);
        return;
      }

      const localFile = await this.storageService.getFile(fileId);
      const cloudMeta = await this.googleSyncService.getFileMetadata(fileId);

      if (!cloudMeta && localFile) {
        console.log(`[Sync] Uploading ${fileId}, missing remotely.`);
        const newTime = await this.googleSyncService.uploadFile(fileId, localFile.content);
        await this.storageService.saveFile(fileId, localFile.content, { baseContent: localFile.content });
        localStorage.setItem(modifiedKey, newTime);
        return;
      }

      if (cloudMeta && !localFile) {
        console.log(`[Sync] Downloading ${fileId}, missing locally.`);
        const { content: remoteContent, modifiedTime: remoteTime } =
          await this.googleSyncService.downloadFileContent(cloudMeta.id);
        await this._saveParsed(fileId, remoteContent, remoteTime);
        return;
      }

      if (localFile && cloudMeta) {
        const { content: localContent, baseContent } = localFile;
        const localStr = normalize(localContent);
        const baseStr = normalize(baseContent);
        const isDirty = localStr !== baseStr;

        const lastKnownCloudModified = localStorage.getItem(modifiedKey);
        const currentCloudModified = cloudMeta.modifiedTime;
        const cloudHasChanged = currentCloudModified !== lastKnownCloudModified;

        if (!isDirty && cloudHasChanged) {
          console.log(`[Sync] ${fileId} clean locally, updating from cloud.`);
          const { content: remoteContent, modifiedTime: remoteTime } =
            await this.googleSyncService.downloadFileContent(cloudMeta.id);
          await this._saveParsed(fileId, remoteContent, remoteTime);
        } else if (isDirty && !cloudHasChanged) {
          console.log(`[Sync] Uploading local changes for ${fileId}.`);
          const newTime = await this.googleSyncService.uploadFile(fileId, localContent);
          await this.storageService.saveFile(fileId, localContent, { baseContent: localContent });
          localStorage.setItem(modifiedKey, newTime);
        } else if (isDirty && cloudHasChanged) {
          console.warn(`[Sync] Conflict in ${fileId}, attempting merge.`);
          const { content: remoteContent, modifiedTime: remoteTime } =
            await this.googleSyncService.downloadFileContent(cloudMeta.id);
          const remoteStr = normalize(remoteContent);

          const patches = this.dmp.patch_make(baseStr, localStr);
          const [mergedStr, results] = this.dmp.patch_apply(patches, remoteStr);

          if (results.every(Boolean)) {
            console.log(`[Sync] Auto-merge succeeded for ${fileId}.`);
            const mergedContent = JSON.parse(mergedStr);
            const newTime = await this.googleSyncService.uploadFile(fileId, mergedContent);
            await this._saveParsed(fileId, mergedContent, newTime);
          } else {
            await this._handleConflict(fileId, localContent, remoteContent, remoteTime);
          }
        } else {
          console.log(`[Sync] ${fileId} already in sync.`);
        }
      }
    } catch (err) {
      console.error(`[Sync] reconcileFile failed for ${fileId}:`, err);
      this.controller.showIndicator(`Sync failed for ${fileId}`, { isError: true, duration: 4000 });
    } finally {
      this.controller.setSyncState("signed-in");
    }
  }

  async _saveParsed(fileId, remoteContent, remoteTime) {
    let parsed = remoteContent;
    if (typeof remoteContent === "string" &&
      (fileId.endsWith(".json") || fileId.endsWith(".book") || fileId.endsWith(".note"))) {
      try {
        parsed = JSON.parse(remoteContent);
      } catch (e) {
        console.error(`[Sync] Failed to parse JSON for ${fileId}, storing raw string.`);
      }
    }
    await this.storageService.saveFile(fileId, parsed, { baseContent: parsed });
    localStorage.setItem(`cloud_modified_${fileId}`, remoteTime);
  }

  async _handleConflict(fileId, localContent, remoteContent, remoteTime) {
    this.controller.showIndicator(`Conflict detected for ${fileId}. Please resolve.`, { duration: 5000 });

    const choice = await this.controller.showMergeConflict({
      fileId,
      localContent: localContent,
      remoteContent: remoteContent,
    });

    if (choice === "local") {
      const contentToSave = localContent;
      const newTime = await this.googleSyncService.uploadFile(fileId, contentToSave);
      await this.storageService.saveFile(fileId, contentToSave, { baseContent: contentToSave });
      localStorage.setItem(`cloud_modified_${fileId}`, newTime);
    } else {
      await this._saveParsed(fileId, remoteContent, remoteTime);
    }
  }

  async reconcileAllFiles() {
    const indicatorId = this.controller.showIndicator('Reconciling offline changes...');
    try {
      const allFiles = await this.storageService.getAllFiles();
      for (const file of allFiles) {
        if (!['user-manual.book', 'initial_setup_complete'].includes(file.id)) {
          await this.reconcileFile(file.id, 'reconcile');
        }
      }
      this.controller.showIndicator('Reconciliation complete!', { duration: 3000 });
    } catch (error) {
      console.error("Reconciliation process failed:", error);
      this.controller.showIndicator('Could not reconcile offline changes.', { isError: true, duration: 4000 });
    } finally {
      this.controller.hideIndicator(indicatorId);
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
      const content = item.content;
      if (item.id.endsWith('.book')) {
        if (!existingBookIds.has(item.id)) {
          await this.storageService.saveFile(item.id, content, { baseContent: content });
        }
      } else {
        await this.storageService.saveFile(item.id, content, { baseContent: content });
      }
    }
  }

  async deleteCloudFileById(fileId) {
    const indicatorId = this.controller.showIndicator('Deleting cloud file...');
    try {
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
      return await this.googleSyncService.listFiles();
    } catch (error) {
      console.error("Failed to get cloud file list:", error);
      this.controller.showIndicator('Failed to connect to Drive.', { isError: true, duration: 6000 });
      return null;
    }
  }

  async deleteAllCloudFiles() {
    const indicatorId = this.controller.showIndicator('Deleting cloud data...');
    try {
      await this.googleSyncService.deleteAllFilesAndFolder();
      this.controller.showIndicator('All cloud data deleted successfully.', { duration: 4000 });
    } catch (error) {
      console.error("Failed to delete all cloud files:", error);
      this.controller.showIndicator('Deletion failed. See console.', { isError: true, duration: 4000 });
    } finally {
      this.controller.hideIndicator(indicatorId);
    }
  }

  async performInitialSync() {
    const isSignedIn = await this.googleSyncService.checkSignInStatus();
    if (!isSignedIn) return;

    this.controller.setSyncState('syncing');
    const indicatorId = this.controller.showIndicator('Syncing with Google Drive...');

    try {
      const localTombstones = await this.storageService.getAllTombstones();
      this.activeTombstones = new Set(localTombstones.map(ts => ts.filename));
      console.log(`[Sync] Loaded ${this.activeTombstones.size} active tombstones.`);
      console.log("[Sync] Building local ID-to-filename map...");
      this.idToFilenameMap.clear();
      const allLocalFiles = await this.storageService.getAllFiles();
      for (const file of allLocalFiles) {
        if (file.id.endsWith('.book') && file.content?.metadata?.id) {
          this.idToFilenameMap.set(file.content.metadata.id, file.id);
        } else if (file.id.endsWith('.note') && file.content?.id) {
          this.idToFilenameMap.set(file.content.id, file.id);
        }
      }
      console.log(`[Sync] Map built with ${this.idToFilenameMap.size} entries.`);

      await this._processCloudTombstones();

      await this.reconcileFile('tombstones.json');

      const cloudFiles = await this.googleSyncService.listFiles();
      const currentLocalFiles = await this.storageService.getAllFiles();

      const cloudFilesMap = new Map(cloudFiles.map(f => [f.name, f]));
      const localFilesMap = new Map(currentLocalFiles.map(f => [f.id, f]));
      const allFileIds = new Set([...cloudFilesMap.keys(), ...localFilesMap.keys()]);

      for (const fileId of allFileIds) {
        if (['user-manual.book', 'initial_setup_complete', 'tombstones.json'].includes(fileId)) continue;
        await this.reconcileFile(fileId, 'sync');
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