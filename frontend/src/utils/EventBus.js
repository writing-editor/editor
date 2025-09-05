/**
 * A simple publish-subscribe event bus for decoupled communication.
 * This will be used for features like background sync notifications.
 */
export class EventBus {
    constructor() {
        this.events = {};
    }

    /**
     * Subscribe to an event.
     * @param {string} eventName - The name of the event to listen for.
     * @param {Function} callback - The function to call when the event is published.
     */
    subscribe(eventName, callback) {
        if (!this.events[eventName]) {
            this.events[eventName] = [];
        }
        this.events[eventName].push(callback);
    }

    /**
     * Publish an event to all its subscribers.
     * @param {string} eventName - The name of the event to publish.
     * @param {*} data - The data to pass to the subscribers' callback functions.
     */
    publish(eventName, data) {
        if (this.events[eventName]) {
            this.events[eventName].forEach(callback => callback(data));
        }
    }

    /**
     * Unsubscribe from an event.
     * @param {string} eventName - The name of the event.
     * @param {Function} callback - The specific callback to remove.
     */
    unsubscribe(eventName, callback) {
        if (this.events[eventName]) {
            this.events[eventName] = this.events[eventName].filter(cb => cb !== callback);
        }
    }
}