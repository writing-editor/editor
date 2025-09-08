/**
 * A wrapper for IndexedDB to provide a simple, async, key-value file storage system.
 * This service is the single source of truth for all persistent data stored in the browser.
 */
export class StorageService {
  constructor(dbName = 'EditorAppDB', version = 4) {
    this.dbName = dbName;
    this.version = version;
    this.db = null;
    this.controller = null;
    this.openingPromise = null;
  }

  setController(controller) {
    this.controller = controller;
  }

  open() {
    if (this.db) {
      return Promise.resolve(true);
    }

    if (this.openingPromise) {
      return this.openingPromise;
    }

    this.openingPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onblocked = () => {
        console.error("Database open request is blocked. Please close other tabs of this app.");
        reject("Database open blocked");
      };

      request.onerror = (event) => {
        console.error("IndexedDB error:", request.error);
        this.openingPromise = null;
        reject("Error opening database");
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        console.log(`Database opened successfully at version ${this.version}.`);

        this.db.onversionchange = () => {
          this.db.close();
          alert("A new version of the app is ready. Please reload the page.");
          window.location.reload();
        };

        resolve(true);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        console.log(`Upgrading database to version ${this.version}...`);

        if (!db.objectStoreNames.contains('files')) {
          db.createObjectStore('files', { keyPath: 'id' });
          console.log("Object store 'files' created.");
        }
        if (!db.objectStoreNames.contains('tombstones')) {
          db.createObjectStore('tombstones', { keyPath: 'fileId' });
          console.log("Object store 'tombstones' created.");
        }
      };
    });

    return this.openingPromise;
  }

  async saveFile(id, content, options = {}) {
    const { baseContent = null } = options;
    const lastModified = Date.now();

    return new Promise(async (resolve, reject) => {
      if (!this.db) return reject("Database not open.");

      const transaction = this.db.transaction(['files'], 'readwrite');
      const store = transaction.objectStore('files');

      const existingRecord = await new Promise(res => {
        const req = store.get(id);
        req.onsuccess = () => res(req.result);
        req.onerror = () => res(null); // Resolve with null on error
      });

      const recordToSave = {
        id,
        content,
        lastModified,
        baseContent: baseContent !== null ? baseContent : (existingRecord ? existingRecord.baseContent : content)
      };

      const request = store.put(recordToSave);
      request.onsuccess = () => {
        if (this.controller && id !== 'initial_setup_complete') {
          this.controller.publish('database:changed', { fileId: id, action: 'saved' });
        }
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getFile(id) {
    return new Promise((resolve, reject) => {
      if (!this.db) return reject("Database not open.");
      const transaction = this.db.transaction(['files'], 'readonly');
      const store = transaction.objectStore('files');
      const request = store.get(id);
      request.onsuccess = () => {
        resolve(request.result || null);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async deleteFile(id) {
    return new Promise(async (resolve, reject) => {
      if (!this.db) return reject("Database not open.");

      await this.addTombstone(id);

      const transaction = this.db.transaction(['files'], 'readwrite');
      const store = transaction.objectStore('files');
      const request = store.delete(id);
      request.onsuccess = () => {
        if (this.controller) {
          this.controller.publish('database:changed', { fileId: id, action: 'deleted' });
        }
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getAllFilesBySuffix(suffix) {
    return new Promise((resolve, reject) => {
      if (!this.db) return reject("Database not open.");
      const transaction = this.db.transaction(['files'], 'readonly');
      const store = transaction.objectStore('files');
      const request = store.getAll();
      request.onsuccess = () => {
        const allFiles = request.result || [];
        const filteredFiles = allFiles.filter(file => file.id.endsWith(suffix));
        resolve(filteredFiles);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getAllFiles() {
    return new Promise((resolve, reject) => {
      if (!this.db) return reject("Database not open.");
      const transaction = this.db.transaction(['files'], 'readonly');
      const store = transaction.objectStore('files');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async deleteDatabase() {
    return new Promise((resolve, reject) => {
      if (this.db) {
        this.db.close();
        this.db = null;
        console.log("Database connection closed.");
      }
      console.log(`Deleting database: ${this.dbName}`);
      const deleteRequest = indexedDB.deleteDatabase(this.dbName);
      deleteRequest.onsuccess = () => {
        console.log("Database deleted successfully.");
        resolve();
      };
      deleteRequest.onerror = (event) => {
        console.error("Error deleting database:", event.target.error);
        reject("Error deleting database.");
      };
      deleteRequest.onblocked = () => {
        console.warn("Database deletion blocked. Please close other tabs of this app.");
        reject("Database deletion blocked.");
      };
    });
  }

  async addTombstone(fileId) {
    return new Promise((resolve, reject) => {
      if (!this.db) return reject("Database not open.");
      const transaction = this.db.transaction(['tombstones'], 'readwrite');
      const store = transaction.objectStore('tombstones');
      const request = store.put({ fileId, deletedAt: Date.now() });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async removeTombstone(fileId) {
    return new Promise((resolve, reject) => {
      if (!this.db) return reject("Database not open.");
      const transaction = this.db.transaction(['tombstones'], 'readwrite');
      const store = transaction.objectStore('tombstones');
      const request = store.delete(fileId);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getAllTombstones() {
    return new Promise((resolve, reject) => {
      if (!this.db) return reject("Database not open.");
      const transaction = this.db.transaction(['tombstones'], 'readonly');
      const store = transaction.objectStore('tombstones');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }
}