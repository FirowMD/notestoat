export const THEMES = [
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
] as const;

export type Theme = (typeof THEMES)[number];
