import { LibreTranslateClient } from "../api/LibreTranslateClient";
import { ChunkingEngine } from "./ChunkingEngine";
import { MarkdownTranslator } from "../markdown/MarkdownTranslator";
import { LibreTranslateSettings } from "../types";

export type ProgressCallback = (
    completed: number,
    total: number
) => void;

const MAX_CACHE_ENTRIES = 100;

export class TranslationEngine {
    private readonly api: LibreTranslateClient;
    private readonly markdown: MarkdownTranslator;
    private readonly chunker: ChunkingEngine;
    private readonly settings: LibreTranslateSettings;

    private readonly cache = new Map<string, string>();

    private cancelled = false;

    constructor(
        api: LibreTranslateClient,
        settings: LibreTranslateSettings
    ) {
        this.api = api;
        this.settings = settings;

        this.markdown = new MarkdownTranslator(api);
        this.chunker = new ChunkingEngine();
    }

    /**
     * Cancel the currently running translation.
     */
    cancel(): void {
        this.cancelled = true;
    }

    /**
     * Allow new translations.
     */
    resetCancel(): void {
        this.cancelled = false;
    }

    clearCache(): void {
        this.cache.clear();
    }

    cacheSize(): number {
        return this.cache.size;
    }

    /**
     * Translate a markdown document.
     */
    async translateMarkdown(
        markdown: string,
        progress?: ProgressCallback
    ): Promise<string> {

        if (!markdown.trim()) {
            return markdown;
        }

        this.resetCancel();

        const cacheKey = this.createCacheKey(markdown);

        const cached = this.cache.get(cacheKey);
        if (cached !== undefined) {
            return cached;
        }

        const chunks = this.chunker.split(
            markdown,
            this.settings.chunkSize
        );

        const translatedChunks: string[] = [];

        for (let index = 0; index < chunks.length; index++) {

            if (this.cancelled) {
                throw new Error("Translation cancelled.");
            }

            const chunk = chunks[index];

            try {

                const translated =
                    await this.markdown.translate(chunk);

                translatedChunks.push(translated);

            } catch (error) {

                throw new Error(
                    `Failed translating chunk ${index + 1} of ${chunks.length}: ${
                        error instanceof Error
                            ? error.message
                            : String(error)
                    }`
                );

            }

            progress?.(index + 1, chunks.length);
        }

        const result = translatedChunks.join("\n\n");

        this.addToCache(cacheKey, result);

        return result;
    }

    /**
     * Translate plain text.
     */
    async translateText(text: string): Promise<string> {

        if (!text.trim()) {
            return text;
        }

        return this.api.translate(text);
    }

    /**
     * Create a cache key.
     */
    private createCacheKey(text: string): string {

        return [
            this.settings.sourceLanguage,
            this.settings.targetLanguage,
            text
        ].join("::");
    }

    /**
     * Simple FIFO cache.
     */
    private addToCache(
        key: string,
        value: string
    ): void {

        if (this.cache.has(key)) {
            this.cache.delete(key);
        }

        this.cache.set(key, value);

        while (this.cache.size > MAX_CACHE_ENTRIES) {

            const oldest = this.cache.keys().next().value;

            if (!oldest) {
                break;
            }

            this.cache.delete(oldest);
        }
    }
}