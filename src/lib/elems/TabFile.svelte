<script lang="ts">
  import { ArrowDown, ArrowUp } from '@lucide/svelte';
  import { onMount } from 'svelte';
  import { documentService } from '../documents/documentService';
  import { contextMenuStore } from '../stores/contextMenu';
  import { fileStore } from '../stores/files';
  import type { FileInfo } from '../types/file';

  export let file: FileInfo;
  export let isActive = false;
  export let index: number;
  export let totalFiles: number;

  let contextMenuElement: HTMLDivElement;
  let inputElement: HTMLInputElement;
  let isRenaming = false;
  let renameInProgress = false;
  let newFileName = file.name;

  $: dateModified = (file.fileSystemModified ?? file.created).toLocaleDateString();
  $: timeModified = (file.fileSystemModified ?? file.created).toLocaleTimeString();
  $: if (isRenaming && inputElement) inputElement.focus();

  function handleClick() {
    fileStore.setActiveFile(file.id);
  }

  async function handleClose(event: MouseEvent) {
    event.stopPropagation();
    await documentService.closeDocument(file.id);
    contextMenuStore.close();
  }

  function handleContextMenu(event: MouseEvent) {
    event.preventDefault();
    contextMenuStore.open(event.clientX, event.clientY, file.id);
  }

  function move(offset: -1 | 1) {
    const nextIndex = index + offset;
    if (nextIndex < 0 || nextIndex >= totalFiles) return;

    const files = [...$fileStore.files];
    [files[index], files[nextIndex]] = [files[nextIndex], files[index]];
    void documentService.reorderFiles(files);
  }

  function handleWindowClick(event: MouseEvent) {
    if (
      $contextMenuStore.isOpen &&
      contextMenuElement &&
      !contextMenuElement.contains(event.target as Node)
    ) {
      contextMenuStore.close();
    }
  }

  function handleRename() {
    isRenaming = true;
    newFileName = file.name;
    contextMenuStore.close();
  }

  async function handleRenameSubmit() {
    if (!isRenaming || renameInProgress) return;
    renameInProgress = true;
    const renamed = await documentService.renameDocument(file.id, newFileName);
    newFileName = renamed ?? file.name;
    isRenaming = false;
    renameInProgress = false;
  }

  function handleRenameKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault();
      void handleRenameSubmit();
    } else if (event.key === 'Escape') {
      isRenaming = false;
      newFileName = file.name;
    }
  }

  async function handleSaveAs() {
    await documentService.saveDocument(file.id, true);
    contextMenuStore.close();
  }

  async function handleDelete() {
    await documentService.deleteDocument(file.id);
    contextMenuStore.close();
  }

  async function handleOpenFilePath() {
    await documentService.revealDocument(file.id);
    contextMenuStore.close();
  }

  async function handleOpenInNewWindow() {
    await documentService.openInNewWindow(file.id);
    contextMenuStore.close();
  }

  function handleKeydown(event: KeyboardEvent) {
    if (!isActive) return;

    if (event.ctrlKey && !event.shiftKey && event.code === 'KeyE') {
      event.preventDefault();
      void handleOpenFilePath();
    } else if (!event.ctrlKey && !event.shiftKey && event.code === 'F2') {
      event.preventDefault();
      handleRename();
    } else if (event.ctrlKey && event.shiftKey && event.code === 'KeyS') {
      event.preventDefault();
      void handleSaveAs();
    }
  }

  onMount(() => {
    window.addEventListener('click', handleWindowClick);
    window.addEventListener('keydown', handleKeydown);
    return () => {
      window.removeEventListener('click', handleWindowClick);
      window.removeEventListener('keydown', handleKeydown);
    };
  });
</script>

<div
  class="relative group flex items-center w-full"
  oncontextmenu={handleContextMenu}
  role="button"
  tabindex="0"
>
  <button
    type="button"
    class="w-full btn rounded-none h-10 flex flex-col items-start overflow-hidden transition-all duration-200 pl-6 {
      isActive && file.isModified ? 'shadow-xl preset-gradient-five' :
      isActive ? 'shadow-xl preset-gradient-four' :
      file.isModified ? 'preset-gradient-six' :
      'preset-gradient-three'
    }"
    onclick={handleClick}
    title="{file.name}{file.isModified ? ' (modified)' : ''}"
  >
    {#if isRenaming}
      <input
        type="text"
        bind:value={newFileName}
        bind:this={inputElement}
        onblur={handleRenameSubmit}
        onkeydown={handleRenameKeydown}
        class="w-full text-sm rounded-none focus:outline-none"
      />
      <span class="text-xs text-left opacity-50 truncate w-full">{dateModified} {timeModified}</span>
    {:else}
      <div class="w-full min-w-0">
        <div class="flex items-center gap-1 w-full">
          <span class="text-sm text-left truncate flex-1">{file.name}</span>
        </div>
        <span class="text-xs text-left opacity-50 truncate block w-full">{dateModified} {timeModified}</span>
      </div>
    {/if}
  </button>

  <div class="absolute left-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-0.5">
    <button
      type="button"
      class="preset-ghost p-0.5 hover:bg-surface-600 disabled:opacity-25 rounded-none transition-all duration-200"
      onclick={() => move(-1)}
      disabled={index === 0}
      aria-label="Move file up"
    >
      <ArrowUp size={14} />
    </button>
    <button
      type="button"
      class="preset-ghost p-0.5 hover:bg-surface-600 disabled:opacity-25 rounded-none transition-all duration-200"
      onclick={() => move(1)}
      disabled={index === totalFiles - 1}
      aria-label="Move file down"
    >
      <ArrowDown size={14} />
    </button>
  </div>

  <button
    type="button"
    class="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity preset-outlined-primary-500-500 rounded-full px-2 py-0.5"
    onclick={handleClose}
    aria-label="Close {file.name}"
  >
    ×
  </button>

  {#if $contextMenuStore.isOpen && $contextMenuStore.fileId === file.id}
    <div
      bind:this={contextMenuElement}
      class="fixed z-50 w-40 preset-glass shadow-xl rounded-none py-0.5 text-sm"
      style="left: {$contextMenuStore.x}px; top: {$contextMenuStore.y}px"
    >
      <button type="button" class="preset-ghost text-xs w-full px-3 py-1.5 text-left hover:bg-surface-600 transition-colors" onclick={handleOpenInNewWindow}>
        Open in new window
      </button>
      <button type="button" class="preset-ghost text-xs w-full px-3 py-1.5 text-left hover:bg-surface-600 transition-colors" onclick={handleOpenFilePath}>
        Open file path
      </button>
      <button type="button" class="preset-ghost text-xs w-full px-3 py-1.5 text-left hover:bg-surface-600 transition-colors" onclick={handleRename}>
        Rename
      </button>
      <button type="button" class="preset-ghost text-xs w-full px-3 py-1.5 text-left hover:bg-surface-600 transition-colors" onclick={handleSaveAs}>
        Save as
      </button>
      <button type="button" class="preset-ghost text-xs w-full px-3 py-1.5 text-left hover:bg-surface-600 transition-colors" onclick={handleDelete}>
        Delete
      </button>
      <button type="button" class="preset-ghost text-xs w-full px-3 py-1.5 text-left hover:bg-surface-600 transition-colors" onclick={handleClose}>
        Close
      </button>
    </div>
  {/if}
</div>
