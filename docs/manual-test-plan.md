# Manual Test Plan

This plan exercises the full `design` CLI manually from a clean workspace.

It is written to match the current Codex-backed implementation:

- model-backed commands run through `codex exec`
- local review/history commands run in the CLI itself

## Prerequisites

1. Build the CLI:

```bash
bun run build
```

2. Make sure Codex is installed and logged in:

```bash
codex login status
```

Expected:

- output indicates you are logged in

3. Create a disposable workspace:

```bash
export DESIGN_BIN=/Users/juanheyns/Source/github.com/juanheyns/gstack-design/dist/design
export DESIGN_TEST_ROOT=/tmp/design-manual-$(date +%Y%m%d-%H%M%S)
mkdir -p "$DESIGN_TEST_ROOT"
cd "$DESIGN_TEST_ROOT"
mkdir app
cd app
git init
```

4. Create a structured brief fixture:

```bash
cat > brief.json <<'EOF'
{
  "goal": "Analytics dashboard for a developer tool",
  "audience": "Developers and engineering managers",
  "style": "Clean, modern, calm, high information density",
  "elements": ["sidebar", "top navigation", "metric cards", "activity table", "status badges"],
  "constraints": "Readable typography, clear hierarchy, production UI",
  "screenType": "desktop-dashboard"
}
EOF
```

5. Define a reusable brief string:

```bash
export DESIGN_BRIEF="Analytics dashboard for a developer tool with sidebar, metric cards, activity table, and clear hierarchy"
```

## 1. Help And Version

Command:

```bash
"$DESIGN_BIN" --help
"$DESIGN_BIN" --version
```

Expected:

- help prints the command list
- help mentions `codex login`
- version prints `design <version>`

## 2. Setup / Backend Readiness

Command:

```bash
"$DESIGN_BIN" setup
```

Expected:

- confirms Codex is available and logged in
- runs a smoke generation
- writes `.design/smoke-test.png`
- prints `Smoke test PASSED`

## 3. Generate From Plain Brief

Command:

```bash
"$DESIGN_BIN" generate \
  --brief "$DESIGN_BRIEF" \
  --output .design/mockup-plain.png
```

Expected:

- `.design/mockup-plain.png` exists and is non-empty
- stdout is JSON with `outputPath`, `sessionFile`, and `responseId`
- the `sessionFile` path exists in `/tmp`

## 4. Generate From Structured Brief File

Command:

```bash
"$DESIGN_BIN" generate \
  --brief-file brief.json \
  --output .design/mockup-brief-file.png
```

Expected:

- `.design/mockup-brief-file.png` exists and is non-empty
- result JSON is printed

## 5. Generate With Quality Check

Command:

```bash
"$DESIGN_BIN" generate \
  --brief "$DESIGN_BRIEF" \
  --output .design/mockup-check.png \
  --check
```

Expected:

- generation succeeds
- stderr includes `Quality check: PASS` or `Quality check: FAIL`
- stdout JSON includes `checkResult`

## 6. Variants: Different Design Directions

Command:

```bash
"$DESIGN_BIN" variants \
  --brief "$DESIGN_BRIEF" \
  --count 3 \
  --output-dir .design/variants-style
```

Expected:

- `.design/variants-style/variant-A.png`
- `.design/variants-style/variant-B.png`
- `.design/variants-style/variant-C.png`
- stdout JSON includes `paths`

Manual check:

- the three outputs should not be identical in look and feel

## 7. Variants: Responsive Viewports

Command:

```bash
"$DESIGN_BIN" variants \
  --brief "$DESIGN_BRIEF" \
  --viewports "desktop,tablet,mobile" \
  --output-dir .design/variants-responsive
```

Expected:

- `.design/variants-responsive/responsive-desktop.png`
- `.design/variants-responsive/responsive-tablet.png`
- `.design/variants-responsive/responsive-mobile.png`

Manual check:

- mobile version should look meaningfully adapted for a narrow viewport

## 8. Compare Board Without Server

Command:

```bash
"$DESIGN_BIN" compare \
  --images ".design/variants-style/*.png" \
  --output .design/board.html
```

Expected:

- `.design/board.html` exists
- opening it in a browser shows all variants on one page

## 9. Compare Board With Live Feedback Server

Command:

```bash
"$DESIGN_BIN" compare \
  --images ".design/variants-style/*.png" \
  --output .design/board-serve.html \
  --serve
```

Manual browser actions:

1. Wait for the browser to open.
2. Pick one option.
3. Add ratings and comments.
4. Click `Submit`.

Expected:

- browser loads the comparison board
- submitting feedback creates `.design/feedback.json`
- the file contains your chosen option and comments

Optional regenerate path:

1. Re-run the command above.
2. In the board, choose a regenerate/remix action instead of final submit.

Expected:

- `.design/feedback-pending.json` is created

## 10. Iterate On An Existing Design

First, capture the session path from test 3 or regenerate one:

