import { NextResponse } from "next/server";
import { z } from "zod";
import { runAnalysis } from "@/lib/analysis/run-analysis";
import {
  createResponseRecord,
  getInterview,
  listResponses,
} from "@/lib/store/repositories";
import { transcriptItemSchema } from "@/types/interview";

const createSchema = z.object({
  interviewId: z.string().min(1),
  candidateName: z.string().default("Candidate"),
  transcript: z.array(transcriptItemSchema).default([]),
  durationSec: z.number().nonnegative(),
  tabSwitchCount: z.number().int().nonnegative().default(0),
  callSessionId: z.string().optional(),
  analyze: z.boolean().default(true),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const interviewId = searchParams.get("interviewId") ?? undefined;
  const responses = await listResponses(interviewId);
  return NextResponse.json({ responses });
}

export async function POST(request: Request) {
  try {
    const body = createSchema.parse(await request.json());
    const interview = await getInterview(body.interviewId);
    if (!interview) {
      return NextResponse.json({ error: "Interview not found." }, { status: 404 });
    }

    const response = await createResponseRecord({
      interviewId: body.interviewId,
      candidateName: body.candidateName,
      transcript: body.transcript,
      durationSec: body.durationSec,
      tabSwitchCount: body.tabSwitchCount,
      callSessionId: body.callSessionId,
    });

    if (!body.analyze) {
      return NextResponse.json({ response }, { status: 201 });
    }

    try {
      const analysed = await runAnalysis(response.id);
      return NextResponse.json({ response: analysed }, { status: 201 });
    } catch (analysisError) {
      return NextResponse.json(
        {
          response,
          warning:
            analysisError instanceof Error
              ? analysisError.message
              : "Response saved but analysis failed.",
        },
        { status: 201 },
      );
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid response payload.", details: error.flatten() },
        { status: 400 },
      );
    }
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to save response.",
      },
      { status: 500 },
    );
  }
}
