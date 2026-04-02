# design

AI-powered UI mockup CLI built on GPT-4o. Generate, iterate, diff, and QA production-quality UI mockups from the command line.

## Install

```bash
brew tap juanheyns/gstack
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
