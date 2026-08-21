import { describe, expect, it } from "vitest";
import { chunkSyllabus } from "@/lib/chunk";

describe("chunkSyllabus", () => {
  it("returns a single chunk when the text is small", () => {
    const text = "# Algebra\n\nLinear equations.";
    expect(chunkSyllabus(text, 8000)).toEqual([text]);
  });

  it("splits oversized text on paragraph boundaries", () => {
    const para = "x".repeat(100);
    const text = Array.from({ length: 20 }, () => para).join("\n\n");
    const chunks = chunkSyllabus(text, 250);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.join("\n\n")).toBe(text);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(250 + para.length);
    }
  });

  it("does not drop a single oversize paragraph", () => {
    const blob = "y".repeat(500);
    expect(chunkSyllabus(blob, 100)).toEqual([blob]);
  });
});
