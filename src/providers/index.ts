/**
 * Provider factory — reads config and returns the configured Provider.
 */

import { requireProviderConfig, type ProviderConfig } from "../auth";
import type { Provider } from "./types";
import { OpenAIProvider } from "./openai";
import { GeminiProvider } from "./gemini";

export type { Provider } from "./types";
export type {
  ImageGenerateInput,
  ImageEditInput,
  ImageOutput,
  VisionAnalyzeInput,
  ProviderCapabilities,
} from "./types";

export function buildProvider(config: ProviderConfig): Provider {
  switch (config.provider) {
    case "gemini":
      return new GeminiProvider({
        apiKey: config.apiKey,
        imageModel: config.models?.image,
        visionModel: config.models?.vision,
      });
    case "openai":
      return new OpenAIProvider({
        apiKey: config.apiKey,
        imageModel: config.models?.image,
        visionModel: config.models?.vision,
      });
    default: {
      const exhaustive: never = config.provider;
      throw new Error(`Unsupported provider: ${exhaustive}`);
    }
  }
}

export function getProvider(): Provider {
  return buildProvider(requireProviderConfig());
}
