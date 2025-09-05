/**
 * Manages authentication and file operations with the Google Drive API.
 */
export class GoogleSyncService {
  constructor(controller) {
    this.controller = controller;
    this.tokenClient = null;
    this.gapi = null;
    this.gis = null;
    this.initializationPromise = null;

    this.API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;
    this.CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    // The scope for userinfo.profile was already correct.
    this.SCOPES = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile';
    this.DISCOVERY_DOCS = [
      "https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"
      // No longer need oauth2 discovery doc, as we use fetch
    ];

    this.APP_FOLDER_NAME = 'Editor App';
    this.appFolderId = null;
  }

  initialize() {
    if (this.initializationPromise) return this.initializationPromise;
    this.initializationPromise = (async () => {
      this.gapi = await this.loadGapiClient();
      const gisClient = await this.loadGisClient();
      this.tokenClient = gisClient.initTokenClient({
        client_id: this.CLIENT_ID,
        scope: this.SCOPES,
        callback: () => { },
      });
      console.log("Google Sync Service Initialized for drive.file scope.");
    })();
    return this.initializationPromise;
  }

  loadGapiClient() {
    return new Promise(resolve => {
      const checkGapi = () => {
        if (window.gapi && window.gapi.load) {
          window.gapi.load('client', () => resolve(window.gapi));
        } else setTimeout(checkGapi, 100);
      };
      checkGapi();
    });
  }

  loadGisClient() {
    return new Promise(resolve => {
      const checkGis = () => {
        if (window.google && window.google.accounts && window.google.accounts.oauth2) {
          this.gis = window.google.accounts.oauth2;
          resolve(this.gis);
        } else setTimeout(checkGis, 100);
      };
      checkGis();
    });
  }

  async authorize() {
    await this.initialize();
    return new Promise(async (resolve, reject) => {
      try {
        // We only need to init the 'drive' client now.
        await this.gapi.client.init({ apiKey: this.API_KEY, discoveryDocs: this.DISCOVERY_DOCS });
        if (this.gapi.client.getToken()) {
          resolve(true);
          return;
        }
        this.tokenClient.callback = (resp) => {
          if (resp.error) return reject(resp.error);
          resolve(true);
        };
        this.tokenClient.requestAccessToken({ prompt: 'select_account' });
      } catch (err) {
        reject(err);
      }
    });
  }

  // --- AUTH FLOW METHODS ---

  async signIn() {
    await this.authorize();
    return this.getUserProfile();
  }

  async signOut() {
    const token = this.gapi.client.getToken();
    if (token && this.gis) {
      this.gis.revoke(token.access_token, () => {
        this.gapi.client.setToken(null);
        console.log('Access token revoked and removed from client.');
      });
    }
  }

  async checkSignInStatus() {
    await this.initialize();
    return !!this.gapi.client.getToken();
  } async signIn() {
    await this.authorize();
    return this.getUserProfile();
  }

  async signOut() {
    const token = this.gapi.client.getToken();
    if (token && this.gis) {
      this.gis.revoke(token.access_token, () => {
        this.gapi.client.setToken(null);
        console.log('Access token revoked and removed from client.');
      });
    }
  }

  async checkSignInStatus() {
    await this.initialize();
    return !!this.gapi.client.getToken();
  }

  async getUserProfile() {
    const token = this.gapi.client.getToken();
    if (!token) return null;

    try {
      // Manually fetch using the access token, bypassing the gapi.client library for this call
      const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: {
          'Authorization': `Bearer ${token.access_token}`
        }
      });

      if (!response.ok) {
        const errorBody = await response.json();
        console.error("Failed to fetch user profile:", errorBody);
        throw new Error(`Failed to fetch user profile: ${response.statusText}`);
      }

