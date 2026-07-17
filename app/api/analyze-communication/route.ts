import { NextResponse } from "next/server";
import { z } from "zod";
import { chatJson } from "@/lib/openai/client";
import {
  ANALYZE_COMMUNICATION_SYSTEM,
  buildAnalyzeCommunicationUser,
} from "@/lib/prompts/analyze-communication";
import { communicationMetricsSchema, transcriptItemSchema } from "@/types/interview";

const bodySchema = z.object({
  transcript: z.array(transcriptItemSchema),
  durationSec: z.number().nonnegative().default(0),
  tabSwitchCount: z.number().int().nonnegative().default(0),
});

export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await request.json());
    const metrics = await chatJson<z.infer<typeof communicationMetricsSchema>>({
      system: ANALYZE_COMMUNICATION_SYSTEM,
      user: buildAnalyzeCommunicationUser(body),
    });

    return NextResponse.json({
      communication: communicationMetricsSchema.parse(metrics),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid payload.", details: error.flatten() },
        { status: 400 },
      );
    }
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to analyze communication.",
      },
      { status: 500 },
    );
  }
}
