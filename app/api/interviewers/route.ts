import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createInterviewer,
  listInterviewers,
} from "@/lib/store/repositories";

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().default(""),
  traits: z.object({
    empathy: z.number().min(0).max(10),
    exploration: z.number().min(0).max(10),
    rapport: z.number().min(0).max(10),
    speakingSpeed: z.number().min(0).max(10),
  }),
});

export async function GET() {
  const interviewers = await listInterviewers();
  return NextResponse.json({ interviewers });
}

export async function POST(request: Request) {
  try {
    const body = createSchema.parse(await request.json());
    const interviewer = await createInterviewer(body);
    return NextResponse.json({ interviewer }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid interviewer payload.", details: error.flatten() },
        { status: 400 },
      );
    }
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to create interviewer.",
      },
      { status: 500 },
    );
  }
}
