import { invoke } from '@tauri-apps/api/core';
import { writable } from 'svelte/store';
import { createDefaultAppConfig, sanitizeAppConfig } from '../schemas/config';
import type { AppConfig } from '../types/config';

function createConfigStore() {
  let currentConfig = createDefaultAppConfig();
  let loadPromise: Promise<AppConfig | null> | null = null;
  let saveQueue: Promise<void> = Promise.resolve();
  const { subscribe, set } = writable<AppConfig>(currentConfig);

  function replace(config: AppConfig) {
    currentConfig = sanitizeAppConfig(config);
    set(currentConfig);
  }

  function persist(config: AppConfig): Promise<void> {
    const snapshot = sanitizeAppConfig(config);
    saveQueue = saveQueue
      .catch(() => undefined)
      .then(() => invoke('save_config', { config: snapshot }))
      .then(() => undefined)
      .catch(error => {
        console.error('Error saving config:', error);
      });
    return saveQueue;
  }

  async function loadFromDisk(): Promise<AppConfig | null> {
    try {
      await invoke('load_config');
      const config = sanitizeAppConfig(await invoke<unknown>('get_config'));
      replace(config);
      return config;
    } catch (error) {
      console.error('Error loading config:', error);
      return null;
    }
  }

  return {
    subscribe,

    load: (force = false): Promise<AppConfig | null> => {
      if (force || !loadPromise) {
        const pendingLoad = loadFromDisk();
        loadPromise = pendingLoad;
        void pendingLoad.then(config => {
          if (!config && loadPromise === pendingLoad) loadPromise = null;
        });
      }
      return loadPromise;
    },

    save: (updates: Partial<AppConfig>): Promise<void> => {
      replace({ ...currentConfig, ...updates });
      return persist(currentConfig);
    },

    updateConfig: (config: AppConfig): Promise<void> => {
      replace(config);
      return persist(currentConfig);
    }
  };
}

export const configStore = createConfigStore();
