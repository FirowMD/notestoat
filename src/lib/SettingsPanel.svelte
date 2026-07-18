<script lang="ts">
  import { Info, Minus, Plus, Settings2, X } from '@lucide/svelte';
  import { message } from '@tauri-apps/plugin-dialog';
  import { documentService } from './documents/documentService';
  import { configStore } from './stores/configStore';
  import { editorStore } from './stores/editor';
  import { fileStore } from './stores/files';
  import { availableLanguages } from './stores/language';
  import { monacoThemeStore } from './stores/monacoTheme';
  import { themeStore } from './stores/theme';
  import { ENCODINGS, type Encoding } from './types/config';
  import { THEMES, type Theme } from './types/theme';

  export let availableMonacoThemes: string[];
  export let offsetForDocumentToolbar = false;
  export let onClose: () => void;

  $: activeFile = $fileStore.files.find(file => file.id === $fileStore.activeFileId);
  $: opacityPercent = Math.round(($configStore.window_opacity ?? 0.85) * 100);
  $: transparentMode = $configStore.transparent_mode ?? false;

  function changeFontSize(offset: number) {
    editorStore.setFontSize(Math.max(8, Math.min(32, $editorStore.fontSize + offset)));
  }

  function handleLanguageChange(event: Event) {
    const language = (event.target as HTMLSelectElement).value;
    editorStore.setLanguage(language);
    if (activeFile) fileStore.updateFile(activeFile.id, { language });
  }

  async function handleEncodingChange(event: Event) {
    const encoding = (event.target as HTMLSelectElement).value as Encoding;
    if (activeFile) await documentService.changeEncoding(activeFile.id, encoding);
    else editorStore.setEncoding(encoding);
  }

  function handleAppThemeChange(event: Event) {
    themeStore.setTheme((event.target as HTMLSelectElement).value as Theme);
  }

  function handleEditorThemeChange(event: Event) {
    void monacoThemeStore.setTheme((event.target as HTMLSelectElement).value);
  }

  function handleTransparencyChange(event: Event) {
    void configStore.save({ transparent_mode: (event.target as HTMLInputElement).checked });
  }

  function handleOpacityChange(event: Event) {
    const percent = Number((event.target as HTMLInputElement).value);
    void configStore.save({ window_opacity: percent / 100 });
  }

  async function handleAbout() {
    await message('NoteStoat v0.4.1', { title: 'About NoteStoat' });
  }
</script>

<aside
  class="settings-panel"
  class:below-document-toolbar={offsetForDocumentToolbar}
  aria-label="Application settings"
