/**
 * Gemini provider — gemini-2.5-flash-image (image gen + edit) + gemini-2.5-flash (vision).
 *
 * One key covers both. Native image-edit support means evolve/iterate can
 * skip the analyze+regenerate fallback when this provider is active.
 */

import type {
  Provider,
  ProviderCapabilities,
  ImageGenerateInput,
  ImageEditInput,
  ImageOutput,
  VisionAnalyzeInput,
} from "./types";

const BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_IMAGE_MODEL = "gemini-2.5-flash-image";
const DEFAULT_VISION_MODEL = "gemini-2.5-flash";

export interface GeminiProviderOptions {
  apiKey: string;
  imageModel?: string;
  visionModel?: string;
}

/**
 * Map "WxH" sizes used by the OpenAI image_generation tool to the nearest
 * Gemini aspectRatio. Gemini's image model doesn't take pixel dimensions —
 * just a ratio — so we round to the closest supported value.
 */
function sizeToAspectRatio(size: string): string {
  const match = /^(\d+)x(\d+)$/.exec(size);
  if (!match) return "1:1";
  const w = parseInt(match[1], 10);
  const h = parseInt(match[2], 10);
  const r = w / h;
  const candidates: Array<[string, number]> = [
    ["1:1", 1],
    ["3:2", 1.5],
    ["2:3", 0.667],
    ["4:3", 1.333],
    ["3:4", 0.75],
    ["16:9", 1.778],
    ["9:16", 0.5625],
  ];
  let best = candidates[0];
  let bestDelta = Math.abs(r - best[1]);
  for (const c of candidates.slice(1)) {
    const d = Math.abs(r - c[1]);
    if (d < bestDelta) {
      best = c;
      bestDelta = d;
    }
  }
  return best[0];
}

export class GeminiProvider implements Provider {
  readonly name = "gemini";
  readonly capabilities: ProviderCapabilities = {
    sessionThreading: false, // Gemini doesn't have OpenAI's previous_response_id
    imageEdit: true,         // Native image-in → image-out single call
  };

  private readonly apiKey: string;
  private readonly imageModel: string;
  private readonly visionModel: string;

  constructor(opts: GeminiProviderOptions) {
    this.apiKey = opts.apiKey;
    this.imageModel = opts.imageModel || DEFAULT_IMAGE_MODEL;
    this.visionModel = opts.visionModel || DEFAULT_VISION_MODEL;
  }

  async generateImage(input: ImageGenerateInput): Promise<ImageOutput> {
    const body = {
      contents: [{ parts: [{ text: input.prompt }] }],
      generationConfig: {
        responseModalities: ["IMAGE"],
        imageConfig: { aspectRatio: sizeToAspectRatio(input.size) },
      },
    };
    return this.callImageModel(body);
  }

  async editImage(input: ImageEditInput): Promise<ImageOutput> {
    const body = {
      contents: [{
        parts: [
          { text: input.prompt },
          { inlineData: { mimeType: "image/png", data: input.sourceImage } },
        ],
      }],
      generationConfig: {
        responseModalities: ["IMAGE"],
        imageConfig: { aspectRatio: sizeToAspectRatio(input.size) },
      },
    };
    return this.callImageModel(body);
  }

  async analyze(input: VisionAnalyzeInput): Promise<string> {
    const parts: any[] = [];
    for (const img of input.images) {
      parts.push({ inlineData: { mimeType: "image/png", data: img } });
    }
    parts.push({ text: input.prompt });

    const generationConfig: any = {
      maxOutputTokens: input.maxTokens ?? 600,
    };
    if (input.jsonMode) generationConfig.responseMimeType = "application/json";

    const data = await this.callModel(
      this.visionModel,
      { contents: [{ parts }], generationConfig },
      input.timeoutMs ?? 60_000,
    );
    const responseParts: any[] = data?.candidates?.[0]?.content?.parts ?? [];
    return responseParts
      .map((p: any) => (typeof p.text === "string" ? p.text : ""))
      .join("")
      .trim();
  }

  private async callImageModel(body: any): Promise<ImageOutput> {
    const data = await this.callModel(this.imageModel, body, 120_000);
    const parts: any[] = data?.candidates?.[0]?.content?.parts ?? [];
    for (const p of parts) {
      const inline = p.inlineData ?? p.inline_data;
      if (inline?.data) {
        return { imageData: inline.data };
      }
    }
    const textBlocks = parts.map((p: any) => p.text).filter(Boolean).join(" ").slice(0, 300);
    throw new Error(
      `No image data in Gemini response${textBlocks ? `; model said: ${textBlocks}` : ""}`,
    );
  }

  private async callModel(model: string, body: any, timeoutMs: number): Promise<any> {
    const url = `${BASE_URL}/models/${encodeURIComponent(model)}:generateContent`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "x-goog-api-key": this.apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!response.ok) {
        const error = await response.text();
        const err = new Error(`Gemini API error (${response.status}): ${error.slice(0, 300)}`);
        (err as any).status = response.status;
        throw err;
      }
      return await response.json();
    } finally {
      clearTimeout(timeout);
    }
  }
}
