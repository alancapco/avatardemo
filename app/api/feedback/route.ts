import { NextResponse } from "next/server";
import { z } from "zod";
import { createFeedback } from "@/lib/store/repositories";

const bodySchema = z.object({
  interviewId: z.string().min(1),
  responseId: z.string().optional(),
  rating: z.number().min(1).max(5),
  comment: z.string().default(""),
});

export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await request.json());
    const feedback = await createFeedback(body);
    return NextResponse.json({ feedback }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid feedback payload.", details: error.flatten() },
        { status: 400 },
      );
    }
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to save feedback.",
      },
      { status: 500 },
    );
  }
}
