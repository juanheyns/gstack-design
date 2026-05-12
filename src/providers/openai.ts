/**
 * OpenAI provider — gpt-4o + Responses API image_generation tool + chat/completions vision.
 */

import type {
  Provider,
  ProviderCapabilities,
  ImageGenerateInput,
  ImageEditInput,
  ImageOutput,
  VisionAnalyzeInput,
} from "./types";

const RESPONSES_URL = "https://api.openai.com/v1/responses";
const CHAT_URL = "https://api.openai.com/v1/chat/completions";

const DEFAULT_IMAGE_MODEL = "gpt-4o";
const DEFAULT_VISION_MODEL = "gpt-4o";

export interface OpenAIProviderOptions {
  apiKey: string;
  imageModel?: string;
  visionModel?: string;
}

export class OpenAIProvider implements Provider {
  readonly name = "openai";
  readonly capabilities: ProviderCapabilities = {
    sessionThreading: true,
    imageEdit: false, // Responses image_generation tool can't accept reference images
  };

  private readonly apiKey: string;
  private readonly imageModel: string;
  private readonly visionModel: string;

  constructor(opts: OpenAIProviderOptions) {
    this.apiKey = opts.apiKey;
    this.imageModel = opts.imageModel || DEFAULT_IMAGE_MODEL;
    this.visionModel = opts.visionModel || DEFAULT_VISION_MODEL;
  }

  async generateImage(input: ImageGenerateInput): Promise<ImageOutput> {
    const body: any = {
      model: this.imageModel,
      input: input.prompt,
      tools: [{ type: "image_generation", size: input.size, quality: input.quality }],
    };
    if (input.previousRef) body.previous_response_id = input.previousRef;

    const data = await this.callResponses(body, 120_000);
    const imageItem = data.output?.find((item: any) => item.type === "image_generation_call");
    if (!imageItem?.result) {
      throw new Error(
        `No image data in response. Output types: ${data.output?.map((o: any) => o.type).join(", ") || "none"}`,
      );
    }
    return { imageData: imageItem.result, providerRef: data.id };
  }

  async editImage(_input: ImageEditInput): Promise<ImageOutput> {
    // OpenAI's Responses image_generation tool doesn't accept reference
    // images. Callers should check `capabilities.imageEdit` and route to
    // the analyze+regenerate fallback themselves.
    throw new Error("OpenAI provider does not support native image edit; check capabilities.imageEdit");
  }

  async analyze(input: VisionAnalyzeInput): Promise<string> {
    const content: any[] = [];
    for (const img of input.images) {
      content.push({
        type: "image_url",
        image_url: { url: `data:image/png;base64,${img}` },
      });
    }
    content.push({ type: "text", text: input.prompt });

    const body: any = {
      model: this.visionModel,
      messages: [{ role: "user", content }],
      max_tokens: input.maxTokens ?? 600,
    };
    if (input.jsonMode) body.response_format = { type: "json_object" };

    const data = await this.callChat(body, input.timeoutMs ?? 60_000);
    return data.choices?.[0]?.message?.content?.trim() || "";
  }

  private async callResponses(body: any, timeoutMs: number): Promise<any> {
    return this.post(RESPONSES_URL, body, timeoutMs);
  }

  private async callChat(body: any, timeoutMs: number): Promise<any> {
    return this.post(CHAT_URL, body, timeoutMs);
  }

  private async post(url: string, body: any, timeoutMs: number): Promise<any> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!response.ok) {
        const error = await response.text();
        const err = new Error(`API error (${response.status}): ${error.slice(0, 300)}`);
        (err as any).status = response.status;
        throw err;
      }
      return await response.json();
    } finally {
      clearTimeout(timeout);
    }
  }
}
