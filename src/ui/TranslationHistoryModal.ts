import { App, Modal, WorkspaceLeaf } from "obsidian";

type TranslationHistoryEntry = {
    id: string;
    timestamp: number;
    type: "selection" | "document";
    original: string;
    translated: string;
    filePath?: string;
};

type HistoryAction = (entry: TranslationHistoryEntry) => Promise<void>;

export class TranslationHistoryModal extends Modal {
    private readonly history: TranslationHistoryEntry[];
    private readonly onUndo: HistoryAction;

    constructor(app: App, history: TranslationHistoryEntry[], onUndo: HistoryAction) {
        super(app);
        this.history = history;
        this.onUndo = onUndo;
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();

        this.titleEl.setText("Translation History");

        if (this.history.length === 0) {
            contentEl.createEl("p", { text: "No translation history available." });
            return;
        }

        const list = contentEl.createEl("div", { cls: "translation-history-list" });

        for (const entry of this.history) {
            const row = list.createEl("div", { cls: "translation-history-item" });
            row.createEl("div", { cls: "translation-history-meta", text: `${new Date(entry.timestamp).toLocaleString()} · ${entry.type}` });
            row.createEl("div", { cls: "translation-history-text", text: entry.original.slice(0, 120) });

            const undoButton = row.createEl("button", { text: "Undo", cls: "mod-cta" });
            undoButton.onclick = async () => {
                await this.onUndo(entry);
                this.close();
            };
        }
    }

    onClose(): void {
        this.contentEl.empty();
    }
}
