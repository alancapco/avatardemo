import { NextResponse } from "next/server";
import { z } from "zod";
import { getRpqQuestion } from "@/lib/rpq/questionnaire";
import { scoreRpqAssessment } from "@/lib/rpq/scoring";
import {
  createRpqAssessment,
  getRpqAssessment,
} from "@/lib/store/repositories";
import { createRpqAssessmentSchema } from "@/types/rpq";

export async function POST(request: Request) {
  try {
    const payload = createRpqAssessmentSchema.parse(await request.json());
    const { totalScore, profile } = scoreRpqAssessment(payload.answers);
    const assessment = await createRpqAssessment({
      answers: payload.answers,
      sessionId: payload.sessionId,
      totalScore,
      profileId: profile.id,
    });
    return NextResponse.json({ assessment, profile }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof Error) {
      return NextResponse.json(
        { error: error.message || "Invalid RPQ assessment." },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: "Unable to save assessment." }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Assessment ID is required." }, { status: 400 });
  const assessment = await getRpqAssessment(id);
  if (!assessment) return NextResponse.json({ error: "Assessment not found." }, { status: 404 });
  const profile = (await import("@/lib/rpq/questionnaire")).RISK_PROFILES.find(
    (item) => item.id === assessment.profileId,
  );
  const answerReview = assessment.answers.map((answer) => {
    const question = getRpqQuestion(answer.questionId);
    const score = question
      ? Math.max(
          ...answer.optionIds.map(
            (id) => question.options.find((option) => option.id === id)?.score ?? 0,
          ),
        )
      : 0;
    return { ...answer, question, score };
  });
  return NextResponse.json({ assessment, profile, answerReview });
}
