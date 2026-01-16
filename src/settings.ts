import { App, PluginSettingTab, Setting } from 'obsidian';
import HevyPlugin from './main';

export interface HevyPluginSettings {
    apiKey: string;
    defaultLimit: number;
    weightUnit: 'kg' | 'lbs';
    folderPath: string;
}

export const DEFAULT_SETTINGS: HevyPluginSettings = {
    apiKey: '',
    defaultLimit: 10,
    weightUnit: 'kg',
    folderPath: 'HevyWorkouts'
}

export class HevySettingTab extends PluginSettingTab {
    plugin: HevyPlugin;
    constructor(app: App, plugin: HevyPlugin) { super(app, plugin); this.plugin = plugin; }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();
        containerEl.createEl('h2', { text: 'Hevy for Obsidian Settings' });

        new Setting(containerEl).setName('Hevy API Key').addText(t => t.setValue(this.plugin.settings.apiKey).onChange(async (v) => { this.plugin.settings.apiKey = v; await this.plugin.saveSettings(); }));
        new Setting(containerEl).setName('Weight Unit').addDropdown(d => d.addOption('kg', 'kg').addOption('lbs', 'lbs').setValue(this.plugin.settings.weightUnit).onChange(async (v: 'kg' | 'lbs') => { this.plugin.settings.weightUnit = v; await this.plugin.saveSettings(); }));
        new Setting(containerEl).setName('Export Folder').addText(t => t.setValue(this.plugin.settings.folderPath).onChange(async (v) => { this.plugin.settings.folderPath = v; await this.plugin.saveSettings(); }));
    }
}