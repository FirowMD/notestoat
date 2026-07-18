<script lang="ts">
  import {
    Clock,
    FilePlus,
    FileText,
    FolderOpen,
    PanelLeft,
    PanelLeftClose,
    RotateCcw,
    Save,
    Settings2
  } from '@lucide/svelte';
  import { onMount } from 'svelte';
  import SettingsPanel from './SettingsPanel.svelte';
  import { documentService } from './documents/documentService';
  import { configStore } from './stores/configStore';
  import { editorStore } from './stores/editor';
  import { fileStore } from './stores/files';
  import { monacoThemeStore } from './stores/monacoTheme';
  import { sidePanelStore } from './stores/sidePanelStore';

  let isRecentFilesOpen = false;
  let isSettingsOpen = false;
  let selectedRecentIndex = 0;
  let recentPanel: HTMLDivElement;
  let recentButton: HTMLButtonElement;
  let settingsContainer: HTMLDivElement;
  let settingsButton: HTMLButtonElement;
  let availableMonacoThemes: string[] = ['vs', 'vs-dark', 'hc-black', 'Firow'];

  $: activeFile = $fileStore.files.find(file => file.id === $fileStore.activeFileId);
  $: hasDocumentToolbar = Boolean(
    activeFile && (
      activeFile.language === 'markdown' ||
      /\.(md|markdown|mdown|mkdn)$/i.test(activeFile.name)
    )
  );
  $: recentFiles = ($configStore.recent_files ?? []).slice(0, 10);

  function handleNewFile() {
    documentService.createUntitled();
  }

  async function handleOpenFile() {
    await documentService.openFromDialog();
  }

  async function handleSaveFile() {
    if (activeFile) await documentService.saveDocument(activeFile.id);
  }

  async function handleCloseActiveFile() {
    if (activeFile) await documentService.closeDocument(activeFile.id);
  }

  function toggleRecentFiles() {
    isRecentFilesOpen = !isRecentFilesOpen;
    isSettingsOpen = false;
    selectedRecentIndex = 0;
    if (isRecentFilesOpen) setTimeout(() => recentPanel?.focus(), 0);
  }

  function toggleSettings() {
    isSettingsOpen = !isSettingsOpen;
    isRecentFilesOpen = false;
  }

  async function handleOpenRecentFile(filePath: string) {
    await documentService.openRecentFile(filePath);
    isRecentFilesOpen = false;
  }

  async function handleRestoreFile() {
    await documentService.restoreRecentFile();
    isRecentFilesOpen = false;
  }

  function handleRecentMenuKeydown(event: KeyboardEvent) {
    if (!isRecentFilesOpen) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      isRecentFilesOpen = false;
      recentButton?.focus();
      return;
    }
    if (recentFiles.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      selectedRecentIndex = (selectedRecentIndex + 1) % recentFiles.length;
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      selectedRecentIndex = (selectedRecentIndex - 1 + recentFiles.length) % recentFiles.length;
    } else if (event.key === 'Enter') {
      event.preventDefault();
      void handleOpenRecentFile(recentFiles[selectedRecentIndex]);
    } else {
      return;
    }

    setTimeout(() => {
      recentPanel
        ?.querySelector('[data-index="' + selectedRecentIndex + '"]')
        ?.scrollIntoView({ block: 'nearest' });
    }, 0);
  }

  function handleGlobalPointerDown(event: PointerEvent) {
    const target = event.target as Node;
    if (
      isRecentFilesOpen &&
      !recentPanel?.contains(target) &&
      !recentButton?.contains(target)
    ) {
      isRecentFilesOpen = false;
    }
    if (
      isSettingsOpen &&
      !settingsContainer?.contains(target) &&
      !settingsButton?.contains(target)
    ) {
      isSettingsOpen = false;
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && (isRecentFilesOpen || isSettingsOpen)) {
      event.preventDefault();
      isRecentFilesOpen = false;
      isSettingsOpen = false;
      return;
    }

    const primary = event.ctrlKey || event.metaKey;
    if (primary && !event.shiftKey && event.code === 'KeyN') {
      event.preventDefault();
      handleNewFile();
    } else if (primary && !event.shiftKey && event.code === 'KeyO') {
      event.preventDefault();
      void handleOpenFile();
    } else if (primary && !event.shiftKey && event.code === 'KeyS') {
      event.preventDefault();
      void handleSaveFile();
    } else if (primary && !event.shiftKey && event.code === 'KeyR') {
      event.preventDefault();
      toggleRecentFiles();
    } else if (primary && event.shiftKey && event.code === 'KeyT') {
      event.preventDefault();
      void handleRestoreFile();
    } else if (event.altKey && !primary && !event.shiftKey && event.code === 'KeyZ') {
      event.preventDefault();
      editorStore.setWordWrap(!$editorStore.wordWrap);
    } else if (primary && !event.shiftKey && event.code === 'KeyW') {
      event.preventDefault();
      void handleCloseActiveFile();
    } else if (primary && !event.shiftKey && event.code === 'KeyB') {
      event.preventDefault();
      sidePanelStore.toggle();
    }
  }

  onMount(() => {
    window.addEventListener('keydown', handleKeydown);
    window.addEventListener('pointerdown', handleGlobalPointerDown);

    monacoThemeStore.getAvailableThemes()
      .then(themes => {
        availableMonacoThemes = themes;
      })
      .catch(error => {
        console.error('Error loading Monaco themes:', error);
      });

    return () => {
      window.removeEventListener('keydown', handleKeydown);
      window.removeEventListener('pointerdown', handleGlobalPointerDown);
    };
  });
