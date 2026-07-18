<script lang="ts">
  import { ArrowUpDown, Check, FilePlus, Files, FolderOpen, ListFilter, Search, X } from '@lucide/svelte';
  import { onMount } from 'svelte';
  import TabFile from './elems/TabFile.svelte';
  import { documentService } from './documents/documentService';
  import { fileStore } from './stores/files';

  let searchQuery = '';
  let filterMode: 'all' | 'modified' | 'markdown' | 'unsaved' = 'all';
  let sortMode: 'manual' | 'name' | 'modified' | 'type' = 'manual';
  let isFilterMenuOpen = false;
  let isSortMenuOpen = false;
  let filterButton: HTMLButtonElement;
  let sortButton: HTMLButtonElement;
  let filterMenu: HTMLDivElement;
  let sortMenu: HTMLDivElement;

  $: files = $fileStore.files;
  $: activeFileId = $fileStore.activeFileId;
  $: normalizedQuery = searchQuery.trim().toLowerCase();
  $: filteredFiles = files.filter(file => {
    const matchesSearch = !normalizedQuery ||
      file.name.toLowerCase().includes(normalizedQuery) ||
      file.path.toLowerCase().includes(normalizedQuery);
    if (!matchesSearch) return false;

    if (filterMode === 'modified') return file.isModified;
    if (filterMode === 'markdown') {
      return file.language === 'markdown' || /\.(md|markdown|mdown|mkdn)$/i.test(file.name);
    }
    if (filterMode === 'unsaved') return !file.path;
    return true;
  });
  $: visibleFiles = [...filteredFiles].sort((left, right) => {
    if (sortMode === 'name') return left.name.localeCompare(right.name);
    if (sortMode === 'modified') {
      const leftTime = (left.fileSystemModified ?? left.modified ?? left.created).getTime();
      const rightTime = (right.fileSystemModified ?? right.modified ?? right.created).getTime();
      return rightTime - leftTime;
    }
    if (sortMode === 'type') {
      const leftType = left.name.split('.').pop()?.toLowerCase() ?? '';
      const rightType = right.name.split('.').pop()?.toLowerCase() ?? '';
      return leftType.localeCompare(rightType) || left.name.localeCompare(right.name);
    }
    return 0;
  });

  const filterOptions = [
    ['all', 'All files'],
    ['modified', 'Modified'],
    ['markdown', 'Markdown'],
    ['unsaved', 'Unsaved']
  ] as const;

  const sortOptions = [
    ['manual', 'Manual order'],
    ['name', 'Name'],
    ['modified', 'Last modified'],
    ['type', 'File type']
  ] as const;

  function toggleFilterMenu() {
    isFilterMenuOpen = !isFilterMenuOpen;
    isSortMenuOpen = false;
  }

  function toggleSortMenu() {
    isSortMenuOpen = !isSortMenuOpen;
    isFilterMenuOpen = false;
  }

  function clearFilters() {
    searchQuery = '';
    filterMode = 'all';
  }

  function handleWindowPointerDown(event: PointerEvent) {
    const target = event.target as Node;
    if (isFilterMenuOpen && !filterMenu?.contains(target) && !filterButton?.contains(target)) {
      isFilterMenuOpen = false;
    }
    if (isSortMenuOpen && !sortMenu?.contains(target) && !sortButton?.contains(target)) {
      isSortMenuOpen = false;
    }
  }

  function handleWindowKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      isFilterMenuOpen = false;
      isSortMenuOpen = false;
    }
  }

  onMount(() => {
    window.addEventListener('pointerdown', handleWindowPointerDown);
    window.addEventListener('keydown', handleWindowKeydown);
    return () => {
      window.removeEventListener('pointerdown', handleWindowPointerDown);
      window.removeEventListener('keydown', handleWindowKeydown);
    };
  });
</script>

