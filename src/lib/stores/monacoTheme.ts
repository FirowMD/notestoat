import { writable, get } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';
import { configStore } from './configStore';
import { parseMonacoThemeData } from '../schemas/monacoTheme';

function createMonacoThemeStore() {
  const { subscribe, set, update } = writable<string>('Firow');
  let monaco: any = null;

  return {
    subscribe,
    set,
    update,
    setMonaco: (monacoInstance: any) => {
      monaco = monacoInstance;
    },
    applyTransparentOverlay: async (enabled: boolean) => {
      if (!monaco) return;
      const current = get(monacoThemeStore);

      if (enabled) {
        const derived = `${current}-transparent-overlay`;
        const base = (current === 'vs' || current === 'vs-dark' || current === 'hc-black') ? current : 'vs-dark';
        try {
          monaco.editor.defineTheme(derived, {
            base,
            inherit: true,
            rules: [],
            colors: {
              'editor.background': '#00000014',
              'editorPane.background': '#00000014',
              'editorWidget.background': '#00000014'
            }
          });
          monaco.editor.setTheme(derived);
        } catch (e) {
          console.error('Error applying transparent overlay to Monaco:', e);
        }
      } else {
        try {
          monaco.editor.setTheme(current);
        } catch (e) {
          console.error('Error restoring Monaco theme:', e);
        }
      }
    },
    setTheme: async (themeName: string, persist = true) => {
      let appliedTheme = themeName;

      if (monaco) {
        if (themeName === 'vs' || themeName === 'vs-dark' || themeName === 'hc-black') {
          monaco.editor.setTheme(themeName);
        } else {
          try {
            const themeContent = await invoke<string>('read_monaco_theme', { themeName });
            const themeData = parseMonacoThemeData(themeContent);
            monaco.editor.defineTheme(themeName, {
              base: themeData.base || 'vs-dark',
              inherit: themeData.inherit !== false,
              rules: themeData.rules || [],
              colors: themeData.colors || {}
            });
            monaco.editor.setTheme(themeName);
          } catch (error) {
            console.error('Error loading Monaco theme:', error);
            monaco.editor.setTheme('vs-dark');
            appliedTheme = 'vs-dark';
          }
        }
      }
      set(appliedTheme);
      if (persist) await configStore.save({ monaco_editor_theme: appliedTheme });
    },
    getAvailableThemes: async (): Promise<string[]> => {
      try {
        const themes = await invoke<string[]>('get_monaco_themes');
        return themes;
      } catch (error) {
        console.error('Error getting Monaco themes:', error);
        return ['vs', 'vs-dark', 'hc-black', 'Firow'];
      }
    }
  };
}

export const monacoThemeStore = createMonacoThemeStore();
