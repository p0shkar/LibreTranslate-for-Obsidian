import { LibreTranslateClient } from "../api/LibreTranslateClient";
import { MarkdownTranslator } from "./MarkdownTranslator";

class DummyClient extends LibreTranslateClient {
    constructor() {
        super({
            serverUrl: "https://example.com",
            apiKey: "",
            sourceLanguage: "en",
            targetLanguage: "sv",
            chunkSize: 2000,
            parallelRequests: 1,
            retryCount: 2,
            translationOutput: "replace"
        });
    }

    async translate(text: string): Promise<string> {
        return text.replace(/\btest\b/g, "TEST").replace(/\bthing\b/g, "THING");
    }
}

async function run() {
    const translator = new MarkdownTranslator(new DummyClient());

    const input = "Make a note of something, [[create a link]], or try [the Importer](https://help.obsidian.md/Plugins/Importer)!";
    const result = await translator.translate(input);

    console.log("INPUT:", input);
    console.log("OUTPUT:", result);
}

run().catch(console.error);
