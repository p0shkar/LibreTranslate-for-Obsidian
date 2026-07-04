import { MarkdownView, Plugin, Editor, Notice, Menu } from "obsidian";

import { LibreTranslateSettings } from "./types";
import {
    createDefaultSettings,
    LibreTranslateSettingTab
} from "./settings";

import { LibreTranslateClient, LibreTranslateLanguage } from "./api/LibreTranslateClient";
import { TranslationEngine } from "./engine/TranslationEngine";
import { LanguageSelectionModal } from "./ui/LanguageSelectionModal";
import { ConfirmModal } from "./ui/ConfirmModal";
import { PluginActionModal } from "./ui/PluginActionModal";
import { TranslationHistoryModal } from "./ui/TranslationHistoryModal";

import { TranslateSelectionCommand } from "./commands/TranslateSelectionCommand";
import { TranslateDocumentCommand } from "./commands/TranslateDocumentCommand";

type TranslationHistoryEntry = {
    id: string;
    timestamp: number;
    type: "selection" | "document";
    original: string;
    translated: string;
    filePath?: string;
    range?: {
        from: { line: number; ch: number };
        to: { line: number; ch: number };
    };
    insertionRange?: {
        from: { line: number; ch: number };
        to: { line: number; ch: number };
    };
};

export default class LibreTranslatePlugin extends Plugin {

    private pluginSettings!: LibreTranslateSettings;
    private languageCache: LibreTranslateLanguage[] = [];
    private translationHistory: TranslationHistoryEntry[] = [];

    api!: LibreTranslateClient;
    engine!: TranslationEngine;

