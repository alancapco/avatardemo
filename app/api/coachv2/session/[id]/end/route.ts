import { NextResponse } from "next/server";
import { endConversation } from "@/lib/tavus/server";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (!id?.trim()) {
      return NextResponse.json(
        { error: "Missing conversation id." },
        { status: 400 },
      );
    }

    await endConversation(id.trim());
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Coach v2 session end error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not end Coach v2 session.",
      },
      { status: 500 },
    );
  }
}
