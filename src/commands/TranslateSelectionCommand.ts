import { Editor, Notice } from "obsidian";
import LibreTranslatePlugin from "../main";

export class TranslateSelectionCommand {
    plugin: LibreTranslatePlugin;

    constructor(plugin: LibreTranslatePlugin) {
        this.plugin = plugin;
    }

    register(): void {
        this.plugin.addCommand({
            id: "translate-selection",
            name: "Translate selected text",
            hotkeys: [
                {
                    modifiers: ["Mod", "Shift"],
                    key: "T"
                }
            ],
            editorCallback: async (editor: Editor) => {

                const selection = editor.getSelection();

                if (!selection || !selection.trim()) {
                    new Notice("No text selected.");
                    return;
                }

                try {
                    await this.plugin.translateSelection(editor);
                    new Notice("Translation complete.");
                } catch (error) {

                    console.error(error);

                    new Notice(
                        error instanceof Error
                            ? error.message
                            : "Translation failed."
                    );
                }

            }
        });
    }
}