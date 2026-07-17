declare namespace Deno {
  function test(name: string, testFunction: () => void | Promise<void>): void;
}

// @ts-ignore Deno requires explicit TypeScript extensions.
import { getExtension, getFileName, normalizePath, preserveExtension, replaceFileName } from '../src/lib/documents/path.ts';

function assertEqual<T>(actual: T, expected: T): void {
  if (!Object.is(actual, expected)) {
    throw new Error(`Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
}

Deno.test('path helpers support Windows and Unix paths', () => {
  assertEqual(getFileName('C:\\notes\\todo.md'), 'todo.md');
  assertEqual(getFileName('/home/user/todo.md'), 'todo.md');
  assertEqual(getExtension('/home/user/todo.md'), 'md');
  assertEqual(replaceFileName('C:\\notes\\todo.md', 'done.md'), 'C:\\notes\\done.md');
  assertEqual(replaceFileName('/home/user/todo.md', 'done.md'), '/home/user/done.md');
});

Deno.test('preserveExtension only appends a missing extension', () => {
  assertEqual(preserveExtension('todo.md', 'done'), 'done.md');
  assertEqual(preserveExtension('todo.md', 'done.txt'), 'done.txt');
});

Deno.test('normalizePath compares Windows paths case-insensitively', () => {
  assertEqual(normalizePath('C:\\Notes\\TODO.md'), 'c:/notes/todo.md');
  assertEqual(normalizePath('/Home/Notes/TODO.md'), '/Home/Notes/TODO.md');
});
