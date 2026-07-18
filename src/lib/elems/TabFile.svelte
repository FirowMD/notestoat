<script lang="ts">
  import {
    ArrowDown,
    ArrowUp,
    ExternalLink,
    FileText,
    FolderSearch,
    MoreHorizontal,
    Pencil,
    Save,
    Trash2,
    X
  } from '@lucide/svelte';
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { documentService } from '../documents/documentService';
  import { contextMenuStore } from '../stores/contextMenu';
  import { fileReorderStore } from '../stores/fileReorder';
  import { fileStore } from '../stores/files';
  import type { FileInfo } from '../types/file';

  export let file: FileInfo;
  export let isActive = false;
  export let index: number;
  export let totalFiles: number;
  export let allowReorder = true;

  let contextMenuElement: HTMLDivElement;
  let inputElement: HTMLInputElement;
  let isRenaming = false;
  let renameInProgress = false;
  let pointerCandidate: { id: number; x: number; y: number } | null = null;
  let suppressClick = false;
  let newFileName = file.name;

  $: modifiedAt = file.fileSystemModified ?? file.modified ?? file.created;
  $: parentName = (() => {
    if (!file.path) return 'Unsaved';
    const parts = file.path.split(/[/\\]/).filter(Boolean);
    return parts.length > 1 ? parts[parts.length - 2] : 'Saved';
  })();
  $: secondaryText = parentName + ' - ' + modifiedAt.toLocaleDateString();
  $: if (isRenaming && inputElement) inputElement.focus();

  function handleClick() {
    if (!suppressClick) fileStore.setActiveFile(file.id);
  }

  async function handleClose(event: MouseEvent) {
    event.stopPropagation();
    await documentService.closeDocument(file.id);
    contextMenuStore.close();
  }

  function openMenuAt(x: number, y: number) {
    const menuWidth = 196;
    const menuHeight = 290;
    contextMenuStore.open(
      Math.max(4, Math.min(x, window.innerWidth - menuWidth - 4)),
      Math.max(4, Math.min(y, window.innerHeight - menuHeight - 4)),
      file.id
    );
  }

  function handleContextMenu(event: MouseEvent) {
    event.preventDefault();
    openMenuAt(event.clientX, event.clientY);
  }

  function handleMenuClick(event: MouseEvent) {
    event.stopPropagation();
    const bounds = event.currentTarget instanceof HTMLElement
      ? event.currentTarget.getBoundingClientRect()
      : null;
    if (bounds) openMenuAt(bounds.right - 188, bounds.bottom + 4);
  }

  function move(offset: -1 | 1) {
    if (!allowReorder) return;
    const nextIndex = index + offset;
    if (nextIndex < 0 || nextIndex >= totalFiles) return;
    const files = [...$fileStore.files];
    [files[index], files[nextIndex]] = [files[nextIndex], files[index]];
    void documentService.reorderFiles(files);
    contextMenuStore.close();
  }

  function handlePointerDown(event: PointerEvent) {
    if (!allowReorder || isRenaming || event.button !== 0) return;
    pointerCandidate = { id: event.pointerId, x: event.clientX, y: event.clientY };
    window.addEventListener('pointermove', handlePointerMove, { passive: false });
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerCancel);
  }

  function handlePointerMove(event: PointerEvent) {
    if (!pointerCandidate || event.pointerId !== pointerCandidate.id) return;
    const distance = Math.hypot(
      event.clientX - pointerCandidate.x,
      event.clientY - pointerCandidate.y
    );
    const reorderState = get(fileReorderStore);

    if (!reorderState.sourceId && distance < 6) return;
    if (!reorderState.sourceId) {
      fileReorderStore.start(file.id);
      document.body.style.cursor = 'grabbing';
      document.body.style.userSelect = 'none';
    }

    event.preventDefault();
    const row = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>('[data-file-row-id]');
    const targetId = row?.dataset.fileRowId ?? null;
    if (!row || !targetId || targetId === file.id) {
      fileReorderStore.setTarget(null);
      return;
    }

    const bounds = row.getBoundingClientRect();
    const position = event.clientY > bounds.top + bounds.height / 2 ? 'after' : 'before';
    fileReorderStore.setTarget(targetId, position);
  }

  function stopPointerTracking() {
    pointerCandidate = null;
    window.removeEventListener('pointermove', handlePointerMove);
    window.removeEventListener('pointerup', handlePointerUp);
    window.removeEventListener('pointercancel', handlePointerCancel);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }

  function finishPointerReorder(commit: boolean) {
    const reorderState = get(fileReorderStore);
    const wasDragging = reorderState.sourceId === file.id;

    if (commit && wasDragging && reorderState.targetId) {
      const files = [...$fileStore.files];
      const sourceIndex = files.findIndex(candidate => candidate.id === file.id);
      if (sourceIndex >= 0) {
        const [movedFile] = files.splice(sourceIndex, 1);
        const targetIndex = files.findIndex(candidate => candidate.id === reorderState.targetId);
        if (targetIndex >= 0) {
          const insertIndex = targetIndex + (reorderState.position === 'after' ? 1 : 0);
          files.splice(insertIndex, 0, movedFile);
          void documentService.reorderFiles(files);
        }
      }
    }

    if (wasDragging) {
      suppressClick = true;
      window.setTimeout(() => suppressClick = false, 0);
      fileReorderStore.reset();
    }
    stopPointerTracking();
  }

  function handlePointerUp(event: PointerEvent) {
    if (pointerCandidate && event.pointerId === pointerCandidate.id) finishPointerReorder(true);
  }

  function handlePointerCancel(event: PointerEvent) {
    if (pointerCandidate && event.pointerId === pointerCandidate.id) finishPointerReorder(false);
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
    if (event.key === 'Escape' && $contextMenuStore.isOpen) {
      contextMenuStore.close();
      return;
    }
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
      if (get(fileReorderStore).sourceId === file.id) fileReorderStore.reset();
      stopPointerTracking();
    };
  });
