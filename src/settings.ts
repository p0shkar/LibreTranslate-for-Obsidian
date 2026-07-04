import { App, PluginSettingTab, Setting } from "obsidian";
import LibreTranslatePlugin from "./main";
import { LibreTranslateLanguage } from "./api/LibreTranslateClient";
import { ConfirmModal } from "./ui/ConfirmModal";
import {
    LibreTranslateSettings,
    TranslationOutput,
} from "./types";

export function createDefaultSettings(): LibreTranslateSettings {
    return {
        serverUrl: "https://translate.libregalaxy.org",
        apiKey: "",

        sourceLanguage: "auto",
        targetLanguage: getSystemLocaleLanguage(),

        chunkSize: 2000,
        parallelRequests: 1,
        retryCount: 2,

        translationOutput: "callout",
    };
}

function getSystemLocaleLanguage(): string {
    const locale = typeof navigator !== "undefined" ? navigator.language : "en";

    if (!locale) {
        return "en";
    }

    const match = locale.match(/^[a-z]{2}/i);
    return match ? match[0].toLowerCase() : "en";
}

export class LibreTranslateSettingTab extends PluginSettingTab {
    plugin: LibreTranslatePlugin;
    private languageSection?: HTMLElement;
    private languages: LibreTranslateLanguage[] = [];

