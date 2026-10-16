import { NextResponse } from "next/server";
import { z } from "zod";
import {
  COACH_V2_BRIEFS,
  COACH_V2_EMOTIONS,
  COACH_V2_LANGUAGES,
} from "@/lib/prompts/coach-v2";
import { createCoachConversation } from "@/lib/tavus/server";

const languageIds = COACH_V2_LANGUAGES.map((item) => item.id) as [
  (typeof COACH_V2_LANGUAGES)[number]["id"],
  ...(typeof COACH_V2_LANGUAGES)[number]["id"][],
];

const bodySchema = z.object({
  emotion: z.enum(COACH_V2_EMOTIONS),
  language: z.enum(languageIds).default("en"),
  briefId: z.enum(
    COACH_V2_BRIEFS.map((brief) => brief.id) as [
      (typeof COACH_V2_BRIEFS)[number]["id"],
      ...(typeof COACH_V2_BRIEFS)[number]["id"][],
    ],
  ),
  customSituation: z.string().max(800).optional(),
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const body = bodySchema.parse(json);

    const conversation = await createCoachConversation({
      emotion: body.emotion,
      language: body.language,
      briefId: body.briefId,
      customSituation: body.customSituation,
    });

    return NextResponse.json({
      conversationId: conversation.conversation_id,
      conversationUrl: conversation.conversation_url,
      status: conversation.status,
      palId: conversation.pal_id,
      faceId: conversation.face_id,
      emotion: body.emotion,
      language: body.language,
      briefId: body.briefId,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid Coach v2 session request.", details: error.issues },
        { status: 400 },
      );
    }

    console.error("Coach v2 session create error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not start Coach v2 session.",
      },
      { status: 500 },
    );
  }
}
