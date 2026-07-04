import { Editor, Notice } from "obsidian";
import LibreTranslatePlugin from "../main";

export class TranslateDocumentCommand {
    plugin: LibreTranslatePlugin;

    constructor(plugin: LibreTranslatePlugin) {
        this.plugin = plugin;
    }

    register(): void {
        this.plugin.addCommand({
            id: "translate-document",
            name: "Translate entire document",
            hotkeys: [
                {
                    modifiers: ["Mod", "Shift"],
                    key: "D"
                }
            ],
            editorCallback: async (editor: Editor) => {
                await this.plugin.translateDocument(editor);
            }
        });
    }
}