<script lang="ts">
  import { isTauri } from '@tauri-apps/api/core';
  import { listen } from '@tauri-apps/api/event';
  import { getCurrentWebview } from '@tauri-apps/api/webview';
  import { getCurrentWindow } from '@tauri-apps/api/window';
  import { FileUp } from '@lucide/svelte';
  import { onMount } from 'svelte';
  import NotificationContainer from './NotificationContainer.svelte';
  import PanelEditor from './PanelEditor.svelte';
  import PanelSide from './PanelSide.svelte';
  import PanelTop from './PanelTop.svelte';
  import { documentService } from './documents/documentService';
  import { configStore } from './stores/configStore';
  import { editorStore } from './stores/editor';
  import { fileStore } from './stores/files';
  import { monacoThemeStore } from './stores/monacoTheme';
  import { sidePanelStore } from './stores/sidePanelStore';
  import { themeStore } from './stores/theme';

  let isDragging = false;
  let contentRef: HTMLDivElement;
  let sidebarPercent = 22;
  let isResizingSidebar = false;

  $: sidebarStyle = 'flex-basis: ' + sidebarPercent + '%';

  function updateSidebarWidth(clientX: number) {
    if (!contentRef) return;
    const bounds = contentRef.getBoundingClientRect();
    const nextPercent = ((clientX - bounds.left) / bounds.width) * 100;
    sidebarPercent = Math.max(18, Math.min(38, nextPercent));
  }

  function handleSidebarResizeMove(event: PointerEvent) {
    updateSidebarWidth(event.clientX);
  }

  function stopSidebarResize() {
    isResizingSidebar = false;
    window.removeEventListener('pointermove', handleSidebarResizeMove);
    window.removeEventListener('pointerup', stopSidebarResize);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }

  function startSidebarResize(event: PointerEvent) {
    event.preventDefault();
    isResizingSidebar = true;
    updateSidebarWidth(event.clientX);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', handleSidebarResizeMove);
    window.addEventListener('pointerup', stopSidebarResize);
  }

  function handleSidebarResizeKeydown(event: KeyboardEvent) {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      sidebarPercent = Math.max(18, sidebarPercent - 2);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      sidebarPercent = Math.min(38, sidebarPercent + 2);
    }
  }

  function handleTabSwitch(event: KeyboardEvent) {
    if (!event.ctrlKey || event.altKey || event.code !== 'Tab') return;
    event.preventDefault();

    const files = $fileStore.files;
    if (files.length <= 1) return;

    const currentIndex = files.findIndex(file => file.id === $fileStore.activeFileId);
    const nextIndex = event.shiftKey
      ? (currentIndex <= 0 ? files.length - 1 : currentIndex - 1)
      : (currentIndex >= files.length - 1 ? 0 : currentIndex + 1);
    fileStore.setActiveFile(files[nextIndex].id);
  }

  async function applyWindowAppearance(transparent: boolean, opacity: number) {
    document.documentElement.style.setProperty('--overlayOpacity', transparent ? String(opacity) : '1');
    document.documentElement.classList.toggle('transparent-mode', transparent);

    if (!isTauri()) return;
    const window = getCurrentWindow();
    try { await window.setDecorations(!transparent); } catch {}
    try { await window.setAlwaysOnTop(transparent); } catch {}
  }

  $: void applyWindowAppearance(
    $configStore.transparent_mode ?? false,
    $configStore.window_opacity ?? 0.85
  );

  onMount(() => {
    let disposed = false;
    const cleanups: Array<() => void> = [];
    const registerCleanup = (cleanup: () => void) => {
      if (disposed) cleanup();
      else cleanups.push(cleanup);
    };
    window.addEventListener('keydown', handleTabSwitch);

    async function initialize() {
      const config = await configStore.load();
      if (!config || disposed) return;

      if (config.colorscheme) themeStore.loadTheme(config.colorscheme);
      if (config.monaco_editor_theme) monacoThemeStore.set(config.monaco_editor_theme);
      editorStore.hydrate({
        fontSize: config.font_size,
        wordWrap: config.word_wrap,
        showInvisibles: config.show_invisibles,
        markdownViewMode: config.markdown_view_mode,
        encoding: config.default_encoding
      });

      await documentService.restoreOpenedFiles(
        config.opened_files ?? [],
        config.default_encoding ?? 'utf-8'
      );
      if (disposed || !isTauri()) return;

      registerCleanup(await getCurrentWebview().onDragDropEvent(event => {
        if (event.payload.type === 'over') {
          isDragging = true;
        } else if (event.payload.type === 'drop') {
          void documentService.openPaths(
            event.payload.paths,
            $configStore.default_encoding ?? 'utf-8'
          );
          isDragging = false;
        } else {
          isDragging = false;
        }
      }));

      registerCleanup(await listen<string>('file-changed', event => {
        void documentService.reloadExternalFile(event.payload);
      }));

      registerCleanup(await listen<string[]>('files-updated', async event => {
        await documentService.openPaths(
          event.payload,
          $configStore.default_encoding ?? 'utf-8'
        );
      }));
    }

    void initialize();

    return () => {
      disposed = true;
      window.removeEventListener('keydown', handleTabSwitch);
      stopSidebarResize();
      cleanups.forEach(cleanup => cleanup());
    };
  });
</script>

<div
  class="relative flex h-full w-full flex-col overflow-hidden bg-surface-950"
  style="opacity: var(--overlayOpacity, 1)"
  role="presentation"
>
  <PanelTop />
  <div bind:this={contentRef} class="flex min-h-0 w-full flex-1 overflow-hidden">
    {#if $sidePanelStore}
      <div class="min-h-0 min-w-0 shrink-0" style={sidebarStyle}>
        <PanelSide />
      </div>
      <!-- svelte-ignore a11y_no_noninteractive_tabindex a11y_no_noninteractive_element_interactions -->
      <div
        class="relative z-20 w-1 shrink-0 cursor-col-resize bg-surface-800 transition-colors duration-150 after:absolute after:inset-y-0 after:-inset-x-1 after:content-[''] hover:bg-primary-500 focus-visible:bg-primary-500 focus-visible:outline-none {isResizingSidebar ? 'bg-primary-500' : ''}"
        role="separator"
        aria-label="Resize files panel"
        aria-orientation="vertical"
        aria-valuemin="18"
        aria-valuemax="38"
        aria-valuenow={Math.round(sidebarPercent)}
        tabindex="0"
        onpointerdown={startSidebarResize}
        onkeydown={handleSidebarResizeKeydown}
      ></div>
    {/if}
    <main class="min-h-0 min-w-0 flex-1">
      <PanelEditor />
    </main>
  </div>

  {#if isDragging}
    <div
      class="absolute inset-0 z-100 flex items-center justify-center bg-surface-950/85 p-4 backdrop-blur-sm"
      role="presentation"
    >
      <div class="flex size-full max-h-72 max-w-xl flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-primary-400/70 bg-surface-900/80 text-center text-surface-200">
        <FileUp size={30} class="text-primary-300" />
        <p class="m-0 text-sm font-semibold">Drop files to open</p>
      </div>
    </div>
  {/if}

  <NotificationContainer />
</div>
