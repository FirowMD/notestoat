import { getExtension, getFileName } from './path';
import { getLanguageFromExtension } from '../stores/language';
import type { Encoding } from '../types/config';
import type { NewFileInfo } from '../types/file';
import type { ReadFileResult } from '../platform/tauriFiles';

export function createFileInfo(
  path: string,
  encoding: Encoding,
  fileData: ReadFileResult
): NewFileInfo {
  const now = new Date();
  const name = getFileName(path);

  return {
    path,
    name,
    content: fileData.content,
    encoding,
    language: getLanguageFromExtension(getExtension(name)),
    created: now,
    modified: now,
    fileSystemModified: fileData.modifiedAt,
    isModified: false,
    hash: fileData.hash,
    cursor: { line: 1, column: 1 }
  };
}
