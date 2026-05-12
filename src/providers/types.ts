/**
 * Provider abstraction for image generation + vision analysis.
 *
 * Two interfaces:
 *   - ImageProvider: text → image, and (image + text) → image
 *   - VisionProvider: (image(s) + text) → text (optionally JSON)
 *
 * A concrete provider may implement one or both. The OpenAI and Gemini
 * providers implement both, so callers can target a single object.
 */

export interface ImageGenerateInput {
  prompt: string;
  size: string;           // "1536x1024" etc.
  quality: string;        // "high" | "medium" | "low" — provider-specific mapping
  previousRef?: string;   // For session-threaded follow-ups (OpenAI response_id)
}

export interface ImageEditInput {
  prompt: string;
  sourceImage: string;    // base64 PNG
  size: string;
  quality: string;
  previousRef?: string;
}

export interface ImageOutput {
  imageData: string;      // base64 PNG
  providerRef?: string;   // Opaque ref used by `previousRef` on a follow-up call
}

export interface VisionAnalyzeInput {
  images: string[];       // base64 PNG, one or more
  prompt: string;
  jsonMode?: boolean;     // Force valid JSON output (when supported)
  maxTokens?: number;
  timeoutMs?: number;
}

export interface ProviderCapabilities {
  /** Provider supports threaded follow-ups via `previousRef`. */
  sessionThreading: boolean;
  /** Provider supports image-in → image-out edits in a single call. */
  imageEdit: boolean;
}

export interface Provider {
  readonly name: string;
  readonly capabilities: ProviderCapabilities;

  generateImage(input: ImageGenerateInput): Promise<ImageOutput>;

  /**
   * Edit an image. Providers without native image-edit (image_generation
   * tool can't accept reference images on OpenAI; Gemini's image model can)
   * should fall back to analyze+regenerate.
   */
  editImage(input: ImageEditInput): Promise<ImageOutput>;

  analyze(input: VisionAnalyzeInput): Promise<string>;
}
