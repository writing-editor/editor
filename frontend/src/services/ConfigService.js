import { EventBus } from '../utils/EventBus.js';

export class ConfigService {
    constructor(storageService, eventBus) {
        this.storageService = storageService;
        this.eventBus = eventBus;
        this.config = null;
        this.CONFIG_FILE_NAME = 'config.json';
    }

    async initialize() {
        let configFile = await this.storageService.getFile(this.CONFIG_FILE_NAME);

        if (!configFile) {
            console.log("No config file found, creating a new one from default.");
            const response = await fetch('default-config.json');
            const defaultConfig = await response.json();

            const configToSave = this._stripSecrets(defaultConfig);
            await this.storageService.saveFile(this.CONFIG_FILE_NAME, configToSave);
            this.config = defaultConfig;
        } else {
            this.config = configFile.content;
        }

        this.eventBus.publish('config:updated', this.config);
        return this.config;
    }

    get(path, defaultValue = undefined) {
        if (!this.config) return defaultValue;
        // Reduce the path to the target value
        const value = path.split('.').reduce((acc, part) => acc && acc[part], this.config);
        return value !== undefined ? value : defaultValue;
    }

    // A more advanced getter for nested properties
    getConfig(path) {
        if (!this.config) return undefined;
        return path.split('.').reduce((acc, part) => acc && acc[part], this.config);
    }

    async set(key, value) {
        if (!this.config) {
            console.error("Config not initialized before set.");
            return;
        }
        this.config[key] = value;
        await this.save();
    }

    async setConfig(path, value) {
        if (!this.config) return;
        const keys = path.split('.');
        const lastKey = keys.pop();
        const target = keys.reduce((acc, part) => acc[part], this.config);
        target[lastKey] = value;
        await this.save();
    }

    _stripSecrets(configObject) {
        // Create a deep copy to avoid modifying the in-memory config
        const cleanConfig = JSON.parse(JSON.stringify(configObject));

        // Explicitly set the API key fields to empty strings
        if (cleanConfig.user && cleanConfig.user.api_keys) {
            cleanConfig.user.api_keys.gemini_key = "";
            cleanConfig.user.api_keys.anthropic_key = "";
        }

        return cleanConfig;
    }

    async save() {
        if (!this.config) return;
        const configToSave = this._stripSecrets(this.config);

        await this.storageService.saveFile(this.CONFIG_FILE_NAME, configToSave);
        this.eventBus.publish('config:updated', this.config);
    }
}
