import { requestUrl, RequestUrlResponse } from "obsidian";
import { LibreTranslateSettings } from "../types";

interface TranslateResponse {
    translatedText: string;
}

interface LibreTranslateError {
    error?: string;
}

export interface LibreTranslateLanguage {
    code: string;
    name: string;
}

export class LibreTranslateClient {
    private readonly settings: LibreTranslateSettings;

    constructor(settings: LibreTranslateSettings) {
        this.settings = settings;
    }

    async translate(text: string): Promise<string> {

        if (!text.trim()) {
            return text;
        }

        const payload = {
            q: text,
            source: this.settings.sourceLanguage,
            target: this.settings.targetLanguage,
            format: "text",
            ...(this.settings.apiKey
                ? { api_key: this.settings.apiKey }
                : {})
        };

        let lastError: Error | undefined;

        const retries = Math.max(
            0,
            this.settings.retryCount ?? 0
        );

        for (let attempt = 0; attempt <= retries; attempt++) {

            try {

                const response = await requestUrl({
                    url: `${this.baseUrl()}/translate`,
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(payload),
                    throw: false
                });

                return this.parseTranslateResponse(response);

            } catch (error) {

                lastError =
                    error instanceof Error
                        ? error
                        : new Error(String(error));

                if (attempt < retries) {
                    await this.delay(500 * (attempt + 1));
                }
            }
        }

        throw lastError ??
            new Error("Translation failed.");
    }

    async getLanguages(): Promise<LibreTranslateLanguage[]> {
        const response = await requestUrl({
            url: `${this.baseUrl()}/languages`,
            method: "GET",
            throw: false
        });

        if (response.status !== 200) {
            const error = response.json as LibreTranslateError;

            if (error?.error) {
                throw new Error(error.error);
            }

            throw new Error(
                `LibreTranslate returned HTTP ${response.status}`
            );
        }

        if (!Array.isArray(response.json)) {
            throw new Error("Invalid response from LibreTranslate.");
        }

        return (response.json as any[])
            .filter(
                (item): item is LibreTranslateLanguage =>
                    item && typeof item.code === "string" && typeof item.name === "string"
            )
            .map((item) => ({
                code: item.code,
                name: item.name,
            }));
    }

    async testConnection(): Promise<boolean> {

        try {

            const response = await requestUrl({
                url: `${this.baseUrl()}/languages`,
                method: "GET",
                throw: false
            });

            return response.status === 200;

        } catch {

            return false;

        }
    }

    private parseTranslateResponse(
        response: RequestUrlResponse
    ): string {

        if (response.status !== 200) {

            const error =
                response.json as LibreTranslateError;

            if (error?.error) {
                throw new Error(error.error);
            }

            throw new Error(
                `LibreTranslate returned HTTP ${response.status}`
            );
        }

        const data =
            response.json as TranslateResponse;

        if (
            !data ||
            typeof data.translatedText !== "string"
        ) {
            throw new Error(
                "Invalid response from LibreTranslate."
            );
        }

        return data.translatedText;
    }

    private baseUrl(): string {
        return this.settings.serverUrl.replace(/\/+$/, "");
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve =>
            window.setTimeout(resolve, ms)
        );
    }
}