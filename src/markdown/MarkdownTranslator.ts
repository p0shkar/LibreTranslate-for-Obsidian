import { LibreTranslateClient } from "../api/LibreTranslateClient";

type PatternDef = { pattern: string; flags?: string; desc: string; example: string };

export class MarkdownTranslator {

    private readonly api: LibreTranslateClient;
    private readonly placeholders = new Map<string, string>();
    private placeholderIndex = 0;

    // Centralized pattern definitions (keeps order explicit and adds examples)
    private static readonly PATTERN_DEFINITIONS: PatternDef[] = [
        { pattern: '^---\\n[\\s\\S]*?\\n---', flags: 'm', desc: 'YAML frontmatter block', example: '---\ntitle: Foo\n---' },
        { pattern: '```[\\s\\S]*?```', flags: 'g', desc: 'Fenced code block', example: '```js\nconsole.log("hi")\n```' },
        { pattern: '\\\$\\$[\\s\\S]*?\\$\\$', flags: 'g', desc: 'Display math block', example: '$$E=mc^2$$' },
        { pattern: '<[^>]+>[\s\S]*?<\/[^>]+>', flags: 'g', desc: 'HTML block', example: '<div>Hello</div>' },
        { pattern: '^>+\\s*\\[![^\\]]+\\].*$', flags: 'gm', desc: 'Obsidian callout marker line (supports nested callouts)', example: '> [!note]' },
        { pattern: '^>+\\s+', flags: 'gm', desc: 'Markdown blockquote prefix', example: '> ' },
        { pattern: '!\[\[[^\]]+\]\]', flags: 'g', desc: 'Embedded wiki image', example: '![[image.png]]' },
        { pattern: '\\\[\\[[^\\[\\]]+\\]\\](?!\\])', flags: 'g', desc: 'Obsidian wiki link', example: '[[some text]]' },
        { pattern: '!\\[[^\\]]*\\]\\([^\\)]+\\)', flags: 'g', desc: 'Markdown image', example: '![alt](image.png)' },
        { pattern: '\\[[^\\]]+\\]\\([^\\)]+\\)', flags: 'g', desc: 'Markdown link', example: '[text](https://example.com)' },
        { pattern: '\\[[^\\]]+\\]\\[[^\\]]+\\]', flags: 'g', desc: 'Reference-style link', example: '[text][id]' },
        { pattern: '^\\[[^\\]]+\\]:\\s+\\S.*$', flags: 'gm', desc: 'Link reference definition', example: '[id]: https://example.com' },
        { pattern: '`[^`\\n]+`', flags: 'g', desc: 'Inline code', example: '`code`' },
        { pattern: '\\\$(?!\\$)(?:\\\\.|[^$\\n])+\\$', flags: 'g', desc: 'Inline math', example: '$x^2$' },
        { pattern: 'https?:\\/\\/\\S+', flags: 'g', desc: 'Raw URL', example: 'https://example.com' },
        { pattern: '#[\\p{L}\\p{N}_\\/\-]+', flags: 'gu', desc: 'Obsidian tag or hashtag', example: '#tag' },
    ];

    constructor(api: LibreTranslateClient) {
        this.api = api;
    }

    /**
     * Protect markdown → translate → restore.
     */
    async translate(markdown: string): Promise<string> {
        if (!markdown.trim()) return markdown;

        this.reset();

        // Split the document into protected and translatable segments.
        const segments = this.splitIntoSegments(markdown);

        let result = '';
        let pendingRightSpace = false;

        for (const seg of segments) {
            if (seg.protected) {
                // ensure left space if original had it and result doesn't end with whitespace
                if (seg.leftSpace && result.length > 0 && !/\s$/.test(result)) {
                    result += ' ';
                }

                result += seg.text;

                // mark if the protected segment originally had a right-space
                pendingRightSpace = !!seg.rightSpace;
            } else {
                const preserved = this.preserveInlineFormatting(seg.text);
                const translated = await this.api.translate(preserved);
                const restored = this.restore(translated);

                let part = restored;
                if (pendingRightSpace && part.length > 0 && !/^\s/.test(part)) {
                    part = ' ' + part;
                }

                result += part;
                pendingRightSpace = false;
            }
        }

        return result;
    }

