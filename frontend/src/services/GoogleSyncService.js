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
    this.SCOPES = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile';
    this.DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"];

    this.APP_FOLDER_NAME = 'Editor App';
    this.appFolderId = null;
  }

  // --- MODIFIED: Initialization is now more robust ---
  initialize() {
    if (this.initializationPromise) return this.initializationPromise;
    
    this.initializationPromise = new Promise(async (resolve, reject) => {
      try {
        // First, load the GAPI client library
        this.gapi = await this.loadGapiClient();
        await this.gapi.client.init({ apiKey: this.API_KEY, discoveryDocs: this.DISCOVERY_DOCS });

        // Second, load the GIS library for auth
        this.gis = await this.loadGisClient();
        this.tokenClient = this.gis.initTokenClient({
          client_id: this.CLIENT_ID,
          scope: this.SCOPES,
          callback: (tokenResponse) => {
            // This callback handles both explicit and silent sign-ins
            if (tokenResponse && tokenResponse.access_token) {
                console.log("Token received, user is signed in.");
            } else {
                console.log("Token response was empty, user is not signed in.");
            }
          },
        });
        console.log("Google Sync Service Initialized.");
        resolve();
      } catch (error) {
        console.error("Error during Google Service initialization:", error);
        reject(error);
      }
    });
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
          resolve(window.google.accounts.oauth2);
        } else setTimeout(checkGis, 100);
      };
      checkGis();
    });
  }

  // --- NEW: Method for silent sign-in on page load ---
  async trySilentAuth() {
    return new Promise((resolve, reject) => {
      if (!this.tokenClient) return reject("Token client not initialized.");
      // The prompt: 'none' is the key here. It will not show a popup.
      this.tokenClient.requestAccessToken({ prompt: 'none' });
      
      // We don't need to do anything in the callback here because the gapi client
      // automatically gets the token. We just need to check if it's there.
      // We add a small delay to allow the silent request to complete.
      setTimeout(() => {
          resolve(!!this.gapi.client.getToken());
      }, 1000);
    });
  }

  async authorize() {
    await this.initialize();
    return new Promise((resolve, reject) => {
        if (this.gapi.client.getToken()) {
          resolve(true);
          return;
        }
        // This will now handle the callback via the central callback in initialize()
        this.tokenClient.requestAccessToken({ prompt: 'select_account' });
        // The authorize flow now mostly triggers the UI, the real token handling
        // happens in the callback. We can consider this "successful" once the prompt is shown.
        resolve(true); 
    });
  }

  // --- AUTH FLOW METHODS ---

  async signIn() {
    await this.authorize();
    // After triggering the sign-in, we wait a moment for the token to be processed
    return new Promise(resolve => {
        setTimeout(async () => {
             const user = await this.getUserProfile();
             resolve(user);
        }, 1500);
    });
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

  // No longer need a duplicate checkSignInStatus method, it was removed.

  async getUserProfile() {
    const token = this.gapi.client.getToken();
    if (!token) return null;

    try {
      const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { 'Authorization': `Bearer ${token.access_token}` }
      });
      if (!response.ok) throw new Error(`Failed to fetch user profile: ${response.statusText}`);
      return await response.json();
    } catch (error) {
      console.error("Error in getUserProfile:", error);
      return null;
    }
  }

  // ... rest of the file ( _getAppFolderId, _findFileId, uploadFile, etc.) remains exactly the same ...
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

  async _findFileId(filename) {
    const folderId = await this._getAppFolderId();
    const response = await this.gapi.client.drive.files.list({
      q: `'${folderId}' in parents and name='${filename}' and trashed=false`,
      fields: 'files(id, name)',
    });
    return response.result.files.length > 0 ? response.result.files[0].id : null;
  }

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

  async downloadFileContent(fileId) {
    if (!fileId) return null;
    const response = await this.gapi.client.drive.files.get({ fileId, alt: 'media' });
    return response.body;
  }

  async listFiles() {
    const folderId = await this._getAppFolderId();
    const response = await this.gapi.client.drive.files.list({
      q: `'${folderId}' in parents and trashed=false`,
      fields: 'files(id, name, modifiedTime)',
    });
    return response.result.files || [];
  }

  async deleteFileById(fileId) {
    if (!fileId) {
      throw new Error("File ID is required for deletion.");
    }
    await this.gapi.client.drive.files.delete({ fileId: fileId });
    console.log(`Deleted file with ID "${fileId}" from Google Drive.`);
  }

  async deleteAllFilesAndFolder() {
    const folderId = await this._getAppFolderId();
    if (folderId) {
      await this.gapi.client.drive.files.delete({ fileId: folderId });
      this.appFolderId = null;
    }
  }
}