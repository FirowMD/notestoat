<script lang="ts">
  import { isTauri } from '@tauri-apps/api/core';
  import { listen } from '@tauri-apps/api/event';
  import { getCurrentWebview } from '@tauri-apps/api/webview';
  import { getCurrentWindow } from '@tauri-apps/api/window';
  import { onMount } from 'svelte';
  import { Pane, PaneGroup, PaneResizer } from 'paneforge';
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
      cleanups.forEach(cleanup => cleanup());
    };
  });
</script>

<div
  class="preset-gradient flex flex-col w-full h-full relative"
  style="opacity: var(--overlayOpacity, 1)"
  role="presentation"
>
  <PanelTop />
  <PaneGroup direction="horizontal" class="flex w-full h-full">
    {#if $sidePanelStore}
      <Pane defaultSize={20} minSize={20}>
        <PanelSide />
      </Pane>
      <PaneResizer class="preset-glass w-1 hover:bg-primary-500/40 transition-all duration-200 cursor-col-resize" />
    {/if}
    <Pane defaultSize={$sidePanelStore ? 80 : 100} minSize={30}>
      <PanelEditor />
    </Pane>
  </PaneGroup>

  {#if isDragging}
    <div
      class="absolute inset-0 bg-surface-900/80 flex items-center justify-center"
      role="presentation"
    >
      <div class="w-96 text-center">
        <p class="text-lg">Drop file to open</p>
      </div>
    </div>
  {/if}

  <NotificationContainer />
</div>
