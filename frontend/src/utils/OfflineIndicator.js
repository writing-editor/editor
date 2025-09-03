export class OfflineIndicator {
  constructor() {
    this.indicatorEl = null;
    this.createIndicatorElement();

    window.addEventListener('online', () => this.handleConnectionChange());
    window.addEventListener('offline', () => this.handleConnectionChange());

    this.handleConnectionChange();
  }

  createIndicatorElement() {
    this.indicatorEl = document.createElement('div');
    this.indicatorEl.id = 'offline-indicator';

    this.indicatorEl.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"></path>
        <line x1="1" y1="1" x2="23" y2="23"></line>
      </svg>
    `;
    document.body.appendChild(this.indicatorEl);
  }

  handleConnectionChange() {
    if (navigator.onLine) {
      this.hide();
    } else {
      this.show();
    }
  }

  show() {
    // Add a tooltip for accessibility
    this.indicatorEl.title = "You are currently offline. Edits are saved locally.";
    this.indicatorEl.classList.add('is-visible');
  }

  hide() {
    this.indicatorEl.classList.remove('is-visible');
  }
}