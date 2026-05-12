# Provider abstraction

`design` supports multiple AI providers behind a single `Provider` interface. Today: **OpenAI** (default) and **Gemini**.

## Config shape

`~/.config/design/config.json`

```json
{
  "provider": "openai",
  "api_key": "sk-...",
  "models": {
    "image": "gpt-4o",
    "vision": "gpt-4o"
  }
}
```

Or for Gemini:

```json
{
  "provider": "gemini",
  "api_key": "AIza...",
  "models": {
    "image": "gemini-2.5-flash-image",
    "vision": "gemini-2.5-flash"
  }
}
```

`models` is optional — each provider has sensible defaults.

### Env var fallbacks

| Env var | Effect |
|---|---|
| `OPENAI_API_KEY` | Selects OpenAI, uses this key |
| `GEMINI_API_KEY` | Selects Gemini, uses this key |
| `DESIGN_PROVIDER` | Force provider (`openai` \| `gemini`) when both keys present |

### Backward compatibility

A pre-existing `{"api_key": "sk-..."}` config (no `provider` field) is treated as `provider: "openai"`. Existing users see no change.

## The Provider interface

See [`src/providers/types.ts`](../src/providers/types.ts).

```ts
interface Provider {
  name: string;
  capabilities: { sessionThreading: boolean; imageEdit: boolean };

  generateImage({ prompt, size, quality, previousRef? }): Promise<{ imageData, providerRef? }>;
  editImage({ prompt, sourceImage, size, quality, previousRef? }): Promise<{ imageData, providerRef? }>;
  analyze({ images, prompt, jsonMode?, maxTokens? }): Promise<string>;
}
```

## Capability matrix

|                  | OpenAI (gpt-4o + image_generation tool) | Gemini (2.5-flash + 2.5-flash-image) |
|------------------|------------------------------------------|---------------------------------------|
| Text → image     | ✅                                       | ✅                                    |
| Image → image    | ❌ (needs analyze+regenerate fallback)   | ✅ (native, single call)              |
| Session threading | ✅ (`previous_response_id`)              | ❌ (use accumulated-prompt fallback)  |
| Vision (image → text) | ✅                                  | ✅                                    |
| JSON mode        | ✅ (`response_format`)                   | ✅ (`response_mime_type`)            |

Callers that depend on threading (`iterate`) check `provider.capabilities.sessionThreading`. Callers that benefit from native image-edit (`evolve`, `iterate`) check `provider.capabilities.imageEdit` and use the simpler path when available.

## Where each call site lands

| File | Old | New |
|------|-----|-----|
| `generate.ts` | inline fetch → `responses` | `provider.generateImage()` |
| `iterate.ts` | `previous_response_id` + fallback | `provider.editImage()` if `imageEdit`; else accumulated prompt via `generateImage()` |
| `variants.ts` | inline fetch in loop | `provider.generateImage()` |
| `evolve.ts` | analyze + generate (2 calls) | `provider.editImage()` if `imageEdit`; else current 2-call path |
| `check.ts` | vision chat | `provider.analyze()` |
| `diff.ts` | vision chat (2 images) | `provider.analyze({ images: [a, b] })` |
| `design-to-code.ts` | vision chat (JSON) | `provider.analyze({ jsonMode: true })` |
| `memory.ts` | vision chat (JSON) | `provider.analyze({ jsonMode: true })` |
