import './ConnectivityStatus.css';

export class ConnectivityStatus {
  constructor(controller) {
    this.controller = controller;
    this.element = document.getElementById('connectivity-status-container');
    this.state = 'initializing'; // States: initializing, offline, signed-out, signed-in, syncing
    this.userName = '';

    this.setupEventListeners();
    this.handleConnectionChange();
  }

  setupEventListeners() {
    window.addEventListener('online', () => this.handleConnectionChange());
    window.addEventListener('offline', () => this.handleConnectionChange());

    this.element.addEventListener('click', (e) => {
      const action = e.target.closest('[data-action]');
      if (!action) return;

      if (action.dataset.action === 'sign-in') {
        this.controller.signIn();
      } else if (action.dataset.action === 'sign-out') {
        this.controller.signOut();
      }
    });
  }

  handleConnectionChange() {
    if (!navigator.onLine) {
      this.setState('offline');
    } else {
      // If we regain connection but are not signed in, revert to signed-out state
      if (this.state === 'offline') {
        this.setState('signed-out');
      }
    }
  }

  setState(newState, userName = '') {
    this.state = newState;
    this.userName = userName;
    this.render();
  }

  render() {
    let iconHtml = '';
    let tooltipHtml = '';

    switch (this.state) {
      case 'offline':
        iconHtml = `
          <div class="status-icon is-offline" title="You are offline. Edits are saved locally.">
            <svg viewBox="0 0 24 24"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
          </div>`;
        break;

      case 'signed-out':
        iconHtml = `
          <button class="google-sign-in-btn" data-action="sign-in">
            <svg viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/><path d="M1 1h22v22H1z" fill="none"/></svg>
            
          </button>`;
        break;

      case 'signed-in':
        iconHtml = `
          <div class="status-icon is-online">
            <svg viewBox="0 0 24 24"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"></path></svg>
          </div>`;
        tooltipHtml = `
          <div class="status-tooltip">
            <p>Signed in as ${this.userName}</p>
            <button class="sign-out-btn" data-action="sign-out">Sign Out</button>
          </div>`;
        break;
        
      case 'syncing':
        iconHtml = `
          <div class="status-icon is-syncing" title="Syncing with Google Drive...">
            <svg viewBox="0 0 24 24"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
          </div>`;
        break;
    }

    this.element.innerHTML = iconHtml + tooltipHtml;
  }
}