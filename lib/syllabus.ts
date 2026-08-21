import { generateText, Output } from "ai";
import { xai } from "@ai-sdk/xai";
import { z } from "zod";
import { chunkSyllabus } from "@/lib/chunk";
import { MissingKeyError } from "@/lib/errors";
import type { Store } from "@/lib/store";
import type { AddUnitsResult, NewUnit } from "@/lib/types";

const UnitsSchema = z.object({
  units: z.array(
    z.object({
      title: z.string().describe("A small unit that can be mastered in 25–60 minutes"),
      question: z
        .string()
        .describe("One sharp curiosity-driving question. Not 'What is X?'"),
      minutes: z.number().describe("Integer minutes between 25 and 60"),
      sourceExcerpt: z.string().describe("Short trace back to the source syllabus"),
    }),
  ),
});

const SYSTEM = `You break a private syllabus into deep-work units.

Rules:
- Each unit must be small enough for 25–60 minutes of real depth, not a survey.
- Split large headings into sub-units.
- Skip fluff: grading, policies, office hours, admin.
- For every unit, write exactly one curiosity-driving question. The question should create an itch — a paradox, a "why does this have to be true", a counterintuitive implication. Never "What is X?" or "Explain X."
- Do not include study instructions, video tips, templates, or pedagogy.
- Return only the structured units.`;

export type GenerateUnits = (chunk: string) => Promise<NewUnit[]>;

export async function generateUnitsWithXai(chunk: string): Promise<NewUnit[]> {
  if (!process.env.XAI_API_KEY) throw new MissingKeyError();

  const { output } = await generateText({
    model: xai("grok-4.6"),
    output: Output.object({ schema: UnitsSchema }),
    system: SYSTEM,
    prompt: `Turn this syllabus excerpt into deep-work units:\n\n${chunk}`,
  });

  if (!output) return [];
  return output.units.map((unit) => ({
    title: unit.title,
    question: unit.question,
    minutes: unit.minutes,
    sourceExcerpt: unit.sourceExcerpt,
  }));
}

export async function ingestSyllabus(
  store: Store,
  input: {
    title: string;
    rawText: string;
    generate?: GenerateUnits;
  },
): Promise<AddUnitsResult & { chunks: number }> {
  const generate = input.generate ?? generateUnitsWithXai;
  const chunks = chunkSyllabus(input.rawText);
  if (chunks.length === 0) {
    return { syllabusId: "", added: 0, skipped: 0, chunks: 0 };
  }

  const units: NewUnit[] = [];
  for (const chunk of chunks) {
    units.push(...(await generate(chunk)));
  }
  const result = store.addUnits(input.title, input.rawText, units);
  return { ...result, chunks: chunks.length };
}
