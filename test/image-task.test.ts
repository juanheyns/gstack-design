import { describe, it, expect } from "bun:test";
import fs from "fs";
import os from "os";
import path from "path";
import { buildImageTaskSchema, parseImageSize, validateGeneratedPng, validateImageTaskResponse } from "../src/image-task";

const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/58BAwAI/AL+hc2rNAAAAABJRU5ErkJggg==",
  "base64",
);

describe("image-task", () => {
  it("parses image size strings", () => {
    expect(parseImageSize("1536x1024")).toEqual({ width: 1536, height: 1024 });
  });

  it("validates structured file responses", () => {
    expect(() => validateImageTaskResponse({
      status: "ok",
      writtenFiles: ["/tmp/a.png", "/tmp/b.png"],
      generationMethod: "native_image_generation",
    }, ["/tmp/b.png", "/tmp/a.png"])).not.toThrow();
  });

  it("builds a bounded schema for image tasks", () => {
    const schema = buildImageTaskSchema(3) as any;
    expect(schema.required).toContain("notes");
    expect(schema.properties.status.enum).toContain("unavailable");
  });

  it("validates PNG dimensions from file headers", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "design-image-task-"));
    const filePath = path.join(dir, "tiny.png");
    fs.writeFileSync(filePath, PNG_1X1);

    const result = validateGeneratedPng(filePath, "1x1");
    expect(result.width).toBe(1);
    expect(result.height).toBe(1);
    expect(result.bytes).toBeGreaterThan(0);

    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("rejects unavailable image-generation responses", () => {
    expect(() => validateImageTaskResponse({
      status: "unavailable",
      writtenFiles: [],
      generationMethod: "unavailable",
      notes: "Native image generation is unavailable in this environment.",
    }, ["/tmp/a.png"])).toThrow(/unavailable/i);
  });
});
