#!/usr/bin/env bash
# Sync raw upstream files from garrytan/gstack into the vendor branch.
#
# Usage:
#   scripts/sync-upstream.sh --check            # show what changed
#   scripts/sync-upstream.sh --apply <SHA>      # update vendor to <SHA>
#
# See UPSTREAM.md for the full workflow.

set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
UPSTREAM_REMOTE="upstream"
UPSTREAM_REPO="https://github.com/garrytan/gstack.git"

# ── Helpers ────────────────────────────────────────────────────────────────

die() { echo "error: $*" >&2; exit 1; }

ensure_remote() {
  if ! git -C "$REPO_DIR" remote get-url "$UPSTREAM_REMOTE" &>/dev/null; then
    echo "Adding remote '$UPSTREAM_REMOTE' → $UPSTREAM_REPO"
    git -C "$REPO_DIR" remote add "$UPSTREAM_REMOTE" "$UPSTREAM_REPO"
  fi
}

fetch_upstream() {
  echo "Fetching $UPSTREAM_REMOTE..."
  git -C "$REPO_DIR" fetch "$UPSTREAM_REMOTE" --quiet
}

current_branch() {
  git -C "$REPO_DIR" rev-parse --abbrev-ref HEAD
}

require_clean() {
  if ! git -C "$REPO_DIR" diff --quiet || ! git -C "$REPO_DIR" diff --cached --quiet; then
    die "Working tree is dirty. Commit or stash changes before syncing."
  fi
}

# ── File map ───────────────────────────────────────────────────────────────
# Each entry is "upstream_path:local_path[:flag]"
# flag "surgical" = file has surgical patches beyond mechanical substitutions

declare -a FILE_MAP=(
  # Source files
  "design/src/auth.ts:src/auth.ts:surgical"
  "design/src/brief.ts:src/brief.ts:surgical"
  "design/src/check.ts:src/check.ts"
  "design/src/cli.ts:src/cli.ts:surgical"
  "design/src/commands.ts:src/commands.ts:surgical"
  "design/src/compare.ts:src/compare.ts:surgical"
  "design/src/design-to-code.ts:src/design-to-code.ts"
  "design/src/diff.ts:src/diff.ts"
  "design/src/evolve.ts:src/evolve.ts"
  "design/src/gallery.ts:src/gallery.ts:surgical"
  "design/src/generate.ts:src/generate.ts"
  "design/src/iterate.ts:src/iterate.ts"
  "design/src/memory.ts:src/memory.ts"
  "design/src/serve.ts:src/serve.ts:surgical"
  "design/src/session.ts:src/session.ts"
  "design/src/variants.ts:src/variants.ts"
  # Tests
  "design/test/gallery.test.ts:test/gallery.test.ts:surgical"
  "design/test/serve.test.ts:test/serve.test.ts:surgical"
  # License
  "LICENSE:LICENSE"
)

copy_upstream_file() {
  local upstream_path="$1"
  local local_path="$2"
  local target="$REPO_DIR/$local_path"

  # Try to get file from git upstream ref
  local content
  if content=$(git -C "$REPO_DIR" show "$TARGET_SHA:$upstream_path" 2>/dev/null); then
    mkdir -p "$(dirname "$target")"
    printf '%s' "$content" > "$target"
    return 0
  fi

  echo "  WARN: $upstream_path not found at $TARGET_SHA (skipped)"
  return 1
}

# ── --check mode ───────────────────────────────────────────────────────────

