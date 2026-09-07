import { readFile } from 'node:fs/promises';
import path from 'node:path';

/** The 40 hex characters a git commit hash is, and nothing else. */
const COMMIT = /^[0-9a-f]{40}$/;

/**
 * The commit the served `data/` tree comes from. Both deployment workflows
 * write `data-commit` next to the artifact after their rsync; a local run or a
 * checkout without one has no such file, and the answer is `undefined`.
 *
 * The file is one line and is read by the health check and the documentation
 * page only, so it is read per call rather than cached.
 */
export async function readDataCommit (root: string = process.cwd()): Promise<string | undefined> {
  let contents: string;
  try {
    contents = await readFile(path.join(root, 'data-commit'), 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
  const commit = contents.trim();
  return COMMIT.test(commit) ? commit : undefined;
}
