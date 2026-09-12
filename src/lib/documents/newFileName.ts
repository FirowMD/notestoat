export const DEFAULT_NEW_FILE_NAME = 'Untitled_%d.md';

const INVALID_FILE_NAME_CHARACTERS = /[<>:"/\\|?*\u0000-\u001f]/;

export function getNewFileNameError(value: string): string | null {
  const template = value.trim();

  if (!template) return 'Enter a file name.';
  if (template.length > 128) return 'Use 128 characters or fewer.';
  if (!template.includes('%d')) return 'Include %d for the file number.';
  if (INVALID_FILE_NAME_CHARACTERS.test(template)) {
    return 'File names cannot contain < > : " / \\ | ? *.';
  }
  if (/[. ]$/.test(template)) return 'File names cannot end with a period or space.';

  return null;
}

export function formatNewFileName(template: string, counter: number): string {
  const safeTemplate = getNewFileNameError(template) ? DEFAULT_NEW_FILE_NAME : template.trim();
  const safeCounter = Number.isSafeInteger(counter) && counter > 0 ? counter : 1;
  return safeTemplate.replaceAll('%d', String(safeCounter));
}