    /**
     * Preserve inline markdown formatting markers while translating.
     */
    private preserveInlineFormatting(text: string): string {
        // Do not preserve inline formatting markers (bold/italic) so their
        // contents are translated. Returning the original text keeps markers
        // in place and allows translation of the enclosed text.
        return text;
    }

    /**
     * Protect markdown elements that should never be translated.
     */
    private protect(text: string): string {
        let result = text;

        for (const def of MarkdownTranslator.PATTERN_DEFINITIONS) {
            const regex = new RegExp(def.pattern, def.flags || '');
            // Reset lastIndex for safety when reusing global regexes
            if ((regex as any).lastIndex !== undefined) (regex as any).lastIndex = 0;
            result = result.replace(regex, (match: string) => this.store(match));
        }

        return result;
    }

    /**
     * Store protected content using a token that is unlikely to be altered by translation.
     */
    private store(value: string): string {
        const token = this.createPlaceholderToken(this.placeholderIndex++);
        this.placeholders.set(token, value);
        return token;
    }

    private createPlaceholderToken(index: number): string {
        // Use a placeholder token that avoids markdown formatting markers and common punctuation
        // '§' is unlikely to be altered by translators.
        return `§§LT${Date.now()}_${index}§§`;
    }

    /**
     * Restore all placeholders in the translated text.
     */
    private restore(text: string): string {
        let result = text;
        // Replace tokens in insertion order (should be stable)
        for (const [token, value] of this.placeholders) {
            result = result.split(token).join(value);
        }
        return result;
    }

    /**
     * Split text into segments where protected parts (code, links, images, etc.)
     * are marked and returned alongside translatable segments.
     */
    private splitIntoSegments(text: string): Array<{ protected: boolean; text: string; leftSpace?: boolean; rightSpace?: boolean }> {
        const segments: Array<{ protected: boolean; text: string; leftSpace?: boolean; rightSpace?: boolean }> = [];

        // Build regex union from pattern defs (use lastIndex-safe individual regexes)
        let cursor = 0;
        while (cursor < text.length) {
            let earliestMatch: { start: number; end: number; text: string } | null = null;

            for (const def of MarkdownTranslator.PATTERN_DEFINITIONS) {
                const regex = new RegExp(def.pattern, def.flags || '');
                regex.lastIndex = cursor;
                const m = regex.exec(text);
                if (m && m.index >= cursor) {
                    const start = m.index;
                    const end = start + m[0].length;
                    if (!earliestMatch || start < earliestMatch.start) {
                        earliestMatch = { start, end, text: m[0] };
                    }
                }
            }

            if (!earliestMatch) {
                // no more protected matches — rest is translatable
                segments.push({ protected: false, text: text.slice(cursor) });
                break;
            }

            if (earliestMatch.start > cursor) {
                // push preceding translatable segment
                segments.push({ protected: false, text: text.slice(cursor, earliestMatch.start) });
            }

            // compute original surrounding whitespace flags
            let start = earliestMatch.start;
            let end = earliestMatch.end;

            // Expand end to include trailing punctuation directly adjacent to the match
            while (end < text.length && /[.,;:!?)]/.test(text[end])) {
                end += 1;
            }

            // Recompute the protected text slice (may include punctuation)
            const protectedText = text.slice(start, end);

            const leftChar = start > 0 ? text[start - 1] : undefined;
            const rightChar = end < text.length ? text[end] : undefined;
            const leftSpace = leftChar !== undefined && /\s/.test(leftChar);
            const rightSpace = rightChar !== undefined && /\s/.test(rightChar);

            // push protected segment with spacing metadata
            segments.push({ protected: true, text: protectedText, leftSpace, rightSpace });

            cursor = end;
        }

        return segments;
    }

    /**
     * Reset translator state between runs.
     */
    private reset(): void {
        this.placeholders.clear();
        this.placeholderIndex = 0;
    }
}
