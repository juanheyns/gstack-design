import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { getCodexStatus } from '../src/auth';
import fs from 'fs';
import path from 'path';
import os from 'os';

const originalBin = process.env.DESIGN_CODEX_BIN;
let tmpDir: string;

function writeFakeCodex(name: string, script: string): string {
  const filePath = path.join(tmpDir, name);
  fs.writeFileSync(filePath, script);
  fs.chmodSync(filePath, 0o755);
  return filePath;
}

describe('auth', () => {
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'design-auth-'));
  });

  afterEach(() => {
    if (originalBin) {
      process.env.DESIGN_CODEX_BIN = originalBin;
    } else {
      delete process.env.DESIGN_CODEX_BIN;
    }
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns unavailable when codex is missing', () => {
    process.env.DESIGN_CODEX_BIN = path.join(tmpDir, 'does-not-exist');

    const result = getCodexStatus();

    expect(result.available).toBe(false);
    expect(result.loggedIn).toBe(false);
  });

  it('detects logged-in codex status', () => {
    const fakeCodex = writeFakeCodex('codex-logged-in', `#!/bin/sh
if [ "$1" = "login" ] && [ "$2" = "status" ]; then
  echo "Logged in using ChatGPT"
  exit 0
fi
echo "unexpected args" >&2
exit 1
`);
    process.env.DESIGN_CODEX_BIN = fakeCodex;

    const result = getCodexStatus();

    expect(result.available).toBe(true);
    expect(result.loggedIn).toBe(true);
    expect(result.message).toContain('Logged in');
  });

  it('detects logged-out codex status', () => {
    const fakeCodex = writeFakeCodex('codex-logged-out', `#!/bin/sh
if [ "$1" = "login" ] && [ "$2" = "status" ]; then
  echo "Not logged in" >&2
  exit 1
fi
echo "unexpected args" >&2
exit 1
`);
    process.env.DESIGN_CODEX_BIN = fakeCodex;

    const result = getCodexStatus();

    expect(result.available).toBe(true);
    expect(result.loggedIn).toBe(false);
    expect(result.message).toContain('Not logged in');
  });
});
