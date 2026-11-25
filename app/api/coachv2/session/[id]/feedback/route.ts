import { NextResponse } from "next/server";
import { z } from "zod";
import { chatJson } from "@/lib/openai/client";
import {
  COACH_V2_LANGUAGES,
  buildCoachV2FeedbackSystem,
  type CoachV2Feedback,
} from "@/lib/prompts/coach-v2";
import {
  dialogueTranscript,
  formatTranscriptForLlm,
  waitForTranscript,
} from "@/lib/tavus/server";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const languageIds = COACH_V2_LANGUAGES.map((item) => item.id) as [
  (typeof COACH_V2_LANGUAGES)[number]["id"],
  ...(typeof COACH_V2_LANGUAGES)[number]["id"][],
];

const bodySchema = z.object({
  language: z.enum(languageIds).default("en"),
});

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (!id?.trim()) {
      return NextResponse.json(
        { error: "Missing conversation id." },
        { status: 400 },
      );
    }

    const json = await request.json().catch(() => ({}));
    const body = bodySchema.parse(json);

    const conversationId = id.trim();
    const transcript = await waitForTranscript(conversationId);
    const dialogue = dialogueTranscript(transcript);

    // Count agent and customer turns separately
    const agentTurns = dialogue.filter(
      (entry) => entry.role === "user" || entry.role === "human",
    ).length;
    const customerTurns = dialogue.filter(
      (entry) => entry.role === "assistant",
    ).length;

    // Need at least one turn from each side (excluding just the greeting)
    if (dialogue.length === 0 || agentTurns === 0 || customerTurns <= 1) {
      return NextResponse.json({
        conversationId,
        transcript: dialogue,
        feedback: null,
        message:
          body.language === "zh"
            ? "对话不足以进行评估。需要代理人和客户之间的实质性交流才能生成反馈。"
            : "Insufficient dialogue for evaluation. A meaningful exchange between agent and customer is required to generate feedback.",
      });
    }

    const formatted = formatTranscriptForLlm(transcript);
    const feedback = await chatJson<CoachV2Feedback>({
      system: buildCoachV2FeedbackSystem(body.language),
      user: `Return only one valid JSON object with keys overallScore, summary, strengths, improvements, emotionHandling, complianceNote. Do not use ASCII double quotes inside string values. Role-play transcript:\n\n${formatted}`,
      temperature: 0.2,
      maxTokens: 2500,
    });

    const overallScore = Math.max(
      0,
      Math.min(100, Math.round(Number(feedback.overallScore) || 0)),
    );

    return NextResponse.json({
      conversationId,
      transcript: dialogue,
      feedback: {
        overallScore,
        summary: feedback.summary ?? "",
        strengths: Array.isArray(feedback.strengths) ? feedback.strengths : [],
        improvements: Array.isArray(feedback.improvements)
          ? feedback.improvements
          : [],
        emotionHandling: feedback.emotionHandling ?? "",
        complianceNote: feedback.complianceNote ?? "",
      },
    });
  } catch (error) {
    console.error("Coach v2 feedback error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not generate Coach v2 feedback.",
      },
      { status: 500 },
    );
  }
}