</script>

<header class="app-header" role="toolbar" aria-label="Application toolbar">
  <div class="action-group">
    <button
      type="button"
      class="toolbar-button"
      class:active={$sidePanelStore}
      onclick={() => sidePanelStore.toggle()}
      title="Toggle files panel (Ctrl+B)"
    >
      {#if $sidePanelStore}
        <PanelLeftClose size={17} />
      {:else}
        <PanelLeft size={17} />
      {/if}
    </button>

    <span class="toolbar-divider"></span>

    <button type="button" class="toolbar-button" onclick={handleNewFile} title="New file (Ctrl+N)">
      <FilePlus size={17} />
    </button>
    <button type="button" class="toolbar-button" onclick={handleOpenFile} title="Open file (Ctrl+O)">
      <FolderOpen size={17} />
    </button>
    <button
      type="button"
      class="toolbar-button"
      onclick={handleSaveFile}
      disabled={!activeFile}
      title="Save (Ctrl+S)"
    >
      <Save size={17} />
    </button>
  </div>

  <div class="document-identity">
    <img src="/icon.png" alt="" />
    <div>
      <div class="document-name">
        <span>{activeFile?.name ?? 'NoteStoat'}</span>
        {#if activeFile?.isModified}
          <span class="modified-dot" title="Unsaved changes"></span>
        {/if}
      </div>
      <div class="document-location">
        {activeFile?.path || (activeFile ? 'Unsaved document' : 'Ready')}
      </div>
    </div>
  </div>

  <div class="action-group action-group-right">
    <button
      bind:this={recentButton}
      type="button"
      class="toolbar-button"
      class:active={isRecentFilesOpen}
      onclick={toggleRecentFiles}
      title="Recent files (Ctrl+R)"
      aria-haspopup="menu"
      aria-expanded={isRecentFilesOpen}
    >
      <Clock size={17} />
    </button>
    <button
      bind:this={settingsButton}
      type="button"
      class="toolbar-button"
      class:active={isSettingsOpen}
      onclick={toggleSettings}
      title="Settings"
      aria-haspopup="dialog"
      aria-expanded={isSettingsOpen}
    >
      <Settings2 size={17} />
    </button>
  </div>

  {#if isRecentFilesOpen}
    <div
      bind:this={recentPanel}
      class="recent-panel"
      role="menu"
      tabindex="-1"
      aria-label="Recent files"
      onkeydown={handleRecentMenuKeydown}
    >
      <div class="popover-heading">
        <span>Recent files</span>
        <span>{recentFiles.length}</span>
      </div>

      <div class="recent-list">
        {#if recentFiles.length}
          {#each recentFiles as filePath, index}
            {@const fileName = filePath.split(/[/\\]/).pop() || filePath}
            <button
              type="button"
              role="menuitem"
              data-index={index}
              class:selected={selectedRecentIndex === index}
              onclick={() => handleOpenRecentFile(filePath)}
              onmouseenter={() => selectedRecentIndex = index}
            >
              <FileText size={15} />
              <span>
                <strong>{fileName}</strong>
                <small>{filePath}</small>
              </span>
            </button>
          {/each}
        {:else}
          <div class="recent-empty">No recent files</div>
        {/if}
      </div>

      <div class="recent-footer">
        <button type="button" onclick={handleRestoreFile} disabled={!recentFiles.length}>
          <RotateCcw size={15} />
          <span>Restore last closed</span>
          <kbd>Ctrl Shift T</kbd>
        </button>
      </div>
    </div>
  {/if}

  {#if isSettingsOpen}
    <div bind:this={settingsContainer} class="settings-anchor">
      <SettingsPanel
        {availableMonacoThemes}
        offsetForDocumentToolbar={hasDocumentToolbar}
        onClose={() => {
          isSettingsOpen = false;
          settingsButton?.focus();
        }}
      />
    </div>
  {/if}
</header>

<style>
  .app-header {
    position: relative;
    z-index: 70;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    width: 100%;
    min-height: 48px;
    align-items: center;
    gap: 10px;
    padding: 0 8px;
    border-bottom: 1px solid color-mix(in oklab, var(--color-surface-500) 35%, transparent);
    background: color-mix(in oklab, var(--color-surface-950) 94%, black);
    color: var(--color-surface-100);
    box-shadow: 0 1px 0 rgb(0 0 0 / 20%);
  }

  .settings-anchor {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  .settings-anchor :global(.settings-panel) {
    pointer-events: auto;
  }

  .action-group {
    display: flex;
    align-items: center;
    gap: 3px;
  }

  .toolbar-button {
    display: grid;
    width: 32px;
    height: 32px;
    flex: 0 0 32px;
    place-items: center;
    padding: 0;
    border: 1px solid transparent;
    border-radius: 5px;
    background: transparent;
    color: var(--color-surface-300);
    cursor: pointer;
    transition: color 120ms ease, background 120ms ease, border-color 120ms ease;
  }

  .toolbar-button:hover:not(:disabled) {
    border-color: color-mix(in oklab, var(--color-surface-500) 35%, transparent);
    background: var(--color-surface-800);
    color: var(--color-surface-50);
  }

  .toolbar-button.active {
    border-color: color-mix(in oklab, var(--color-primary-500) 45%, transparent);
    background: color-mix(in oklab, var(--color-primary-700) 45%, var(--color-surface-900));
    color: var(--color-primary-100);
  }

  .toolbar-button:disabled {
    opacity: 0.32;
    cursor: default;
  }

  .toolbar-button:focus-visible,
  .recent-panel button:focus-visible {
    outline: 2px solid var(--color-primary-400);
    outline-offset: 1px;
  }

  .toolbar-divider {
    width: 1px;
    height: 20px;
    margin: 0 4px;
    background: color-mix(in oklab, var(--color-surface-500) 38%, transparent);
  }

  .document-identity {
    display: flex;
    min-width: 0;
    align-items: center;
    justify-content: center;
    gap: 9px;
    pointer-events: none;
  }

  .document-identity img {
    width: 24px;
    height: 24px;
    flex: 0 0 24px;
    border-radius: 5px;
  }

  .document-identity > div {
    min-width: 0;
  }

  .document-name {
    display: flex;
    min-width: 0;
    align-items: center;
    justify-content: center;
    gap: 7px;
    color: var(--color-surface-100);
    font-size: 0.78rem;
    font-weight: 650;
  }

  .document-name > span:first-child,
  .document-location {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .document-location {
    max-width: min(42vw, 440px);
    margin-top: 1px;
    color: var(--color-surface-500);
    font-size: 0.64rem;
    text-align: center;
  }

  .modified-dot {
    width: 6px;
    height: 6px;
    flex: 0 0 6px;
    border-radius: 50%;
    background: var(--color-warning-500);
  }

  .recent-panel {
    position: absolute;
    top: calc(100% + 6px);
    right: 48px;
    z-index: 80;
    width: min(380px, calc(100vw - 16px));
    overflow: hidden;
    border: 1px solid color-mix(in oklab, var(--color-surface-500) 42%, transparent);
    border-radius: 7px;
    background: color-mix(in oklab, var(--color-surface-900) 96%, black);
    box-shadow: 0 18px 48px rgb(0 0 0 / 38%);
  }

  .popover-heading {
    display: flex;
    height: 40px;
    align-items: center;
    justify-content: space-between;
    padding: 0 12px;
    border-bottom: 1px solid color-mix(in oklab, var(--color-surface-500) 28%, transparent);
    color: var(--color-surface-200);
    font-size: 0.76rem;
    font-weight: 650;
  }

  .popover-heading span:last-child {
    color: var(--color-surface-500);
    font-size: 0.68rem;
  }

  .recent-list {
    max-height: 310px;
    overflow-y: auto;
    padding: 5px;
  }

  .recent-list button {
    display: grid;
    width: 100%;
    grid-template-columns: 20px minmax(0, 1fr);
    align-items: center;
    gap: 8px;
    padding: 8px;
    border: 0;
    border-radius: 4px;
    background: transparent;
    color: var(--color-surface-400);
    text-align: left;
    cursor: pointer;
  }

  .recent-list button:hover,
  .recent-list button.selected {
    background: var(--color-surface-800);
    color: var(--color-surface-100);
  }

  .recent-list button > span {
    min-width: 0;
  }

  .recent-list strong,
  .recent-list small {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .recent-list strong {
    font-size: 0.75rem;
    font-weight: 600;
  }

  .recent-list small {
    margin-top: 2px;
    color: var(--color-surface-500);
    font-size: 0.62rem;
  }

  .recent-empty {
    display: grid;
    min-height: 100px;
    place-items: center;
    color: var(--color-surface-500);
    font-size: 0.75rem;
  }

  .recent-footer {
    padding: 5px;
    border-top: 1px solid color-mix(in oklab, var(--color-surface-500) 28%, transparent);
  }

  .recent-footer button {
    display: grid;
    width: 100%;
    min-height: 34px;
    grid-template-columns: 20px 1fr auto;
    align-items: center;
    gap: 7px;
    padding: 0 8px;
    border: 0;
    border-radius: 4px;
    background: transparent;
    color: var(--color-surface-300);
    font-size: 0.72rem;
    text-align: left;
    cursor: pointer;
  }

  .recent-footer button:hover:not(:disabled) {
    background: var(--color-surface-800);
    color: var(--color-surface-50);
  }

  .recent-footer button:disabled {
    opacity: 0.35;
    cursor: default;
  }

  kbd {
    color: var(--color-surface-500);
    font-family: inherit;
    font-size: 0.6rem;
  }

  @media (max-width: 620px) {
    .app-header {
      gap: 4px;
      padding: 0 5px;
    }

    .document-identity img,
    .document-location {
      display: none;
    }

    .toolbar-divider {
      margin: 0 1px;
    }

    .recent-panel {
      right: 5px;
    }
  }
</style>
