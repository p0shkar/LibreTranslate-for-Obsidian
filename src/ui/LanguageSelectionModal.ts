import { App, Modal, Setting } from "obsidian";
import { LibreTranslateLanguage } from "../api/LibreTranslateClient";

export class LanguageSelectionModal extends Modal {
    private readonly languages: LibreTranslateLanguage[];
    private readonly onChooseLanguage: (code: string) => void;
    private readonly titleText: string;
    private selectedCode: string;

    constructor(
        app: App,
        title: string,
        languages: LibreTranslateLanguage[],
        currentCode: string,
        onChooseLanguage: (code: string) => void
    ) {
        super(app);

        this.languages = languages;
        this.onChooseLanguage = onChooseLanguage;
        this.titleText = title;
        this.selectedCode = currentCode;
    }

    onOpen(): void {
        const { contentEl } = this;

        contentEl.empty();
        contentEl.createEl("h2", { text: this.titleText });

        new Setting(contentEl)
            .setName("Language")
            .setDesc("Choose a language from the list.")
            .addDropdown((dropdown) => {
                for (const language of this.languages) {
                    dropdown.addOption(language.code, `${language.name} (${language.code})`);
                }

                dropdown.setValue(this.selectedCode);
                dropdown.onChange((value) => {
                    this.selectedCode = value;
                });
            });

        const buttonContainer = contentEl.createDiv({ cls: "language-selection-buttons" });

        new Setting(buttonContainer)
            .addButton((button) =>
                button
                    .setButtonText("Confirm")
                    .setCta()
                    .onClick(async () => {
                        await this.onChooseLanguage(this.selectedCode);
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
