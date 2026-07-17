import { NextResponse } from "next/server";
import { z } from "zod";
import { runAnalysis } from "@/lib/analysis/run-analysis";
import { getResponse } from "@/lib/store/repositories";

const bodySchema = z.object({
  responseId: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const { responseId } = bodySchema.parse(await request.json());
    const existing = await getResponse(responseId);
    if (!existing) {
      return NextResponse.json({ error: "Response not found." }, { status: 404 });
    }

    const response = await runAnalysis(responseId);
    return NextResponse.json({ response });
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
            : "Failed to generate insights.",
      },
      { status: 500 },
    );
  }
}
