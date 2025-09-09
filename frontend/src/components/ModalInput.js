export class ModalInput {
  constructor() {
    this.containerEl = document.getElementById('modal-input-container');
    this.boxEl = document.getElementById('modal-input-box');
    this.titleEl = document.getElementById('modal-title');
    this.inputEl = document.getElementById('modal-input');

    this.resolvePromise = null;
    this.containerEl.addEventListener('click', (e) => {
      if (e.target === this.containerEl) this.cancel();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !this.containerEl.classList.contains('hidden')) {
        this.cancel();
      }
    });

    this.inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.submit();
      }
    });
  }

  show(title, placeholder, defaultValue = '') {
    this.titleEl.textContent = title;
    this.inputEl.placeholder = placeholder;
    this.inputEl.value = defaultValue; // Set the value
    this.containerEl.classList.remove('hidden');
    this.inputEl.focus();
    this.inputEl.select();
    return new Promise((resolve) => {
      this.resolvePromise = resolve;
    });
  }

  submit() {
    const value = this.inputEl.value.trim();
    if (this.resolvePromise) {
        this.resolvePromise(value);
    }
    this.hide();
  }

  cancel() {if (this.resolvePromise) {
        this.resolvePromise(null);
    }
    this.hide();
  }

  hide() {
    this.containerEl.classList.add('hidden');
  }
}