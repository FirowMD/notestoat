import { z } from 'zod';
import type { AppConfig } from '../types/config';

const ThemeSchema = z.enum([
  'Firow',
  'catppuccin',
  'cerberus',
  'concord',
  'crimson',
  'fennec',
  'hamlindigo',
  'legacy',
  'mint',
  'modern',
  'mona',
  'nosh',
  'nouveau',
  'pine',
  'reign',
  'rocket',
  'rose',
  'sahara',
  'seafoam',
  'terminus',
  'vintage',
  'vox',
  'wintry'
] as const);

const EncodingSchema = z.enum([
  'utf-8',
  'utf-16le',
  'utf-16be',
  'windows-1252'
] as const);

const PartialAppConfigSchema = z.object({
  colorscheme: ThemeSchema.optional().catch(undefined),
  monaco_editor_theme: z.string().trim().min(1).max(128).optional().catch(undefined),
  recent_files: z.array(z.string().min(1)).max(100).optional().catch(undefined),
  opened_files: z.array(z.string().min(1)).max(100).optional().catch(undefined),
  font_size: z.number().int().min(8).max(72).optional().catch(undefined),
  word_wrap: z.boolean().optional().catch(undefined),
  show_invisibles: z.boolean().optional().catch(undefined),
  default_encoding: EncodingSchema.optional().catch(undefined),
  transparent_mode: z.boolean().optional().catch(undefined),
  window_opacity: z.number().min(0.1).max(1).optional().catch(undefined)
});

export function createDefaultAppConfig(): AppConfig {
  return {
    colorscheme: 'cerberus',
    monaco_editor_theme: 'Firow',
    recent_files: [],
    opened_files: [],
    font_size: 14,
    word_wrap: false,
    show_invisibles: false,
    default_encoding: 'utf-8',
    transparent_mode: false,
    window_opacity: 0.85
  };
}

export function sanitizeAppConfig(value: unknown, baseConfig: AppConfig = createDefaultAppConfig()): AppConfig {
  const parsed = PartialAppConfigSchema.safeParse(value);

  if (!parsed.success) {
    return {
      ...baseConfig,
      recent_files: [...(baseConfig.recent_files ?? [])],
      opened_files: [...(baseConfig.opened_files ?? [])]
    };
  }

  const sanitized = parsed.data;

  return {
    ...baseConfig,
    ...sanitized,
    recent_files: sanitized.recent_files ?? [...(baseConfig.recent_files ?? [])],
    opened_files: sanitized.opened_files ?? [...(baseConfig.opened_files ?? [])]
  };
}