    constructor(app: App, plugin: LibreTranslatePlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;

        containerEl.empty();

        containerEl.createEl("h2", {
            text: "LibreTranslate Settings",
        });

        const s = this.plugin.getSettings();

        new Setting(containerEl)
            .setName("Server URL")
            .setDesc("URL to your LibreTranslate server.")
            .addText((text) =>
                text
                    .setPlaceholder("https://translate.libregalaxy.org")
                    .setValue(s.serverUrl)
                    .onChange(async (value) => {
                        s.serverUrl = value.trim();
                        await this.plugin.saveSettings();
                        this.renderLanguageSettings(s);
                        this.loadLanguages(s);
                    })
            );

        new Setting(containerEl)
            .setName("API key")
            .setDesc("Leave empty if your server does not require one.")
            .addText((text) =>
                text
                    .setPlaceholder("Optional")
                    .setValue(s.apiKey)
                    .onChange(async (value) => {
                        s.apiKey = value.trim();
                        await this.plugin.saveSettings();
                    })
            );

        this.languageSection = containerEl.createDiv();
        this.renderLanguageSettings(s);
        this.loadLanguages(s);

        new Setting(containerEl)
            .setName("Refresh language list")
            .setDesc("Reload available languages from the LibreTranslate server.")
            .addButton((button) =>
                button
                    .setButtonText("Refresh")
                    .onClick(async () => {
                        await this.plugin.refreshLanguageList();
                        this.languages = await this.plugin.getLanguageList();
                        this.renderLanguageSettings(s);
                    })
            );

        new Setting(containerEl)
            .setName("Reset LibreTranslate language settings")
            .setDesc("Restore only source and target languages to default values.")
            .addButton((button) =>
                button
                    .setButtonText("Reset")
                    .onClick(async () => {
                        new ConfirmModal(
                            this.app,
                            "Reset LibreTranslate language settings",
                            "Restore only source and target language settings to defaults?",
                            async () => {
                                await this.plugin.resetLanguageSettings();
                                const updated = this.plugin.getSettings();
                                this.renderLanguageSettings(updated);
                                this.display();
                            }
                        ).open();
                    })
            );

        new Setting(containerEl)
            .setName("Chunk size")
            .setDesc("Maximum characters per translation request.")
            .addText((text) =>
                text
                    .setValue(String(s.chunkSize))
                    .onChange(async (value) => {
                        const number = Number(value);

                        if (!Number.isNaN(number) && number > 0) {
                            s.chunkSize = number;
                            await this.plugin.saveSettings();
                        }
                    })
            );

        new Setting(containerEl)
            .setName("Retry count")
            .setDesc("Number of retries if translation fails.")
            .addText((text) =>
                text
                    .setValue(String(s.retryCount))
                    .onChange(async (value) => {
                        const number = Number(value);

                        if (!Number.isNaN(number) && number >= 0) {
                            s.retryCount = number;
                            await this.plugin.saveSettings();
                        }
                    })
            );

        new Setting(containerEl)
            .setName("Translation output")
            .setDesc("Choose how translated text should be inserted.")
            .addDropdown((dropdown) =>
                dropdown
                    .addOption("replace", "Replace selection")
                    .addOption("callout", "Insert translation callout")
                    .setValue(s.translationOutput)
                    .onChange(async (value) => {
                        s.translationOutput =
                            value as TranslationOutput;

                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName("Reset to defaults")
            .setDesc("Restore all settings to default values.")
            .addButton((button) =>
                button
                    .setButtonText("Reset")
                    .onClick(async () => {
                        await this.plugin.resetSettings();
                        const updated = this.plugin.getSettings();
                        this.renderLanguageSettings(updated);
                        this.display();
                    })
            );
    }

    private renderLanguageSettings(s: LibreTranslateSettings): void {
        if (!this.languageSection) {
            return;
        }

        this.languageSection.empty();

        if (this.languages.length === 0) {
            new Setting(this.languageSection)
                .setName("Source language")
                .setDesc("Use 'auto' for automatic detection.")
                .addText((text) =>
                    text
                        .setPlaceholder("auto")
                        .setValue(s.sourceLanguage)
                        .onChange(async (value) => {
                            s.sourceLanguage = value.trim();
                            await this.plugin.saveSettings();
                        })
                );

            new Setting(this.languageSection)
                .setName("Target language")
                .setDesc("Language code, for example 'sv', 'en' or 'de'.")
                .addText((text) =>
                    text
                        .setPlaceholder("sv")
                        .setValue(s.targetLanguage)
                        .onChange(async (value) => {
                            s.targetLanguage = value.trim();
                            await this.plugin.saveSettings();
                        })
                );

            new Setting(this.languageSection)
                .setName("Language list")
                .setDesc("Fetching available languages from LibreTranslate...");

            return;
        }

        const sourceSetting = new Setting(this.languageSection)
            .setName("Source language")
            .setDesc("Use 'auto' for automatic detection.")
            .addDropdown((dropdown) => {
                dropdown.addOption("auto", "Automatic detection");

                for (const language of this.languages) {
                    dropdown.addOption(language.code, `${language.name} (${language.code})`);
                }

                if (!this.languages.some((language) => language.code === s.sourceLanguage)) {
                    dropdown.addOption(s.sourceLanguage, s.sourceLanguage);
                }

                dropdown.setValue(s.sourceLanguage);
                dropdown.onChange(async (value) => {
                    s.sourceLanguage = value;
                    await this.plugin.saveSettings();
                });
            });

        new Setting(this.languageSection)
            .setName("Target language")
            .setDesc("Select the target language.")
            .addDropdown((dropdown) => {
                for (const language of this.languages) {
                    dropdown.addOption(language.code, `${language.name} (${language.code})`);
                }

                if (!this.languages.some((language) => language.code === s.targetLanguage)) {
                    dropdown.addOption(s.targetLanguage, s.targetLanguage);
                }

                dropdown.setValue(s.targetLanguage);
                dropdown.onChange(async (value) => {
                    s.targetLanguage = value;
                    await this.plugin.saveSettings();
                });
            });
    }

    private async loadLanguages(s: LibreTranslateSettings): Promise<void> {
        if (!this.languageSection) {
            return;
        }

        try {
            this.languages = await this.plugin.getLanguageList();
            this.renderLanguageSettings(s);
        } catch (error) {
            console.error("Failed to load LibreTranslate languages:", error);

            if (!this.languageSection) {
                return;
            }

            this.languageSection.empty();

            new Setting(this.languageSection)
                .setName("Source language")
                .setDesc("Use 'auto' for automatic detection.")
                .addText((text) =>
                    text
                        .setPlaceholder("auto")
                        .setValue(s.sourceLanguage)
                        .onChange(async (value) => {
                            s.sourceLanguage = value.trim();
                            await this.plugin.saveSettings();
                        })
                );

            new Setting(this.languageSection)
                .setName("Target language")
                .setDesc("Language code, for example 'sv', 'en' or 'de'.")
                .addText((text) =>
                    text
                        .setPlaceholder("sv")
                        .setValue(s.targetLanguage)
                        .onChange(async (value) => {
                            s.targetLanguage = value.trim();
                            await this.plugin.saveSettings();
                        })
                );

            new Setting(this.languageSection)
                .setName("Language list")
                .setDesc("Unable to load languages from LibreTranslate.");
        }
    }
}