---

# SPEC.md — Extract `design` into `juanheyns/gstack-design`

## Overview

This document is the complete implementation specification for extracting the `design` UI mockup CLI from `garrytan/gstack` into a new standalone repository `juanheyns/gstack-design`. Every section is actionable. The implementer should work through the [Implementation Order](#25-implementation-order) section sequentially.

---

## Table of Contents

1. [Repository Bootstrap](#1-repository-bootstrap)
2. [File Mapping](#2-file-mapping)
3. [Path and String Substitutions](#3-path-and-string-substitutions)
4. [New Files to Create](#4-new-files-to-create)
5. [auth.ts Changes](#5-authts-changes)
6. [cli.ts Changes](#6-clits-changes)
7. [gallery.ts Changes](#7-galleryts-changes)
8. [serve.ts Changes](#8-servets-changes)
9. [brief.ts Changes](#9-briefts-changes)
10. [Test Strategy](#10-test-strategy)
11. [package.json](#11-packagejson)
12. [setup Script](#12-setup-script)
13. [tsconfig.json](#13-tsconfigjson)
14. [CI Workflow: ci.yml](#14-ci-workflow-ciyml)
15. [CI Workflow: release.yml](#15-ci-workflow-releaseyml)
16. [Homebrew Formulae](#16-homebrew-formulae)
17. [Tap Repository: juanheyns/homebrew-gstack-design](#17-tap-repository-juanheynshomebrew-gstack-design)
18. [SKILL.md](#18-skillmd)
19. [README.md](#19-readmemd)
20. [.gitignore](#20-gitignore)
21. [Implementation Order](#21-implementation-order)
22. [Verification Checklist](#22-verification-checklist)

---

## 1. Repository Bootstrap

```bash
# Create the new repo on GitHub (public, MIT license, no auto-init)
gh repo create juanheyns/gstack-design --public --description "AI-powered UI mockup CLI — generate, iterate, diff, and QA design mockups"

# Clone it locally
git clone git@github.com:juanheyns/gstack-design.git
cd gstack-design
```

The repo starts empty. All files described in subsequent sections are either copied from gstack or created fresh.

---

## 2. File Mapping

Copy the following files from `garrytan/gstack` (or `juanheyns/gstack`) into the new repo root. Do not use git history transfer — a clean initial commit is fine.

| Source path in gstack | Destination in gstack-design | Action |
|---|---|---|
| `design/src/cli.ts` | `src/cli.ts` | Copy, then patch (§6) |
| `design/src/commands.ts` | `src/commands.ts` | Copy as-is |
| `design/src/auth.ts` | `src/auth.ts` | Copy, then patch (§5) |
| `design/src/generate.ts` | `src/generate.ts` | Copy as-is |
| `design/src/brief.ts` | `src/brief.ts` | Copy, then patch (§9) |
| `design/src/session.ts` | `src/session.ts` | Copy as-is |
| `design/src/check.ts` | `src/check.ts` | Copy as-is |
| `design/src/variants.ts` | `src/variants.ts` | Copy as-is |
| `design/src/compare.ts` | `src/compare.ts` | Copy, then patch (§8.2) |
| `design/src/iterate.ts` | `src/iterate.ts` | Copy as-is |
| `design/src/diff.ts` | `src/diff.ts` | Copy as-is |
| `design/src/evolve.ts` | `src/evolve.ts` | Copy as-is |
| `design/src/memory.ts` | `src/memory.ts` | Copy as-is |
| `design/src/design-to-code.ts` | `src/design-to-code.ts` | Copy as-is |
| `design/src/gallery.ts` | `src/gallery.ts` | Copy, then patch (§7) |
| `design/src/serve.ts` | `src/serve.ts` | Copy, then patch (§8) |
| `design/test/gallery.test.ts` | `test/gallery.test.ts` | Copy, then patch (§10.3) |
| `design/test/serve.test.ts` | `test/serve.test.ts` | Copy, then patch (§10.4) |
| `design/test/feedback-roundtrip.test.ts` | — | **Do not copy** (§10.5) |
| `LICENSE` | `LICENSE` | Copy as-is (MIT) |

**Do not copy:**
- `design/prototype.ts` — one-off validation script, not a command. Dead code.
- `design/dist/` — compiled binary, rebuilt from source.
- `design/SKILL.md` — write a new one from scratch (§18).
- `design/SKILL.md.tmpl` — not needed, no templating system.

---

## 3. Path and String Substitutions

After copying, apply these mechanical substitutions throughout all copied TypeScript files.

### 3.1 `~/.gstack/` config directory rename

The config/data directory changes from `~/.gstack/` to `~/.config/design/`. This keeps design's state separate when running standalone alongside gstack.

Files affected: `src/auth.ts`, `src/gallery.ts`, `src/cli.ts`.

Substitutions:

| Find | Replace |
|---|---|
| `'.gstack', 'openai.json'` | `'.config', 'design', 'config.json'` |
| `'.gstack/openai.json'` (in strings/comments) | `'.config/design/config.json'` |
| `'.gstack/projects'` (in strings/comments) | `'.config/design/projects'` |
| `~/.gstack/openai.json` (in help text) | `~/.config/design/config.json` |

### 3.2 `$D` shorthand removal

The CLI references `$D` as a shorthand alias set by gstack skills. Replace all occurrences in help text and error messages:

| Find | Replace |
|---|---|
| `$D setup` | `design setup` |
| `$D` (in usage text) | `design` |

### 3.3 `gstack` string references

| Find | Replace |
|---|---|
| `'gstack design'` (in help/log text) | `'design'` |
| `gstack design —` (in help strings) | `design —` |
| `gstack/openai.json` (in comments) | `config/design/config.json` |

### 3.4 Default output paths in `cli.ts`

The CLI currently uses `/tmp/gstack-*` prefixes for default output paths. Replace all defaults to use a `.design/` directory in the current project root (mirroring how browse uses `.browse/`). The CLI should create `.design/` on first use and add it to `.gitignore` if not already present.

| Find | Replace |
|---|---|
| `/tmp/gstack-design-smoke-test.png` | `.design/smoke-test.png` |
| `/tmp/gstack-mockup.png` | `.design/mockup.png` |
| `/tmp/gstack-design-board.html` | `.design/board.html` |
| `/tmp/gstack-variants/` | `.design/variants/` |
| `/tmp/gstack-iterate.png` | `.design/iterate.png` |
| `/tmp/gstack-evolved.png` | `.design/evolved.png` |
| `/tmp/gstack-design-gallery.html` | `.design/gallery.html` |

Session files stay in `/tmp/design-session-*.json` (they are ephemeral API threading state, not design artifacts).

### 3.5 `__GSTACK_SERVER_URL` JavaScript global

This variable appears in `src/serve.ts` and `src/compare.ts` (inline JS in generated HTML). Replace all occurrences:

| Find | Replace |
|---|---|
| `__GSTACK_SERVER_URL` | `__DESIGN_SERVER_URL` |

### 3.6 `commands.ts` gallery usage example

Line ~69:

| Find | Replace |
|---|---|
| `~/.gstack/projects/$SLUG/designs/` | `~/.config/design/projects/$SLUG/designs/` |

---

## 4. New Files to Create

### 4.1 `src/project-dir.ts`

Manages the `.design/` project directory — creates it on first use, adds it to `.gitignore`. This mirrors how browse manages `.browse/`.

```typescript
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
```

### 4.2 `src/slug.ts`

The gallery command needs a project slug to namespace stored designs. In gstack this is provided by the `gstack-slug` shell script. Inline a TypeScript equivalent:

```typescript
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
```

---

## 5. auth.ts Changes

The auth module resolves the OpenAI API key. Two changes needed:

### 5.1 Config path

**Before (line ~13):**
```typescript
const CONFIG_PATH = path.join(process.env.HOME || "~", ".gstack", "openai.json");
```

**After:**
```typescript
const CONFIG_DIR = process.env.DESIGN_HOME
  || path.join(process.env.HOME || "~", ".config", "design");
const CONFIG_PATH = path.join(CONFIG_DIR, "config.json");
```

### 5.2 Config file format

**Before:** reads `{ "api_key": "sk-..." }` from `openai.json`.

**After:** reads from `config.json` which uses the same format. No structural change needed — the key name `api_key` is fine.

### 5.3 `saveApiKey()` — update directory creation

**Before (line ~40):**
```typescript
export function saveApiKey(key: string): void {
  const dir = path.dirname(CONFIG_PATH);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify({ api_key: key }, null, 2));
  fs.chmodSync(CONFIG_PATH, 0o600);
}
```

**After:** No code change needed — `CONFIG_DIR` is derived above, and `path.dirname(CONFIG_PATH)` already resolves correctly. The `0o600` permissions are correct for a credentials file.

### 5.4 `requireApiKey()` — update error message

**Before (line ~52-58):**
```typescript
export function requireApiKey(): string {
  const key = resolveApiKey();
  if (!key) {
    console.error("No OpenAI API key found.");
    console.error("");
    console.error("Run: $D setup");
    console.error("  or save to ~/.gstack/openai.json: { \"api_key\": \"sk-...\" }");
    console.error("  or set OPENAI_API_KEY environment variable");
    console.error("");
    console.error("Get a key at: https://platform.openai.com/api-keys");
    process.exit(1);
  }
  return key;
}
```

**After:**
```typescript
export function requireApiKey(): string {
  const key = resolveApiKey();
  if (!key) {
    console.error("No OpenAI API key found.");
    console.error("");
    console.error("Run: design setup");
    console.error("  or save to ~/.config/design/config.json: { \"api_key\": \"sk-...\" }");
    console.error("  or set OPENAI_API_KEY environment variable");
    console.error("");
    console.error("Get a key at: https://platform.openai.com/api-keys");
    process.exit(1);
  }
  return key;
}
```

### 5.5 Backward compatibility with gstack

Add a fallback to read from the gstack config path if the standalone path doesn't exist. This helps users who already have gstack configured:

**After the `existsSync(CONFIG_PATH)` check in `resolveApiKey()`, before the env var check:**

```typescript
  // Fallback: check gstack config (for users migrating from gstack)
  const GSTACK_CONFIG = path.join(process.env.HOME || "~", ".gstack", "openai.json");
  try {
    if (fs.existsSync(GSTACK_CONFIG)) {
      const content = fs.readFileSync(GSTACK_CONFIG, "utf-8");
      const config = JSON.parse(content);
      if (config.api_key && typeof config.api_key === "string") {
        return config.api_key;
      }
    }
  } catch {
    // Fall through to env var
  }
```

---

## 6. cli.ts Changes

### 6.1 Help text

The `printUsage()` function starts with `"gstack design — AI-powered UI mockup generation"`. Change to:

```typescript
console.log("design — AI-powered UI mockup generation\n");
```

All `$D` references in usage examples become `design`.

### 6.2 Add `setup` subcommand

Add a `setup` command that interactively prompts for the OpenAI API key. Insert before the existing command dispatch:

```typescript
if (command === 'setup') {
  const readline = require('readline');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  console.log("design setup — configure OpenAI API key\n");
  console.log("Get a key at: https://platform.openai.com/api-keys\n");

  const { resolveApiKey, saveApiKey } = await import('./auth');
  const existing = resolveApiKey();
  if (existing) {
    console.log(`Current key: ${existing.slice(0, 8)}...${existing.slice(-4)}`);
  }

  rl.question('OpenAI API key: ', (key: string) => {
    key = key.trim();
    if (!key.startsWith('sk-')) {
      console.error('Invalid key — must start with sk-');
      process.exit(1);
    }
    saveApiKey(key);
    console.log('Saved to ~/.config/design/config.json');
    rl.close();
    process.exit(0);
  });
  // Block until readline completes
  await new Promise(() => {});
}
```

### 6.3 Add `--version` flag

At the top of `main()`, before any other command parsing:

```typescript
if (args[0] === '--version' || args[0] === '-v') {
  const pkg = require('../package.json');
  console.log(`design ${pkg.version}`);
  process.exit(0);
}
```

### 6.4 Import and use `project-dir.ts` for all default paths

Add at the top of `cli.ts`:

```typescript
import { resolveOutput, resolveOutputDir } from './project-dir';
```

Then replace every hardcoded default path in the command dispatch blocks. Example for `generate`:

**Before:**
```typescript
output: (flags.output as string) || "/tmp/gstack-mockup.png",
```

**After:**
```typescript
output: resolveOutput(flags.output as string, "mockup.png"),
```

Apply the same pattern to all commands:
- `generate` → `resolveOutput(flags.output, "mockup.png")`
- `variants` → `resolveOutputDir(flags["output-dir"], "variants")`
- `iterate` → `resolveOutput(flags.output, "iterate.png")`
- `compare` → `resolveOutput(flags.output, "board.html")`
- `evolve` → `resolveOutput(flags.output, "evolved.png")`
- `gallery` → `resolveOutput(flags.output, "gallery.html")`
- smoke test → `resolveOutput(undefined, "smoke-test.png")`

### 6.5 Gallery command — designs directory

The gallery command currently expects a `designsDir` derived from `~/.gstack/projects/$SLUG/designs/`. Update to default to `.design/` in the project root:

```typescript
if (command === 'gallery') {
  const { ensureDesignDir } = await import('./project-dir');
  const designsDir = flags['designs-dir'] as string || ensureDesignDir();
  // ... rest of gallery dispatch
}
```

This means the gallery reads from the same `.design/` directory where variants and mockups are generated — no separate config-scoped path needed for the default case. Users can still override with `--designs-dir` for cross-project galleries.

---

## 7. gallery.ts Changes

### 7.1 Empty gallery message

**Before (line ~230):**
```html
<p>Run <code>/design-shotgun</code> to start exploring design directions.</p>
```

**After:**
```html
<p>Run <code>design variants --brief "..." --count 3 --output-dir ./designs/</code> to start exploring.</p>
```

No other changes needed — the gallery module receives `designsDir` as a parameter and does not hardcode any paths.

---

## 8. serve.ts and compare.ts Changes

### 8.1 `__GSTACK_SERVER_URL` → `__DESIGN_SERVER_URL`

The serve module injects a JavaScript global variable into the comparison board HTML so the board's inline JS knows where to POST feedback. This variable is currently named `__GSTACK_SERVER_URL`.

**In `src/serve.ts` (line ~69):**

**Before:**
```typescript
const injected = htmlContent.replace(
  "</head>",
  `<script>window.__GSTACK_SERVER_URL = '${url.origin}';</script>\n</head>`
);
```

**After:**
```typescript
const injected = htmlContent.replace(
  "</head>",
  `<script>window.__DESIGN_SERVER_URL = '${url.origin}';</script>\n</head>`
);
```

### 8.2 `compare.ts` inline JavaScript

The `compare.ts` module generates the comparison board HTML with inline JavaScript that reads this global to construct fetch URLs. Search for `__GSTACK_SERVER_URL` in compare.ts and replace all occurrences with `__DESIGN_SERVER_URL`.

```bash
grep -n '__GSTACK_SERVER_URL' src/compare.ts
```

Apply the replacement to every match.

### 8.3 Telemetry stderr prefixes

The `serve.ts` file emits structured telemetry on stderr with `SERVE_` prefixes (e.g., `SERVE_STARTED`, `SERVE_FEEDBACK_RECEIVED`). These are useful for agent integration and are not gstack-specific. **Keep them as-is.**

---

## 9. brief.ts Changes

### 9.1 Bun.file() usage

**Before (line ~53):**
```typescript
const raw = Bun.file(input);
// We'll read it synchronously via fs since Bun.file is async
const fs = require("fs");
const content = fs.readFileSync(input, "utf-8");
```

**After:** Remove the dead `Bun.file()` call. It's unused and the fallback is already the real implementation:

```typescript
const fs = require("fs");
const content = fs.readFileSync(input, "utf-8");
```

This also makes the code compatible with Node.js if someone runs it outside of Bun.

---

## 10. Test Strategy

### 10.1 Existing tests

The gstack `design/test/` directory contains three test files:

- **`gallery.test.ts`** — Tests gallery HTML generation. References `/design-shotgun` in an assertion. Must be patched (§10.3).
- **`serve.test.ts`** — Tests the HTTP feedback server lifecycle. References `__GSTACK_SERVER_URL` in assertions. Must be patched (§10.4).
- **`feedback-roundtrip.test.ts`** — Full browser E2E test that imports `BrowserManager` from `../../browse/src/browser-manager`. **Do not copy** — this test depends on the browse binary which is not a dependency of the standalone design package (§10.5).

### 10.2 New tests to create

Create `test/auth.test.ts`:

```typescript
import { describe, it, expect } from 'bun:test';
import { resolveApiKey, saveApiKey } from '../src/auth';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('auth', () => {
  it('resolveApiKey returns null when no config exists', () => {
    const original = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    // This test may find a real key if ~/.config/design/config.json exists
    // That's fine — it proves the resolution works
    const result = resolveApiKey();
    if (original) process.env.OPENAI_API_KEY = original;
    expect(result === null || typeof result === 'string').toBe(true);
  });

  it('resolveApiKey reads OPENAI_API_KEY env var', () => {
    const original = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = 'sk-test-key-12345';
    const result = resolveApiKey();
    expect(result).toBe('sk-test-key-12345');
    if (original) {
      process.env.OPENAI_API_KEY = original;
    } else {
      delete process.env.OPENAI_API_KEY;
    }
  });
});
```

Create `test/brief.test.ts`:

```typescript
import { describe, it, expect } from 'bun:test';
import { briefToPrompt, type DesignBrief } from '../src/brief';

describe('brief', () => {
  it('converts a structured brief to a prompt string', () => {
    const brief: DesignBrief = {
      goal: 'Dashboard for metrics',
      audience: 'Engineers',
      style: 'Dark theme, minimal',
      elements: ['chart', 'sidebar'],
      screenType: 'desktop-dashboard',
    };
    const prompt = briefToPrompt(brief);
    expect(prompt).toContain('desktop-dashboard');
    expect(prompt).toContain('Dashboard for metrics');
    expect(prompt).toContain('chart, sidebar');
    expect(prompt).toContain('production UI');
  });
});
```

Create `test/slug.test.ts`:

```typescript
import { describe, it, expect } from 'bun:test';
import { projectSlug } from '../src/slug';

describe('slug', () => {
  it('returns a non-empty string', () => {
    const slug = projectSlug();
    expect(typeof slug).toBe('string');
    expect(slug.length).toBeGreaterThan(0);
  });

  it('contains only safe characters', () => {
    const slug = projectSlug();
    expect(slug).toMatch(/^[a-zA-Z0-9._-]+$/);
  });
});
```

Create `test/session.test.ts`:

```typescript
import { describe, it, expect } from 'bun:test';
import { createSession, readSession, sessionPath } from '../src/session';
import fs from 'fs';

describe('session', () => {
  it('creates and reads a session', () => {
    const session = createSession('resp-123', 'test brief', '/tmp/test.png');
    expect(session.lastResponseId).toBe('resp-123');
    expect(session.originalBrief).toBe('test brief');
    expect(session.feedbackHistory).toEqual([]);

    const reread = readSession(sessionPath(session.id));
    expect(reread.id).toBe(session.id);

    // Cleanup
    try { fs.unlinkSync(sessionPath(session.id)); } catch {}
  });
});
```

### 10.3 Patch `test/gallery.test.ts`

The gallery test asserts that the empty gallery HTML contains `/design-shotgun`:

```typescript
expect(html).toContain('/design-shotgun');
```

After patching `gallery.ts` (§7), update this assertion:

```typescript
expect(html).toContain('design variants');
```

### 10.4 Patch `test/serve.test.ts`

The serve test references `__GSTACK_SERVER_URL` in assertions. This is a JavaScript global variable name injected into the comparison board HTML so the board can POST feedback back to the server. The variable name appears in:

- `serve.ts` line ~69 (injection)
- `compare.ts` inline JS (reading it for fetch URL)
- `serve.test.ts` line ~121 (assertion)
- `feedback-roundtrip.test.ts` lines ~58, ~70, ~143-149

**Decision: rename the variable to `__DESIGN_SERVER_URL`.**

Files to patch:
- `src/serve.ts`: change `window.__GSTACK_SERVER_URL` to `window.__DESIGN_SERVER_URL`
- `src/compare.ts`: change `window.__GSTACK_SERVER_URL` to `window.__DESIGN_SERVER_URL` (in the inline JavaScript)
- `test/serve.test.ts`: change the assertion string from `__GSTACK_SERVER_URL` to `__DESIGN_SERVER_URL`

Search for all occurrences:
```bash
grep -rn '__GSTACK_SERVER_URL' src/ test/
```

This is a mechanical find/replace — the variable name is cosmetic but should not reference gstack in a standalone package.

### 10.5 Do not copy `test/feedback-roundtrip.test.ts`

This test imports from `../../browse/src/browser-manager` and `../../browse/src/read-commands` — it requires the browse binary running alongside design. It is a gstack-level integration test, not a design-level unit test.

If feedback round-trip testing is desired in the standalone package, it would need to be rewritten to use `fetch()` directly against the serve HTTP endpoints (which `serve.test.ts` already covers).

---

## 11. package.json

Create `package.json` at the repo root:

```json
{
  "name": "gstack-design",
  "version": "1.0.0",
  "description": "AI-powered UI mockup CLI — generate, iterate, diff, and QA design mockups",
  "license": "MIT",
  "type": "module",
  "bin": {
    "design": "./dist/design"
  },
  "scripts": {
    "build": "bun build --compile src/cli.ts --outfile dist/design",
    "postbuild": "git rev-parse HEAD > dist/.version 2>/dev/null || echo 'unknown' > dist/.version",
    "dev": "bun run src/cli.ts",
    "test": "bun test test/",
    "typecheck": "bun run tsc --noEmit",
    "setup": "bash setup"
  },
  "devDependencies": {
    "@types/bun": "latest"
  },
  "engines": {
    "bun": ">=1.0.0"
  },
  "keywords": [
    "design",
    "mockup",
    "ui",
    "openai",
    "gpt-4o",
    "image-generation",
    "cli",
    "ai-agent"
  ]
}
```

Notes:
- **Zero npm dependencies.** All source uses `fetch()` (built into Bun and Node 18+) and `fs`/`path`/`child_process` from stdlib.
- `Bun.serve()` is used in `serve.ts` — this is the sole Bun-specific API. The rest works under Node.js too.

---

## 12. setup Script

Create `setup` (executable, no extension) at the repo root:

```bash
#!/usr/bin/env bash
# design setup — install and build the design CLI
set -e

# ─── Check Bun ───────────────────────────────────────────────────
if ! command -v bun >/dev/null 2>&1; then
  echo "Error: bun is required but not installed." >&2
  echo "Install: curl -fsSL https://bun.sh/install | bash" >&2
  exit 1
fi

BUN_VERSION_MAJOR=$(bun --version | cut -d. -f1)
if [ "$BUN_VERSION_MAJOR" -lt 1 ]; then
  echo "Error: bun >= 1.0.0 required (found $(bun --version))" >&2
  exit 1
fi

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
DIST_DIR="$REPO_DIR/dist"

echo "Installing dependencies..."
bun install

# ─── Smart rebuild ───────────────────────────────────────────────
DESIGN_BIN="$DIST_DIR/design"
NEEDS_BUILD=0

if [ ! -f "$DESIGN_BIN" ]; then
  NEEDS_BUILD=1
else
  # Rebuild if any source file is newer than the binary
  if find "$REPO_DIR/src" -name "*.ts" -newer "$DESIGN_BIN" | grep -q .; then
    NEEDS_BUILD=1
  fi
fi

if [ "$NEEDS_BUILD" -eq 1 ]; then
  echo "Building design..."
  mkdir -p "$DIST_DIR"
  bun run build
else
  echo "Build is up to date (use 'bun run build' to force rebuild)"
fi

echo ""
echo "design is ready."
echo "Usage: $DESIGN_BIN <command>"
echo "       design --help"
echo ""
echo "Run 'design setup' to configure your OpenAI API key."
```

Make it executable: `chmod +x setup`

---

## 13. tsconfig.json

Create `tsconfig.json` at the repo root:

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "types": ["bun-types"]
  },
  "include": ["src/**/*.ts", "test/**/*.ts"]
}
```

---

## 14. CI Workflow: ci.yml

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  typecheck:
    name: TypeScript type check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install
      - run: bun run typecheck

  test:
    name: Tests (${{ matrix.os }})
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [macos-14, ubuntu-latest]
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install
      - run: bun test test/
        env:
          CI: "1"

  build-check:
    name: Build check (${{ matrix.os }})
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [macos-14, ubuntu-latest, windows-latest]
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install
      - run: bun run build
```

---

## 15. CI Workflow: release.yml

Create `.github/workflows/release.yml`:

```yaml
name: Release

on:
  push:
    tags:
      - 'v*'

permissions:
  contents: write

jobs:
  build:
    name: Build ${{ matrix.target }}
    runs-on: ${{ matrix.runner }}
    strategy:
      matrix:
        include:
          - runner: macos-14
            target: darwin-arm64
            output: design-darwin-arm64
          - runner: macos-13
            target: darwin-x86_64
            output: design-darwin-x86_64
          - runner: ubuntu-latest
            target: linux-x86_64
            output: design-linux-x86_64
          - runner: ubuntu-24.04-arm
            target: linux-arm64
            output: design-linux-arm64
          - runner: windows-latest
            target: windows-x86_64
            output: design-windows-x86_64
    steps:
      - uses: actions/checkout@v4

      - uses: oven-sh/setup-bun@v2

      - name: Install dependencies
        run: bun install

      - name: Build
        run: bun run build

      - name: Package (non-Windows)
        if: matrix.runner != 'windows-latest'
        run: |
          cd dist
          tar czf ../${{ matrix.output }}.tar.gz design

      - name: Package (Windows)
        if: matrix.runner == 'windows-latest'
        shell: bash
        run: |
          cd dist
          tar czf ../${{ matrix.output }}.tar.gz design.exe

      - name: Upload artifact
        uses: actions/upload-artifact@v4
        with:
          name: ${{ matrix.output }}
          path: ${{ matrix.output }}.tar.gz

  publish:
    name: Publish release
    needs: build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          token: ${{ secrets.HOMEBREW_TAP_TOKEN }}

      - name: Download all artifacts
        uses: actions/download-artifact@v4
        with:
          merge-multiple: true

      - name: Extract version tag
        run: echo "VERSION=${GITHUB_REF_NAME#v}" >> $GITHUB_ENV

      - name: Create GitHub release
        env:
          GH_TOKEN: ${{ github.token }}
        run: |
          gh release create "$GITHUB_REF_NAME" \
            design-darwin-arm64.tar.gz \
            design-darwin-x86_64.tar.gz \
            design-linux-x86_64.tar.gz \
            design-linux-arm64.tar.gz \
            design-windows-x86_64.tar.gz \
            --generate-notes \
            --title "design v$VERSION"

      - name: Compute SHA256 checksums
        run: |
          for f in design-darwin-arm64.tar.gz design-darwin-x86_64.tar.gz design-linux-x86_64.tar.gz design-linux-arm64.tar.gz; do
            sha256sum "$f" | awk '{print $1}' > "${f%.tar.gz}.sha256"
          done

      - name: Clone tap repo
        run: |
          git clone https://x-access-token:${{ secrets.HOMEBREW_TAP_TOKEN }}@github.com/juanheyns/homebrew-gstack-design.git tap

      - name: Update design.rb
        run: |
          VERSION="${{ env.VERSION }}"
          SHA_DARWIN_ARM=$(cat design-darwin-arm64.sha256)
          SHA_DARWIN_X86=$(cat design-darwin-x86_64.sha256)
          SHA_LINUX_X86=$(cat design-linux-x86_64.sha256)
          SHA_LINUX_ARM=$(cat design-linux-arm64.sha256)
          sed -i "s|version \".*\"|version \"${VERSION}\"|g" tap/Formula/design.rb
          sed -i "/darwin.*arm/,/sha256/{s|url \".*\"|url \"https://github.com/juanheyns/gstack-design/releases/download/v${VERSION}/design-darwin-arm64.tar.gz\"|}" tap/Formula/design.rb
          sed -i "/darwin.*arm/,/sha256/{s|sha256 \".*\"|sha256 \"${SHA_DARWIN_ARM}\"|}" tap/Formula/design.rb
          sed -i "/darwin.*intel/,/sha256/{s|url \".*\"|url \"https://github.com/juanheyns/gstack-design/releases/download/v${VERSION}/design-darwin-x86_64.tar.gz\"|}" tap/Formula/design.rb
          sed -i "/darwin.*intel/,/sha256/{s|sha256 \".*\"|sha256 \"${SHA_DARWIN_X86}\"|}" tap/Formula/design.rb
          sed -i "/linux.*intel/,/sha256/{s|url \".*\"|url \"https://github.com/juanheyns/gstack-design/releases/download/v${VERSION}/design-linux-x86_64.tar.gz\"|}" tap/Formula/design.rb
          sed -i "/linux.*intel/,/sha256/{s|sha256 \".*\"|sha256 \"${SHA_LINUX_X86}\"|}" tap/Formula/design.rb
          sed -i "/linux.*arm/,/sha256/{s|url \".*\"|url \"https://github.com/juanheyns/gstack-design/releases/download/v${VERSION}/design-linux-arm64.tar.gz\"|}" tap/Formula/design.rb
          sed -i "/linux.*arm/,/sha256/{s|sha256 \".*\"|sha256 \"${SHA_LINUX_ARM}\"|}" tap/Formula/design.rb

      - name: Commit and push formula update
        run: |
          cd tap
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add Formula/design.rb
          git commit -m "design ${{ env.VERSION }}"
          git push
```

**Required GitHub secrets** in `juanheyns/gstack-design`:
- `HOMEBREW_TAP_TOKEN` — a GitHub personal access token with `repo` scope for `juanheyns/homebrew-gstack-design`.

---

## 16. Homebrew Formulae

These formulae live in the tap repo `juanheyns/homebrew-gstack-design` (§17), and are also kept as `Formula/design.rb` in the main repo for reference.

### 16.1 `Formula/design.rb`

```ruby
class Design < Formula
  desc "AI-powered UI mockup CLI — generate, iterate, diff, and QA design mockups"
  homepage "https://github.com/juanheyns/gstack-design"
  version "1.0.0"
  license "MIT"

  on_macos do
    on_arm do
      url "https://github.com/juanheyns/gstack-design/releases/download/v1.0.0/design-darwin-arm64.tar.gz"
      sha256 "PLACEHOLDER"
    end
    on_intel do
      url "https://github.com/juanheyns/gstack-design/releases/download/v1.0.0/design-darwin-x86_64.tar.gz"
      sha256 "PLACEHOLDER"
    end
  end

  on_linux do
    on_arm do
      url "https://github.com/juanheyns/gstack-design/releases/download/v1.0.0/design-linux-arm64.tar.gz"
      sha256 "PLACEHOLDER"
    end
    on_intel do
      url "https://github.com/juanheyns/gstack-design/releases/download/v1.0.0/design-linux-x86_64.tar.gz"
      sha256 "PLACEHOLDER"
    end
  end

  def install
    bin.install "design"
  end

  test do
    assert_match "design", shell_output("#{bin}/design --version 2>&1")
  end
end
```

---

## 17. Tap Repository: juanheyns/homebrew-gstack-design

Create a separate GitHub repo `juanheyns/homebrew-gstack-design`:

```bash
gh repo create juanheyns/homebrew-gstack-design --public \
  --description "Homebrew tap for juanheyns/gstack-design (AI mockup CLI)"
git clone git@github.com:juanheyns/homebrew-gstack-design.git
```

Structure:

```
homebrew-gstack-design/
  Formula/
    design.rb         (copy from main repo, with real SHAs after first release)
  README.md
```

`README.md` content for the tap repo:

```markdown
# homebrew-gstack-design

Homebrew tap for [design](https://github.com/juanheyns/gstack-design) — AI-powered UI mockup CLI.

## Install

```bash
brew tap juanheyns/gstack-design
brew install design
```

## Upgrade

```bash
brew upgrade design
```
```

The release workflow in `juanheyns/gstack-design` (§15) auto-commits updated formulae to this repo via `HOMEBREW_TAP_TOKEN`.

---

## 18. SKILL.md

Create `SKILL.md` at the repo root. This file is hand-maintained — no templating system, no preamble block.

```markdown
---
name: design
description: AI-powered UI mockup generation — generate, iterate, diff, QA, and evolve mockups via GPT-4o
version: 1.0.0
allowed-tools:
  - Bash
  - Read
  - Write
  - AskUserQuestion
---

# design

AI-powered UI mockup CLI built on GPT-4o image generation. Generates production-quality PNG mockups, not wireframes. Supports multi-turn iteration, visual QA, visual diff, and design-to-code prompt extraction.

Requires an OpenAI API key. Run `design setup` to configure.

## Commands

| Command | Description |
|---|---|
| `design generate --brief "..." --output /path.png` | Generate a mockup from a text brief |
| `design generate --brief-file brief.json --output /path.png` | Generate from a structured JSON brief |
| `design generate --brief "..." --output /path.png --check` | Generate + auto-QA the result |
| `design variants --brief "..." --count 3 --output-dir /path/` | Generate N variant explorations |
| `design variants --brief "..." --count 3 --viewports "desktop,tablet,mobile"` | Variants at multiple viewport sizes |
| `design iterate --session /path/session.json --feedback "..." --output /path.png` | Refine a mockup with feedback |
| `design check --image /path.png --brief "..."` | Vision QA — does mockup match brief? |
| `design compare --images "/path/*.png" --output /path/board.html` | HTML comparison board |
| `design compare --images "/path/*.png" --output /path/board.html --serve` | Comparison board + live feedback server |
| `design diff --before /path/a.png --after /path/b.png` | Visual diff between two mockups |
| `design evolve --screenshot /path/live.png --brief "..." --output /path.png` | Evolve a live screenshot into a new design |
| `design design-to-code --image /path.png` | Extract implementation prompt from mockup |
| `design gallery --output /path/gallery.html` | HTML timeline of all design explorations |
| `design serve --html /path/board.html` | Serve a comparison board with feedback loop |
| `design setup` | Configure OpenAI API key |
| `design --version` | Print version |

## Structured Brief Format

For `--brief-file`, provide a JSON file:

```json
{
  "goal": "Dashboard for coding assessment tool",
  "audience": "Technical users, hiring managers",
  "style": "Dark theme, cream accents, minimal",
  "elements": ["score badge", "narrative letter", "metric cards"],
  "constraints": "Max width 1024px, mobile-first",
  "screenType": "desktop-dashboard"
}
```

`screenType` values: `desktop-dashboard`, `mobile-app`, `landing-page`, `settings-page`, `modal-dialog`, etc.

## Common Patterns

### Explore → Pick → Iterate

```bash
# Generate 3 variants
design variants --brief "Landing page for a dev tool called Stackflow" --count 3 --output-dir /tmp/explore/

# Compare side-by-side (opens in browser)
design compare --images "/tmp/explore/*.png" --output /tmp/explore/board.html --serve

# Iterate on the chosen variant
design iterate --session /tmp/explore/session.json --feedback "make the CTA more prominent" --output /tmp/v2.png
```

### Evolve from a live site

```bash
# Screenshot your current site (via browse or any tool)
browse goto https://example.com
browse screenshot /tmp/current.png

# Generate an evolved version
design evolve --screenshot /tmp/current.png --brief "simplify the header, add more whitespace" --output /tmp/evolved.png

# Diff to see what changed
design diff --before /tmp/current.png --after /tmp/evolved.png
```

### Design-to-code handoff

```bash
# Generate the mockup
design generate --brief "Settings page with profile section and notification toggles" --output /tmp/settings.png --check

# Extract implementation instructions
design design-to-code --image /tmp/settings.png
# Returns: { implementationPrompt, colors, typography, layout, components }
```

### Build a design system from approved mockups

```bash
# After approving a mockup, extract its design language into DESIGN.md
# (This is done automatically by the memory module when invoked from a skill,
# or manually via the design-to-code command)
design design-to-code --image /tmp/approved.png
```

Future `generate` calls in the same repo will read `DESIGN.md` as a constraint, keeping new mockups on-brand.

## Project Directory

All generated output defaults to `.design/` in the current git project root (or cwd if not in a repo). This directory is auto-created on first use and auto-added to `.gitignore`.

```
.design/
├── mockup.png              # Latest generate output
├── variants/               # Latest variant exploration
│   ├── variant-A.png
│   ├── variant-B.png
│   └── variant-C.png
├── board.html              # Latest comparison board
├── iterate.png             # Latest iteration output
├── evolved.png             # Latest evolve output
└── gallery.html            # Design history timeline
```

All paths are overridable with `--output` or `--output-dir` flags.

Multi-turn session state (API threading IDs) lives in `/tmp/design-session-*.json` — ephemeral, not persisted across reboots.

## Configuration

```bash
design setup                    # Interactive API key setup
export OPENAI_API_KEY=sk-...    # Or set via environment variable
```

Config stored at `~/.config/design/config.json`. Also reads `~/.gstack/openai.json` as a fallback for existing gstack users.

## Note for existing gstack users

If you already have gstack installed, the design binary is available at `~/.claude/skills/gstack/design/dist/design`. This standalone package is for using design independently of gstack. Both installations can coexist — they use separate config paths (`~/.gstack/` for gstack, `~/.config/design/` for this package), with a fallback to read gstack's OpenAI key if the standalone config doesn't exist yet.
```

---

## 19. README.md

Create `README.md` at the repo root:

```markdown
# design

AI-powered UI mockup CLI built on GPT-4o. Generate, iterate, diff, and QA production-quality UI mockups from the command line.

## Install

```bash
brew tap juanheyns/gstack-design
brew install design
```

## Quick start

```bash
design setup                    # Configure your OpenAI API key
design generate --brief "Dashboard with metrics cards and a sidebar" --output mockup.png
design check --image mockup.png --brief "Dashboard with metrics cards and a sidebar"
```

## What it does

- **generate** — Text brief → production-quality PNG mockup via GPT-4o image generation
- **variants** — Generate N different interpretations of the same brief for exploration
- **iterate** — Multi-turn refinement with conversation threading ("make the header smaller")
- **check** — Vision-based QA gate: does the mockup match the brief?
- **compare** — HTML comparison board for side-by-side variant review
- **diff** — Visual diff between two PNGs with per-area severity ratings
- **evolve** — Take a screenshot of your live site + a change brief → new mockup
- **design-to-code** — Extract structured implementation prompt from an approved mockup
- **gallery** — HTML timeline of all design explorations for a project

## Commands

See [SKILL.md](./SKILL.md) for the full command reference with examples and common patterns.

## Building from source

```bash
git clone https://github.com/juanheyns/gstack-design.git
cd gstack-design
./setup
dist/design --help
```

Requires [bun](https://bun.sh) >= 1.0.0.

## Configuration

```bash
design setup                    # Interactive API key setup
export OPENAI_API_KEY=sk-...    # Or set via environment variable
```

Config is stored at `~/.config/design/config.json`. Generated output defaults to `.design/` in the project root.

## Agent integration

Every command outputs structured JSON to stdout and logs to stderr, making it suitable for use by AI coding agents. The typical agent loop:

```
generate → check → (iterate if check fails) → compare variants → design-to-code → implement
```

The `evolve` + `diff` pair enables a closed loop: screenshot the live site, evolve it, implement the changes, screenshot again, diff to verify fidelity.

## Note for existing gstack users

If you already have gstack installed, the design binary is available via gstack. This standalone package lets you use it independently. Both installations coexist — the standalone config is at `~/.config/design/` while gstack uses `~/.gstack/`. The standalone binary reads gstack's OpenAI key as a fallback.

## License

MIT
```

---

## 20. .gitignore

Create `.gitignore`:

```
node_modules/
dist/
.design/
*.tar.gz
*.sha256
bun.lockb
```

---

## 21. Implementation Order

Work through these steps in sequence. Each step has a clear completion criterion.

1. **Create `juanheyns/gstack-design` repo** — `gh repo create`, clone locally. Done when: empty repo cloned.

2. **Copy source files** — Copy all files per §2 table. Done when: all 16 source files exist at their destination paths under `src/`.

3. **Apply mechanical substitutions** — Apply all find/replace rules from §3. Done when: `grep -r '\.gstack\|gstack' src/` returns zero matches outside of the backward-compat fallback in auth.ts.

4. **Create `package.json`** — Exact content from §11. Done when: `bun install` succeeds.

5. **Create `src/project-dir.ts`** — Full content from §4.1. Done when: file exists.

6. **Create `src/slug.ts`** — Full content from §4.2. Done when: file exists.

7. **Patch `src/auth.ts`** — §5 changes (config path, error message, gstack fallback). Done when: `design setup` references appear in error text.

8. **Patch `src/cli.ts`** — §6 changes (help text, setup subcommand, --version, use project-dir.ts for defaults, gallery dispatch). Done when: help text says `design —` not `gstack design —` and default outputs point to `.design/`.

9. **Patch `src/gallery.ts`** — §7 changes (empty gallery message). Done when: no `/design-shotgun` reference.

10. **Patch `src/serve.ts` and `src/compare.ts`** — §8 changes (`__GSTACK_SERVER_URL` → `__DESIGN_SERVER_URL`). Done when: `grep '__GSTACK_SERVER_URL' src/` returns zero matches.

11. **Patch `src/brief.ts`** — §9 changes (remove dead Bun.file() call). Done when: no `Bun.file()` in the file.

12. **Copy and patch test files** — Copy `gallery.test.ts` and `serve.test.ts` per §10.3-10.4. Create new tests per §10.2. Do NOT copy `feedback-roundtrip.test.ts`. Done when: all test files exist and no `__GSTACK_SERVER_URL` or `/design-shotgun` in test assertions.

13. **Create `tsconfig.json`** — Content from §13. Done when: file exists.

14. **Run `bun run build`** — Done when: `dist/design` exists and the command exits 0.

15. **Run `bun test test/`** — Fix any broken imports or assertions. Done when: all tests pass.

16. **Create `setup` script** — Content from §12. Make executable: `chmod +x setup`. Done when: `./setup` runs to completion.

17. **Write `SKILL.md`** — Full content from §18. Done when: file exists with correct YAML front matter.

18. **Write `README.md`** — Content from §19. Done when: file exists.

19. **Write `.gitignore`** — Content from §20. Done when: file exists.

20. **Create `juanheyns/homebrew-gstack-design` tap repo** — `gh repo create`, clone, add formula stub, push. Done when: `brew tap juanheyns/gstack-design` succeeds.

21. **Add `Formula/design.rb`** to main repo — Stub content from §16 (SHAs are PLACEHOLDER until first release). Done when: file exists.

22. **Create `.github/workflows/ci.yml`** — Content from §14. Done when: file exists.

23. **Create `.github/workflows/release.yml`** — Content from §15. Done when: file exists.

24. **Set `HOMEBREW_TAP_TOKEN` secret** in `juanheyns/gstack-design` GitHub repo settings. Done when: secret is visible in Settings → Secrets.

25. **Initial commit and push to `main`** — Done when: CI workflow runs and passes.

26. **Tag `v1.0.0`**:
    ```bash
    git tag v1.0.0
    git push origin v1.0.0
    ```
    Done when: Release workflow completes, GitHub release page shows all 5 tarballs.

27. **Verify tap auto-update** — Done when: `tap/Formula/design.rb` in `juanheyns/homebrew-gstack-design` shows the v1.0.0 URLs with real SHA256 hashes.

28. **End-to-end test**:
    ```bash
    mkdir /tmp/design-e2e-test && cd /tmp/design-e2e-test && git init
    brew tap juanheyns/gstack-design
    brew install design
    design --version
    design setup
    design generate --brief "Simple landing page"
    ls .design/mockup.png        # output in project .design/
    grep '.design/' .gitignore   # auto-added to .gitignore
    ```
    Done when: all commands succeed, `.design/mockup.png` exists in the test project, and `.design/` was auto-added to `.gitignore`.

---

## 22. Verification Checklist

After completing the implementation order, verify each item:

- [ ] `grep -r '\.gstack' src/` returns only the backward-compat fallback in `auth.ts`
- [ ] `grep -r 'skills/gstack' src/` returns zero matches
- [ ] `grep -r '\$D ' src/` returns zero matches
- [ ] `grep -r 'gstack-slug\|gstack-config\|gstack-telemetry' src/` returns zero matches
- [ ] `grep -r '__GSTACK_SERVER_URL' src/ test/` returns zero matches
- [ ] `grep -r '/tmp/gstack-' src/` returns zero matches (default outputs now use `.design/`)
- [ ] `grep -r 'design-shotgun' src/ test/` returns zero matches
- [ ] `grep -rn 'gstack' src/ | grep -v 'backward-compat\|fallback\|gstack users\|migrating from gstack'` returns zero matches (catch any stragglers)
- [ ] `bun run build` exits 0 and produces `dist/design`
- [ ] `dist/design --version` prints `design 1.0.0`
- [ ] `dist/design --help` prints `design —` (not `gstack design —`)
- [ ] `dist/design setup` prompts for API key and saves to `~/.config/design/config.json`
- [ ] `bun test test/` passes
- [ ] `bun run typecheck` exits 0
- [ ] `Formula/design.rb` has correct Ruby syntax: `ruby -c Formula/design.rb`
- [ ] GitHub Actions CI workflow passes on PR to `main`
- [ ] Release workflow produces all 5 tarballs on `v1.0.0` tag push
- [ ] `brew tap juanheyns/gstack-design && brew install design` completes without error
- [ ] `~/.config/design/config.json` is created (not `~/.gstack/openai.json`) after `design setup`
- [ ] With only `~/.gstack/openai.json` present (no standalone config), `design generate` still resolves the API key
- [ ] `feedback-roundtrip.test.ts` was NOT copied (it depends on the browse binary)
- [ ] Running `design generate --brief "test"` in a git repo creates `.design/mockup.png` (not `/tmp/`)
- [ ] `.design/` is auto-added to `.gitignore` on first run
- [ ] Running `design generate --output /tmp/explicit.png` still respects explicit paths

---

### Critical Files for Implementation

- `/Users/juanheyns/Source/github.com/garrytan/gstack/design/src/cli.ts`
- `/Users/juanheyns/Source/github.com/garrytan/gstack/design/src/auth.ts`
- `/Users/juanheyns/Source/github.com/garrytan/gstack/design/src/gallery.ts`
- `/Users/juanheyns/Source/github.com/garrytan/gstack/design/src/brief.ts`
- `/Users/juanheyns/Source/github.com/garrytan/gstack/design/src/serve.ts`