</script>

<div
  class="file-row"
  class:active={isActive}
  class:modified={file.isModified}
  class:drop-target={$fileReorderStore.targetId === file.id && $fileReorderStore.position === 'before'}
  class:drop-after={$fileReorderStore.targetId === file.id && $fileReorderStore.position === 'after'}
  data-file-row-id={file.id}
  role="listitem"
>
  <button
    type="button"
    class="file-main"
    class:dragging={$fileReorderStore.sourceId === file.id}
    class:reorder-enabled={allowReorder && !isRenaming}
    onclick={handleClick}
    oncontextmenu={handleContextMenu}
    onpointerdown={handlePointerDown}
    title={file.path || file.name}
  >
    <span class="file-icon"><FileText size={16} strokeWidth={1.7} /></span>
    <span class="file-copy">
      {#if isRenaming}
        <input
          type="text"
          bind:value={newFileName}
          bind:this={inputElement}
          onblur={handleRenameSubmit}
          onkeydown={handleRenameKeydown}
          onclick={(event) => event.stopPropagation()}
          aria-label="Rename {file.name}"
        />
      {:else}
        <span class="file-name">
          <span>{file.name}</span>
          {#if file.isModified}<span class="modified-dot" title="Unsaved changes"></span>{/if}
        </span>
      {/if}
      <span class="file-meta">{secondaryText}</span>
    </span>
  </button>

  <div class="row-actions">
    <button class="menu-action" type="button" onclick={handleMenuClick} title="File actions" aria-label="Actions for {file.name}">
      <MoreHorizontal size={14} />
    </button>
    <button class="close-action" type="button" onclick={handleClose} title="Close file" aria-label="Close {file.name}">
      <X size={13} />
    </button>
  </div>

  {#if $contextMenuStore.isOpen && $contextMenuStore.fileId === file.id}
    <div
      bind:this={contextMenuElement}
      class="file-menu"
      style="left: {$contextMenuStore.x}px; top: {$contextMenuStore.y}px"
      role="menu"
      aria-label="Actions for {file.name}"
    >
      <button type="button" role="menuitem" onclick={handleOpenInNewWindow} disabled={!file.path}>
        <ExternalLink size={15} /><span>Open in new window</span>
      </button>
      <button type="button" role="menuitem" onclick={handleOpenFilePath} disabled={!file.path}>
        <FolderSearch size={15} /><span>Show in folder</span><kbd>Ctrl E</kbd>
      </button>
      <span class="menu-divider"></span>
      <button type="button" role="menuitem" onclick={handleRename}>
        <Pencil size={15} /><span>Rename</span><kbd>F2</kbd>
      </button>
      <button type="button" role="menuitem" onclick={handleSaveAs}>
        <Save size={15} /><span>Save as</span><kbd>Ctrl Shift S</kbd>
      </button>
      <button type="button" role="menuitem" onclick={() => move(-1)} disabled={!allowReorder || index === 0}>
        <ArrowUp size={15} /><span>Move up</span>
      </button>
      <button type="button" role="menuitem" onclick={() => move(1)} disabled={!allowReorder || index === totalFiles - 1}>
        <ArrowDown size={15} /><span>Move down</span>
      </button>
      <span class="menu-divider"></span>
      <button type="button" role="menuitem" class="danger" onclick={handleDelete} disabled={!file.path}>
        <Trash2 size={15} /><span>Move to recycle bin</span>
      </button>
      <button type="button" role="menuitem" onclick={handleClose}>
        <X size={15} /><span>Close</span><kbd>Ctrl W</kbd>
      </button>
    </div>
  {/if}
</div>

<style>
  .file-row {
    position: relative;
    display: flex;
    width: 100%;
    min-width: 0;
    min-height: 44px;
    align-items: stretch;
    overflow: hidden;
    border: 1px solid transparent;
    border-radius: 5px;
  }

  .file-row:hover {
    background: color-mix(in oklab, var(--color-surface-800) 50%, transparent);
  }

  .file-row.active {
    border-color: color-mix(in oklab, var(--color-primary-500) 28%, transparent);
    background: color-mix(in oklab, var(--color-primary-800) 24%, var(--color-surface-900));
  }

  .file-row.active::before {
    position: absolute;
    inset: 5px auto 5px 0;
    width: 2px;
    border-radius: 2px;
    background: var(--color-primary-400);
    content: '';
  }

  .file-row.drop-target {
    border-top-color: var(--color-primary-400);
  }

  .file-row.drop-after {
    border-bottom-color: var(--color-primary-400);
  }

  .file-main {
    display: grid;
    width: 100%;
    min-width: 0;
    grid-template-columns: 18px minmax(0, 1fr);
    align-items: center;
    gap: 5px;
    padding: 4px 44px 4px 8px;
    border: 0;
    background: transparent;
    color: var(--color-surface-300);
    text-align: left;
    cursor: pointer;
  }

  .file-main.reorder-enabled {
    cursor: grab;
  }

  .file-main.reorder-enabled:active,
  .file-main.dragging {
    cursor: grabbing;
  }

  .file-main.dragging {
    opacity: 0.42;
  }

  .file-icon {
    display: grid;
    place-items: center;
    color: var(--color-surface-500);
  }

  .file-icon :global(svg) {
    width: 15px;
    height: 15px;
  }

  .active .file-icon {
    color: var(--color-primary-300);
  }

  .file-copy,
  .file-name,
  .file-meta {
    min-width: 0;
  }

  .file-copy,
  .file-name {
    display: flex;
  }

  .file-copy {
    flex-direction: column;
    gap: 2px;
  }

  .file-name {
    align-items: center;
    gap: 6px;
    color: var(--color-surface-200);
    font-size: 0.72rem;
    font-weight: 560;
  }

  .file-name > span:first-child,
  .file-meta {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .modified-dot {
    width: 6px;
    height: 6px;
    flex: 0 0 6px;
    border-radius: 50%;
    background: var(--color-warning-500);
  }

  .file-meta {
    display: block;
    color: var(--color-surface-600);
    font-size: 0.58rem;
  }

  .file-copy input {
    width: 100%;
    height: 22px;
    padding: 0 5px;
    border: 1px solid var(--color-primary-500);
    border-radius: 3px;
    outline: 0;
    background: var(--color-surface-950);
    color: var(--color-surface-100);
    font: inherit;
    font-size: 0.72rem;
  }

  .row-actions {
    position: absolute;
    top: 50%;
    right: 3px;
    display: flex;
    gap: 0;
    transform: translateY(-50%);
  }

  .row-actions button {
    display: grid;
    width: 20px;
    height: 22px;
    place-items: center;
    padding: 0;
    border: 0;
    border-radius: 3px;
    background: transparent;
    color: var(--color-surface-600);
    cursor: pointer;
    opacity: 0;
    pointer-events: none;
    transition: color 100ms ease, background 100ms ease, opacity 100ms ease;
  }

  .file-row.active .close-action {
    opacity: 0.72;
    pointer-events: auto;
  }

  .file-row:hover .row-actions button,
  .row-actions:focus-within button {
    opacity: 1;
    pointer-events: auto;
  }

  .row-actions button:hover {
    background: color-mix(in oklab, var(--color-surface-600) 26%, transparent);
    color: var(--color-surface-50);
  }

  .file-menu {
    position: fixed;
    z-index: 100;
    width: 192px;
    padding: 5px;
    overflow: hidden;
    border: 1px solid color-mix(in oklab, var(--color-surface-500) 42%, transparent);
    border-radius: 6px;
    background: color-mix(in oklab, var(--color-surface-900) 97%, black);
    box-shadow: 0 14px 38px rgb(0 0 0 / 40%);
  }

  .file-menu button {
    display: grid;
    width: 100%;
    min-height: 31px;
    grid-template-columns: 20px minmax(0, 1fr) auto;
    align-items: center;
    gap: 6px;
    padding: 0 7px;
    border: 0;
    border-radius: 3px;
    background: transparent;
    color: var(--color-surface-300);
    font: inherit;
    font-size: 0.7rem;
    text-align: left;
    cursor: pointer;
  }

  .file-menu button:hover:not(:disabled) {
    background: var(--color-surface-800);
    color: var(--color-surface-50);
  }

  .file-menu button:disabled {
    opacity: 0.32;
    cursor: default;
  }

  .file-menu button.danger {
    color: var(--color-error-300);
  }

  .file-menu button.danger:hover:not(:disabled) {
    background: color-mix(in oklab, var(--color-error-900) 48%, var(--color-surface-900));
  }

  .file-menu kbd {
    color: var(--color-surface-600);
    font-family: inherit;
    font-size: 0.55rem;
  }

  .menu-divider {
    display: block;
    height: 1px;
    margin: 4px 3px;
    background: color-mix(in oklab, var(--color-surface-500) 28%, transparent);
  }

  button:focus-visible {
    outline: 2px solid var(--color-primary-400);
    outline-offset: 1px;
  }
</style>
