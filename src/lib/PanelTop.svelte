<script lang="ts">
  import { FilePlus, FolderOpen, Save, WrapText, Eye, Palette, Code, RotateCcw, Info, PanelLeftClose, PanelLeft, FileCode, Clock, Droplet } from "@lucide/svelte";
  import { documentService } from './documents/documentService';
  import { editorStore } from './stores/editor';
  import { themeStore } from './stores/theme';
  import type { Theme } from './stores/theme';
  import { fileStore } from './stores/files';
  import { sidePanelStore } from './stores/sidePanelStore';
  import { monacoThemeStore } from './stores/monacoTheme';
  import { availableLanguages } from './stores/language';
  import { configStore } from './stores/configStore';
  import { message } from '@tauri-apps/plugin-dialog';
  import { onMount } from 'svelte';
  import { ENCODINGS, type Encoding } from './types/config';
  import { THEMES } from './types/theme';
  

  $: wordWrap = $editorStore.wordWrap;
  $: showInvisibles = $editorStore.showInvisibles;
  $: language = $editorStore.language;
  $: fontSize = $editorStore.fontSize;
  $: isSidePanelVisible = $sidePanelStore;
  $: monacoTheme = $monacoThemeStore;
  $: recentFiles = ($configStore.recent_files || []).slice(0, 10);

  let isFontSizeMenuOpen = false;
  const fontSizes = [8, 9, 10, 11, 12, 13, 14, 15, 16, 18, 20, 22, 24, 26, 28, 30, 32];
  let isRecentFilesMenuOpen = false;
  let selectedRecentIndex = 0;
  let recentFilesMenu: HTMLDivElement;

  function handleFontSizeChange(size: number) {
    editorStore.setFontSize(size);
    isFontSizeMenuOpen = false;
  }

  let isLanguageMenuOpen = false;

  function handleLanguageChange(lang: string) {
    editorStore.setLanguage(lang);
    if ($fileStore.activeFileId) {
      fileStore.updateFile($fileStore.activeFileId, {
        language: lang
      });
    }
    isLanguageMenuOpen = false;
  }

  const themes = THEMES;

  let isThemeMenuOpen = false;
  let isMonacoThemeMenuOpen = false;
  let availableMonacoThemes: string[] = ['vs', 'vs-dark', 'hc-black', 'Firow'];

  let isOpacityMenuOpen = false;
  let opacityPercent = 85;
  $: if ($configStore.window_opacity !== undefined) {
    opacityPercent = Math.round(($configStore.window_opacity || 0.85) * 100);
  }

  function toggleTransparentMode() {
    isOpacityMenuOpen = !isOpacityMenuOpen;
  }

  function applyOpacityFromPercent(percent: number) {
    const clamped = Math.max(10, Math.min(100, Math.round(percent)));
    const nextOpacity = clamped / 100;
    try {
      document.documentElement.style.setProperty('--overlayOpacity', String(nextOpacity));
    } catch {}
    const enableTransparent = nextOpacity < 1;
    void configStore.save({
      window_opacity: nextOpacity,
      transparent_mode: enableTransparent
    });
    opacityPercent = clamped;
  }

  function handleNewFile() {
    documentService.createUntitled();
  }

  async function handleCloseActiveFile() {
    if ($fileStore.activeFileId) await documentService.closeDocument($fileStore.activeFileId);
  }

  async function handleOpenFile() {
    await documentService.openFromDialog();
  }

  function openRecentFilesMenu() {
    isRecentFilesMenuOpen = true;
    selectedRecentIndex = 0;
    setTimeout(() => {
      if (recentFilesMenu) {
        recentFilesMenu.focus();
      }
    }, 0);
  }

  function handleRecentMenuKeydown(event: KeyboardEvent) {
    if (!isRecentFilesMenuOpen || recentFiles.length === 0) return;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        selectedRecentIndex = (selectedRecentIndex + 1) % recentFiles.length;
        scrollToSelectedItem();
        break;
      case 'ArrowUp':
        event.preventDefault();
        selectedRecentIndex = (selectedRecentIndex - 1 + recentFiles.length) % recentFiles.length;
        scrollToSelectedItem();
        break;
      case 'Enter':
        event.preventDefault();
        if (recentFiles[selectedRecentIndex]) {
          handleOpenRecentFile(recentFiles[selectedRecentIndex]);
        }
        break;
      case 'Escape':
        event.preventDefault();
        isRecentFilesMenuOpen = false;
        break;
    }
  }

  function scrollToSelectedItem() {
    setTimeout(() => {
      if (recentFilesMenu) {
        const selectedElement = recentFilesMenu.querySelector(`[data-index="${selectedRecentIndex}"]`);
        if (selectedElement) {
          selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
      }
    }, 0);
  }

  async function handleOpenRecentFile(filePath: string) {
    await documentService.openRecentFile(filePath);
    isRecentFilesMenuOpen = false;
  }

  async function handleSaveFile() {
    if ($fileStore.activeFileId) await documentService.saveDocument($fileStore.activeFileId);
  }

  async function handleRestoreFile() {
    await documentService.restoreRecentFile();
  }

  async function handleAbout() {
    await message('NoteStoat v.0.4.1', 'About');
  }


  $: windowTitle = (() => {
    const activeFile = $fileStore.files.find(f => f.id === $fileStore.activeFileId);
    if (activeFile) {
      const fileName = activeFile.name || 'Untitled';
      const modifiedIndicator = activeFile.isModified ? ' •' : '';
      return `${fileName}${modifiedIndicator}`;
    }
    return 'NoteStoat';
  })();

  

  function handleKeydown(event: KeyboardEvent) {
    if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.code === 'KeyN') {
      event.preventDefault();
      handleNewFile();
    } else if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.code === 'KeyO') {
      event.preventDefault();
      handleOpenFile();
    } else if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.code === 'KeyS') {
      event.preventDefault();
      handleSaveFile();
    } else if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.code === 'KeyR') {
      event.preventDefault();
      openRecentFilesMenu();
    } else if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.code === 'KeyT') {
      event.preventDefault();
      handleRestoreFile();
    } else if (event.altKey && !event.ctrlKey && !event.shiftKey && event.code === 'KeyZ') {
      event.preventDefault();
      editorStore.setWordWrap(!wordWrap);
    } else if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.code === 'KeyW') {
      event.preventDefault();
      handleCloseActiveFile();
    } else if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.code === 'KeyB') {
      event.preventDefault();
      sidePanelStore.toggle();
    }
  }

  const encodings = ENCODINGS;

  let isEncodingMenuOpen = false;

  async function handleEncodingChange(encoding: Encoding) {
    if ($fileStore.activeFileId) {
      await documentService.changeEncoding($fileStore.activeFileId, encoding);
    } else {
      editorStore.setEncoding(encoding);
    }
    isEncodingMenuOpen = false;
  }

  onMount(() => {
    window.addEventListener('keydown', handleKeydown);
    
    // Load available Monaco themes
    monacoThemeStore.getAvailableThemes().then(themes => {
      availableMonacoThemes = themes;
    }).catch(error => {
      console.error('Error loading Monaco themes:', error);
    });
    
    return () => {
      window.removeEventListener('keydown', handleKeydown);
    };
  });
