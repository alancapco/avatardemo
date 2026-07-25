import { NextResponse } from "next/server";
import {
  getInterview,
  getInterviewer,
  listResponses,
  removeInterview,
} from "@/lib/store/repositories";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const interview = await getInterview(id);
  if (!interview) {
    return NextResponse.json({ error: "Interview not found." }, { status: 404 });
  }

  const [interviewer, responses] = await Promise.all([
    getInterviewer(interview.interviewerId),
    listResponses(id),
  ]);

  const isSandbox = process.env.LIVEAVATAR_SANDBOX === "true";

  return NextResponse.json({ interview, interviewer, responses, isSandbox });
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  const removed = await removeInterview(id);
  if (!removed) {
    return NextResponse.json({ error: "Interview not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