>
  <header class="panel-header">
    <div class="panel-title">
      <Settings2 size={16} />
      <span>Settings</span>
    </div>
    <div class="panel-actions">
      <button type="button" class="icon-button" onclick={handleAbout} title="About NoteStoat">
        <Info size={16} />
      </button>
      <button type="button" class="icon-button" onclick={onClose} title="Close settings">
        <X size={16} />
      </button>
    </div>
  </header>

  <div class="panel-content">
    <section class="settings-section">
      <h2>Editor</h2>

      <div class="setting-row">
        <label for="font-size">Font size</label>
        <div class="stepper" id="font-size" aria-label="Editor font size">
          <button type="button" onclick={() => changeFontSize(-1)} disabled={$editorStore.fontSize <= 8} title="Decrease font size">
            <Minus size={14} />
          </button>
          <output>{$editorStore.fontSize}px</output>
          <button type="button" onclick={() => changeFontSize(1)} disabled={$editorStore.fontSize >= 32} title="Increase font size">
            <Plus size={14} />
          </button>
        </div>
      </div>

      <label class="toggle-row">
        <span>Word wrap</span>
        <input
          type="checkbox"
          checked={$editorStore.wordWrap}
          onchange={(event) => editorStore.setWordWrap(event.currentTarget.checked)}
        />
      </label>

      <label class="toggle-row">
        <span>Invisible characters</span>
        <input
          type="checkbox"
          checked={$editorStore.showInvisibles}
          onchange={(event) => editorStore.setShowInvisibles(event.currentTarget.checked)}
        />
      </label>
    </section>

    <section class="settings-section">
      <h2>Document</h2>

      <label class="select-row">
        <span>Language</span>
        <select value={$editorStore.language} onchange={handleLanguageChange} disabled={!activeFile}>
          {#each availableLanguages as language}
            <option value={language}>{language}</option>
          {/each}
        </select>
      </label>

      <label class="select-row">
        <span>Encoding</span>
        <select value={$editorStore.encoding} onchange={handleEncodingChange}>
          {#each ENCODINGS as encoding}
            <option value={encoding}>{encoding.toUpperCase()}</option>
          {/each}
        </select>
      </label>
    </section>

    <section class="settings-section">
      <h2>Appearance</h2>

      <label class="select-row">
        <span>App theme</span>
        <select value={$themeStore} onchange={handleAppThemeChange}>
          {#each THEMES as theme}
            <option value={theme}>{theme}</option>
          {/each}
        </select>
      </label>

      <label class="select-row">
        <span>Editor theme</span>
        <select value={$monacoThemeStore} onchange={handleEditorThemeChange}>
          {#each availableMonacoThemes as theme}
            <option value={theme}>{theme}</option>
          {/each}
        </select>
      </label>
    </section>

    <section class="settings-section">
      <h2>Window</h2>

      <label class="toggle-row">
        <span>Transparent window</span>
        <input type="checkbox" checked={transparentMode} onchange={handleTransparencyChange} />
      </label>

      <label class="range-row">
        <span>
          <span>Opacity</span>
          <output>{opacityPercent}%</output>
        </span>
        <input
          type="range"
          min="20"
          max="100"
          step="1"
          value={opacityPercent}
          disabled={!transparentMode}
          oninput={handleOpacityChange}
        />
      </label>
    </section>
  </div>

</aside>

<style>
  .settings-panel {
    position: absolute;
    top: calc(100% + 6px);
    right: 8px;
    z-index: 80;
    display: flex;
    width: min(340px, calc(100vw - 16px));
    max-height: min(680px, calc(100vh - 68px));
    flex-direction: column;
    overflow: hidden;
    border: 1px solid color-mix(in oklab, var(--color-surface-500) 42%, transparent);
    border-radius: 7px;
    background: color-mix(in oklab, var(--color-surface-900) 96%, black);
    color: var(--color-surface-100);
    box-shadow: 0 18px 48px rgb(0 0 0 / 38%);
  }

  .settings-panel.below-document-toolbar {
    top: calc(100% + 39px);
    max-height: calc(100vh - 93px);
  }

  .panel-header {
    display: flex;
    min-height: 44px;
    align-items: center;
    justify-content: space-between;
    padding: 0 12px;
  }

  .panel-header {
    border-bottom: 1px solid color-mix(in oklab, var(--color-surface-500) 30%, transparent);
  }

  .panel-title,
  .panel-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .panel-title {
    font-size: 0.82rem;
    font-weight: 650;
  }

  .panel-actions {
    gap: 2px;
  }

  .panel-title :global(svg) {
    color: var(--color-primary-300);
  }

  .icon-button,
  .stepper button {
    border: 0;
    color: inherit;
    cursor: pointer;
  }

  .icon-button {
    display: grid;
    width: 28px;
    height: 28px;
    place-items: center;
    border-radius: 4px;
    background: transparent;
    color: var(--color-surface-400);
  }

  .icon-button:hover {
    background: color-mix(in oklab, var(--color-surface-700) 55%, transparent);
    color: var(--color-surface-50);
  }

  .panel-content {
    min-height: 0;
    overflow-y: auto;
  }

  .settings-section {
    padding: 9px 12px 10px;
    border-bottom: 1px solid color-mix(in oklab, var(--color-surface-500) 26%, transparent);
  }

  .settings-section h2 {
    margin: 0 0 6px;
    color: var(--color-surface-400);
    font-size: 0.66rem;
    font-weight: 700;
    letter-spacing: 0;
    text-transform: uppercase;
  }

  .setting-row,
  .toggle-row,
  .select-row,
  .range-row {
    display: flex;
    min-height: 30px;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    font-size: 0.78rem;
  }

  .select-row select {
    width: 160px;
    min-width: 0;
    height: 28px;
    padding: 0 28px 0 8px;
    border: 1px solid color-mix(in oklab, var(--color-surface-500) 45%, transparent);
    border-radius: 4px;
    background: var(--color-surface-950);
    color: var(--color-surface-100);
    font: inherit;
    text-transform: capitalize;
  }

  .select-row select:disabled,
  .range-row input:disabled {
    opacity: 0.45;
  }

  .stepper {
    display: grid;
    grid-template-columns: 28px 48px 28px;
    height: 28px;
    overflow: hidden;
    border: 1px solid color-mix(in oklab, var(--color-surface-500) 45%, transparent);
    border-radius: 4px;
    background: var(--color-surface-950);
  }

  .stepper button {
    display: grid;
    place-items: center;
    background: transparent;
  }

  .stepper button:hover:not(:disabled) {
    background: var(--color-surface-800);
  }

  .stepper button:disabled {
    opacity: 0.35;
    cursor: default;
  }

  .stepper output {
    display: grid;
    place-items: center;
    border-right: 1px solid color-mix(in oklab, var(--color-surface-500) 38%, transparent);
    border-left: 1px solid color-mix(in oklab, var(--color-surface-500) 38%, transparent);
    color: var(--color-surface-200);
    font-size: 0.72rem;
  }

  .toggle-row input {
    width: 16px;
    height: 16px;
    accent-color: var(--color-primary-500);
  }

  .range-row {
    display: block;
    padding-top: 5px;
  }

  .range-row > span {
    display: flex;
    justify-content: space-between;
  }

  .range-row output {
    color: var(--color-surface-400);
    font-size: 0.7rem;
  }

  .range-row input {
    width: 100%;
    margin-top: 8px;
    accent-color: var(--color-primary-500);
  }

  button:focus-visible,
  select:focus-visible,
  input:focus-visible {
    outline: 2px solid var(--color-primary-400);
    outline-offset: 1px;
  }
</style>
