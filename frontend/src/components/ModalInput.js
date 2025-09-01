// In frontend/src/components/ModalInput.js
import './ModalInput.css';

export class ModalInput {
  constructor() {
    this.containerEl = document.getElementById('modal-input-container');
    this.boxEl = document.getElementById('modal-input-box');
    this.titleEl = document.getElementById('modal-title');
    this.inputEl = document.getElementById('modal-input');

    this.resolvePromise = null; // This will hold the 'resolve' function of our promise

    // Event listeners for closing the modal
    this.containerEl.addEventListener('click', (e) => {
      if (e.target === this.containerEl) this.cancel();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !this.containerEl.classList.contains('hidden')) {
        this.cancel();
      }
    });

    // Event listener for submitting
    this.inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.submit();
      }
    });
  }

  // This is a modern way to handle async user input
  show(title, placeholder) {
    this.titleEl.textContent = title;
    this.inputEl.placeholder = placeholder;
    this.inputEl.value = ''; // Clear previous input
    this.containerEl.classList.remove('hidden');
    this.inputEl.focus();

    // We return a Promise that will resolve with the user's input, or null if they cancel.
    return new Promise((resolve) => {
      this.resolvePromise = resolve;
    });
  }

  submit() {
    const value = this.inputEl.value.trim();
    if (value) {
      this.resolvePromise(value);
      this.hide();
    }
    // If input is empty, do nothing, just wait for more input or cancel.
  }

  cancel() {
    this.resolvePromise(null); // Resolve with null to indicate cancellation
    this.hide();
  }

  hide() {
    this.containerEl.classList.add('hidden');
  }
}