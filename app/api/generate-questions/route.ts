import { NextResponse } from "next/server";
import { z } from "zod";
import { chatJson } from "@/lib/openai/client";
import {
  buildGenerateQuestionsUser,
  GENERATE_QUESTIONS_SYSTEM,
} from "@/lib/prompts/generate-questions";

const bodySchema = z.object({
  jobDescription: z.string().min(40),
});

type Generated = {
  questions?: string[];
  suggestedName?: string;
  suggestedObjective?: string;
  suggestedDescription?: string;
  estimatedDurationMin?: number;
};

export async function POST(request: Request) {
  try {
    const { jobDescription } = bodySchema.parse(await request.json());
    const result = await chatJson<Generated>({
      system: GENERATE_QUESTIONS_SYSTEM,
      user: buildGenerateQuestionsUser(jobDescription),
      temperature: 0.4,
    });

    const questions = (result.questions ?? [])
      .map((text) => text.trim())
      .filter(Boolean)
      .slice(0, 10);

    if (questions.length < 3) {
      return NextResponse.json(
        { error: "The model did not return enough questions. Try again." },
        { status: 502 },
      );
    }

    return NextResponse.json({
      questions: questions.map((text) => ({ text })),
      suggestedName: result.suggestedName ?? "Untitled interview",
      suggestedObjective:
        result.suggestedObjective ??
        "Assess role fit through a structured voice interview.",
      suggestedDescription: result.suggestedDescription ?? "",
      estimatedDurationMin: result.estimatedDurationMin ?? 15,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Job description is too short.", details: error.flatten() },
        { status: 400 },
      );
    }
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate interview questions.",
      },
      { status: 500 },
    );
  }
}