      return await response.json();

    } catch (error) {
      console.error("Error in getUserProfile:", error);
      return null;
    }
  }
  /**
   * Finds or creates the dedicated application folder in Google Drive.
   * @returns {Promise<string>} The ID of the folder.
   * @private
   */
  async _getAppFolderId() {
    if (this.appFolderId) return this.appFolderId;

    const response = await this.gapi.client.drive.files.list({
      q: `mimeType='application/vnd.google-apps.folder' and name='${this.APP_FOLDER_NAME}' and trashed=false`,
      fields: 'files(id, name)',
    });

    if (response.result.files.length > 0) {
      this.appFolderId = response.result.files[0].id;
      return this.appFolderId;
    } else {
      const fileMetadata = {
        name: this.APP_FOLDER_NAME,
        mimeType: 'application/vnd.google-apps.folder',
      };
      const newFolder = await this.gapi.client.drive.files.create({
        resource: fileMetadata,
        fields: 'id',
      });
      this.appFolderId = newFolder.result.id;
      return this.appFolderId;
    }
  }

  /**
   * Finds a file by name within the app folder.
   * @param {string} filename The name of the file to find.
   * @returns {Promise<string|null>} The file ID, or null if not found.
   * @private
   */
  async _findFileId(filename) {
    const folderId = await this._getAppFolderId();
    const response = await this.gapi.client.drive.files.list({
      q: `'${folderId}' in parents and name='${filename}' and trashed=false`,
      fields: 'files(id, name)',
    });
    return response.result.files.length > 0 ? response.result.files[0].id : null;
  }

  /**
   * Uploads content to a specific file in the app folder.
   * @param {string} filename The name of the file (e.g., 'notes.json').
   * @param {any} content The content to upload (will be stringified if it's an object).
   */
  async uploadFile(filename, content) {
    const folderId = await this._getAppFolderId();
    const fileId = await this._findFileId(filename);
    const contentString = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
    const mimeType = filename.endsWith('.json') || filename.endsWith('.book') ? 'application/json' : 'text/plain';

    const boundary = '-------314159265358979323846';
    const delimiter = "\r\n--" + boundary + "\r\n";
    const close_delim = "\r\n--" + boundary + "--";

    const metadata = { name: filename, mimeType: mimeType };
    let path = '/upload/drive/v3/files';
    let method = 'POST';

    if (fileId) {
      path = `/upload/drive/v3/files/${fileId}`;
      method = 'PATCH';
    } else {
      metadata.parents = [folderId];
    }

    const multipartRequestBody =
      delimiter + 'Content-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(metadata) +
      delimiter + `Content-Type: ${mimeType}\r\n\r\n` + contentString + close_delim;

    await this.gapi.client.request({
      path, method,
      params: { uploadType: 'multipart' },
      headers: { 'Content-Type': 'multipart/related; boundary="' + boundary + '"' },
      body: multipartRequestBody,
    });
  }

  /**
   * Downloads a specific file from the app folder.
   * @param {string} fileId The ID of the file to download.
   * @returns {Promise<string|null>} The file content as a string, or null.
   */
  async downloadFileContent(fileId) {
    if (!fileId) return null;
    const response = await this.gapi.client.drive.files.get({ fileId, alt: 'media' });
    return response.body;
  }

  /**
   * Lists all files within the dedicated app folder.
   * @returns {Promise<Array<object>>} A list of file objects from the Drive API.
   */
  async listFiles() {
    const folderId = await this._getAppFolderId();
    const response = await this.gapi.client.drive.files.list({
      q: `'${folderId}' in parents and trashed=false`,
      fields: 'files(id, name, modifiedTime)',
    });
    return response.result.files || [];
  }

  /**
* Deletes a specific file by its Google Drive file ID.
* @param {string} fileId The unique ID of the file to delete.
*/
  async deleteFileById(fileId) {
    if (!fileId) {
      throw new Error("File ID is required for deletion.");
    }
    await this.gapi.client.drive.files.delete({ fileId: fileId });
    console.log(`Deleted file with ID "${fileId}" from Google Drive.`);
  }

  /**
   * Deletes all files and the app folder itself.
   */
  async deleteAllFilesAndFolder() {
    const folderId = await this._getAppFolderId();
    if (folderId) {
      await this.gapi.client.drive.files.delete({ fileId: folderId });
      this.appFolderId = null;
    }
  }
}