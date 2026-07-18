import hljs from "highlight.js/lib/common";
// @ts-types="highlight.js"
import batch from "highlight.js/lib/languages/dos";
// @ts-types="highlight.js"
import powershell from "highlight.js/lib/languages/powershell";
import type { LanguageFn } from "highlight.js";
import { Marked } from "marked";
import { markedHighlight } from "marked-highlight";

hljs.registerLanguage("batch", batch as unknown as LanguageFn);
// The bundled grammar uses a supported RegExp keyword pattern that is missing
// from Highlight.js's public LanguageFn type.
hljs.registerLanguage("powershell", powershell as unknown as LanguageFn);

const markdownParser = new Marked(
  markedHighlight({
    emptyLangClass: "hljs",
    langPrefix: "hljs language-",
    highlight(code, language) {
      const normalizedLanguage = language.trim().toLowerCase();

      if (normalizedLanguage && hljs.getLanguage(normalizedLanguage)) {
        return hljs.highlight(code, { language: normalizedLanguage }).value;
      }

      if (!normalizedLanguage) {
        return hljs.highlightAuto(code).value;
      }

      return hljs.highlight(code, { language: "plaintext" }).value;
    },
  }),
);

markdownParser.setOptions({
  async: false,
  breaks: true,
  gfm: true,
});

/**
 * Compiles Markdown to HTML. Callers must sanitize the result before inserting
 * it into the document because Marked intentionally does not sanitize HTML.
 */
export function compileMarkdown(source: string): string {
  return markdownParser.parse(source, { async: false }) as string;
}
