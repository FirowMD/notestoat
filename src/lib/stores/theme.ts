import { writable } from 'svelte/store';
import { configStore } from './configStore';
import type { Theme } from '../types/theme';

export type { Theme } from '../types/theme';

function createThemeStore() {
  const { subscribe, set } = writable<Theme>('Firow');

  return {
    subscribe,
    setTheme: (theme: Theme) => {
      document.documentElement.setAttribute('data-theme', theme);
      void configStore.save({ colorscheme: theme });
      set(theme);
    },
    loadTheme: (theme: Theme) => {
      document.documentElement.setAttribute('data-theme', theme);
      set(theme);
    }
  };
}

export const themeStore = createThemeStore();
