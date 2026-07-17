import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getInterviewer,
  removeInterviewer,
  updateInterviewer,
} from "@/lib/store/repositories";

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  traits: z
    .object({
      empathy: z.number().min(0).max(10),
      exploration: z.number().min(0).max(10),
      rapport: z.number().min(0).max(10),
      speakingSpeed: z.number().min(0).max(10),
    })
    .optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const interviewer = await getInterviewer(id);
  if (!interviewer) {
    return NextResponse.json({ error: "Interviewer not found." }, { status: 404 });
  }
  return NextResponse.json({ interviewer });
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = patchSchema.parse(await request.json());
    const interviewer = await updateInterviewer(id, body);
    if (!interviewer) {
      return NextResponse.json({ error: "Interviewer not found." }, { status: 404 });
    }
    return NextResponse.json({ interviewer });
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
          error instanceof Error ? error.message : "Failed to update interviewer.",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  const removed = await removeInterviewer(id);
  if (!removed) {
    return NextResponse.json({ error: "Interviewer not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
