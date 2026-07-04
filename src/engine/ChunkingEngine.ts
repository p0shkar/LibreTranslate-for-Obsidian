export class ChunkingEngine {

    /**
     * Split a markdown document into chunks that are safe
     * to send to the translation API.
     */
    split(
        text: string,
        maxChunkSize: number = 2000
    ): string[] {

        if (!text.trim()) {
            return [];
        }

        const paragraphs = text.split(/\n\s*\n/);

        const chunks: string[] = [];

        let current = "";

        for (const paragraph of paragraphs) {

            // Large paragraph? Split it first.
            if (paragraph.length > maxChunkSize) {

                if (current) {
                    chunks.push(current);
                    current = "";
                }

                chunks.push(
                    ...this.splitLargeParagraph(
                        paragraph,
                        maxChunkSize
                    )
                );

                continue;
            }

            const candidate =
                current.length === 0
                    ? paragraph
                    : `${current}\n\n${paragraph}`;

            if (candidate.length <= maxChunkSize) {
                current = candidate;
            } else {

                if (current) {
                    chunks.push(current);
                }

                current = paragraph;
            }
        }

        if (current) {
            chunks.push(current);
        }

        return chunks;
    }

    /**
     * Split a paragraph that exceeds the chunk size.
     */
    private splitLargeParagraph(
        paragraph: string,
        maxChunkSize: number
    ): string[] {

        const chunks: string[] = [];

        let remaining = paragraph;

        while (remaining.length > maxChunkSize) {

            let splitAt = remaining.lastIndexOf(
                "\n",
                maxChunkSize
            );

            if (splitAt < maxChunkSize * 0.5) {
                splitAt = remaining.lastIndexOf(
                    " ",
                    maxChunkSize
                );
            }

            if (splitAt < maxChunkSize * 0.5) {
                splitAt = maxChunkSize;
            }

            chunks.push(
                remaining.slice(0, splitAt).trim()
            );

            remaining =
                remaining.slice(splitAt).trimStart();
        }

        if (remaining.length > 0) {
            chunks.push(remaining);
        }

        return chunks;
    }
}