```bash
"$DESIGN_BIN" generate \
  --brief "$DESIGN_BRIEF" \
  --output .design/iterate-source.png | tee /tmp/design-generate.json
export DESIGN_SESSION=$(bun -e 'const fs = require("fs"); const data = JSON.parse(fs.readFileSync("/tmp/design-generate.json", "utf8")); console.log(data.sessionFile);')
echo "$DESIGN_SESSION"
```

Then iterate:

```bash
"$DESIGN_BIN" iterate \
  --session "$DESIGN_SESSION" \
  --feedback "Make the header smaller, increase whitespace, and reduce visual noise in the table" \
  --output .design/iterate-v2.png
```

Expected:

- `.design/iterate-v2.png` exists
- stdout JSON includes `iteration`
- the session file is updated with an extra feedback entry

Manual check:

- the second image should visibly reflect the requested changes

## 11. Diff Between Two Mockups

Command:

```bash
"$DESIGN_BIN" diff \
  --before .design/iterate-source.png \
  --after .design/iterate-v2.png
```

Expected:

- stdout JSON includes `differences`, `summary`, and `matchScore`

Manual check:

- listed differences should broadly match the change request

## 12. Verify Implementation Against Approved Mockup

Pass case:

```bash
"$DESIGN_BIN" verify \
  --mockup .design/iterate-source.png \
  --screenshot .design/iterate-source.png
```

Expected:

- `pass` is true or `matchScore` is very high

Change-detection case:

```bash
"$DESIGN_BIN" verify \
  --mockup .design/iterate-source.png \
  --screenshot .design/iterate-v2.png
```

Expected:

- lower `matchScore` than the pass case
- `diff` field is present

## 13. Evolve A Screenshot

Command:

```bash
"$DESIGN_BIN" evolve \
  --screenshot .design/iterate-source.png \
  --brief "Keep the same product, but make it calmer, lighter, and more spacious" \
  --output .design/evolved.png
```

Expected:

- `.design/evolved.png` exists
- stdout JSON includes `sourceScreenshot` and `brief`

Manual check:

- evolved image should preserve product context while changing visual treatment

## 14. Prompt Extraction

Command:

```bash
"$DESIGN_BIN" prompt \
  --image .design/iterate-source.png
```

Expected:

- stdout JSON includes:
  - `implementationPrompt`
  - `colors`
  - `typography`
  - `layout`
  - `components`

Manual check:

- `implementationPrompt` should read like an actionable build spec

## 15. Extract Design Language Into DESIGN.md

Command:

```bash
"$DESIGN_BIN" extract \
  --image .design/iterate-source.png
```

Expected:

- `DESIGN.md` is created in the repo root
- stdout JSON includes extracted colors, typography, spacing, layout, and mood

Manual check:

- `DESIGN.md` should contain a section titled `Extracted Design Language`

## 16. Gallery

`gallery` expects a history directory with per-session subdirectories and optional `approved.json`. Seed one manually:

```bash
mkdir -p .design/history/dashboard-20260510
cp .design/variants-style/variant-A.png .design/history/dashboard-20260510/variant-A.png
cp .design/variants-style/variant-B.png .design/history/dashboard-20260510/variant-B.png
cp .design/variants-style/variant-C.png .design/history/dashboard-20260510/variant-C.png
cat > .design/history/dashboard-20260510/approved.json <<'EOF'
{
  "approved_variant": "B",
  "feedback": "Variant B has the best spacing and hierarchy",
  "date": "2026-05-10T12:00:00Z"
}
EOF
```

Now run:

```bash
"$DESIGN_BIN" gallery \
  --designs-dir .design/history \
  --output .design/gallery.html
```

Expected:

- `.design/gallery.html` exists
- opening it in a browser shows the seeded session and approved badge

## 17. Failure-Mode Checks

These should fail cleanly.

Unknown command:

```bash
"$DESIGN_BIN" nope
```

Missing image:

```bash
"$DESIGN_BIN" prompt --image does-not-exist.png
```

Missing session:

```bash
"$DESIGN_BIN" iterate \
  --session /tmp/does-not-exist.json \
  --feedback "test" \
  --output .design/should-not-exist.png
```

Expected:

- command exits non-zero
- error message is readable and specific

## Suggested Sign-Off Checklist

- `setup` works
- `generate` works for plain text and JSON brief input
- `check` returns structured QA
- `variants` produces distinct outputs
- `compare` creates a valid board
- `compare --serve` writes feedback files
- `iterate` updates the design and session file
- `diff` returns meaningful structured differences
- `verify` distinguishes matching vs changed screenshots
- `evolve` preserves context while applying change brief
- `prompt` returns usable implementation guidance
- `extract` writes `DESIGN.md`
- `gallery` renders seeded history

## Cleanup

```bash
rm -rf "$DESIGN_TEST_ROOT"
rm -f /tmp/design-generate.json
```
