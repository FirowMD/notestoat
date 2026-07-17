import { get } from 'svelte/store';
import { ask, message, open, save } from '@tauri-apps/plugin-dialog';
import { configStore } from '../stores/configStore';
import { editorStore } from '../stores/editor';
import { fileStore } from '../stores/files';
import { getLanguageFromExtension } from '../stores/language';
import { notificationStore } from '../stores/notification';
import type { Encoding } from '../types/config';
import type { FileInfo } from '../types/file';
import {
  checkAdminPrivileges,
  deleteFile,
  openFileInNewWindow,
  readFile,
  relaunchAsAdmin,
  renameFile,
  revealFile,
  saveFile,
  unwatchFile,
  watchFile
} from '../platform/tauriFiles';
import { createFileInfo } from './documentFactory';
import { getExtension, getFileName, normalizePath, preserveExtension, replaceFileName } from './path';

interface OpenOptions {
  activate?: boolean;
  persist?: boolean;
  removeMissingFromRecent?: boolean;
}

const suppressedWatcherPaths = new Set<string>();

function suppressWatcher(path: string, duration = 1000): void {
  const normalizedPath = normalizePath(path);
  suppressedWatcherPaths.add(normalizedPath);
  setTimeout(() => suppressedWatcherPaths.delete(normalizedPath), duration);
}

function getFile(id: string): FileInfo | undefined {
  return get(fileStore).files.find(file => file.id === id);
}

function getOpenPaths(): string[] {
  return get(fileStore).files.filter(file => file.path).map(file => file.path);
}

function isMissingFileError(error: unknown): boolean {
  const value = String(error).toLowerCase();
  return value.includes('no such file') || value.includes('cannot find the file');
}

async function persistOpenedFiles(): Promise<void> {
  await configStore.save({ opened_files: getOpenPaths() });
}

async function addRecentFile(path: string): Promise<void> {
  const recentFiles = get(configStore).recent_files ?? [];
  await configStore.save({
    recent_files: [path, ...recentFiles.filter(candidate => normalizePath(candidate) !== normalizePath(path))]
      .slice(0, 100)
  });
}

async function removeRecentFile(path: string): Promise<void> {
  const recentFiles = get(configStore).recent_files ?? [];
  await configStore.save({
    recent_files: recentFiles.filter(candidate => normalizePath(candidate) !== normalizePath(path))
  });
}

async function handleFileError(error: unknown, action: string, paths: string[]): Promise<void> {
  console.error(`Error ${action} file:`, error);
  const errorText = String(error);

  if (errorText.includes('File too large')) {
    notificationStore.show('File too large (>100MB). Large files are not supported.', 'error');
    return;
  }

  if (errorText.includes('PERMISSION_DENIED')) {
    const isAdmin = await checkAdminPrivileges();
    if (isAdmin) {
      notificationStore.show('Permission denied even with administrator privileges.', 'error');
      return;
    }

    const shouldRelaunch = await ask(
      `Failed to ${action} the file due to insufficient permissions.\n\nRestart with administrator privileges?`,
      { title: 'Permission Denied', kind: 'warning' }
    );
    if (shouldRelaunch) {
      const openPaths = [...getOpenPaths(), ...paths].filter(Boolean);
      await relaunchAsAdmin([...new Set(openPaths)]);
    }
    return;
  }

  if (isMissingFileError(error)) {
    notificationStore.show('File not found. It may have been moved or deleted.', 'error');
    return;
  }

  notificationStore.show(`Failed to ${action} file`, 'error');
}

async function startWatching(path: string): Promise<void> {
  try {
    await watchFile(path);
  } catch (error) {
    console.error('Error setting up file watch:', error);
  }
}

async function stopWatching(path: string): Promise<void> {
  try {
    await unwatchFile(path);
  } catch (error) {
    console.error('Error removing file watch:', error);
  }
}

