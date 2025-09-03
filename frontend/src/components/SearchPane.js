import './RightDrawer.css';

export class SearchPane {
  constructor(app) {
    this.app = app;
    this.element = document.getElementById('search-drawer');

    this.element.addEventListener('input', (e) => {
      if (e.target.id === 'search-input') {
        this.performSearch(e.target.value);
      }
    });

    this.element.addEventListener('click', (e) => {
      const resultLink = e.target.closest('.search-result-item');
      if (resultLink) {
        e.preventDefault();
        const { filename, viewId } = resultLink.dataset;
        this.app.navigateTo(filename, viewId);
      }
    });
  }

  // Called when the user presses Ctrl+F
  show() {
    this.render();
    this.app.openRightDrawer('search');
    // Use a short timeout to ensure the element is visible before focusing
    setTimeout(() => this.element.querySelector('#search-input')?.focus(), 100);
  }

  performSearch(query) {
    const results = this.app.searchService.search(query);
    this.renderResults(results);
  }

  render() {
    this.element.innerHTML = `
        <div class="search-header">
            <input type="search" id="search-input" placeholder="Search all documents..." />
        </div>
        <div id="search-results-container">
            <p class="search-placeholder">Start typing to find text across all your documents.</p>
        </div>
    `;
  }

  renderResults(results) {
    const container = this.element.querySelector('#search-results-container');
    if (!container) return;

    if (results.length === 0) {
      container.innerHTML = `<p class="search-placeholder">No results found.</p>`;
      return;
    }

    container.innerHTML = results.map(res => `
        <a href="#" class="search-result-item" data-filename="${res.filename}" data-view-id="${res.viewId}">
            <div class="search-result-title">${res.title}</div>
            <div class="search-result-snippet">${res.snippet}</div>
        </a>
    `).join('');
  }
}