    async onload(): Promise<void> {

        console.log("Loading LibreTranslate plugin...");

        this.pluginSettings = Object.assign(
            {},
            createDefaultSettings(),
            await this.loadData()
        );

        this.api = new LibreTranslateClient(this.pluginSettings);

        this.engine = new TranslationEngine(
            this.api,
            this.pluginSettings
        );

        this.addSettingTab(
            new LibreTranslateSettingTab(this.app, this)
        );

        new TranslateSelectionCommand(this).register();
        new TranslateDocumentCommand(this).register();

        this.addCommand({
            id: "open-libretranslate-actions",
            name: "Open LibreTranslate actions",
            callback: async () => {
                await this.openPluginActions();
            }
        });

        this.addCommand({
            id: "show-translation-history",
            name: "Show translation history",
            callback: async () => {
                await this.showTranslationHistory();
            }
        });

        this.addCommand({
            id: "select-target-language",
            name: "Select target language",
            callback: async () => {
                await this.openLanguageSelection("target");
            }
        });

        this.addCommand({
            id: "select-source-language",
            name: "Select source language",
            callback: async () => {
                await this.openLanguageSelection("source");
            }
        });

        this.addCommand({
            id: "refresh-language-list",
            name: "Refresh LibreTranslate language list",
            callback: async () => {
                await this.refreshLanguageList();
                new Notice("LibreTranslate language list refreshed.");
            }
        });

        this.addCommand({
            id: "reset-libretranslate-settings",
            name: "Reset LibreTranslate settings to defaults",
            callback: async () => {
                await this.confirmResetSettings();
            }
        });

        this.addCommand({
            id: "reset-libretranslate-language-settings",
            name: "Reset LibreTranslate language settings",
            callback: async () => {
                await this.confirmResetLanguageSettings();
            }
        });

        const ribbonEl = this.addRibbonIcon(
            "languages",
            "LibreTranslate actions",
            () => {
                // no-op; click handled by onClickEvent
            }
        );

        ribbonEl.onClickEvent(async (event) => {
            await this.openPluginActionMenu(event);
        });

        const statusEl = this.addStatusBarItem();
        statusEl.setText("LibreTranslate");
        statusEl.addClass("mod-clickable");
        statusEl.setAttr("aria-label", "Open LibreTranslate actions");
        statusEl.onClickEvent(async (event) => {
            await this.openPluginActionMenu(event);
        });

        this.registerEvent(
            this.app.workspace.on(
                "editor-menu",
                (menu, editor) => {
                    menu.addItem(item => {
                        item
                            .setTitle("LibreTranslate")
                            .setIcon("languages");

                        const submenu = (item as any).setSubmenu() as Menu;

                        submenu.addItem(translationItem => {
                            translationItem
                                .setTitle("Translation")
                                .setIcon("languages");

                            const translationSubmenu = (translationItem as any).setSubmenu() as Menu;

                            if (editor.getSelection()) {
                                translationSubmenu.addItem(sub =>
                                    sub
                                        .setTitle("Translate selection")
                                        .setIcon("languages")
                                        .onClick(async () => {
                                            await this.translateSelection(editor);
                                        })
                                );
                            }

                            translationSubmenu.addItem(sub =>
                                sub
                                    .setTitle("Translate entire document")
                                    .setIcon("document")
                                    .onClick(async () => {
                                        const view = this.app.workspace.getActiveViewOfType(MarkdownView);

                                        if (!view) {
                                            new Notice("Open a markdown note first.");
                                            return;
                                        }

                                        const activeEditor = view.editor;
                                        await this.translateDocument(activeEditor);
                                    })
                            );

                            translationSubmenu.addItem(sub =>
                                sub
                                    .setTitle("Translation history")
                                    .setIcon("history")
                                    .onClick(async () => {
                                        await this.showTranslationHistory();
                                    })
                            );
                        });

                        submenu.addItem(settingsItem => {
                            settingsItem
                                .setTitle("Settings")
                                .setIcon("settings");

                            const settingsSubmenu = (settingsItem as any).setSubmenu() as Menu;

                            settingsSubmenu.addItem(sub =>
                                sub
                                    .setTitle("Set target language")
                                    .setIcon("languages")
                                    .onClick(async () => {
                                        await this.openLanguageSelection("target");
                                    })
                            );

                            settingsSubmenu.addItem(sub =>
                                sub
                                    .setTitle("Set source language")
                                    .setIcon("languages")
                                    .onClick(async () => {
                                        await this.openLanguageSelection("source");
                                    })
                            );

                            settingsSubmenu.addItem(sub =>
                                sub
                                    .setTitle("Refresh languages")
                                    .setIcon("refresh-cw")
                                    .onClick(async () => {
                                        await this.refreshLanguageList();
                                        new Notice("LibreTranslate language list refreshed.");
                                    })
                            );

                            settingsSubmenu.addItem(sub =>
                                sub
                                    .setTitle("Reset language settings")
                                    .setIcon("reset")
                                    .onClick(async () => {
                                        await this.confirmResetLanguageSettings();
                                    })
                            );

                            settingsSubmenu.addItem(sub =>
                                sub
                                    .setTitle("Reset all settings")
                                    .setIcon("reset")
                                    .onClick(async () => {
                                        await this.confirmResetSettings();
                                    })
                            );
                        });
                    });
                }
            )
        );

        console.log("LibreTranslate plugin loaded.");
    }

    public async translateSelection(editor: Editor): Promise<void> {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        const selection = editor.getSelection();

        if (!selection || !selection.trim()) {
            new Notice("No text selected.");
            return;
        }

        const range = {
            from: editor.getCursor("from"),
            to: editor.getCursor("to")
        };

        const translated = await this.engine.translateMarkdown(selection);
        const replacementText = this.pluginSettings.translationOutput === "callout"
            ? `${selection}\n\n${this.buildCallout(translated)}`
            : translated;

        editor.replaceSelection(replacementText);

        const insertionRange = {
            from: range.from,
            to: editor.getCursor("from")
        };

        this.addTranslationHistory({
            id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            timestamp: Date.now(),
            type: "selection",
            original: selection,
            translated,
            filePath: view?.file?.path,
            range,
            insertionRange
        });
    }

