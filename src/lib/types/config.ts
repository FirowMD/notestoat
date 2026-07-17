import type { Theme } from './theme';

export type MarkdownViewMode = 'edit' | 'split' | 'preview';
export const ENCODINGS = ['utf-8', 'utf-16le', 'utf-16be', 'windows-1252'] as const;
export type Encoding = (typeof ENCODINGS)[number];

export interface AppConfig {
  colorscheme?: Theme;
  monaco_editor_theme?: string;
  recent_files?: string[];
  opened_files?: string[];
  font_size?: number;
  word_wrap?: boolean;
  show_invisibles?: boolean;
  markdown_view_mode?: MarkdownViewMode;
  default_encoding?: Encoding;
  transparent_mode?: boolean;
  window_opacity?: number;
}
