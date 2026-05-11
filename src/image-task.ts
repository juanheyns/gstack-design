import fs from "fs";
import path from "path";

export interface ImageTaskResponse {
  status: "ok" | "unavailable" | "failed";
  writtenFiles: string[];
  generationMethod: "native_image_generation" | "unavailable";
  notes?: string;
}

export interface PngValidationResult {
  path: string;
  bytes: number;
  width: number;
  height: number;
}

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

export function buildImageTaskSchema(expectedCount: number): unknown {
  void expectedCount;
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      status: { type: "string", enum: ["ok", "unavailable", "failed"] },
      writtenFiles: {
        type: "array",
        items: { type: "string" },
      },
      generationMethod: { type: "string", enum: ["native_image_generation", "unavailable"] },
      notes: { type: "string" },
    },
    required: ["status", "writtenFiles", "generationMethod", "notes"],
  };
}

export function validateImageTaskResponse(
  response: ImageTaskResponse,
  expectedPaths: string[],
): void {
  const expected = expectedPaths.map((value) => path.resolve(value)).sort();
  const actual = response.writtenFiles.map((value) => path.resolve(value)).sort();

  if (response.status !== "ok") {
    throw new Error(response.notes || `Codex returned non-ok status: ${response.status}`);
  }

  if (response.generationMethod !== "native_image_generation") {
    throw new Error(`Unexpected generation method: ${response.generationMethod}`);
  }

  if (/unavailable|does not support|cannot write|can't write/i.test(response.notes || "")) {
    throw new Error(response.notes || "Native image generation unavailable");
  }

  if (actual.length !== expected.length) {
    throw new Error(`Expected ${expected.length} written files, got ${actual.length}`);
  }

  for (let i = 0; i < expected.length; i++) {
    if (expected[i] !== actual[i]) {
      throw new Error(`Codex reported unexpected output path: expected ${expected[i]}, got ${actual[i]}`);
    }
  }
}

export function parseImageSize(size: string): { width: number; height: number } {
  const match = size.match(/^(\d+)x(\d+)$/);
  if (!match) {
    throw new Error(`Invalid image size: ${size}`);
  }

  return {
    width: parseInt(match[1], 10),
    height: parseInt(match[2], 10),
  };
}

export function validateGeneratedPng(
  imagePath: string,
  expectedSize: string,
): PngValidationResult {
  const resolved = path.resolve(imagePath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Expected output file was not written: ${resolved}`);
  }

  const file = fs.readFileSync(resolved);
  if (file.length === 0) {
    throw new Error(`Generated output file is empty: ${resolved}`);
  }

  if (file.length < 33) {
    throw new Error(`Generated output file is too small to be a valid PNG: ${resolved}`);
  }

  if (!file.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error(`Generated output file is not a valid PNG: ${resolved}`);
  }

  if (file.subarray(12, 16).toString("ascii") !== "IHDR") {
    throw new Error(`Generated PNG is missing IHDR header: ${resolved}`);
  }

  const width = file.readUInt32BE(16);
  const height = file.readUInt32BE(20);
  const expected = parseImageSize(expectedSize);

  if (width !== expected.width || height !== expected.height) {
    throw new Error(
      `Generated PNG has wrong dimensions: expected ${expected.width}x${expected.height}, got ${width}x${height}`
    );
  }

  return {
    path: resolved,
    bytes: file.length,
    width,
    height,
  };
}
