<script lang="ts">
  import EasyMonacoEditor from '@cloudparker/easy-monaco-editor-svelte';
  import { Columns2, Eye, FileText, Pencil } from '@lucide/svelte';
  import { onDestroy, onMount } from 'svelte';
  import MarkdownPreview from './MarkdownPreview.svelte';
  import { editorStore } from './stores/editor';
  import { fileStore } from './stores/files';
  import { monacoThemeStore } from './stores/monacoTheme';
  import type { MarkdownViewMode } from './types/config';

  let editorRef: HTMLDivElement;
  let containerRef: HTMLElement;
  let workspaceRef: HTMLDivElement;
  let editor: any;
  let monacoApi: any;
  let resizeObserver: ResizeObserver | undefined;
  let editorDisposables: Array<{ dispose: () => void }> = [];

  let previousActiveFileId: string | null = null;
  let isSystemChange = false;
  let editorInitialized = false;
  let lastContentHash = '';
  let splitPercent = 52;

  $: activeFile = $fileStore.files.find(file => file.id === $fileStore.activeFileId);
  $: isMarkdownFile = Boolean(
    activeFile && (
      activeFile.language === 'markdown' ||
      /\.(md|markdown|mdown|mkdn)$/i.test(activeFile.name)
    )
  );
  $: viewMode = $editorStore.markdownViewMode;
  $: effectiveViewMode = isMarkdownFile ? viewMode : 'edit';
  $: editorPaneStyle = effectiveViewMode === 'split'
    ? 'flex-basis: ' + splitPercent + '%'
    : '';
  $: monacoTheme = $monacoThemeStore;

  function hashContent(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash &= hash;
    }
    return hash.toString();
  }

  function setEditorLanguage(language: string) {
    const model = editor?.getModel();
    if (model && monacoApi) {
      monacoApi.editor.setModelLanguage(model, language);
    }
  }

  function setViewMode(mode: MarkdownViewMode) {
    editorStore.setMarkdownViewMode(mode);
    setTimeout(() => editor?.layout(), 0);
  }

  function togglePreview() {
    if (!isMarkdownFile) return;
    setViewMode(viewMode === 'preview' ? 'edit' : 'preview');
  }

  function handleKeydown(event: KeyboardEvent) {
    if (
      (event.ctrlKey || event.metaKey) &&
      event.shiftKey &&
      event.code === 'KeyV' &&
      isMarkdownFile
    ) {
      event.preventDefault();
      togglePreview();
    }
  }

  function updateSplitFromPointer(clientX: number) {
    if (!workspaceRef) return;
    const bounds = workspaceRef.getBoundingClientRect();
    const nextPercent = ((clientX - bounds.left) / bounds.width) * 100;
    splitPercent = Math.max(30, Math.min(72, nextPercent));
  }

  function handleResizeMove(event: PointerEvent) {
    updateSplitFromPointer(event.clientX);
  }

  function stopResize() {
    window.removeEventListener('pointermove', handleResizeMove);
    window.removeEventListener('pointerup', stopResize);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    editor?.layout();
  }

  function startResize(event: PointerEvent) {
    event.preventDefault();
    updateSplitFromPointer(event.clientX);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', handleResizeMove);
    window.addEventListener('pointerup', stopResize);
  }

  function handleResizeKeydown(event: KeyboardEvent) {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      splitPercent = Math.max(30, splitPercent - 4);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      splitPercent = Math.min(72, splitPercent + 4);
    } else {
      return;
    }
    editor?.layout();
  }

  $: {
    if (activeFile && editor && editorInitialized) {
      const currentValue = editor.getValue();

      if (currentValue !== activeFile.content) {
        isSystemChange = true;
        editor.setValue(activeFile.content);
        lastContentHash = hashContent(activeFile.content);

        setTimeout(() => {
          isSystemChange = false;
        }, 10);
      }

      editorStore.setLanguage(activeFile.language);
      editorStore.setEncoding(activeFile.encoding, false);
      setEditorLanguage(activeFile.language);
      editorStore.setStats(activeFile.content.length, activeFile.content.split('\n').length);
      editorStore.setCursor(activeFile.cursor.line, activeFile.cursor.column);

      if (previousActiveFileId !== $fileStore.activeFileId) {
        editor.setPosition({
          lineNumber: activeFile.cursor.line,
          column: activeFile.cursor.column
        });
        editor.revealPosition({
          lineNumber: activeFile.cursor.line,
          column: activeFile.cursor.column
        });
        previousActiveFileId = $fileStore.activeFileId;
      }
    } else if (!activeFile && editor && editorInitialized) {
      isSystemChange = true;
      editor.setValue('');
      setEditorLanguage('plaintext');
      editorStore.setLanguage('plaintext');
      editorStore.setStats(0, 0);
      lastContentHash = '';
      previousActiveFileId = null;
      setTimeout(() => {
        isSystemChange = false;
      }, 10);
    }
  }

  $: if (editor && editorInitialized) {
    editor.updateOptions({
      wordWrap: $editorStore.wordWrap ? 'on' : 'off',
      renderWhitespace: $editorStore.showInvisibles ? 'all' : 'none',
      fontSize: $editorStore.fontSize
    });
  }

  const handleMonaco = async (monaco: any) => {
    if (!monaco || !editorRef) return;

    monacoApi = monaco;
    monacoThemeStore.setMonaco(monaco);

    const currentTheme = $monacoThemeStore || 'Firow';

    if (
      currentTheme &&
      currentTheme !== 'vs' &&
      currentTheme !== 'vs-dark' &&
      currentTheme !== 'hc-black'
    ) {
      await monacoThemeStore.setTheme(currentTheme, false);
    }

    editor = monaco.editor.create(editorRef, {
      value: '',
      language: 'markdown',
      theme: currentTheme || 'Firow',
      fontSize: $editorStore.fontSize,
      fontLigatures: true,
      wordWrap: $editorStore.wordWrap ? 'on' : 'off',
      renderWhitespace: $editorStore.showInvisibles ? 'all' : 'none',
      scrollBeyondLastLine: false,
      renderLineHighlight: 'line',
      lineNumbersMinChars: 3,
      padding: { top: 0 },
      minimap: {
        enabled: false
      }
    });

    const currentFile = $fileStore.files.find(file => file.id === $fileStore.activeFileId);
    if (currentFile) {
      isSystemChange = true;
      editor.setValue(currentFile.content);
      setEditorLanguage(currentFile.language);
      lastContentHash = hashContent(currentFile.content);
      setTimeout(() => {
        isSystemChange = false;
      }, 10);
    }

    editorInitialized = true;

    editorDisposables.push(
      editor.getModel().onDidChangeContent(() => {
        const value = editor.getValue();
        const currentHash = hashContent(value);

        if ($fileStore.activeFileId) {
          fileStore.updateFile($fileStore.activeFileId, {
            content: value,
            modified: new Date()
          });

          if (!isSystemChange && currentHash !== lastContentHash) {
            const editedFile = $fileStore.files.find(file => file.id === $fileStore.activeFileId);
            if (editedFile && (editedFile.path || value.trim() !== '')) {
              fileStore.markAsModified($fileStore.activeFileId);
            }
            lastContentHash = currentHash;
          }
        }

        const hasCarriageReturn = value.includes('\r');
        const hasLineFeed = value.includes('\n');

        if (hasCarriageReturn && hasLineFeed) {
          editorStore.setLineEnding('CRLF');
        } else if (hasLineFeed) {
          editorStore.setLineEnding('LF');
        } else if (hasCarriageReturn) {
          editorStore.setLineEnding('CR');
        }

        editorStore.setStats(value.length, editor.getModel().getLineCount());
      }),
      editor.onDidChangeCursorPosition((event: any) => {
        editorStore.setCursor(event.position.lineNumber, event.position.column);

        if ($fileStore.activeFileId) {
          fileStore.updateFile($fileStore.activeFileId, {
            cursor: {
              line: event.position.lineNumber,
              column: event.position.column
            }
          });
        }
      }),
      editor.getModel().onDidChangeLanguage((event: any) => {
        editorStore.setLanguage(event.newLanguage);
      })
    );

    resizeObserver = new ResizeObserver(() => {
      editor?.layout();
    });
    resizeObserver.observe(containerRef);
  };

  onMount(() => {
    window.addEventListener('keydown', handleKeydown);
  });

  onDestroy(() => {
    window.removeEventListener('keydown', handleKeydown);
    stopResize();
    resizeObserver?.disconnect();
    editorDisposables.forEach(disposable => disposable.dispose());
    editorDisposables = [];
    editor?.dispose();
  });
