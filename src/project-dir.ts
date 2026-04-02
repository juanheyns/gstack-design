/**
 * Project-local .design/ directory management.
 *
 * .design/ stores generated mockups, comparison boards, variants, and gallery HTML.
 * Created on first use. Auto-added to .gitignore if in a git repo.
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

let _projectDir: string | null = null;

/**
 * Find the git repo root, or fall back to cwd.
 */
function findProjectRoot(): string {
  try {
    return execSync('git rev-parse --show-toplevel', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
      timeout: 3000,
    }).trim();
  } catch {
    return process.cwd();
  }
}

/**
 * Get or create the .design/ directory for the current project.
 * Returns the absolute path to .design/.
 */
export function ensureDesignDir(): string {
  if (_projectDir) return _projectDir;

  const root = findProjectRoot();
  const designDir = path.join(root, '.design');

  // Create .design/ if it doesn't exist
  if (!fs.existsSync(designDir)) {
    fs.mkdirSync(designDir, { recursive: true });
  }

  // Add to .gitignore if in a git repo and not already listed
  const gitignorePath = path.join(root, '.gitignore');
  try {
    if (fs.existsSync(path.join(root, '.git'))) {
      const content = fs.existsSync(gitignorePath)
        ? fs.readFileSync(gitignorePath, 'utf-8')
        : '';
      if (!content.match(/^\.design\/?$/m)) {
        const separator = content.endsWith('\n') ? '' : '\n';
        fs.appendFileSync(gitignorePath, `${separator}.design/\n`);
      }
    }
  } catch {
    // .gitignore update is best-effort — don't fail the command
  }

  _projectDir = designDir;
  return designDir;
}

/**
 * Resolve a default output path inside .design/.
 * If the user provided an explicit --output, return that instead.
 */
export function resolveOutput(explicit: string | undefined, defaultName: string): string {
  if (explicit) return explicit;
  const dir = ensureDesignDir();
  return path.join(dir, defaultName);
}

/**
 * Resolve a default output directory inside .design/.
 * If the user provided an explicit --output-dir, return that instead.
 */
export function resolveOutputDir(explicit: string | undefined, defaultSubdir: string): string {
  if (explicit) return explicit;
  const dir = ensureDesignDir();
  return path.join(dir, defaultSubdir);
}
