export class IndicatorManager {
    constructor() {
        this.container = document.getElementById('status-indicator-container');
    }

    show(message, options = {}) {
        const { isError = false, duration = null } = options;
        const id = `indicator-${Date.now()}-${Math.random()}`;
        const indicatorEl = document.createElement('div');
        indicatorEl.id = id;
        indicatorEl.className = 'status-indicator-item';
        indicatorEl.textContent = message;
        if (isError) indicatorEl.classList.add('is-error');
        this.container.appendChild(indicatorEl);

        if (duration) {
            setTimeout(() => this.hide(id), duration);
        }
        return id;
    }

    hide(id) {
        const indicatorEl = document.getElementById(id);
        if (indicatorEl) {
            indicatorEl.style.transition = 'opacity 0.5s ease';
            indicatorEl.style.opacity = '0';
            setTimeout(() => indicatorEl.remove(), 500);
        }
    }
}