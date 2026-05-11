# Codex Backend Notes

This document describes the Codex-backed architecture for `design`.

## Status

This backend is now the current implementation.

- Current state: `design` shells out to `codex exec` for model-backed work and keeps local file management, HTML generation, and feedback handling in-process.
- Prior state: `design` resolved an API key and called OpenAI endpoints directly.

## Goal

Keep the existing `design` command surface, with Codex as the execution backend for generation and vision-style analysis.

The user still runs commands like `design generate` or `design variants`, but the CLI no longer talks to model APIs itself. Instead it prepares a prompt, declares the expected output files, invokes `codex exec`, and validates the results on disk.

## Why Route Through Codex

- It lets the tool reuse the user's Codex login state instead of introducing a separate `design` auth flow.
- It keeps design generation inside the same agent environment already used for implementation work.
- It gives the backend a consistent way to ask for one artifact or several alternatives by naming exact output paths in the prompt.
- It aligns the tool with agent-driven workflows rather than raw API plumbing.

## High-Level Architecture

1. The user runs a `design` command.
2. The CLI parses flags, resolves output paths, and creates any required project-local directories.
3. For model-backed commands, the CLI builds a Codex prompt with:
   - the design brief or image-analysis task
   - the required output format
   - exact file paths to write
   - constraints such as "write exactly three alternatives named `variant-A.png`, `variant-B.png`, and `variant-C.png`"
4. The CLI invokes `codex exec`.
5. Codex performs the generation or analysis and writes the requested files or JSON payload.
6. The CLI verifies that the expected outputs exist, then prints its usual structured result JSON.

## Command Mapping

These commands should stay local:

- `compare`: generate HTML comparison board
- `serve`: host the comparison board and collect browser feedback
- `gallery`: generate HTML design history
- project directory management in `.design/`

These commands should move to `codex exec`:

- `generate`: create one PNG mockup at a requested path
- `variants`: create several named alternatives at requested paths
- `iterate`: refine an existing design using the saved session context and new feedback
- `evolve`: use a screenshot plus change brief to create a new PNG
- `check`: analyze a mockup against a brief and return pass/fail JSON
- `diff`: compare two images and return structured differences
- `verify`: compare an implementation screenshot against an approved mockup
- `prompt`: extract implementation guidance from an approved mockup
- `extract`: extract design language and update `DESIGN.md`

## Output Contracts

The key change is that `design` stops requesting "a model response" and starts requesting "specific artifacts at specific paths."

Examples:

- `generate`: write exactly one PNG to `.design/mockup.png`
- `variants --count 3`: write exactly three PNGs to `.design/variants/variant-A.png`, `.design/variants/variant-B.png`, and `.design/variants/variant-C.png`
- `check`: write one JSON file or print one JSON object with `{ pass, issues }`
- `prompt`: write or print one JSON object with `{ implementationPrompt, colors, typography, layout, components }`

This keeps the `design` CLI stable even though the backend transport changes.

## Prompt Shape

The prompt passed to `codex exec` should be explicit and operational, not conversational.

For generation commands, it should include:

- what to create
- where to write it
- how many alternatives to produce
- any size or style constraints
- whether intermediate files are allowed
- whether the final response should be JSON only

An example shape for `variants`:

```text
Create three distinct UI mockup alternatives for this brief:
"Landing page for a dev tool called Stackflow."

Write the final PNG files to:
- /repo/.design/variants/variant-A.png
- /repo/.design/variants/variant-B.png
- /repo/.design/variants/variant-C.png

Each file should represent a meaningfully different visual direction.
Do not rename the files.
Return JSON only with the written file paths.
```

## User Interaction Changes

From the user's perspective, the CLI interaction stays mostly the same.

- The user still types `design generate`, `design variants`, `design compare`, and similar commands.
- The user still reviews PNGs and HTML boards on disk.
- The user still gives natural-language feedback during `iterate` or through the comparison board.

The main visible changes would be:

- authentication shifts from `design setup` to Codex login
- backend behavior is mediated by Codex rather than direct API calls
- generation quality and capabilities depend on what Codex can do in that environment

## Session Model

The current implementation stores API-threading state in `/tmp/design-session-*.json`.

Under the Codex backend, session files continue to exist, but their contents are framed around Codex handoff state rather than raw API response IDs. For example:

- original brief
- feedback history
- previous output paths
- optional Codex session or run identifiers if a stable public surface exists

The CLI should not depend on undocumented internal Codex auth or session files.

## Auth Direction

- `design setup`
- rely on `codex login`
- use `codex exec` as the supported execution surface
- avoid reading Codex internal token files directly

## Non-Goals

- Replacing the browser review loop in `compare` and `serve`
- Replacing `.design/` artifact management
- Making the CLI scrape or reuse undocumented Codex credentials
- Changing the public command names unless there is a separate product reason to do so

## Implementation Notes

The important operational constraints are:

1. Validate file existence and JSON shape after every Codex run.
2. Keep `compare`, `serve`, and `gallery` unchanged.
3. Avoid depending on undocumented Codex auth or session files.
