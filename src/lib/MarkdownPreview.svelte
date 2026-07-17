<script lang="ts">
  import DOMPurify from 'dompurify';
  import { marked } from 'marked';
  import { openUrl } from '@tauri-apps/plugin-opener';
  import { isTauri } from '@tauri-apps/api/core';
  import { FileText } from '@lucide/svelte';

  export let content = '';
  export let fileName = 'Untitled';

  function renderMarkdown(source: string): string {
    const rendered = marked.parse(source, {
      async: false,
      breaks: true,
      gfm: true
    }) as string;

    return DOMPurify.sanitize(rendered, {
      USE_PROFILES: { html: true }
    });
  }

  async function handlePreviewClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    const link = target.closest('a');
    if (!link) return;

    const href = link.getAttribute('href');
    if (!href || href.startsWith('#')) return;

    event.preventDefault();

    if (/^https?:\/\//i.test(href) || /^mailto:/i.test(href)) {
      if (isTauri()) {
        await openUrl(href);
      } else {
        window.open(href, '_blank', 'noopener,noreferrer');
      }
    }
  }

  function handlePreviewLinks(node: HTMLElement) {
    node.addEventListener('click', handlePreviewClick);
    return {
      destroy() {
        node.removeEventListener('click', handlePreviewClick);
      }
    };
  }

  $: renderedMarkdown = renderMarkdown(content);
</script>

<section class="preview-shell" aria-label={`Preview of ${fileName}`}>
  {#if content.trim()}
    <article class="markdown-preview" use:handlePreviewLinks>
      {@html renderedMarkdown}
    </article>
  {:else}
    <div class="preview-empty">
      <FileText size={28} strokeWidth={1.5} />
      <p>Nothing to preview</p>
    </div>
  {/if}
</section>

<style>
  .preview-shell {
    width: 100%;
    height: 100%;
    overflow: auto;
    background: color-mix(in oklab, var(--color-surface-950) 94%, black);
    color: var(--color-surface-100);
  }

  .markdown-preview {
    width: min(100%, 52rem);
    min-height: 100%;
    margin: 0 auto;
    padding: 2rem clamp(1.25rem, 4%, 3rem) 4rem;
    font-family: var(--base-font-family);
    font-size: 1rem;
    line-height: 1.7;
    overflow-wrap: anywhere;
  }

  .markdown-preview :global(h1),
  .markdown-preview :global(h2),
  .markdown-preview :global(h3),
  .markdown-preview :global(h4),
  .markdown-preview :global(h5),
  .markdown-preview :global(h6) {
    margin: 1.6em 0 0.65em;
    color: var(--color-surface-50);
    font-weight: 650;
    line-height: 1.25;
    letter-spacing: 0;
  }

  .markdown-preview :global(h1) {
    margin-top: 0;
    padding-bottom: 0.45em;
    border-bottom: 1px solid color-mix(in oklab, var(--color-surface-500) 40%, transparent);
    font-size: 2rem;
  }

  .markdown-preview :global(h2) {
    padding-bottom: 0.35em;
    border-bottom: 1px solid color-mix(in oklab, var(--color-surface-600) 35%, transparent);
    font-size: 1.5rem;
  }

  .markdown-preview :global(h3) { font-size: 1.25rem; }
  .markdown-preview :global(h4) { font-size: 1.05rem; }

  .markdown-preview :global(p),
  .markdown-preview :global(ul),
  .markdown-preview :global(ol),
  .markdown-preview :global(blockquote),
  .markdown-preview :global(pre),
  .markdown-preview :global(table) {
    margin: 0 0 1rem;
  }

  .markdown-preview :global(ul),
  .markdown-preview :global(ol) {
    padding-left: 1.6rem;
  }

  .markdown-preview :global(li + li) {
    margin-top: 0.3rem;
  }

  .markdown-preview :global(a) {
    color: var(--color-primary-300);
    text-decoration: underline;
    text-decoration-color: color-mix(in oklab, var(--color-primary-300) 45%, transparent);
    text-underline-offset: 0.18em;
  }

  .markdown-preview :global(a:hover) {
    color: var(--color-primary-100);
    text-decoration-color: currentColor;
  }

  .markdown-preview :global(blockquote) {
    padding: 0.15rem 1rem;
    border-left: 3px solid var(--color-primary-500);
    color: var(--color-surface-300);
    background: color-mix(in oklab, var(--color-surface-800) 45%, transparent);
  }

  .markdown-preview :global(blockquote > :last-child) {
    margin-bottom: 0;
  }

  .markdown-preview :global(code) {
    padding: 0.14em 0.35em;
    border: 1px solid color-mix(in oklab, var(--color-surface-500) 32%, transparent);
    border-radius: 3px;
    background: var(--color-surface-900);
    color: var(--color-secondary-100);
    font-family: 'Cascadia Code', 'SFMono-Regular', Consolas, monospace;
    font-size: 0.88em;
  }

  .markdown-preview :global(pre) {
    overflow: auto;
    padding: 1rem;
    border: 1px solid color-mix(in oklab, var(--color-surface-500) 30%, transparent);
    border-radius: 5px;
    background: color-mix(in oklab, var(--color-surface-950) 72%, black);
  }

  .markdown-preview :global(pre code) {
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--color-surface-100);
    font-size: 0.875rem;
  }

  .markdown-preview :global(table) {
    display: block;
    width: max-content;
    max-width: 100%;
    overflow: auto;
    border-collapse: collapse;
  }

  .markdown-preview :global(th),
  .markdown-preview :global(td) {
    padding: 0.55rem 0.75rem;
    border: 1px solid color-mix(in oklab, var(--color-surface-500) 42%, transparent);
    text-align: left;
  }

  .markdown-preview :global(th) {
    background: var(--color-surface-900);
    color: var(--color-surface-50);
    font-weight: 600;
  }

  .markdown-preview :global(tr:nth-child(even)) {
    background: color-mix(in oklab, var(--color-surface-800) 32%, transparent);
  }

  .markdown-preview :global(img) {
    display: block;
    max-width: 100%;
    height: auto;
    margin: 1.25rem auto;
    border-radius: 5px;
  }

  .markdown-preview :global(hr) {
    height: 1px;
    margin: 2rem 0;
    border: 0;
    background: color-mix(in oklab, var(--color-surface-500) 42%, transparent);
  }

  .markdown-preview :global(input[type='checkbox']) {
    margin-right: 0.45rem;
    accent-color: var(--color-primary-500);
  }

  .preview-empty {
    display: flex;
    width: 100%;
    height: 100%;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.65rem;
    color: var(--color-surface-500);
  }

  .preview-empty p {
    margin: 0;
    font-size: 0.875rem;
  }

  @media (max-width: 640px) {
    .markdown-preview {
      padding: 1.5rem 1.1rem 3rem;
    }

    .markdown-preview :global(h1) {
      font-size: 1.65rem;
    }
  }
</style>
