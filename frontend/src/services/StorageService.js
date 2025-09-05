/**
 * A wrapper for IndexedDB to provide a simple, async, key-value file storage system.
 * This service is the single source of truth for all persistent data stored in the browser.
 */
export class StorageService {
  constructor(dbName = 'EditorAppDB', version = 3) {
    this.dbName = dbName;
    this.version = version;
    this.db = null;
    this.controller = null; // Will be set by App.js
  }

  setController(controller) {
    this.controller = controller;
  }

  /**
   * Opens and initializes the IndexedDB database.
   * @returns {Promise<boolean>} A promise that resolves to true on success.
   */
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

  /**
* Removes all entries associated with a specific filename from the index.
* @param {string} filename The filename of the book to remove.
*/
  removeDocument(filename) {
    // FlexSearch's Document index doesn't have a simple "remove where field equals value".
    // The most robust way is to rebuild the index without the deleted file.
    // Since this is an infrequent operation, performance is acceptable.
    // To do this, we need access to all the *other* books.
    // The better approach is to just rebuild the index from scratch in the App controller.
    console.log(`Request to remove ${filename} from index. A full re-index is recommended.`);
    this.isIndexed = false; // Mark index as dirty
  }

  /**
   * Saves a file (or any JSON object) to the database.
   * @param {string} id - The "filename" or unique key (e.g., 'my-book.book', 'notes.json').
   * @param {any} content - The data to store.
   * @returns {Promise<void>}
   */
  async saveFile(id, content) {
    const lastModified = Date.now();
    return new Promise((resolve, reject) => {
      if (!this.db) return reject("Database not open.");
      const transaction = this.db.transaction(['files'], 'readwrite');
      const store = transaction.objectStore('files');
      const request = store.put({ id, content, lastModified });

      request.onsuccess = () => {
        // --- NEW: PUBLISH EVENT ---
        if (this.controller && id !== 'initial_setup_complete') {
          this.controller.publish('database:changed', { fileId: id, action: 'saved' });
        }
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Retrieves a file from the database by its ID.
   * @param {string} id - The "filename" or unique key.
   * @returns {Promise<any|null>} The content of the file, or null if not found.
   */
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

  /**
   * Deletes a file from the database by its ID.
   * @param {string} id - The "filename" or unique key to delete.
   * @returns {Promise<void>}
   */
  async deleteFile(id) {
    return new Promise((resolve, reject) => {
      if (!this.db) return reject("Database not open.");
      const transaction = this.db.transaction(['files'], 'readwrite');
      const store = transaction.objectStore('files');
      const request = store.delete(id);

      request.onsuccess = () => {
        // --- NEW: PUBLISH EVENT ---
        if (this.controller) {
          this.controller.publish('database:changed', { fileId: id, action: 'deleted' });
        }
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Deletes a specific file by name from the app folder.
   * @param {string} filename The name of the file to delete (e.g., 'notes.json').
   */
  async deleteFile(filename) {
    const fileId = await this._findFileId(filename);
    if (fileId) {
      await this.gapi.client.drive.files.delete({ fileId: fileId });
      console.log(`Deleted "${filename}" from Google Drive.`);
    } else {
      console.log(`File "${filename}" not found in Google Drive, skipping deletion.`);
    }
  }

  /**
   * Retrieves all files that end with a specific suffix (e.g., '.book').
   * @param {string} suffix - The suffix to match (e.g., '.book').
   * @returns {Promise<Array<{id: string, content: any}>>} A list of matching file objects.
   */
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

  /**
   * Retrieves all files from the database. Useful for backups.
   * @returns {Promise<Array<{id: string, content: any}>>} A list of all file objects.
   */
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
      // First, close the active connection to the database
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