async function openPath(
  path: string,
  encoding: Encoding,
  options: OpenOptions = {}
): Promise<string | null> {
  const { activate = true, persist = true, removeMissingFromRecent = false } = options;
  const existing = get(fileStore).files.find(file =>
    file.path && normalizePath(file.path) === normalizePath(path)
  );

  if (existing) {
    if (activate) fileStore.setActiveFile(existing.id);
    return existing.id;
  }

  try {
    const fileData = await readFile(path, encoding);
    const id = fileStore.addFile(createFileInfo(path, encoding, fileData), activate);
    await startWatching(path);
    if (persist) await persistOpenedFiles();
    return id;
  } catch (error) {
    if (removeMissingFromRecent && isMissingFileError(error)) await removeRecentFile(path);
    await handleFileError(error, 'open', [path]);
    return null;
  }
}

async function openPaths(
  paths: string[],
  encoding: Encoding,
  options: OpenOptions = {}
): Promise<string[]> {
  const openedIds: string[] = [];
  for (const path of paths) {
    const id = await openPath(path, encoding, { ...options, persist: false });
    if (id) openedIds.push(id);
  }

  if (options.persist !== false) await persistOpenedFiles();
  if (options.activate !== false && openedIds.length > 0) {
    fileStore.setActiveFile(openedIds[openedIds.length - 1]);
  }
  return openedIds;
}

async function saveDocument(id: string, saveAs = false): Promise<boolean> {
  const file = getFile(id);
  if (!file) return false;

  let path = saveAs ? '' : file.path;
  if (!path) {
    path = await save({ defaultPath: file.name || 'untitled.txt' }) ?? '';
    if (!path) return false;
  }

  try {
    suppressWatcher(path);
    const saved = await saveFile(path, file.content, file.encoding);
    const pathChanged = normalizePath(path) !== normalizePath(file.path);

    if (pathChanged && file.path) await stopWatching(file.path);

    const name = getFileName(path);
    fileStore.updateFile(id, {
      path,
      name,
      language: getLanguageFromExtension(getExtension(name)),
      hash: saved.hash,
      modified: new Date(),
      fileSystemModified: saved.modifiedAt,
      isModified: false
    });

    if (pathChanged) await startWatching(path);
    await persistOpenedFiles();
    notificationStore.show('File saved successfully', 'success', 2500);
    return true;
  } catch (error) {
    await handleFileError(error, 'save', [path]);
    return false;
  }
}

async function closeDocument(id: string): Promise<boolean> {
  const file = getFile(id);
  if (!file) return false;

  if (file.isModified) {
    const shouldClose = await ask(
      `Close "${file.name}" without saving your changes?`,
      { title: 'Unsaved Changes', kind: 'warning' }
    );
    if (!shouldClose) return false;
  }

  if (file.path) {
    await stopWatching(file.path);
    await addRecentFile(file.path);
  }
  fileStore.removeFile(id);
  await persistOpenedFiles();
  return true;
}

async function renameDocument(id: string, requestedName: string): Promise<string | null> {
  const file = getFile(id);
  if (!file) return null;

  const name = preserveExtension(file.name, requestedName);
  if (!name || name === file.name) return file.name;

  if (!file.path) {
    fileStore.updateFile(id, {
      name,
      language: getLanguageFromExtension(getExtension(name)),
      modified: new Date()
    });
    return name;
  }

  const oldPath = file.path;
  const newPath = replaceFileName(oldPath, name);
  try {
    await renameFile(oldPath, newPath);
    await stopWatching(oldPath);
    fileStore.updateFile(id, {
      name,
      path: newPath,
      language: getLanguageFromExtension(getExtension(name)),
      modified: new Date()
    });
    await startWatching(newPath);

    const recentFiles = (get(configStore).recent_files ?? []).map(path =>
      normalizePath(path) === normalizePath(oldPath) ? newPath : path
    );
    await configStore.save({ recent_files: recentFiles, opened_files: getOpenPaths() });
    notificationStore.show('File renamed successfully', 'success', 2500);
    return name;
  } catch (error) {
    await handleFileError(error, 'rename', [oldPath]);
    return null;
  }
}

async function deleteDocument(id: string): Promise<boolean> {
  const file = getFile(id);
  if (!file?.path) {
    notificationStore.show('Cannot delete an unsaved file', 'error');
    return false;
  }

  try {
    await stopWatching(file.path);
    await deleteFile(file.path);
    fileStore.removeFile(id);
    await removeRecentFile(file.path);
    await persistOpenedFiles();
    notificationStore.show('File moved to recycle bin', 'success', 2500);
    return true;
  } catch (error) {
    await handleFileError(error, 'delete', [file.path]);
    await startWatching(file.path);
    return false;
  }
}

