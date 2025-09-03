/**
 * Manages authentication and file operations with the Google Drive API.
 */
export class GoogleSyncService {
  constructor(appController) {
    this.appController = appController;
    this.tokenClient = null;
    this.gapi = null;
    this.gis = null;
    this.initializationPromise = null;

    this.API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;
    this.CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    this.SCOPES = 'https://www.googleapis.com/auth/drive.appdata';
    this.DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"];

    this.BACKUP_FILENAME = 'intelligent_editor_backup.json';
  }

  /**
   * Initializes the Google API and Identity clients.
   * Must be called before any other methods.
   */
  initialize() {
    // If already initializing, return the existing promise
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    // Start the initialization and store the promise
    this.initializationPromise = (async () => {
      this.gapi = await this.loadGapiClient();
      const gisClient = await this.loadGisClient();
      this.tokenClient = gisClient.initTokenClient({
        client_id: this.CLIENT_ID,
        scope: this.SCOPES,
        callback: () => { },
      });
      console.log("Google Sync Service Initialized.");
    })();

    return this.initializationPromise;
  }

  loadGapiClient() {
    return new Promise(resolve => {
      // gapi.load('client', ...) is the full call, so we check for window.gapi first
      const checkGapi = () => {
        if (window.gapi && window.gapi.load) {
          window.gapi.load('client', () => resolve(window.gapi));
        } else {
          setTimeout(checkGapi, 100);
        }
      };
      checkGapi();
    });
  }

  loadGisClient() {
    return new Promise(resolve => {
      const checkGis = () => {
        // CORRECT: Wait for the specific object path to be available
        if (window.google && window.google.accounts && window.google.accounts.oauth2) {
          resolve(window.google.accounts.oauth2);
        } else {
          setTimeout(checkGis, 100);
        }
      };
      checkGis();
    });
  }

  /**
   * Authorizes the user and initializes the Drive API client.
   * This will trigger a login popup if the user is not signed in.
   */
  async authorize() {
    await this.initialize();
    return new Promise(async (resolve, reject) => {
      try {
        await this.gapi.client.init({
          apiKey: this.API_KEY,
          discoveryDocs: this.DISCOVERY_DOCS,
        });

        const tokenResponse = this.gapi.client.getToken();
        if (tokenResponse) {
          console.log("Already authorized.");
          resolve(true);
          return;
        }

        this.tokenClient.callback = (resp) => {
          if (resp.error) {
            return reject(resp.error);
          }
          console.log("Authorization successful.");
          resolve(true);
        };
        this.tokenClient.requestAccessToken({ prompt: 'consent' });
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Finds the backup file in the user's Drive appDataFolder.
   * @returns {Promise<string|null>} The file ID, or null if not found.
   */
  async findBackupFile() {
    const response = await this.gapi.client.drive.files.list({
      spaces: 'appDataFolder',
      fields: 'files(id, name)',
      q: `name='${this.BACKUP_FILENAME}' and trashed=false`,
    });
    const files = response.result.files;
    return files.length > 0 ? files[0].id : null;
  }

  /**
   * Uploads content to the backup file, creating it if it doesn't exist.
   * @param {string} content The JSON string content to upload.
   */
  async uploadBackup(content) {
    const fileId = await this.findBackupFile();
    const boundary = '-------314159265358979323846';
    const delimiter = "\r\n--" + boundary + "\r\n";
    const close_delim = "\r\n--" + boundary + "--";

    const metadata = {
      name: this.BACKUP_FILENAME,
      mimeType: 'application/json',
    };

    let path = '/upload/drive/v3/files';
    let method = 'POST';

    if (fileId) { // If file exists, update it
      path = `/upload/drive/v3/files/${fileId}`;
      method = 'PATCH';
      metadata.parents = undefined; // Don't try to change parents on update
    } else { // Otherwise, specify the appDataFolder for creation
      metadata.parents = ['appDataFolder'];
    }

    const multipartRequestBody =
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: application/json\r\n\r\n' +
      content +
      close_delim;

    await this.gapi.client.request({
      path: path,
      method: method,
      params: { uploadType: 'multipart' },
      headers: { 'Content-Type': 'multipart/related; boundary="' + boundary + '"' },
      body: multipartRequestBody,
    });
  }

  /**
   * Downloads the content of the backup file.
   * @returns {Promise<string|null>} The JSON string content, or null if not found.
   */
  async downloadBackup() {
    const fileId = await this.findBackupFile();
    if (!fileId) return null;

    const response = await this.gapi.client.drive.files.get({
      fileId: fileId,
      alt: 'media',
    });
    return response.body;
  }

  // --- ADD THESE TWO NEW METHODS ---
  async listBackupFiles() {
    const response = await this.gapi.client.drive.files.list({
      spaces: 'appDataFolder',
      fields: 'files(id, name, modifiedTime)',
    });
    return response.result.files;
  }

  async deleteAllFiles() {
    const files = await this.listBackupFiles();
    if (files && files.length > 0) {
      const batch = this.gapi.client.newBatch();
      files.forEach(file => {
        batch.add(this.gapi.client.drive.files.delete({ fileId: file.id }));
      });
      await batch;
    }
    // Also, disconnect the user
    if (this.gis && this.gapi.client.getToken()) {
      this.gis.revokeToken(this.gapi.client.getToken().access_token, () => {
        console.log('Access token revoked.');
      });
    }
  }
}