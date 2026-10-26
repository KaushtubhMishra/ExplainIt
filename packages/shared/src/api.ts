import { z } from "zod";
import { DurationTarget, Language, ThemeChoice } from "./schema";

// Request bodies for the web API, shared by the routes (validation) and pages (types).

export const INPUT_LIMITS = { idea: { min: 5, max: 280 }, notes: { min: 20, max: 5000 } } as const;

export const CreateProjectBody = z
  .object({
    language: Language,
    durationTarget: DurationTarget,
    theme: ThemeChoice,
    inputMode: z.enum(["idea", "notes", "brainstorm"]),
    inputText: z.string().trim().max(5000),
  })
  .superRefine((b, ctx) => {
    if (b.inputMode === "brainstorm") return;
    const { min, max } = INPUT_LIMITS[b.inputMode];
    if (b.inputText.length < min || b.inputText.length > max) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["inputText"],
        message: b.inputMode === "idea"
          ? `Your topic needs ${min}–${max} characters.`
          : `Your notes need ${min}–${max} characters.`,
      });
    }
  });

export type CreateProjectBodyType = z.infer<typeof CreateProjectBody>;

// A readable project title from what the user typed.
export function titleFrom(inputMode: string, inputText: string): string {
  const firstLine = inputText.trim().split(/\r?\n/)[0] ?? "";
  if (!firstLine) return inputMode === "brainstorm" ? "Brainstorm" : "Untitled";
  return firstLine.length > 70 ? `${firstLine.slice(0, 67).trimEnd()}…` : firstLine;
}