async function changeEncoding(id: string, encoding: Encoding): Promise<boolean> {
  const file = getFile(id);
  if (!file) return false;

  if (!file.path) {
    fileStore.updateFile(id, { encoding });
    editorStore.setEncoding(encoding);
    return true;
  }

  if (file.isModified) {
    const shouldReload = await ask(
      `Reload "${file.name}" using ${encoding.toUpperCase()} and discard unsaved changes?`,
      { title: 'Change Encoding', kind: 'warning' }
    );
    if (!shouldReload) return false;
  }

  try {
    const fileData = await readFile(file.path, encoding);
    fileStore.updateFile(id, {
      content: fileData.content,
      encoding,
      hash: fileData.hash,
      fileSystemModified: fileData.modifiedAt,
      modified: new Date(),
      isModified: false
    });
    editorStore.setEncoding(encoding);
    return true;
  } catch (error) {
    await handleFileError(error, 'read', [file.path]);
    return false;
  }
}

async function reloadExternalFile(path: string): Promise<void> {
  if (suppressedWatcherPaths.has(normalizePath(path))) return;

  const file = get(fileStore).files.find(candidate =>
    candidate.path && normalizePath(candidate.path) === normalizePath(path)
  );
  if (!file) return;

  if (file.isModified) {
    notificationStore.show(`${file.name} changed on disk while it has unsaved changes.`, 'info', 5000);
    return;
  }

  try {
    const fileData = await readFile(file.path, file.encoding);
    if (fileData.hash === file.hash) return;
    fileStore.updateFile(file.id, {
      content: fileData.content,
      hash: fileData.hash,
      modified: new Date(),
      fileSystemModified: fileData.modifiedAt
    });
  } catch (error) {
    await handleFileError(error, 'read', [file.path]);
  }
}

export const documentService = {
  createUntitled(): string {
    const encoding = get(configStore).default_encoding ?? 'utf-8';
    return fileStore.addUntitledFile(encoding);
  },

  async openFromDialog(): Promise<void> {
    const selected = await open({ multiple: true });
    if (!selected) return;
    const paths = Array.isArray(selected) ? selected : [selected];
    const encoding = get(configStore).default_encoding ?? 'utf-8';
    await openPaths(paths, encoding);
  },

  openPath,
  openPaths,

  async restoreOpenedFiles(paths: string[], encoding: Encoding): Promise<void> {
    await openPaths(paths, encoding, { persist: true });
  },

  async openRecentFile(path: string): Promise<void> {
    const encoding = get(configStore).default_encoding ?? 'utf-8';
    await openPath(path, encoding, { removeMissingFromRecent: true });
  },

  async restoreRecentFile(): Promise<void> {
    const recentFiles = get(configStore).recent_files ?? [];
    if (recentFiles.length === 0) {
      await message('No recent files to restore', { title: 'Restore File' });
      return;
    }
    await documentService.openRecentFile(recentFiles[0]);
    await configStore.save({ recent_files: recentFiles.slice(1) });
  },

  saveDocument,
  closeDocument,
  renameDocument,
  deleteDocument,
  changeEncoding,
  reloadExternalFile,

  async revealDocument(id: string): Promise<void> {
    const file = getFile(id);
    if (!file?.path) {
      notificationStore.show('Please save the file first', 'info');
      return;
    }
    try {
      await revealFile(file.path);
    } catch (error) {
      await handleFileError(error, 'reveal', [file.path]);
    }
  },

  async openInNewWindow(id: string): Promise<void> {
    const file = getFile(id);
    if (!file?.path) {
      notificationStore.show('Please save the file first', 'info');
      return;
    }
    try {
      await openFileInNewWindow(file.path);
    } catch (error) {
      await handleFileError(error, 'open in a new window', [file.path]);
    }
  },

  async reorderFiles(files: FileInfo[]): Promise<void> {
    fileStore.reorderFiles(files);
    await persistOpenedFiles();
  }
};
