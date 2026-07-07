import { writable } from 'svelte/store';
import { invoke } from "@tauri-apps/api/core";
import type { AppConfig } from '../types/config';
import { createDefaultAppConfig, sanitizeAppConfig } from '../schemas/config';

function createConfigStore() {
  const { subscribe, set, update } = writable<AppConfig>(createDefaultAppConfig());

  return {
    subscribe,
    load: async () => {
      try {
        await invoke('load_config');
        const configRaw = await invoke<unknown>('get_config');
        const config = sanitizeAppConfig(configRaw);
        set(config);
        return config;
      } catch (error) {
        console.error('Error loading config:', error);
        return null;
      }
    },
    save: async (updates: Partial<AppConfig>) => {
      try {
        update(store => {
          const newConfig = sanitizeAppConfig({ ...store, ...updates }, store);
          void invoke('save_config', { config: newConfig }).catch(error => {
            console.error('Error saving config:', error);
          });
          return newConfig;
        });
      } catch (error) {
        console.error('Error saving config:', error);
      }
    },
    updateConfig: (config: AppConfig) => {
      const sanitizedConfig = sanitizeAppConfig(config);
      set(sanitizedConfig);
      void invoke('save_config', { config: sanitizedConfig }).catch(error => {
        console.error('Error saving config:', error);
      });
    }
  };
}

export const configStore = createConfigStore();
