import './DataManager.css';
import { loadHTML } from '../utils/htmlLoader.js';

export class DataManager {
  constructor(controller) {
    this.controller = controller;
    this.containerEl = document.getElementById('data-manager-modal-container');
  }

  async show() {
    this.containerEl.classList.remove('hidden');
    this.containerEl.innerHTML = await loadHTML('html-templates/data-manager.html');

    this.contentEl = document.getElementById('data-manager-content');
    const modalBox = document.getElementById('data-manager-modal-box');
    
    // Use event delegation for the whole modal
    modalBox.addEventListener('click', (e) => this.handleModalClick(e));

    this.containerEl.addEventListener('click', (e) => {
      if (e.target === this.containerEl) {
        this.hide();
      }
    });

    const fileList = await this.controller.getCloudFileList();

    if (fileList === null) {
      this.contentEl.innerHTML = `<p class="data-manager-error">Could not fetch file list. Please try again.</p>`;
    } else if (fileList.length === 0) {
      this.contentEl.innerHTML = `<p class="data-manager-loading">No application data found in your Google Drive.</p>`;
    } else {
      document.getElementById('data-manager-delete-all-btn').disabled = false;
      this.renderFileList(fileList);
    }
  }
  
  renderFileList(files) {
    // File icon SVG
    const fileIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>`;
    
    this.contentEl.innerHTML = `<ul id="data-manager-file-list">
      ${files.map(file => `
        <li class="data-manager-file-item" data-file-id="${file.id}">
          <div class="file-item-info">
            ${fileIcon}
            <span class="file-item-name" title="${file.name}">${file.name}</span>
          </div>
          <button class="file-item-delete-btn" data-action="delete-single" data-file-id="${file.id}" data-file-name="${file.name}" title="Delete this file">
            <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-2 14H7L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M9 6V4h6v2"></path></svg>
          </button>
        </li>
      `).join('')}
    </ul>`;
  }

  handleModalClick(e) {
    const target = e.target.closest('button');
    if (!target) return;

    const action = target.dataset.action || target.id;
    
    if (action === 'data-manager-delete-all-btn') {
      this.handleDeleteAll();
    } else if (action === 'delete-single') {
      const { fileId, fileName } = target.dataset;
      const listItem = target.closest('.data-manager-file-item');
      this.handleDeleteSingleFile(fileId, fileName, listItem);
    }
  }

  hide() {
    this.containerEl.classList.add('hidden');
    this.containerEl.innerHTML = '';
  }

  async handleDeleteAll() {
    this.hide();
    this.controller.hideSettingsPalette();
    const isConfirmed = await this.controller.confirm(
      'Delete All Cloud Data?',
      'This will permanently delete all application data from your Google Drive and disconnect the app. This cannot be undone.'
    );
    if (isConfirmed) {
      await this.controller.deleteAllCloudFiles();
    }
  }
  
  async handleDeleteSingleFile(fileId, fileName, listItem) {
    const isConfirmed = await this.controller.confirm(
      'Delete Cloud File?',
      `Are you sure you want to permanently delete "${fileName}" from your Google Drive? This cannot be undone.`
    );
    if (isConfirmed) {
      listItem.style.opacity = '0.5'; // Visual feedback
      const success = await this.controller.deleteCloudAndLocalFile(fileId, fileName);
      if (success) {
        listItem.style.transition = 'all 0.3s ease';
        listItem.style.transform = 'translateX(-20px)';
        listItem.style.opacity = '0';
        setTimeout(() => {
            listItem.remove();
            const list = document.getElementById('data-manager-file-list');
            if (list && list.children.length === 0) {
                 this.contentEl.innerHTML = `<p class="data-manager-loading">No application data found in your Google Drive.</p>`;
                 document.getElementById('data-manager-delete-all-btn').disabled = true;
            }
        }, 300);
      } else {
        listItem.style.opacity = '1'; // Revert on failure
      }
    }
  }
}