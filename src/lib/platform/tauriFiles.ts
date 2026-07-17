import { invoke } from '@tauri-apps/api/core';
import type { Encoding } from '../types/config';

interface ReadFilePayload {
  content: string;
  hash: string;
  modified: number;
}

interface SavedFilePayload {
  hash: string;
  modified: number;
}

export interface ReadFileResult {
  content: string;
  hash: string;
  modifiedAt?: Date;
}

export interface SavedFileResult {
  hash: string;
  modifiedAt?: Date;
}

export async function readFile(path: string, encoding: Encoding): Promise<ReadFileResult> {
  const payload = await invoke<ReadFilePayload>('read_file', { path, encoding });
  return {
    content: payload.content,
    hash: payload.hash,
    modifiedAt: new Date(payload.modified * 1000)
  };
}

export async function saveFile(
  path: string,
  content: string,
  encoding: Encoding
): Promise<SavedFileResult> {
  const payload = await invoke<SavedFilePayload>('save_file', { path, content, encoding });

  return {
    hash: payload.hash,
    modifiedAt: new Date(payload.modified * 1000)
  };
}

export function renameFile(oldPath: string, newPath: string): Promise<void> {
  return invoke('rename_file', { oldPath, newPath });
}

export function deleteFile(path: string): Promise<void> {
  return invoke('delete_file', { path });
}

export function watchFile(path: string): Promise<void> {
  return invoke('watch_file', { path });
}

export function unwatchFile(path: string): Promise<void> {
  return invoke('unwatch_file', { path });
}

export function revealFile(path: string): Promise<void> {
  return invoke('run_explorer', { path });
}

export function openFileInNewWindow(path: string): Promise<void> {
  return invoke('open_in_new_window', { path });
}

export function checkAdminPrivileges(): Promise<boolean> {
  return invoke('check_admin_privileges');
}

export function relaunchAsAdmin(args: string[]): Promise<void> {
  return invoke('relaunch_as_admin', { args });
}
