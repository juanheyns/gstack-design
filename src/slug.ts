/**
 * Derive a project slug from git remote or cwd.
 * Replaces the gstack-slug shell utility.
 */

import { execSync } from 'child_process';
import { basename } from 'path';

export function projectSlug(): string {
  try {
    const remote = execSync('git remote get-url origin', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
      timeout: 3000,
    }).trim();
    // Extract org/repo from git URL, sanitize
    const match = remote.match(/[:/]([^/]+\/[^/]+?)(?:\.git)?$/);
    if (match) {
      return match[1].replace('/', '-').replace(/[^a-zA-Z0-9._-]/g, '');
    }
  } catch {
    // Not a git repo or git not available — fall through
  }
  return basename(process.cwd()).replace(/[^a-zA-Z0-9._-]/g, '');
}
