export const missingSummaryInputs =
  "A custom summary user prompt needs {{conversation}} and either {{previousSummaryBlock}} or {{existingSummary}}.";

export function hasSummaryInputs(prompt: string): boolean {
  return prompt.includes("{{conversation}}") &&
    (prompt.includes("{{previousSummaryBlock}}") || prompt.includes("{{existingSummary}}"));
}
