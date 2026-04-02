# Upstream sync: garrytan/gstack → juanheyns/gstack-design

This repo tracks the `design/` directory of [garrytan/gstack](https://github.com/garrytan/gstack) using a **vendor branch pattern**.

```
vendor branch  ──── raw upstream files (no patches)
                          │
                  git rebase onto
                          │
main branch    ──── our patches on top
```

## One-time setup

```bash
git remote add upstream https://github.com/garrytan/gstack.git
git fetch upstream
cat UPSTREAM_REF      # verify current tracking SHA
```

## Routine sync

### 1. Check for changes

```bash
scripts/sync-upstream.sh --check
```

Shows which mapped files changed upstream. Flags surgical patches that need manual review.

### 2. Apply update

```bash
scripts/sync-upstream.sh --apply <UPSTREAM_SHA>
```

Switches to `vendor` branch, copies raw files, commits, switches back.

### 3. Rebase main

```bash
git rebase vendor
```

Re-applies local patches on top of new upstream.

### 4. Resolve conflicts & verify

```bash
git diff <file>        # review surgical patch conflicts
git add <file>
git rebase --continue

bunx tsc --noEmit && bun test
```

## File mapping

| Upstream path (garrytan/gstack) | Local path | Notes |
|---|---|---|
| `design/src/auth.ts` | `src/auth.ts` | **Surgical**: config path, gstack fallback, error messages |
| `design/src/brief.ts` | `src/brief.ts` | **Surgical**: removed dead Bun.file() call |
| `design/src/check.ts` | `src/check.ts` | Copy as-is |
| `design/src/cli.ts` | `src/cli.ts` | **Surgical**: help text, setup command, --version, project-dir imports, default paths |
| `design/src/commands.ts` | `src/commands.ts` | **Surgical**: gallery usage example path |
| `design/src/compare.ts` | `src/compare.ts` | **Surgical**: `__GSTACK_SERVER_URL` → `__DESIGN_SERVER_URL`, `/design-shotgun` → `design variants` |
| `design/src/design-to-code.ts` | `src/design-to-code.ts` | Copy as-is |
| `design/src/diff.ts` | `src/diff.ts` | Copy as-is |
| `design/src/evolve.ts` | `src/evolve.ts` | Copy as-is |
| `design/src/gallery.ts` | `src/gallery.ts` | **Surgical**: empty gallery message, comment path |
| `design/src/generate.ts` | `src/generate.ts` | Copy as-is |
| `design/src/iterate.ts` | `src/iterate.ts` | Copy as-is |
| `design/src/memory.ts` | `src/memory.ts` | Copy as-is |
| `design/src/serve.ts` | `src/serve.ts` | **Surgical**: `__GSTACK_SERVER_URL` → `__DESIGN_SERVER_URL`, `$D` → `design` |
| `design/src/session.ts` | `src/session.ts` | Copy as-is |
| `design/src/variants.ts` | `src/variants.ts` | Copy as-is |
| `design/test/gallery.test.ts` | `test/gallery.test.ts` | **Surgical**: assertion for empty gallery message |
| `design/test/serve.test.ts` | `test/serve.test.ts` | **Surgical**: `__GSTACK_SERVER_URL` → `__DESIGN_SERVER_URL` |
| `LICENSE` | `LICENSE` | Copy as-is |

### Files NOT synced (only in main branch)

- `src/project-dir.ts` — new file, manages `.design/` project directory
- `src/slug.ts` — new file, replaces gstack-slug shell utility
- `test/auth.test.ts`, `test/brief.test.ts`, `test/slug.test.ts`, `test/session.test.ts` — new tests
- `test/smoke.test.ts`, `test/smoke-integration.test.ts` — new smoke tests
- `package.json`, `tsconfig.json`, `setup`, `.gitignore`
- `.github/workflows/` — CI/CD
- `skills/gstack-design/SKILL.md`, `README.md`
- `UPSTREAM.md`, `UPSTREAM_REF`, `scripts/sync-upstream.sh`

### Files NOT copied from upstream

- `design/prototype.ts` — one-off validation script, dead code
- `design/dist/` — compiled binary, rebuilt from source
- `design/SKILL.md` — replaced with standalone version
- `design/SKILL.md.tmpl` — not needed
- `design/test/feedback-roundtrip.test.ts` — depends on browse binary (replaced by `test/smoke-integration.test.ts`)

## Mechanical substitutions

These are automatically applied during rebase as part of our patches:

| Upstream | Local |
|---|---|
| `'.gstack', 'openai.json'` | `'.config', 'design', 'config.json'` |
| `'.gstack/openai.json'` | `'.config/design/config.json'` |
| `'.gstack/projects'` | `'.config/design/projects'` |
| `~/.gstack/openai.json` | `~/.config/design/config.json` |
| `$D setup` | `design setup` |
| `$D` (usage text) | `design` |
| `'gstack design'` | `'design'` |
| `/tmp/gstack-*` defaults | `.design/*` via project-dir.ts |
| `__GSTACK_SERVER_URL` | `__DESIGN_SERVER_URL` |
| `/design-shotgun` | `design variants` |

## Surgical patches

These files have logic changes beyond find/replace. Review carefully on rebase conflicts:

1. **`src/auth.ts`** — Config path changed to `~/.config/design/`, added gstack fallback
2. **`src/cli.ts`** — Help text, `--version` flag, `setup` command rewritten, all defaults use `project-dir.ts`
3. **`src/brief.ts`** — Removed dead `Bun.file()` call
4. **`src/gallery.ts`** — Empty gallery message updated
5. **`src/serve.ts`** — JS global renamed, `$D` references in comments
6. **`src/compare.ts`** — JS global renamed, `/design-shotgun` → `design variants` in inline JS
7. **`src/commands.ts`** — Gallery usage example path updated

## Quick reference

```bash
# Check for upstream changes
scripts/sync-upstream.sh --check

# Apply and rebase
scripts/sync-upstream.sh --apply <SHA>
git rebase vendor
bun test
```