</script>

<div class="editor-surface">
  {#if isMarkdownFile}
    <div class="markdown-toolbar">
      <div class="document-kind">
        <FileText size={15} />
        <span>Markdown</span>
      </div>

      <div class="view-switcher" role="group" aria-label="Markdown view">
        <button
          type="button"
          class:active={viewMode === 'edit'}
          aria-pressed={viewMode === 'edit'}
          onclick={() => setViewMode('edit')}
          title="Edit Markdown"
        >
          <Pencil size={14} />
          <span>Edit</span>
        </button>
        <button
          type="button"
          class:active={viewMode === 'split'}
          aria-pressed={viewMode === 'split'}
          onclick={() => setViewMode('split')}
          title="Split editor and preview"
        >
          <Columns2 size={14} />
          <span>Split</span>
        </button>
        <button
          type="button"
          class:active={viewMode === 'preview'}
          aria-pressed={viewMode === 'preview'}
          onclick={() => setViewMode('preview')}
          title="Preview Markdown (Ctrl+Shift+V)"
        >
          <Eye size={14} />
          <span>Preview</span>
        </button>
      </div>
    </div>
  {/if}

  <div
    class="editor-workspace mode-{effectiveViewMode}"
    bind:this={workspaceRef}
  >
    <section
      class="editor-pane"
      class:visually-hidden-pane={effectiveViewMode === 'preview'}
      style={editorPaneStyle}
      aria-label="Text editor"
      aria-hidden={effectiveViewMode === 'preview'}
      bind:this={containerRef}
    >
      <EasyMonacoEditor onLoad={handleMonaco}>
        <div class="editor-host" bind:this={editorRef}></div>
      </EasyMonacoEditor>
    </section>

    {#if isMarkdownFile && effectiveViewMode === 'split'}
      <!-- svelte-ignore a11y_no_noninteractive_tabindex a11y_no_noninteractive_element_interactions -->
      <div
        class="split-resizer"
        role="separator"
        aria-label="Resize editor and preview"
        aria-orientation="vertical"
        aria-valuemin="30"
        aria-valuemax="72"
        aria-valuenow={Math.round(splitPercent)}
        tabindex="0"
        onpointerdown={startResize}
        onkeydown={handleResizeKeydown}
      ></div>
    {/if}

    {#if isMarkdownFile && effectiveViewMode !== 'edit'}
      <div class="preview-pane">
        <MarkdownPreview
          content={activeFile?.content || ''}
          fileName={activeFile?.name || 'Untitled'}
        />
      </div>
    {/if}
  </div>

  <div class="status-bar">
    <div class="status-group status-document">
      <span class="language-status">{$editorStore.language}</span>
      <span>{$editorStore.stats.lines} lines</span>
      <span>{$editorStore.stats.length} characters</span>
    </div>
    <div class="status-group status-position">
      <span>Ln {$editorStore.cursor.line}, Col {$editorStore.cursor.column}</span>
      <span>{$editorStore.lineEnding}</span>
      <span class="encoding-status">{$editorStore.encoding}</span>
    </div>
  </div>
</div>

<style>
  .editor-surface {
    position: relative;
    z-index: 10;
    display: flex;
    width: 100%;
    height: 100%;
    min-width: 0;
    min-height: 0;
    flex-direction: column;
    background: var(--color-surface-950);
  }

  .markdown-toolbar {
    display: flex;
    min-height: 38px;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0 0.65rem 0 0.85rem;
    border-bottom: 1px solid color-mix(in oklab, var(--color-surface-500) 32%, transparent);
    background: color-mix(in oklab, var(--color-surface-900) 94%, black);
    color: var(--color-surface-200);
  }

  .document-kind {
    display: flex;
    min-width: 0;
    align-items: center;
    gap: 0.45rem;
    font-size: 0.75rem;
    font-weight: 600;
  }

  .document-kind :global(svg) {
    color: var(--color-primary-300);
  }

  .view-switcher {
    display: inline-flex;
    height: 28px;
    align-items: stretch;
    padding: 2px;
    border: 1px solid color-mix(in oklab, var(--color-surface-500) 38%, transparent);
    border-radius: 5px;
    background: var(--color-surface-950);
  }

  .view-switcher button {
    display: inline-flex;
    min-width: 4.7rem;
    align-items: center;
    justify-content: center;
    gap: 0.35rem;
    padding: 0 0.55rem;
    border: 0;
    border-radius: 3px;
    background: transparent;
    color: var(--color-surface-400);
    font: inherit;
    font-size: 0.72rem;
    cursor: pointer;
  }

  .view-switcher button:hover {
    color: var(--color-surface-100);
    background: color-mix(in oklab, var(--color-surface-700) 45%, transparent);
  }

  .view-switcher button:focus-visible,
  .split-resizer:focus-visible {
    outline: 2px solid var(--color-primary-400);
    outline-offset: 1px;
  }

  .view-switcher button.active {
    background: var(--color-primary-700);
    color: var(--color-primary-50);
  }

  .editor-workspace {
    display: flex;
    min-width: 0;
    min-height: 0;
    flex: 1;
    overflow: hidden;
  }

  .editor-pane,
  .preview-pane {
    position: relative;
    min-width: 0;
    min-height: 0;
  }

  .editor-pane {
    flex: 1 1 auto;
  }

  .mode-split .editor-pane {
    flex-grow: 0;
    flex-shrink: 0;
  }

  .preview-pane {
    flex: 1 1 0;
  }

  .visually-hidden-pane {
    display: none;
  }

  .editor-host {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }

  .split-resizer {
    position: relative;
    z-index: 2;
    width: 5px;
    flex: 0 0 5px;
    cursor: col-resize;
    padding: 0;
    border: 0;
    background: var(--color-surface-800);
  }

  .split-resizer::after {
    position: absolute;
    inset: 0 1px;
    background: transparent;
    content: '';
    transition: background 120ms ease;
  }

  .split-resizer:hover::after,
  .split-resizer:focus-visible::after {
    background: var(--color-primary-500);
  }

  .status-bar {
    display: flex;
    min-height: 24px;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0 0.65rem;
    border-top: 1px solid color-mix(in oklab, var(--color-primary-400) 35%, transparent);
    background: var(--color-primary-900);
    color: var(--color-primary-50);
    font-size: 0.7rem;
  }

  .status-group {
    display: flex;
    min-width: 0;
    align-items: center;
  }

  .status-group span {
    white-space: nowrap;
  }

  .status-group span + span {
    margin-left: 0.7rem;
    padding-left: 0.7rem;
    border-left: 1px solid color-mix(in oklab, var(--color-primary-200) 35%, transparent);
  }

  .language-status,
  .encoding-status {
    text-transform: uppercase;
  }

  @media (max-width: 680px) {
    .editor-workspace.mode-split {
      flex-direction: column;
    }

    .mode-split .editor-pane {
      flex: 1 1 0 !important;
    }

    .mode-split .preview-pane {
      border-top: 3px solid var(--color-surface-800);
    }

    .split-resizer {
      display: none;
    }

    .view-switcher button {
      min-width: 2.25rem;
      padding: 0 0.4rem;
    }

    .view-switcher button span,
    .status-document span:not(.language-status),
    .status-position span:not(.encoding-status) {
      display: none;
    }
  }
</style>
