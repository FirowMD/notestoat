import { writable } from 'svelte/store';
import { configStore } from './configStore';
import type { Encoding, MarkdownViewMode } from '../types/config';

interface EditorState {
  cursor: {
    line: number;
    column: number;
  };
  stats: {
    length: number;
    lines: number;
  };
  language: string;
  encoding: Encoding;
  lineEnding: 'CRLF' | 'LF' | 'CR';
  wordWrap: boolean;
  showInvisibles: boolean;
  fontSize: number;
  markdownViewMode: MarkdownViewMode;
}

function createEditorStore() {
  const { subscribe, set, update } = writable<EditorState>({
    cursor: { line: 1, column: 1 },
    stats: { length: 0, lines: 0 },
    language: 'plaintext',
    encoding: 'utf-8',
    lineEnding: 'CRLF',
    wordWrap: false,
    showInvisibles: false,
    fontSize: 14,
    markdownViewMode: 'split'
  });

  return {
    subscribe,
    hydrate: (config: {
      fontSize?: number;
      wordWrap?: boolean;
      showInvisibles?: boolean;
      markdownViewMode?: MarkdownViewMode;
      encoding?: Encoding;
    }) => update(state => ({
      ...state,
      fontSize: config.fontSize ?? state.fontSize,
      wordWrap: config.wordWrap ?? state.wordWrap,
      showInvisibles: config.showInvisibles ?? state.showInvisibles,
      markdownViewMode: config.markdownViewMode ?? state.markdownViewMode,
      encoding: config.encoding ?? state.encoding
    })),
    setCursor: (line: number, column: number) => 
      update(state => ({ ...state, cursor: { line, column } })),
    setStats: (length: number, lines: number) => 
      update(state => ({ ...state, stats: { length, lines } })),
    setLanguage: (language: string) => 
      update(state => ({ ...state, language })),
    setEncoding: (encoding: Encoding, persist = true) =>
      update(state => {
        if (persist) void configStore.save({ default_encoding: encoding });
        return { ...state, encoding };
      }),
    setWordWrap: (enabled: boolean) => 
      update(state => {
        void configStore.save({ word_wrap: enabled });
        return { ...state, wordWrap: enabled };
      }),
    setShowInvisibles: (enabled: boolean) => 
      update(state => {
        void configStore.save({ show_invisibles: enabled });
        return { ...state, showInvisibles: enabled };
      }),
    setLineEnding: (ending: 'CRLF' | 'LF' | 'CR') =>
      update(state => ({ ...state, lineEnding: ending })),
    setFontSize: (size: number) => 
      update(state => {
        void configStore.save({ font_size: size });
        return { ...state, fontSize: size };
      }),
    setMarkdownViewMode: (mode: MarkdownViewMode, persist = true) =>
      update(state => {
        if (persist) {
          void configStore.save({ markdown_view_mode: mode });
        }
        return { ...state, markdownViewMode: mode };
      })
  };
}

export const editorStore = createEditorStore();
