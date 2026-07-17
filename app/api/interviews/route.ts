import { NextResponse } from "next/server";
import { z } from "zod";
import {
  LiveAvatarApiError,
  LiveAvatarServer,
} from "@/lib/liveavatar/server";
import { buildInterviewContext } from "@/lib/prompts/interview-context";
import {
  createInterviewRecord,
  getInterviewer,
  listInterviews,
  listResponses,
} from "@/lib/store/repositories";

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().default(""),
  objective: z.string().min(1),
  jobDescription: z.string().min(1),
  interviewerId: z.string().min(1),
  estimatedDurationMin: z.number().int().positive().optional(),
  questions: z
    .array(z.object({ text: z.string().min(1) }))
    .min(1)
    .max(12),
});

export async function GET() {
  const [interviews, responses] = await Promise.all([
    listInterviews(),
    listResponses(),
  ]);

  const enriched = interviews.map((interview) => {
    const related = responses.filter((r) => r.interviewId === interview.id);
    const analysed = related.filter((r) => r.isAnalysed && r.analysis);
    const avgScore =
      analysed.length > 0
        ? analysed.reduce((sum, r) => sum + (r.analysis?.overallScore ?? 0), 0) /
          analysed.length
        : null;

    return {
      ...interview,
      responseCount: related.length,
      analysedCount: analysed.length,
      avgScore,
    };
  });

  return NextResponse.json({ interviews: enriched });
}

export async function POST(request: Request) {
  try {
    const body = createSchema.parse(await request.json());
    const interviewer = await getInterviewer(body.interviewerId);
    if (!interviewer) {
      return NextResponse.json(
        { error: "Selected interviewer was not found." },
        { status: 400 },
      );
    }

    const apiKey = process.env.LIVEAVATAR_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json(
        { error: "LIVEAVATAR_API_KEY is not configured." },
        { status: 503 },
      );
    }

    const draftQuestions = body.questions.map((q, index) => ({
      id: `draft-${index}`,
      text: q.text,
    }));

    const contextPayload = buildInterviewContext({
      interview: {
        name: body.name,
        description: body.description,
        objective: body.objective,
        questions: draftQuestions,
        estimatedDurationMin: body.estimatedDurationMin ?? 15,
      },
      interviewer,
    });

    const client = new LiveAvatarServer(apiKey);
    const context = await client.createContext(contextPayload);

    const interview = await createInterviewRecord({
      ...body,
      liveAvatarContextId: context.id,
    });

    return NextResponse.json({ interview }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid interview payload.", details: error.flatten() },
        { status: 400 },
      );
    }
    if (error instanceof LiveAvatarApiError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to create interview.",
      },
      { status: 500 },
    );
  }
}
