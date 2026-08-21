import { extractText } from "unpdf";

export async function extractSyllabusText(
  filename: string,
  bytes: Uint8Array,
): Promise<string> {
  const lower = filename.toLowerCase();
  const decoded = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  if (lower.endsWith(".pdf")) {
    const result = await extractText(bytes);
    const text = Array.isArray(result.text) ? result.text.join("\n\n") : String(result.text ?? "");
    if (!text.trim()) {
      throw new Error("PDF produced no text. Export as .txt or paste the syllabus.");
    }
    return text;
  }
  return decoded;
}
