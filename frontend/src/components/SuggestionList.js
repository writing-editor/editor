// --- REVISED FILE: src/editor/SuggestionList.js ---

export class SuggestionList {
  constructor({ onSelect }) {
    this.element = document.createElement('div');
    this.element.className = 'suggestion-list';
    // The component is now only created, not appended to the body here.
    
    this.items = []; // Initialize as an empty array
    this.selectedIndex = 0;
    this.onSelect = onSelect;
  }

  render() {
    if (!this.items || this.items.length === 0) {
      this.element.innerHTML = ''; // Keep it empty but don't destroy
      return;
    }

    this.element.innerHTML = this.items.map((item, index) => `
      <button class="suggestion-item ${index === this.selectedIndex ? 'is-selected' : ''}" 
              data-index="${index}">
        ${item.title}
      </button>
    `).join('');

    this.element.querySelectorAll('.suggestion-item').forEach(itemEl => {
        itemEl.addEventListener('mousedown', (e) => {
            e.preventDefault();
            this.selectItem(parseInt(itemEl.dataset.index));
        });
    });
  }

  update(items) {
    this.items = items;
    this.selectedIndex = 0;
    this.render();
  }

  onKeyDown({ event }) {
    if (event.key === 'ArrowUp') {
      this.selectedIndex = (this.selectedIndex + this.items.length - 1) % this.items.length;
      this.render();
      return true;
    }
    if (event.key === 'ArrowDown') {
      this.selectedIndex = (this.selectedIndex + 1) % this.items.length;
      this.render();
      return true;
    }
    if (event.key === 'Enter') {
      this.selectItem(this.selectedIndex);
      return true;
    }
    return false;
  }

  selectItem(index) {
    const item = this.items[index];
    if (item) {
      this.onSelect(item);
    }
  }

  destroy() {
    this.element = null;
  }
}