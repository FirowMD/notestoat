export function normalizePath(path: string): string {
  const normalized = path.replace(/\\/g, '/');
  const isWindowsPath = /^[a-zA-Z]:[\\/]/.test(path) || path.startsWith('\\\\');
  return isWindowsPath ? normalized.toLowerCase() : normalized;
}

export function getFileName(path: string): string {
  return path.split(/[/\\]/).pop() || path;
}

export function getExtension(nameOrPath: string): string {
  const fileName = getFileName(nameOrPath);
  const dotIndex = fileName.lastIndexOf('.');
  return dotIndex > 0 && dotIndex < fileName.length - 1
    ? fileName.slice(dotIndex + 1).toLowerCase()
    : '';
}

export function preserveExtension(oldName: string, requestedName: string): string {
  const trimmedName = requestedName.trim();
  if (!trimmedName || getExtension(trimmedName)) return trimmedName;

  const oldExtension = getExtension(oldName);
  return oldExtension ? `${trimmedName}.${oldExtension}` : trimmedName;
}

export function replaceFileName(path: string, nextName: string): string {
  const separatorIndex = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
  return separatorIndex >= 0 ? `${path.slice(0, separatorIndex + 1)}${nextName}` : nextName;
}
