import { NextResponse } from "next/server";
import { z } from "zod";
import { chatJson } from "@/lib/openai/client";
import { matchRpqAnswer } from "@/lib/rpq/answer-matcher";
import { getRpqQuestion } from "@/lib/rpq/questionnaire";

const requestSchema = z.object({
  questionId: z.string().min(1),
  utterance: z.string().min(1).max(500),
});

export async function POST(request: Request) {
  try {
    const { questionId, utterance } = requestSchema.parse(await request.json());
    const question = getRpqQuestion(questionId);
    if (!question) {
      return NextResponse.json({ error: "Unknown RPQ question." }, { status: 404 });
    }

    const deterministic = matchRpqAnswer(questionId, utterance);
    if (deterministic.status === "matched") {
      return NextResponse.json(deterministic);
    }

    // The inexpensive model is only an ambiguity fallback. It is restricted to
    // these exact IDs and its response is validated again before returning.
    try {
      const result = await chatJson<{ optionIds?: string[] }>({
        temperature: 0,
        system: `Map an English spoken answer to the allowed answer option IDs for ONE risk questionnaire question. Return JSON only: {"optionIds":["id"]}. Return [] if uncertain. Do not infer facts, calculate a score, or return any ID not listed. ${question.type === "single" ? "Return exactly one ID or []." : "Return one or more IDs or []."}`,
        user: `Question: ${question.prompt.en}\nOptions:\n${question.options.map((option, index) => `${index + 1}. id=${option.id}; ${option.label.en}`).join("\n")}\n\nSpoken answer: ${utterance}`,
      });
      const allowed = new Set(question.options.map((option) => option.id));
      const optionIds = [...new Set(result.optionIds ?? [])].filter((id) => allowed.has(id));
      const valid =
        optionIds.length > 0 &&
        (question.type === "multi" || optionIds.length === 1);

      return NextResponse.json(
        valid
          ? { status: "matched", optionIds, confidence: "high" }
          : deterministic,
      );
    } catch {
      return NextResponse.json(deterministic);
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid answer-match request." }, { status: 400 });
    }
    return NextResponse.json({ error: "Unable to match the spoken answer." }, { status: 500 });
  }
}
