import { getRpqQuestion } from "@/lib/rpq/questionnaire";

export type MatchResult =
  | { status: "matched"; optionIds: string[]; confidence: "high" }
  | { status: "ambiguous" | "unmatched"; optionIds: [] };

const NUMBER_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
};

function normalized(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9%+\-\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function selectedByNumber(input: string, optionCount: number) {
  const values = new Set<number>();
  const numericMatches = input.match(/\b[1-5]\b/g) ?? [];
  for (const value of numericMatches) values.add(Number(value));
  for (const [word, value] of Object.entries(NUMBER_WORDS)) {
    if (new RegExp(`\\b${word}\\b`).test(input)) values.add(value);
  }
  return [...values]
    .filter((value) => value >= 1 && value <= optionCount)
    .map((value) => value - 1);
}

export function matchRpqAnswer(questionId: string, utterance: string): MatchResult {
  const question = getRpqQuestion(questionId);
  if (!question || !utterance.trim()) {
    return { status: "unmatched", optionIds: [] };
  }

  const input = normalized(utterance);
  const byNumber = selectedByNumber(input, question.options.length);
  if (byNumber.length > 0) {
    if (question.type === "single" && byNumber.length !== 1) {
      return { status: "ambiguous", optionIds: [] };
    }
    return {
      status: "matched",
      optionIds: byNumber.map((index) => question.options[index].id),
      confidence: "high",
    };
  }

  const hits = question.options
    .filter((option) =>
      option.aliases.some((alias) => input.includes(normalized(alias))),
    )
    .map((option) => option.id);

  if (hits.length === 0) return { status: "unmatched", optionIds: [] };
  if (question.type === "single" && hits.length !== 1) {
    return { status: "ambiguous", optionIds: [] };
  }

  return { status: "matched", optionIds: [...new Set(hits)], confidence: "high" };
}
