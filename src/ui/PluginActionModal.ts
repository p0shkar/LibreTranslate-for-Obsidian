import { App, Modal } from "obsidian";

interface PluginAction {
    id: string;
    title: string;
    description: string;
    buttonLabel?: string;
    run: () => Promise<void>;
}

export class PluginActionModal extends Modal {
    private readonly actions: PluginAction[];
    private readonly titleText: string;

    constructor(app: App, title: string, actions: PluginAction[]) {
        super(app);
        this.titleText = title;
        this.actions = actions;
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();
        this.titleEl.setText(this.titleText);

        const list = contentEl.createEl("div", { cls: "plugin-action-list" });

        for (const action of this.actions) {
            const row = list.createEl("div", { cls: "plugin-action-item" });
            const titleRow = row.createEl("div", { cls: "plugin-action-row" });
            titleRow.createEl("div", { cls: "plugin-action-title", text: action.title });
            const button = titleRow.createEl("button", {
                text: action.buttonLabel ?? "Run",
                cls: "mod-cta plugin-action-button"
            });
            row.createEl("div", { cls: "plugin-action-desc", text: action.description });
            button.onclick = async () => {
                await action.run();
                this.close();
            };
        }
    }

    onClose(): void {
        this.contentEl.empty();
    }
}
