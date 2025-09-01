// frontend/src/components/DataManager.js
import './DataManager.css';


export class DataManager {
  constructor(app) {
    this.app = app;
    // The constructor's only job is to get the container.
    this.containerEl = document.getElementById('data-manager-modal-container');
  }

  // The show() method is now the single entry point that builds and displays the modal.
  async show() {
    // 1. Make the container visible and render the initial "loading" shell.
    this.containerEl.classList.remove('hidden');
    this.containerEl.innerHTML = `
      <div id="data-manager-modal-box">
        <div id="data-manager-toolbar">
          <h4>Files in Google Drive</h4>
          <button id="data-manager-delete-all-btn" class="settings-action-btn" title="Disconnect & Delete All Cloud Data" disabled>
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6l-2 14H7L5 6"/>
    <path d="M10 11v6"/>
    <path d="M14 11v6"/>
    <path d="M9 6V4h6v2"/>
  </svg>
</button>
        </div>
        <div id="data-manager-content">
          <p class="data-manager-loading">Connecting to Google Drive...</p>
        </div>
      </div>
    `;

    // 2. Now that the elements exist, find them and attach listeners.
    this.deleteAllBtn = document.getElementById('data-manager-delete-all-btn');
    this.contentEl = document.getElementById('data-manager-content');

    this.deleteAllBtn.addEventListener('click', () => this.handleDeleteAll());
    this.containerEl.addEventListener('click', (e) => {
      // Use a new reference to the modal box for the click-away check
      const modalBox = document.getElementById('data-manager-modal-box');
      if (e.target === this.containerEl || !modalBox.contains(e.target)) {
        this.hide();
      }
    });

    // 3. Fetch the file list from the cloud.
    const fileList = await this.app.syncService.getCloudFileList();

    // 4. Update the content area with the results.
    if (fileList === null) {
      this.contentEl.innerHTML = `<p class="data-manager-error">Could not fetch file list. Please try again.</p>`;
    } else if (fileList.length === 0) {
      this.contentEl.innerHTML = `<p class="data-manager-loading">No application data found in your Google Drive.</p>`;
    } else {
      this.deleteAllBtn.disabled = false; // Enable the delete button only if there are files
      this.contentEl.innerHTML = `<ul id="data-manager-file-list">${fileList.map(file => `<li>${file.name}</li>`).join('')}</ul>`;
    }
  }

  hide() {
    this.containerEl.classList.add('hidden');
    // Also clear the content so it's fresh next time
    this.containerEl.innerHTML = '';
  }
  
  async handleDeleteAll() {
    // 1. Hide both modals immediately.
    this.hide();
    this.app.settingsPalette.hide();

    // 2. Now show the confirmation modal on a clean screen.
    const isConfirmed = await this.app.confirmationModal.show(
      'Delete All Cloud Data?',
      'This will permanently delete all application data from your Google Drive and disconnect the app. This cannot be undone.'
    );
    if (isConfirmed) {
        await this.app.syncService.deleteAllCloudFiles();
    }
  }
}