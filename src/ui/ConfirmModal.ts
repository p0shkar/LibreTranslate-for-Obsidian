import { App, Modal, Setting } from "obsidian";

export class ConfirmModal extends Modal {
    private readonly titleText: string;
    private readonly message: string;
    private readonly onConfirm: () => Promise<void>;

    constructor(
        app: App,
        title: string,
        message: string,
        onConfirm: () => Promise<void>
    ) {
        super(app);

        this.titleText = title;
        this.message = message;
        this.onConfirm = onConfirm;
    }

    onOpen(): void {
        const { contentEl } = this;

        contentEl.createEl("h2", { text: this.titleText });
        contentEl.createEl("p", { text: this.message });

        const buttonContainer = contentEl.createDiv({ cls: "confirm-modal-buttons" });

        new Setting(buttonContainer)
            .addButton((button) =>
                button
                    .setButtonText("Confirm")
                    .setCta()
                    .onClick(async () => {
                        await this.onConfirm();
                        this.close();
                    })
            )
            .addButton((button) =>
                button
                    .setButtonText("Cancel")
                    .onClick(() => this.close())
            );
    }
}