cmd_check() {
  ensure_remote
  fetch_upstream

  local upstream_head
  upstream_head=$(git -C "$REPO_DIR" rev-parse "$UPSTREAM_REMOTE/main")
  local current_ref
  current_ref=$(cat "$REPO_DIR/UPSTREAM_REF" 2>/dev/null || echo "(none)")

  echo ""
  echo "Current vendor: $current_ref"
  echo "Upstream HEAD:  $upstream_head"
  echo ""

  if [[ "$upstream_head" == "$current_ref" ]]; then
    echo "Already up to date."
    return 0
  fi

  TARGET_SHA="$upstream_head"

  echo "Changed files:"
  local changed=0
  local surgical=0

  for entry in "${FILE_MAP[@]}"; do
    IFS=: read -r upstream_path local_path flag <<< "$entry"
    flag="${flag:-}"

    # Get upstream content at new SHA
    local new_content
    new_content=$(git -C "$REPO_DIR" show "$TARGET_SHA:$upstream_path" 2>/dev/null || true)

    # Get vendor content
    local vendor_content
    vendor_content=$(git -C "$REPO_DIR" show "vendor:$local_path" 2>/dev/null || true)

    if [[ "$new_content" != "$vendor_content" ]]; then
      local label=""
      [[ "$flag" == "surgical" ]] && label=" [SURGICAL PATCH — review diff carefully]"
      echo "  CHANGED  $local_path$label"
      changed=$((changed + 1))
      [[ "$flag" == "surgical" ]] && surgical=$((surgical + 1))
    fi
  done

  if [[ $changed -eq 0 ]]; then
    echo "  (no mapped files changed)"
  else
    echo ""
    echo "  $changed file(s) changed, $surgical require surgical patch review"
    echo ""
    echo "To apply: scripts/sync-upstream.sh --apply $upstream_head"
  fi
}

# ── --apply mode ───────────────────────────────────────────────────────────

cmd_apply() {
  local target_sha="$1"
  [[ -z "$target_sha" ]] && die "Usage: sync-upstream.sh --apply <SHA>"

  ensure_remote
  fetch_upstream

  # Validate SHA
  git -C "$REPO_DIR" cat-file -e "${target_sha}^{commit}" 2>/dev/null \
    || die "Unknown commit: $target_sha"

  TARGET_SHA="$target_sha"

  require_clean

  local orig_branch
  orig_branch=$(current_branch)

  [[ "$orig_branch" == "vendor" ]] && die "Already on vendor branch. Check out main first."

  echo "Switching to vendor branch..."
  git -C "$REPO_DIR" checkout vendor

  echo "Copying upstream files at $target_sha..."
  for entry in "${FILE_MAP[@]}"; do
    IFS=: read -r upstream_path local_path flag <<< "$entry"
    copy_upstream_file "$upstream_path" "$local_path"
  done

  echo "$target_sha" > "$REPO_DIR/UPSTREAM_REF"
  git -C "$REPO_DIR" add -A

  if git -C "$REPO_DIR" diff --cached --quiet; then
    echo "No changes — vendor already matches $target_sha"
    git -C "$REPO_DIR" checkout "$orig_branch"
    return 0
  fi

  local short_sha="${target_sha:0:12}"
  git -C "$REPO_DIR" commit -m "$(cat <<EOF
vendor: update to garrytan/gstack@${short_sha}

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"

  echo "Switching back to $orig_branch..."
  git -C "$REPO_DIR" checkout "$orig_branch"

  echo ""
  echo "Vendor updated. Now rebase your patches:"
  echo ""
  echo "  git rebase vendor"
  echo ""
  echo "Then verify:"
  echo ""
  echo "  bunx tsc --noEmit"
  echo "  bun test"
  echo ""
  echo "See UPSTREAM.md for guidance on resolving surgical patch conflicts."
}

# ── Entry point ────────────────────────────────────────────────────────────

TARGET_SHA=""

case "${1:-}" in
  --check)
    cmd_check
    ;;
  --apply)
    cmd_apply "${2:-}"
    ;;
  *)
    echo "Usage:"
    echo "  scripts/sync-upstream.sh --check"
    echo "  scripts/sync-upstream.sh --apply <UPSTREAM_SHA>"
    echo ""
    echo "See UPSTREAM.md for the full workflow."
    exit 1
    ;;
esac
