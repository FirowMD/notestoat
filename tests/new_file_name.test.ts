declare namespace Deno {
  function test(name: string, testFunction: () => void | Promise<void>): void;
}

// @ts-ignore Deno requires explicit TypeScript extensions.
import { formatNewFileName, getNewFileNameError } from '../src/lib/documents/newFileName.ts';

function assertEqual<T>(actual: T, expected: T): void {
  if (!Object.is(actual, expected)) {
    throw new Error(`Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
}

Deno.test('new file names replace the counter token', () => {
  assertEqual(formatNewFileName('Untitled_%d.md', 4), 'Untitled_4.md');
  assertEqual(formatNewFileName('Draft_%d_copy_%d.txt', 2), 'Draft_2_copy_2.txt');
});

Deno.test('new file name templates require safe numbered file names', () => {
  assertEqual(getNewFileNameError('Note_%d.md'), null);
  assertEqual(getNewFileNameError('Note.md'), 'Include %d for the file number.');
  assertEqual(getNewFileNameError('../Note_%d.md'), 'File names cannot contain < > : " / \\ | ? *.');
});

Deno.test('invalid templates fall back to the default file name', () => {
  assertEqual(formatNewFileName('Note.md', 3), 'Untitled_3.md');
});