    public async translateDocument(editor: Editor): Promise<void> {
        const original = editor.getValue();

        if (!original || !original.trim()) {
            new Notice("Document is empty.");
            return;
        }

        const notice = new Notice("Translating document...", 0);

        try {
            const translated = await this.engine.translateMarkdown(original);

            if (this.pluginSettings.translationOutput === "callout") {
                const callout = this.buildCallout(translated);
                editor.setValue(`${original.replace(/\s+$/g, "")}\n\n${callout}`);
            } else {
                editor.setValue(translated);
            }

            this.addTranslationHistory({
                id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
                timestamp: Date.now(),
                type: "document",
                original,
                translated,
                filePath: this.app.workspace.getActiveViewOfType(MarkdownView)?.file?.path
            });

            notice.setMessage("Translation complete.");
            window.setTimeout(() => notice.hide(), 2000);
        } catch (error) {
            console.error("Translation failed:", error);
            notice.setMessage(
                error instanceof Error
                    ? error.message
                    : "Translation failed."
            );
            window.setTimeout(() => notice.hide(), 3000);
        }
    }

    public async openPluginActions(): Promise<void> {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!view) {
            new Notice("Open a markdown note first.");
            return;
        }

        const actions = [
            {
                id: "translate-selection",
                title: "Translate selection",
                description: "Translate only the selected text in the current note.",
                buttonLabel: "Translate selection",
                run: async () => {
                    await this.translateSelection(view.editor);
                }
            },
            {
                id: "translate-document",
                title: "Translate document",
                description: "Translate the entire active markdown note.",
                buttonLabel: "Translate document",
                run: async () => {
                    await this.translateDocument(view.editor);
                }
            },
            {
                id: "show-translation-history",
                title: "Translation history",
                description: "Review or undo recent translations.",
                buttonLabel: "View history",
                run: async () => {
                    await this.showTranslationHistory();
                }
            },
            {
                id: "select-target-language",
                title: "Set target language",
                description: "Select the language for translated text.",
                buttonLabel: "Set target",
                run: async () => {
                    await this.openLanguageSelection("target");
                }
            },
            {
                id: "select-source-language",
                title: "Set source language",
                description: "Select the language to translate from.",
                buttonLabel: "Set source",
                run: async () => {
                    await this.openLanguageSelection("source");
                }
            }
        ];

