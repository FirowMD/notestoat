import type { Encoding } from './config';

export interface FileInfo {
  id: string;
  path: string;
  name: string;
  content: string;
  encoding: Encoding;
  language: string;
  created: Date;
  modified: Date;
  fileSystemModified?: Date; // File system's last modified time
  isModified: boolean;
  hash: string;
  cursor: {
    line: number;
    column: number;
  };
}

export type NewFileInfo = Omit<FileInfo, 'id'>;