</script>

<div class="flex flex-col w-full z-50">
  <div class="flex flex-row w-full min-h-[22px] max-h-[22px] items-center preset-gradient-one shadow-xl"
       role="toolbar" tabindex="0"
  >
    <div class="flex-1 px-3 text-sm font-medium select-none truncate">
      {windowTitle}
    </div>
  </div>
  
  <div class="flex flex-row w-full min-h-[36px] max-h-[36px] items-center px-2 gap-2 preset-gradient-two">
  <button 
    type="button" 
    class="preset-filled-primary-950-50 btn btn-sm h-7 flex items-center transition-all duration-200 hover:scale-105"
    onclick={handleNewFile}
    title="New (Ctrl+N)"
  >
    <FilePlus size={14} />
  </button>
  <button 
    type="button" 
    class="preset-filled-primary-950-50 btn btn-sm h-7 flex items-center transition-all duration-200 hover:scale-105"
    onclick={handleOpenFile}
    title="Open (Ctrl+O)"
  >
    <FolderOpen size={14} />
  </button>
  <button 
    type="button" 
    class="preset-filled-primary-950-50 btn btn-sm h-7 flex items-center transition-all duration-200 hover:scale-105"
    onclick={handleSaveFile}
    title="Save (Ctrl+S)"
  >
    <Save size={14} />
  </button>
  <div class="relative">
    <button 
      type="button" 
      class="btn btn-sm h-7 flex items-center { (isRecentFilesMenuOpen ? 'preset-tonal-primary' : 'preset-filled-primary-950-50') } transition-all duration-200 hover:scale-105"
      onclick={openRecentFilesMenu}
      title="Recent (Ctrl+R)"
    >
      <Clock size={14} />
    </button>
    {#if isRecentFilesMenuOpen}
      <div 
        bind:this={recentFilesMenu}
        role="menu"
        tabindex="-1"
        class="absolute left-0 top-full mt-1 w-96 preset-filled-primary-950-50 rounded-none shadow-xl z-50 max-h-64 overflow-y-auto focus:outline-none"
        onmouseleave={() => isRecentFilesMenuOpen = false}
        onkeydown={handleRecentMenuKeydown}
      >
        {#if recentFiles.length > 0}
          {#each recentFiles as filePath, index}
            {@const fileName = filePath.split(/[/\\]/).pop() || filePath}
            <button
              role="menuitem"
              type="button"
              data-index={index}
              class="text-xs w-full text-left btn preset-filled-primary-950-50 rounded-none"
              onclick={() => handleOpenRecentFile(filePath)}
              onmouseenter={() => selectedRecentIndex = index}
            >
              <span class="font-medium">{fileName}</span>
              <span class="text-[10px] truncate">{filePath}</span>
            </button>
          {/each}
        {:else}
          <div class="text-xs px-3 py-2 text-surface-400">
            No recent files
          </div>
        {/if}
      </div>
    {/if}
  </div>
  <div class="w-px h-6 mx-1 bg-primary-100"></div>
  <button 
    type="button" 
    class="preset-filled-primary-950-50 btn btn-sm h-7 flex items-center transition-all duration-200 hover:scale-105"
    onclick={handleRestoreFile}
    title="Restore (Ctrl+Shift+T)"
  >
    <RotateCcw size={14} />
  </button>
  <button 
    type="button" 
    class="btn btn-sm h-7 flex items-center { (wordWrap ? 'preset-tonal-primary' : 'preset-filled-primary-950-50') } transition-all duration-200 hover:scale-105"
    onclick={() => editorStore.setWordWrap(!wordWrap)}
    title="Word Wrap (Alt+Z)"
  >
    <WrapText size={14} />
  </button>
  <button 
    type="button" 
    class="btn btn-sm h-7 flex items-center { (showInvisibles ? 'preset-tonal-primary' : 'preset-filled-primary-950-50') } transition-all duration-200 hover:scale-105"
    onclick={() => editorStore.setShowInvisibles(!showInvisibles)}
    title="Show Space Characters"
  >
    <Eye size={14} />
  </button>
  <div class="w-px h-6 mx-1 bg-primary-100"></div>
  <div class="relative">
    <button 
      type="button" 
      class="btn btn-sm h-7 flex items-center { (isThemeMenuOpen ? 'preset-tonal-primary' : 'preset-filled-primary-950-50') } transition-all duration-200 hover:scale-105"
      onclick={() => isThemeMenuOpen = !isThemeMenuOpen}
      title="Theme"
    >
      <Palette size={14} />
    </button>
    {#if isThemeMenuOpen}
      <div 
        role="menu"
        tabindex="-1"
        class="absolute left-0 top-full mt-1 w-64 preset-filled-primary-950-50 rounded-none shadow-xl z-50 max-h-64 overflow-y-auto focus:outline-none"
        onmouseleave={() => isThemeMenuOpen = false}
      >
        {#each themes as theme}
          <button
            role="menuitem"
            type="button"
            class="text-xs w-full text-left btn preset-filled-primary-950-50 rounded-none capitalize"
            onclick={() => { themeStore.setTheme(theme as Theme); isThemeMenuOpen = false; }}
          >
            {theme}
          </button>
        {/each}
      </div>
    {/if}
  </div>
  <div class="relative">
    <button 
      type="button" 
      class="preset-filled-primary-950-50 btn btn-sm h-7 flex items-center transition-all duration-200 hover:scale-105"
      onclick={toggleTransparentMode}
      title="Transparency"
    >
      <Droplet size={14} />
    </button>
    {#if isOpacityMenuOpen}
      <div
        role="menu"
        tabindex="-1"
        class="absolute left-0 top-full mt-1 w-64 preset-filled-primary-950-50 rounded-none shadow-xl z-50 p-3 focus:outline-none"
        onmouseleave={() => isOpacityMenuOpen = false}
      >
        <div class="w-full space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-xs">Transparency</span>
            <span class="text-[11px] opacity-70">{opacityPercent}%</span>
          </div>
          <input
            class="input w-full"
            type="range"
            min="10"
            max="100"
            step="1"
            bind:value={opacityPercent}
            oninput={(e) => applyOpacityFromPercent(Number((e.target as HTMLInputElement).value))}
            aria-label="Window opacity percentage"
          />
        </div>
      </div>
    {/if}
  </div>
  <div class="relative">
    <button 
      type="button" 
      class="btn btn-sm h-7 flex items-center { (isMonacoThemeMenuOpen ? 'preset-tonal-primary' : 'preset-filled-primary-950-50') } transition-all duration-200 hover:scale-105"
      onclick={() => isMonacoThemeMenuOpen = !isMonacoThemeMenuOpen}
      title="Monaco Editor Theme"
    >
      <FileCode size={14} />
    </button>
    {#if isMonacoThemeMenuOpen}
      <div 
        role="menu"
        tabindex="-1"
        class="absolute left-0 top-full mt-1 w-64 preset-filled-primary-950-50 rounded-none shadow-xl z-50 max-h-64 overflow-y-auto focus:outline-none"
        onmouseleave={() => isMonacoThemeMenuOpen = false}
      >
        {#each availableMonacoThemes as theme}
          <button
            role="menuitem"
            type="button"
            class="text-xs w-full text-left btn preset-filled-primary-950-50 rounded-none"
            class:bg-surface-500={monacoTheme === theme}
            onclick={() => { monacoThemeStore.setTheme(theme); isMonacoThemeMenuOpen = false; }}
          >
            {theme}
          </button>
        {/each}
      </div>
    {/if}
  </div>
  <div class="relative">
    <button 
      type="button" 
      class="btn btn-sm h-7 flex items-center gap-2 { (isLanguageMenuOpen ? 'preset-tonal-primary' : 'preset-filled-primary-950-50') } transition-all duration-200 hover:scale-105"
      onclick={() => isLanguageMenuOpen = !isLanguageMenuOpen}
      title="Language"
    >
      <Code size={14} />
      <span class="text-xs capitalize">{language}</span>
    </button>
    {#if isLanguageMenuOpen}
      <div 
        role="menu"
        tabindex="-1"
        class="absolute left-0 top-full mt-1 w-64 preset-filled-primary-950-50 rounded-none shadow-xl z-50 max-h-64 overflow-y-auto focus:outline-none"
        onmouseleave={() => isLanguageMenuOpen = false}
      >
        {#each availableLanguages as lang}
          <button
            role="menuitem"
            type="button"
            class="text-xs w-full text-left btn preset-filled-primary-950-50 rounded-none capitalize"
            class:bg-surface-500={language === lang}
            onclick={() => handleLanguageChange(lang)}
          >
            {lang}
          </button>
        {/each}
      </div>
    {/if}
  </div>
  <div class="relative">
    <button 
      type="button" 
      class="btn btn-sm h-7 flex items-center gap-2 { (isEncodingMenuOpen ? 'preset-tonal-primary' : 'preset-filled-primary-950-50') } transition-all duration-200 hover:scale-105"
      onclick={() => isEncodingMenuOpen = !isEncodingMenuOpen}
      title="Encoding"
    >
      <span class="text-xs uppercase">{$editorStore.encoding || 'UTF-8'}</span>
    </button>
    {#if isEncodingMenuOpen}
      <div 
        role="menu"
        tabindex="-1"
        class="absolute left-0 top-full mt-1 w-32 preset-filled-primary-950-50 rounded-none shadow-xl z-50 max-h-64 overflow-y-auto focus:outline-none"
        onmouseleave={() => isEncodingMenuOpen = false}
      >
        {#each encodings as encoding}
          <button
            role="menuitem"
            type="button"
            class="text-xs w-full text-left btn preset-filled-primary-950-50 rounded-none uppercase"
            class:bg-surface-500={$editorStore.encoding === encoding}
            onclick={() => handleEncodingChange(encoding)}
          >
            {encoding}
          </button>
        {/each}
      </div>
    {/if}
  </div>
  <div class="relative">
    <button 
      type="button" 
      class="btn btn-sm h-7 flex items-center gap-2 { (isFontSizeMenuOpen ? 'preset-tonal-primary' : 'preset-filled-primary-950-50') } transition-all duration-200 hover:scale-105"
      onclick={() => isFontSizeMenuOpen = !isFontSizeMenuOpen}
      title="Font Size"
    >
      <span class="text-xs">{fontSize}px</span>
    </button>
    {#if isFontSizeMenuOpen}
      <div 
        role="menu"
        tabindex="-1"
        class="absolute left-0 top-full mt-1 w-32 preset-filled-primary-950-50 rounded-none shadow-xl z-50 max-h-64 overflow-y-auto focus:outline-none"
        onmouseleave={() => isFontSizeMenuOpen = false}
      >
        {#each fontSizes as size}
          <button
            role="menuitem"
            type="button"
            class="text-xs w-full text-left btn preset-filled-primary-950-50 rounded-none"
            class:bg-surface-500={fontSize === size}
            onclick={() => handleFontSizeChange(size)}
          >
            {size}px
          </button>
        {/each}
      </div>
    {/if}
  </div>
  <button 
    type="button" 
    class="btn btn-sm h-7 flex items-center { (isSidePanelVisible ? 'preset-tonal-primary' : 'preset-filled-primary-950-50') } transition-all duration-200 hover:scale-105"
    onclick={() => sidePanelStore.toggle()}
    title="Show/Hide Side Panel (Ctrl+B)"
  >
    {#if isSidePanelVisible}
      <PanelLeftClose size={14} />
    {:else}
      <PanelLeft size={14} />
    {/if}
  </button>
  <div class="w-px h-6 mx-1 bg-primary-100"></div>
  <button
    type="button"
    class="preset-filled-primary-950-50 btn btn-sm h-7 flex items-center transition-all duration-200 hover:scale-105"
    onclick={handleAbout}
    title="About"
  >
    <Info size={14} />
  </button>
  </div>
</div>