        new PluginActionModal(this.app, "LibreTranslate Actions", actions).open();
    }

    private async openPluginActionMenu(event: MouseEvent): Promise<void> {
        const menu = new Menu(this.app);
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);

        if (view?.editor.getSelection()?.trim()) {
            menu.addItem(item =>
                item
                    .setTitle("Translate selection")
                    .setIcon("languages")
                    .onClick(async () => {
                        await this.translateSelection(view.editor);
                    })
            );
        }

        if (view) {
            menu.addItem(item =>
                item
                    .setTitle("Translate entire document")
                    .setIcon("document")
                    .onClick(async () => {
                        await this.translateDocument(view.editor);
                    })
            );
        }

        menu.addItem(item =>
            item
                .setTitle("Translation history")
                .setIcon("history")
                .onClick(async () => {
                    await this.showTranslationHistory();
                })
        );

        menu.addItem(item =>
            item
                .setTitle("Set target language")
                .setIcon("languages")
                .onClick(async () => {
                    await this.openLanguageSelection("target");
                })
        );

        menu.addItem(item =>
            item
                .setTitle("Set source language")
                .setIcon("languages")
                .onClick(async () => {
                    await this.openLanguageSelection("source");
                })
        );

        menu.showAtMouseEvent(event);
    }

    public async openLanguageSelection(kind: "source" | "target"): Promise<void> {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);

        if (!view) {
            new Notice("Open a markdown note first.");
            return;
        }

        const languages = await this.fetchLanguages();

        if (languages.length === 0) {
            new Notice("Could not load languages from LibreTranslate.");
            return;
        }

        if (kind === "source") {
            const items = [{ code: "auto", name: "Automatic detection" }, ...languages];
            new LanguageSelectionModal(
                this.app,
                "Select source language",
                items,
                this.pluginSettings.sourceLanguage,
                async (code) => {
                    this.pluginSettings.sourceLanguage = code;
                    await this.saveSettings();
                    new Notice(`Source language set to ${code}.`);
                }
            ).open();
        } else {
            new LanguageSelectionModal(
                this.app,
                "Select target language",
                languages,
                this.pluginSettings.targetLanguage,
                async (code) => {
                    this.pluginSettings.targetLanguage = code;
                    await this.saveSettings();
                    new Notice(`Target language set to ${code}.`);
                }
            ).open();
        }
    }

    private async fetchLanguages(): Promise<LibreTranslateLanguage[]> {
        try {
            return await this.api.getLanguages();
        } catch (error) {
            console.error("Failed to fetch LibreTranslate languages:", error);
            return [];
        }
    }

    public buildCallout(text: string): string {
        const lines = text.split("\n");

        return [
            "> [!note] Translation",
            ...lines.map(line => {
                const normalized = line.trimStart();
                if (normalized.startsWith(">")) {
                    return line;
                }
                return `> ${line}`;
            })
        ].join("\n");
    }

    public getSettings(): LibreTranslateSettings {
        return this.pluginSettings;
    }

    public async getLanguageList(): Promise<LibreTranslateLanguage[]> {
        if (this.languageCache.length > 0) {
            return this.languageCache;
        }

        return this.refreshLanguageList();
    }

    public async refreshLanguageList(): Promise<LibreTranslateLanguage[]> {
        try {
            this.languageCache = await this.api.getLanguages();
        } catch (error) {
            console.error("Failed to refresh language list:", error);
            this.languageCache = [];
        }

        return this.languageCache;
    }

    public async resetSettings(): Promise<void> {
        Object.assign(this.pluginSettings, createDefaultSettings());
        this.languageCache = [];
        await this.saveSettings();
    }

    private addTranslationHistory(entry: TranslationHistoryEntry): void {
        this.translationHistory.unshift(entry);
        if (this.translationHistory.length > 50) {
            this.translationHistory.pop();
        }
    }

    public async showTranslationHistory(): Promise<void> {
        new TranslationHistoryModal(
            this.app,
            this.translationHistory,
            async (entry) => {
                await this.undoTranslation(entry.id);
            }
        ).open();
    }

    public async undoTranslation(entryId: string): Promise<void> {
        const entry = this.translationHistory.find(item => item.id === entryId);

        if (!entry) {
            new Notice("Translation history entry not found.");
            return;
        }

        const view = this.app.workspace.getActiveViewOfType(MarkdownView);

        if (!view) {
            new Notice("Open a markdown note first.");
            return;
        }

        if (entry.filePath && view.file?.path !== entry.filePath) {
            new Notice("Open the same note used for this translation to undo it.");
            return;
        }

        const editor = view.editor;

        if (entry.type === "document") {
            editor.setValue(entry.original);
        } else if (entry.type === "selection") {
            if (entry.insertionRange) {
                editor.replaceRange(entry.original, entry.insertionRange.from, entry.insertionRange.to);
            } else if (entry.range) {
                editor.replaceRange(entry.original, entry.range.from, entry.range.to);
            } else {
                new Notice("Selected translation cannot be undone.");
                return;
            }
        } else {
            new Notice("Selected translation cannot be undone.");
            return;
        }

        new Notice("Translation undone.");
        this.translationHistory = this.translationHistory.filter(item => item.id !== entryId);
    }

    public async confirmResetSettings(): Promise<void> {
        new ConfirmModal(
            this.app,
            "Reset LibreTranslate settings",
            "This will restore all LibreTranslate settings to defaults. Continue?",
            async () => {
                await this.resetSettings();
                new Notice("LibreTranslate settings reset to defaults.");
            }
        ).open();
    }

    public async confirmResetLanguageSettings(): Promise<void> {
        new ConfirmModal(
            this.app,
            "Reset LibreTranslate language settings",
            "This will restore only LibreTranslate source and target language settings to defaults. Continue?",
            async () => {
                await this.resetLanguageSettings();
                new Notice("LibreTranslate language settings reset to defaults.");
            }
        ).open();
    }

    async saveSettings(): Promise<void> {
        await this.saveData(this.pluginSettings);
    }

}