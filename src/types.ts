export type TranslationOutput =
    | "replace"
    | "callout";

export interface LibreTranslateSettings {
    serverUrl: string;
    apiKey: string;

    sourceLanguage: string;
    targetLanguage: string;

    chunkSize: number;
    parallelRequests: number;
    retryCount: number;

    translationOutput: TranslationOutput;
}