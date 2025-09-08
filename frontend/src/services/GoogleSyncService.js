export class GoogleSyncService {
  constructor(controller) {
    this.controller = controller;
    this.tokenClient = null;
    this.gapi = null;
    this.gis = null;
    this.initializationPromise = null;
    this.tokenResolver = null;

    this.API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;
    this.CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    this.SCOPES = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile';
    this.DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"];

    this.APP_FOLDER_NAME = 'Editor App';
    this.appFolderId = null;
    this.notesFolderId = null;
  }

  initialize() {
    if (this.initializationPromise) return this.initializationPromise;

    this.initializationPromise = new Promise(async (resolve, reject) => {
      try {
        this.gapi = await this.loadGapiClient();
        await this.gapi.client.init({ apiKey: this.API_KEY, discoveryDocs: this.DISCOVERY_DOCS });

        this.gis = await this.loadGisClient();
        this.tokenClient = this.gis.initTokenClient({
          client_id: this.CLIENT_ID,
          scope: this.SCOPES,
          // --- FIX: A single, robust callback for all token responses ---
          callback: (tokenResponse) => {
            if (tokenResponse && tokenResponse.access_token) {
              // This is the crucial step that was missing.
              // Explicitly set the token for the gapi client.
              this.gapi.client.setToken(tokenResponse);
              if (this.tokenResolver) this.tokenResolver.resolve(tokenResponse);
            } else {
              // Handle errors or empty responses
              const error = new Error(tokenResponse?.error_description || 'Sign-in failed or was cancelled.');
              if (this.tokenResolver) this.tokenResolver.reject(error);
            }
            this.tokenResolver = null;
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

  async trySilentAuth() {
    const token = gapi.client.getToken();
    if (token) {
      return true;
    }

    return new Promise((resolve) => {
      this.tokenClient.callback = (resp) => {
        if (resp && resp.access_token) {
          resolve(true);
        } else {
          resolve(false);
        }
      };
      this.tokenClient.requestAccessToken({
        prompt: "",
      });
    });
  }



  async signIn() {
    return new Promise((resolve, reject) => {
      this.tokenClient.callback = async (resp) => {
        if (resp && resp.access_token) {
          try {
            const profile = await this.getUserProfile();
            resolve(profile);
          } catch (err) {
            reject(err);
          }
        } else {
          reject(new Error("Failed to sign in"));
        }
      };

      this.tokenClient.requestAccessToken({
        prompt: "consent",   // only first time
        access_type: "offline", // persistent session
      });
    });
  }

  async getUserProfile() {
  const token = gapi.client.getToken();
  if (!token) return null;

  try {
    const resp = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: {
        Authorization: `Bearer ${token.access_token}`,
      },
    });

    if (!resp.ok) {
      console.error("Failed to fetch profile", await resp.text());
      return null;
    }

    return await resp.json(); // contains name, picture, email
  } catch (err) {
    console.error("Failed to fetch user profile", err);
    return null;
  }
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

  async _getNotesFolderId() {
    if (this.notesFolderId) return this.notesFolderId;

    const parentFolderId = await this._getAppFolderId();
    const response = await this.gapi.client.drive.files.list({
      q: `'${parentFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and name='notes' and trashed=false`,
      fields: 'files(id, name)',
    });

    if (response.result.files.length > 0) {
      this.notesFolderId = response.result.files[0].id;
      return this.notesFolderId;
    } else {
      const fileMetadata = {
        name: 'notes',
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentFolderId],
      };
      const newFolder = await this.gapi.client.drive.files.create({ resource: fileMetadata, fields: 'id' });
      this.notesFolderId = newFolder.result.id;
      return this.notesFolderId;
    }
  }

  async _findFileId(filename, parentFolderId) {
    const response = await this.gapi.client.drive.files.list({
      q: `'${parentFolderId}' in parents and name='${filename}' and trashed=false`,
      fields: 'files(id, name)',
    });
    return response.result.files.length > 0 ? response.result.files[0].id : null;
  }

  async getFileMetadata(filename) {
    const parentFolderId = filename.endsWith('.note') ? await this._getNotesFolderId() : await this._getAppFolderId();
    const response = await this.gapi.client.drive.files.list({
      q: `'${parentFolderId}' in parents and name='${filename}' and trashed=false`,
      fields: 'files(id, name, modifiedTime)',
    });
    return response.result.files.length > 0 ? response.result.files[0] : null;
  }

  async uploadFile(filename, content) {
    const isNote = filename.endsWith('.note');
    const folderId = isNote ? await this._getNotesFolderId() : await this._getAppFolderId();
    const fileId = await this._findFileId(filename, folderId);

    const contentString = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
    const mimeType = filename.endsWith('.json') || filename.endsWith('.book') || filename.endsWith('.note') ? 'application/json' : 'text/plain';

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

    // *** FIX STEP 1: Upload the file and ONLY ask for the 'id' ***
    const uploadResponse = await this.gapi.client.request({
      path, method,
      params: { uploadType: 'multipart', fields: 'id' },
      headers: { 'Content-Type': 'multipart/related; boundary="' + boundary + '"' },
      body: multipartRequestBody,
    });

    const newFileId = uploadResponse.result.id;

    // *** FIX STEP 2: Use the ID to make a VALID metadata request ***
    const metaResponse = await this.gapi.client.drive.files.get({
      fileId: newFileId,
      fields: 'id, modifiedTime' // Requesting 'id' alongside 'modifiedTime' is a valid call
    });

    return metaResponse.result.modifiedTime;
  }

  async downloadFileContent(fileId) {
    if (!fileId) return null;

    // *** FIX: Correct the metadata request to be valid ***
    const metaResponse = await this.gapi.client.drive.files.get({
      fileId: fileId,
      fields: 'id, modifiedTime' // Request 'id' and 'modifiedTime'
    });
    const modifiedTime = metaResponse.result.modifiedTime;

    const contentResponse = await this.gapi.client.drive.files.get({ fileId, alt: 'media' });

    return { content: contentResponse.body, modifiedTime: modifiedTime };
  }

  async listFiles() {
    const appFolderId = await this._getAppFolderId();
    const notesFolderId = await this._getNotesFolderId();

    const query = `('${appFolderId}' in parents or '${notesFolderId}' in parents) and trashed=false and mimeType != 'application/vnd.google-apps.folder'`;

    const response = await this.gapi.client.drive.files.list({
      q: query,
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

  async deleteFileByName(filename) {
    const fileMeta = await this.getFileMetadata(filename);
    if (fileMeta && fileMeta.id) {
      await this.deleteFileById(fileMeta.id);
      return true;
    }
    console.warn(`Could not find cloud file "${filename}" to delete.`);
    return false;
  }

  async deleteAllFilesAndFolder() {
    const folderId = await this._getAppFolderId();
    if (folderId) {
      await this.gapi.client.drive.files.delete({ fileId: folderId });
      this.appFolderId = null;
      this.notesFolderId = null;
    }
  }
}