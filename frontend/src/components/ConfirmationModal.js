export class ConfirmationModal {
  constructor() {
    this.containerEl = document.getElementById('confirmation-modal-container');
    this.titleEl = document.getElementById('confirmation-title');
    this.messageEl = document.getElementById('confirmation-message');
    this.confirmBtn = document.getElementById('confirm-btn-confirm');
    this.cancelBtn = document.getElementById('confirm-btn-cancel');

    this.resolvePromise = null;

    this.confirmBtn.addEventListener('click', () => this.submit(true));
    this.cancelBtn.addEventListener('click', () => this.submit(false));
    this.containerEl.addEventListener('click', (e) => {
      if (e.target === this.containerEl) this.submit(false);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !this.containerEl.classList.contains('hidden')) {
        this.submit(false);
      }
    });
  }

  // Promise-based show method, returns true for confirm, false for cancel
  show(title, message) {
    this.titleEl.textContent = title;
    this.messageEl.textContent = message;
    this.containerEl.classList.remove('hidden');
    this.confirmBtn.focus();

    return new Promise((resolve) => {
      this.resolvePromise = resolve;
    });
  }

  submit(value) {
    if (this.resolvePromise) {
      this.resolvePromise(value);
    }
    this.hide();
  }

  hide() {
    this.containerEl.classList.add('hidden');
  }
}