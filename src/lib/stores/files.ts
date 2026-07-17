import { writable } from 'svelte/store';
import { normalizePath } from '../documents/path';
import type { Encoding } from '../types/config';
import type { FileInfo, NewFileInfo } from '../types/file';

export interface FileStoreState {
  files: FileInfo[];
  activeFileId: string | null;
  nextId: number;
  untitledCounter: number;
}

function createFileStore() {
  const { subscribe, update } = writable<FileStoreState>({
    files: [],
    activeFileId: null,
    nextId: 1,
    untitledCounter: 1
  });

  return {
    subscribe,

    addUntitledFile: (encoding: Encoding = 'utf-8'): string => {
      let addedId = '';
      update(store => {
        addedId = store.nextId.toString();
        const now = new Date();
        const file: FileInfo = {
          id: addedId,
          path: '',
          name: `Untitled_${store.untitledCounter}.txt`,
          content: '',
          encoding,
          language: 'plaintext',
          created: now,
          modified: now,
          isModified: false,
          hash: '',
          cursor: { line: 1, column: 1 }
        };

        return {
          ...store,
          files: [...store.files, file],
          activeFileId: addedId,
          nextId: store.nextId + 1,
          untitledCounter: store.untitledCounter + 1
        };
      });
      return addedId;
    },

    addFile: (file: NewFileInfo, setActive = true): string => {
      let fileId = '';
      update(store => {
        const normalizedPath = normalizePath(file.path);
        const existingFile = normalizedPath
          ? store.files.find(candidate => normalizePath(candidate.path) === normalizedPath)
          : undefined;

        if (existingFile) {
          fileId = existingFile.id;
          return {
            ...store,
            activeFileId: setActive ? existingFile.id : store.activeFileId
          };
        }

        fileId = store.nextId.toString();
        const fileWithId: FileInfo = { ...file, id: fileId };
        return {
          ...store,
          files: [...store.files, fileWithId],
          activeFileId: setActive ? fileId : store.activeFileId,
          nextId: store.nextId + 1
        };
      });
      return fileId;
    },

    removeFile: (id: string) => update(store => {
      const currentIndex = store.files.findIndex(file => file.id === id);
      const remainingFiles = store.files.filter(file => file.id !== id);
      let activeFileId = store.activeFileId;

      if (store.activeFileId === id) {
        const nextFile = remainingFiles[currentIndex] ?? remainingFiles[currentIndex - 1];
        activeFileId = nextFile?.id ?? null;
      }

      return { ...store, files: remainingFiles, activeFileId };
    }),

    setActiveFile: (id: string) => update(store => ({ ...store, activeFileId: id })),

    updateFile: (id: string, updates: Partial<FileInfo>) => update(store => ({
      ...store,
      files: store.files.map(file => file.id === id ? { ...file, ...updates } : file)
    })),

    markAsModified: (id: string) => update(store => ({
      ...store,
      files: store.files.map(file => file.id === id
        ? { ...file, isModified: true, modified: new Date() }
        : file)
    })),

    markAsSaved: (id: string) => update(store => ({
      ...store,
      files: store.files.map(file => file.id === id ? { ...file, isModified: false } : file)
    })),

    reorderFiles: (files: FileInfo[]) => update(store => ({ ...store, files: [...files] }))
  };
}

export const fileStore = createFileStore();
