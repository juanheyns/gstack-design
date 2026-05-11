# design

AI-powered UI mockup CLI for agent-driven design workflows. Generate, iterate, diff, and QA production-quality UI mockups from the command line.

## Install

```bash
brew tap juanheyns/gstack
brew install design
```

## Quick start

```bash
codex login
design setup                    # Verify Codex login + run smoke test
design generate --brief "Dashboard with metrics cards and a sidebar" --output mockup.png
design check --image mockup.png --brief "Dashboard with metrics cards and a sidebar"
```

## What it does

- **generate** — Text brief → production-quality PNG mockup
- **variants** — Generate N different interpretations of the same brief for exploration
- **iterate** — Multi-turn refinement with conversation threading ("make the header smaller")
- **check** — Vision-based QA gate: does the mockup match the brief?
- **compare** — HTML comparison board for side-by-side variant review
- **diff** — Visual diff between two PNGs with per-area severity ratings
- **evolve** — Take a screenshot of your live site + a change brief → new mockup
- **prompt** — Extract a structured implementation prompt from an approved mockup
- **extract** — Extract design language from an approved mockup into `DESIGN.md`
- **verify** — Compare a live implementation screenshot against an approved mockup
- **gallery** — HTML timeline of all design explorations for a project

## Commands

See [SKILL.md](./skills/gstack-design/SKILL.md) for the full command reference with examples and common patterns.

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
codex login
design setup                    # Verify Codex login + run smoke test
```

Model-backed commands run through `codex exec`. Generated output defaults to `.design/` in the project root.

## Codex Backend

`design` keeps the same user-facing CLI surface, but model-backed commands execute through `codex exec`.

- `design` remains responsible for parsing briefs, resolving output paths, writing comparison boards, and returning structured JSON.
- Model-backed commands such as `generate`, `variants`, `iterate`, `check`, `diff`, `verify`, `evolve`, `prompt`, and `extract` construct a prompt plus an output contract, then invoke `codex exec`.
- The Codex agent is told exactly which files to write and where to write them, for example a single PNG at `.design/mockup.png` or three alternatives at `.design/variants/variant-A.png`, `variant-B.png`, and `variant-C.png`.
- Authentication relies on the user's existing Codex login state.
- Local deterministic commands such as `compare`, `serve`, `gallery`, and `.design/` project directory management would stay in the CLI.

More detail is documented in [docs/codex-backend.md](./docs/codex-backend.md).

## Agent integration

Every command outputs structured JSON to stdout and logs to stderr, making it suitable for use by AI coding agents. The typical agent loop:

```
generate → check → (iterate if check fails) → compare variants → prompt → implement
```

The `evolve` + `diff` pair enables a closed loop: screenshot the live site, evolve it, implement the changes, screenshot again, diff to verify fidelity.

## Note for existing gstack users

If you already have gstack installed, the design binary is available via gstack. This standalone package lets you use it independently. Both installations coexist — the standalone config is at `~/.config/design/` while gstack uses `~/.gstack/`. The standalone binary reads gstack's OpenAI key as a fallback.

## License

MIT
