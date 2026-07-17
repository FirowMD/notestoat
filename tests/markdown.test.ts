declare namespace Deno {
  function test(name: string, testFunction: () => void | Promise<void>): void;
}

// @ts-ignore Deno requires explicit TypeScript extensions.
import { compileMarkdown } from "../src/lib/markdown/renderer.ts";

function assertIncludes(actual: string, expected: string): void {
  if (!actual.includes(expected)) {
    throw new Error(
      `Expected rendered HTML to include ${
        JSON.stringify(expected)
      }.\n${actual}`,
    );
  }
}

Deno.test("Markdown renderer highlights fenced TypeScript code", () => {
  const rendered = compileMarkdown(
    "```typescript\nconst answer: number = 42;\n```",
  );

  assertIncludes(rendered, 'class="hljs language-typescript"');
  assertIncludes(rendered, "hljs-keyword");
  assertIncludes(rendered, "hljs-number");
});

Deno.test("Markdown renderer includes Windows shell languages", () => {
  const powershell = compileMarkdown(
    "```ps1\n$files = Get-ChildItem | Where-Object { $_.Length -gt 0 }\n```",
  );
  const batch = compileMarkdown("```cmd\n@echo off\necho Ready\n```");

  assertIncludes(powershell, 'class="hljs language-ps1"');
  assertIncludes(powershell, "hljs-variable");
  assertIncludes(batch, 'class="hljs language-cmd"');
  assertIncludes(batch, "hljs-built_in");
});

Deno.test("Markdown renderer supports GFM tables, tasks, and strikethrough", () => {
  const rendered = compileMarkdown(
    `| Item | Done |\n| --- | --- |\n| Preview | yes |\n\n- [x] Polish Markdown\n\n~~old~~`,
  );

  assertIncludes(rendered, "<table>");
  assertIncludes(rendered, 'type="checkbox"');
  assertIncludes(rendered, "<del>old</del>");
});

Deno.test("unknown code languages fall back to escaped plain text", () => {
  const rendered = compileMarkdown(
    '```unknown-language\n<script>alert("nope")</script>\n```',
  );

  assertIncludes(rendered, 'class="hljs language-unknown-language"');
  assertIncludes(rendered, "&lt;script&gt;");
});
