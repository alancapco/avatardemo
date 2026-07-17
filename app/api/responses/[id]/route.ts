import { NextResponse } from "next/server";
import { getInterview, getResponse } from "@/lib/store/repositories";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const response = await getResponse(id);
  if (!response) {
    return NextResponse.json({ error: "Response not found." }, { status: 404 });
  }

  const interview = await getInterview(response.interviewId);
  return NextResponse.json({ response, interview });
}