<aside class="files-panel" aria-label="Open files">
  <header class="files-header">
    <div>
      <span>Files</span>
      <span class="file-count">{files.length}</span>
    </div>
    <div class="header-actions">
      <button
        bind:this={filterButton}
        type="button"
        class:active={filterMode !== 'all'}
        onclick={toggleFilterMenu}
        title="Filter files"
        aria-haspopup="menu"
        aria-expanded={isFilterMenuOpen}
      >
        <ListFilter size={15} />
      </button>
      <button
        bind:this={sortButton}
        type="button"
        class:active={sortMode !== 'manual'}
        onclick={toggleSortMenu}
        title="Sort files"
        aria-haspopup="menu"
        aria-expanded={isSortMenuOpen}
      >
        <ArrowUpDown size={15} />
      </button>
    </div>
  </header>

  {#if isFilterMenuOpen}
    <div bind:this={filterMenu} class="header-menu" role="menu" aria-label="Filter files">
      <div class="menu-label">Show</div>
      {#each filterOptions as option}
        <button
          type="button"
          role="menuitemradio"
          aria-checked={filterMode === option[0]}
          onclick={() => {
            filterMode = option[0];
            isFilterMenuOpen = false;
          }}
        >
          <span class="check-slot">{#if filterMode === option[0]}<Check size={13} />{/if}</span>
          <span>{option[1]}</span>
        </button>
      {/each}
    </div>
  {/if}

  {#if isSortMenuOpen}
    <div bind:this={sortMenu} class="header-menu" role="menu" aria-label="Sort files">
      <div class="menu-label">Sort by</div>
      {#each sortOptions as option}
        <button
          type="button"
          role="menuitemradio"
          aria-checked={sortMode === option[0]}
          onclick={() => {
            sortMode = option[0];
            isSortMenuOpen = false;
          }}
        >
          <span class="check-slot">{#if sortMode === option[0]}<Check size={13} />{/if}</span>
          <span>{option[1]}</span>
        </button>
      {/each}
    </div>
  {/if}

  <div class="search-box">
    <Search size={14} />
    <input
      type="search"
      bind:value={searchQuery}
      placeholder="Search files"
      aria-label="Search open files"
    />
    {#if searchQuery}
      <button type="button" onclick={() => searchQuery = ''} title="Clear search">
        <X size={13} />
      </button>
    {/if}
  </div>

  <div class="file-list" role="list">
    {#if visibleFiles.length}
      {#each visibleFiles as file (file.id)}
        <TabFile
          {file}
          index={files.findIndex(candidate => candidate.id === file.id)}
          isActive={file.id === activeFileId}
          totalFiles={files.length}
          allowReorder={sortMode === 'manual'}
        />
      {/each}
    {:else if files.length}
      <div class="panel-empty compact">
        <Search size={20} />
        <span>No matches</span>
        <button type="button" onclick={clearFilters}>Clear filters</button>
      </div>
    {:else}
      <div class="panel-empty">
        <Files size={26} strokeWidth={1.5} />
        <span>No open files</span>
        <div>
          <button type="button" onclick={() => documentService.createUntitled()}>
            <FilePlus size={14} />
            <span>New</span>
          </button>
          <button type="button" onclick={() => documentService.openFromDialog()}>
            <FolderOpen size={14} />
            <span>Open</span>
          </button>
        </div>
      </div>
    {/if}
  </div>
</aside>

<style>
  .files-panel {
    position: relative;
    display: flex;
    width: 100%;
    height: 100%;
    min-width: 0;
    min-height: 0;
    flex-direction: column;
    border-right: 1px solid color-mix(in oklab, var(--color-surface-500) 28%, transparent);
    background: color-mix(in oklab, var(--color-surface-900) 94%, black);
    color: var(--color-surface-200);
  }

  .files-header {
    display: flex;
    min-height: 40px;
    align-items: center;
    justify-content: space-between;
    padding: 0 8px 0 12px;
    border-bottom: 1px solid color-mix(in oklab, var(--color-surface-500) 25%, transparent);
  }

  .files-header > div:first-child {
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
  }

  .file-count {
    display: grid;
    min-width: 18px;
    height: 18px;
    place-items: center;
    border-radius: 4px;
    background: var(--color-surface-800);
    color: var(--color-surface-400);
    font-size: 0.62rem;
  }

  .header-actions {
    display: flex;
    gap: 2px;
  }

  .header-actions button,
  .search-box button {
    display: grid;
    width: 27px;
    height: 27px;
    place-items: center;
    padding: 0;
    border: 0;
    border-radius: 4px;
    background: transparent;
    color: var(--color-surface-400);
    cursor: pointer;
  }

  .header-actions button:hover,
  .search-box button:hover {
    background: var(--color-surface-800);
    color: var(--color-surface-100);
  }

  .header-actions button.active {
    background: color-mix(in oklab, var(--color-primary-700) 45%, var(--color-surface-900));
    color: var(--color-primary-200);
  }

  .header-menu {
    position: absolute;
    top: 36px;
    right: 5px;
    z-index: 60;
    width: 176px;
    padding: 5px;
    overflow: hidden;
    border: 1px solid color-mix(in oklab, var(--color-surface-500) 42%, transparent);
    border-radius: 6px;
    background: color-mix(in oklab, var(--color-surface-900) 97%, black);
    box-shadow: 0 12px 32px rgb(0 0 0 / 38%);
  }

  .menu-label {
    padding: 5px 7px 4px;
    color: var(--color-surface-600);
    font-size: 0.6rem;
    font-weight: 700;
    text-transform: uppercase;
  }

  .header-menu button {
    display: grid;
    width: 100%;
    min-height: 30px;
    grid-template-columns: 18px minmax(0, 1fr);
    align-items: center;
    gap: 5px;
    padding: 0 7px;
    border: 0;
    border-radius: 3px;
    background: transparent;
    color: var(--color-surface-300);
    font: inherit;
    font-size: 0.69rem;
    text-align: left;
    cursor: pointer;
  }

  .header-menu button:hover {
    background: var(--color-surface-800);
    color: var(--color-surface-50);
  }

  .check-slot {
    display: grid;
    place-items: center;
    color: var(--color-primary-300);
  }

  .search-box {
    position: relative;
    display: flex;
    height: 32px;
    align-items: center;
    margin: 8px;
    border: 1px solid color-mix(in oklab, var(--color-surface-500) 42%, transparent);
    border-radius: 5px;
    background: var(--color-surface-950);
    color: var(--color-surface-500);
  }

  .search-box > :global(svg) {
    position: absolute;
    left: 9px;
    pointer-events: none;
  }

  .search-box input {
    width: 100%;
    min-width: 0;
    height: 100%;
    padding: 0 30px 0 29px;
    border: 0;
    outline: 0;
    background: transparent;
    color: var(--color-surface-100);
    font: inherit;
    font-size: 0.72rem;
  }

  .search-box input::placeholder {
    color: var(--color-surface-600);
  }

  .search-box input::-webkit-search-cancel-button,
  .search-box input::-webkit-search-decoration {
    display: none;
    appearance: none;
    -webkit-appearance: none;
  }

  .search-box:focus-within {
    border-color: var(--color-primary-500);
    box-shadow: 0 0 0 1px color-mix(in oklab, var(--color-primary-500) 40%, transparent);
  }

  .search-box button {
    position: absolute;
    right: 2px;
    width: 25px;
    height: 25px;
  }

  .file-list {
    min-height: 0;
    flex: 1;
    overflow-y: auto;
    padding: 2px 5px 12px;
  }

  .panel-empty {
    display: flex;
    min-height: 190px;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 9px;
    padding: 18px 8px;
    color: var(--color-surface-500);
    font-size: 0.72rem;
    text-align: center;
  }

  .panel-empty.compact {
    min-height: 130px;
  }

  .panel-empty > div {
    display: flex;
    gap: 5px;
  }

  .panel-empty button {
    display: inline-flex;
    height: 28px;
    align-items: center;
    gap: 5px;
    padding: 0 8px;
    border: 1px solid color-mix(in oklab, var(--color-surface-500) 38%, transparent);
    border-radius: 4px;
    background: var(--color-surface-800);
    color: var(--color-surface-200);
    font: inherit;
    font-size: 0.68rem;
    cursor: pointer;
  }

  .panel-empty button:hover {
    border-color: color-mix(in oklab, var(--color-primary-500) 55%, transparent);
    color: var(--color-surface-50);
  }

  button:focus-visible {
    outline: 2px solid var(--color-primary-400);
    outline-offset: 1px;
  }
</style>
