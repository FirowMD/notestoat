<script lang="ts">
  import EasyMonacoEditor from '@cloudparker/easy-monaco-editor-svelte';
  import { Columns2, Eye, FilePlus, FileText, FolderOpen, Pencil } from '@lucide/svelte';
  import { onDestroy, onMount } from 'svelte';
  import MarkdownPreview from './MarkdownPreview.svelte';
  import { documentService } from './documents/documentService';
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

  const viewButtonBaseClass = [
    'inline-flex min-w-[4.7rem] cursor-pointer items-center justify-center gap-1.5',
    'rounded-[3px] border-0 px-[0.55rem] text-[0.72rem] transition-colors',
    'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary-400',
    'max-[680px]:min-w-9 max-[680px]:px-1.5'
  ].join(' ');

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

  function getViewButtonClass(isActive: boolean): string {
    const stateClass = isActive
      ? 'bg-primary-700 text-primary-50'
      : 'bg-transparent text-surface-400 hover:bg-surface-700/50 hover:text-surface-100';
    return `${viewButtonBaseClass} ${stateClass}`;
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

<div class="relative z-10 flex h-full min-h-0 w-full min-w-0 flex-col bg-surface-950">
  {#if isMarkdownFile}
    <div
      class="flex min-h-[38px] items-center justify-between gap-3 border-b border-surface-500/30 bg-surface-900 px-[0.65rem] pl-[0.85rem] text-surface-200"
    >
      <div class="flex min-w-0 items-center gap-[0.45rem] text-xs font-semibold">
        <FileText class="text-primary-300" size={15} />
        <span>Markdown</span>
      </div>

      <div
        class="inline-flex h-7 items-stretch rounded-[5px] border border-surface-500/40 bg-surface-950 p-0.5"
        role="group"
        aria-label="Markdown view"
      >
        <button
          type="button"
          class={getViewButtonClass(viewMode === 'edit')}
          aria-pressed={viewMode === 'edit'}
          onclick={() => setViewMode('edit')}
          title="Edit Markdown"
        >
          <Pencil size={14} />
          <span class="max-[680px]:hidden">Edit</span>
        </button>
        <button
          type="button"
          class={getViewButtonClass(viewMode === 'split')}
          aria-pressed={viewMode === 'split'}
          onclick={() => setViewMode('split')}
          title="Split editor and preview"
        >
          <Columns2 size={14} />
          <span class="max-[680px]:hidden">Split</span>
        </button>
        <button
          type="button"
          class={getViewButtonClass(viewMode === 'preview')}
          aria-pressed={viewMode === 'preview'}
          onclick={() => setViewMode('preview')}
          title="Preview Markdown (Ctrl+Shift+V)"
        >
          <Eye size={14} />
          <span class="max-[680px]:hidden">Preview</span>
        </button>
      </div>
    </div>
  {/if}

  <div
    class="flex min-h-0 min-w-0 flex-1 overflow-hidden max-[680px]:flex-col {activeFile ? '' : 'invisible pointer-events-none'}"
    bind:this={workspaceRef}
  >
    <section
      class="relative min-h-0 min-w-0 flex-auto {effectiveViewMode === 'split'
        ? 'shrink-0 grow-0 max-[680px]:!flex-1'
        : ''} {effectiveViewMode === 'preview' ? 'hidden' : ''}"
      style={editorPaneStyle}
      aria-label="Text editor"
      aria-hidden={effectiveViewMode === 'preview'}
      bind:this={containerRef}
    >
      <EasyMonacoEditor onLoad={handleMonaco}>
        <div class="absolute inset-0 size-full" bind:this={editorRef}></div>
      </EasyMonacoEditor>
    </section>

    {#if isMarkdownFile && effectiveViewMode === 'split'}
      <!-- svelte-ignore a11y_no_noninteractive_tabindex a11y_no_noninteractive_element_interactions -->
      <div
        class="relative z-[2] w-[5px] flex-[0_0_5px] cursor-col-resize border-0 bg-surface-800 p-0 after:absolute after:inset-x-px after:inset-y-0 after:bg-transparent after:content-[''] after:transition-colors hover:after:bg-primary-500 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary-400 focus-visible:after:bg-primary-500 max-[680px]:hidden"
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
      <div
        class="relative min-h-0 min-w-0 flex-[1_1_0] {effectiveViewMode === 'split'
          ? 'max-[680px]:border-t-[3px] max-[680px]:border-surface-800'
          : ''}"
      >
        <MarkdownPreview
          content={activeFile?.content || ''}
          fileName={activeFile?.name || 'Untitled'}
        />
      </div>
    {/if}
  </div>

  {#if !activeFile}
    <div class="absolute inset-0 z-10 flex flex-col items-center justify-center bg-surface-950 px-6 text-center">
      <img src="/icon.png" alt="" class="mb-4 size-11 rounded-md opacity-90" />
      <h2 class="m-0 text-base font-semibold text-surface-100">No file open</h2>
      <div class="mt-5 flex items-center gap-2">
        <button
          type="button"
          class="inline-flex h-8 items-center gap-2 rounded-[5px] border border-primary-500/45 bg-primary-800/55 px-3 text-xs text-primary-50 hover:bg-primary-700/65 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-400"
          onclick={() => documentService.createUntitled()}
        >
          <FilePlus size={15} />
          <span>New file</span>
        </button>
        <button
          type="button"
          class="inline-flex h-8 items-center gap-2 rounded-[5px] border border-surface-500/40 bg-surface-900 px-3 text-xs text-surface-200 hover:bg-surface-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-400"
          onclick={() => documentService.openFromDialog()}
        >
          <FolderOpen size={15} />
          <span>Open file</span>
        </button>
      </div>
    </div>
  {:else}
    <div
      class="flex min-h-6 items-center justify-between gap-4 border-t border-surface-500/30 bg-surface-900 px-[0.65rem] text-[0.68rem] text-surface-400"
    >
      <div class="flex min-w-0 items-center gap-3">
        <span class="whitespace-nowrap font-semibold text-surface-300 uppercase">{$editorStore.language}</span>
        <span class="whitespace-nowrap max-[680px]:hidden">{$editorStore.stats.lines} lines</span>
        <span class="whitespace-nowrap max-[680px]:hidden">{$editorStore.stats.length} characters</span>
      </div>
      <div class="flex min-w-0 items-center gap-3">
        <span class="whitespace-nowrap max-[680px]:hidden">Ln {$editorStore.cursor.line}, Col {$editorStore.cursor.column}</span>
        <span class="whitespace-nowrap max-[680px]:hidden">{$editorStore.lineEnding}</span>
        <span class="whitespace-nowrap uppercase">{$editorStore.encoding}</span>
      </div>
    </div>
  {/if}
</div>
