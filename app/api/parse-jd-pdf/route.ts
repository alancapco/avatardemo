import { NextResponse } from "next/server";
import { PDFParse } from "pdf-parse";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Upload a PDF file under the 'file' field." },
        { status: 400 },
      );
    }

    if (file.type && file.type !== "application/pdf") {
      return NextResponse.json(
        { error: "Only PDF files are supported." },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    const text = result.text?.replace(/\s+/g, " ").trim() ?? "";

    if (text.length < 40) {
      return NextResponse.json(
        { error: "Could not extract enough text from this PDF." },
        { status: 422 },
      );
    }

    return NextResponse.json({
      text,
      pages: result.total ?? result.pages?.length ?? undefined,
      fileName: file.name,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to parse the uploaded PDF.",
      },
      { status: 500 },
    );
  }
}
