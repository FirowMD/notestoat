<script lang="ts">
  import DOMPurify from 'dompurify';
  import { isTauri } from '@tauri-apps/api/core';
  import { openUrl } from '@tauri-apps/plugin-opener';
  import { FileText } from '@lucide/svelte';
  import { compileMarkdown } from './markdown/renderer';
  import './markdown/preview.css';

  export let content = '';
  export let fileName = 'Untitled';

  const languageNames: Record<string, string> = {
    bat: 'Batch',
    bash: 'Shell',
    batch: 'Batch',
    cmd: 'Batch',
    csharp: 'C#',
    cs: 'C#',
    cpp: 'C++',
    html: 'HTML',
    js: 'JavaScript',
    javascript: 'JavaScript',
    jsx: 'JSX',
    md: 'Markdown',
    plaintext: 'Plain text',
    ps1: 'PowerShell',
    powershell: 'PowerShell',
    pwsh: 'PowerShell',
    py: 'Python',
    rs: 'Rust',
    sh: 'Shell',
    shell: 'Shell',
    ts: 'TypeScript',
    tsx: 'TSX',
    typescript: 'TypeScript',
    xml: 'HTML/XML',
    yaml: 'YAML',
    yml: 'YAML'
  };

  function renderMarkdown(source: string): string {
    return DOMPurify.sanitize(compileMarkdown(source), {
      USE_PROFILES: { html: true }
    });
  }

  function getLanguageName(code: HTMLElement): string {
    const languageClass = [...code.classList].find((name) => name.startsWith('language-'));
    const language = languageClass?.slice('language-'.length).toLowerCase();
    return language ? languageNames[language] ?? language : 'Code';
  }

  function decorateCodeBlocks(node: HTMLElement): void {
    for (const code of node.querySelectorAll<HTMLElement>('pre > code')) {
      const pre = code.parentElement;
      if (!pre || pre.parentElement?.classList.contains('markdown-code-block')) continue;

      const block = document.createElement('div');
      block.className = 'markdown-code-block';

      const toolbar = document.createElement('div');
      toolbar.className = 'markdown-code-toolbar';

      const language = document.createElement('span');
      language.className = 'markdown-code-language';
      language.textContent = getLanguageName(code);

      const copyButton = document.createElement('button');
      copyButton.type = 'button';
      copyButton.className = 'markdown-copy-button';
      copyButton.dataset.copyCode = '';
      copyButton.textContent = 'Copy';
      copyButton.setAttribute('aria-label', `Copy ${language.textContent} code`);

      toolbar.append(language, copyButton);
      pre.before(block);
      block.append(toolbar, pre);
    }
  }

  async function copyText(text: string): Promise<void> {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.append(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    textarea.remove();

    if (!copied) throw new Error('Clipboard is unavailable');
  }

  function enhancePreview(node: HTMLElement, html: string) {
    const resetTimers = new Set<number>();

    function scheduleDecoration(): void {
      queueMicrotask(() => decorateCodeBlocks(node));
    }

    async function handleClick(event: MouseEvent): Promise<void> {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const copyButton = target.closest<HTMLButtonElement>('[data-copy-code]');
      if (copyButton) {
        const code = copyButton.closest('.markdown-code-block')?.querySelector('code');
        if (!code) return;

        try {
          await copyText(code.textContent?.replace(/\n$/, '') ?? '');
          copyButton.textContent = 'Copied';
          copyButton.dataset.state = 'copied';
        } catch {
          copyButton.textContent = 'Failed';
          copyButton.dataset.state = 'error';
        }

        const timer = window.setTimeout(() => {
          if (copyButton.isConnected) {
            copyButton.textContent = 'Copy';
            delete copyButton.dataset.state;
          }
          resetTimers.delete(timer);
        }, 1600);
        resetTimers.add(timer);
        return;
      }

      const link = target.closest<HTMLAnchorElement>('a');
      if (!link) return;

      const href = link.getAttribute('href');
      if (!href || href.startsWith('#')) return;

      if (/^https?:\/\//i.test(href) || /^mailto:/i.test(href)) {
        event.preventDefault();
        if (isTauri()) {
          await openUrl(href);
        } else {
          window.open(href, '_blank', 'noopener,noreferrer');
        }
      }
    }

    node.addEventListener('click', handleClick);
    scheduleDecoration();

    return {
      update(updatedHtml: string) {
        if (updatedHtml !== html) {
          html = updatedHtml;
          scheduleDecoration();
        }
      },
      destroy() {
        node.removeEventListener('click', handleClick);
        for (const timer of resetTimers) window.clearTimeout(timer);
      }
    };
  }

  $: renderedMarkdown = renderMarkdown(content);
</script>

<section class="preview-shell" aria-label={`Preview of ${fileName}`}>
  {#if content.trim()}
    <article class="markdown-preview" use:enhancePreview={renderedMarkdown}>
      {@html renderedMarkdown}
    </article>
  {:else}
    <div class="preview-empty">
      <FileText size={28} strokeWidth={1.5} />
      <p>Nothing to preview</p>
    </div>
  {/if}
</section>
