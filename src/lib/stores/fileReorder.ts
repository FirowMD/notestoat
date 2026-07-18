import { writable } from 'svelte/store';

export type FileReorderPosition = 'before' | 'after';

interface FileReorderState {
  sourceId: string | null;
  targetId: string | null;
  position: FileReorderPosition;
}

const initialState: FileReorderState = {
  sourceId: null,
  targetId: null,
  position: 'before'
};

function createFileReorderStore() {
  const { subscribe, set, update } = writable<FileReorderState>(initialState);

  return {
    subscribe,
    start: (sourceId: string) => set({ ...initialState, sourceId }),
    setTarget: (targetId: string | null, position: FileReorderPosition = 'before') => {
      update(state => ({ ...state, targetId, position }));
    },
    reset: () => set(initialState)
  };
}

export const fileReorderStore = createFileReorderStore();
