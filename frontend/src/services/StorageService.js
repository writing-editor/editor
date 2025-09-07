/**
 * A wrapper for IndexedDB to provide a simple, async, key-value file storage system.
 * This service is the single source of truth for all persistent data stored in the browser.
 */
export class StorageService {
  constructor(dbName = 'EditorAppDB', version = 3) {
    this.dbName = dbName;
    this.version = version;
    this.db = null;
    this.controller = null;
  }

  setController(controller) {
    this.controller = controller;
  }

  async open() {
    return new Promise((resolve, reject) => {
      if (this.db) {
        resolve(true);
        return;
      }
      const request = indexedDB.open(this.dbName, this.version);
      request.onerror = (event) => {
        console.error("IndexedDB error:", request.error);
        reject("Error opening database");
      };
      request.onsuccess = (event) => {
        this.db = event.target.result;
        console.log("Database opened successfully at version 3.");
        resolve(true);
      };
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        console.log(`Upgrading database to version ${this.version}...`);
        if (db.objectStoreNames.contains('files')) {
          db.deleteObjectStore('files');
        }
        db.createObjectStore('files', { keyPath: 'id' });
      };
    });
  }

  async saveFile(id, content) {
    const lastModified = Date.now();
    return new Promise((resolve, reject) => {
      if (!this.db) return reject("Database not open.");
      const transaction = this.db.transaction(['files'], 'readwrite');
      const store = transaction.objectStore('files');
      const request = store.put({ id, content, lastModified });
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
        resolve(request.result ? request.result.content : null);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async deleteFile(id) {
    return new Promise((resolve, reject) => {
      if (!this.db) return reject("Database not open.");
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
}