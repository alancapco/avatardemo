import { NextResponse } from "next/server";
import { z } from "zod";
import {
  LiveAvatarApiError,
  LiveAvatarServer,
  type AvatarPersona,
} from "@/lib/liveavatar/server";
import { buildInterviewSegmentContext } from "@/lib/prompts/interview-context";
import { getInterview, getInterviewer } from "@/lib/store/repositories";

const bodySchema = z.object({
  /** Interview-scoped session (uses interview LiveAvatar context). */
  interviewId: z.string().min(1).optional(),
  /** Demo studio session (uses LIVEAVATAR_CONTEXT_ID from env). */
  mode: z.enum(["demo", "interview", "rpq"]).optional(),
  /** Sandbox interview: 0-based question segment index. */
  segmentIndex: z.number().int().nonnegative().optional(),
  /** Brief prior Q&A for continuity across sandbox segments. */
  coveredSummary: z.string().max(1200).optional(),
});

export async function POST(request: Request) {
  const apiKey = process.env.LIVEAVATAR_API_KEY?.trim();
  const avatarId = process.env.LIVEAVATAR_AVATAR_ID?.trim();
  const demoContextId = process.env.LIVEAVATAR_CONTEXT_ID?.trim();
  const rpqContextId = process.env.LIVEAVATAR_RPQ_CONTEXT_ID?.trim();
  const voiceId = process.env.LIVEAVATAR_VOICE_ID?.trim();
  const language = process.env.LIVEAVATAR_LANGUAGE?.trim() || "en";
  const isSandbox = process.env.LIVEAVATAR_SANDBOX === "true";
  const llmConfigurationId =
    process.env.LIVEAVATAR_LLM_CONFIGURATION_ID?.trim();

  if (!apiKey || !avatarId) {
    return NextResponse.json(
      {
        error:
          "LiveAvatar is not fully configured. Add LIVEAVATAR_API_KEY and LIVEAVATAR_AVATAR_ID.",
        code: "CONFIG_INCOMPLETE",
      },
      { status: 503 },
    );
  }

  try {
    const raw = await request.json().catch(() => ({}));
    const body = bodySchema.parse(raw);
    const isRpq = body.mode === "rpq";
    const isDemo = !isRpq && (body.mode === "demo" || !body.interviewId);

    let contextId: string | undefined;
    let interviewMeta:
      | { id: string; name: string; estimatedDurationMin: number }
      | undefined;
    let segmentMeta:
      | { segmentIndex: number; segmentCount: number }
      | undefined;

    const client = new LiveAvatarServer(apiKey);

    if (isRpq) {
      if (!rpqContextId) {
        return NextResponse.json(
          {
            error:
              "LIVEAVATAR_RPQ_CONTEXT_ID is missing. Run npm run liveavatar:setup-rpq.",
            code: "CONFIG_INCOMPLETE",
          },
          { status: 503 },
        );
      }
      contextId = rpqContextId;
    } else if (isDemo) {
      if (!demoContextId) {
        return NextResponse.json(
          {
            error:
              "LIVEAVATAR_CONTEXT_ID is missing. Run npm run liveavatar:setup.",
            code: "CONFIG_INCOMPLETE",
          },
          { status: 503 },
        );
      }
      contextId = demoContextId;
    } else {
      const interview = await getInterview(body.interviewId!);
      if (!interview) {
        return NextResponse.json(
          { error: "Interview not found." },
          { status: 404 },
        );
      }

      interviewMeta = {
        id: interview.id,
        name: interview.name,
        estimatedDurationMin: interview.estimatedDurationMin,
      };

      if (isSandbox) {
        const segmentIndex = body.segmentIndex ?? 0;
        const segmentCount = interview.questions.length;
        if (segmentIndex >= segmentCount) {
          return NextResponse.json(
            {
              error: "Segment index is out of range for this interview.",
              code: "SEGMENT_OUT_OF_RANGE",
            },
            { status: 400 },
          );
        }

        const interviewer = await getInterviewer(interview.interviewerId);
        if (!interviewer) {
          return NextResponse.json(
            { error: "Interviewer for this interview was not found." },
            { status: 422 },
          );
        }

        const question = interview.questions[segmentIndex];
        const segmentContext = buildInterviewSegmentContext({
          interview,
          interviewer,
          questionText: question.text,
          segmentIndex,
          segmentCount,
          coveredSummary: body.coveredSummary,
        });
        const context = await client.createContext(segmentContext);
        contextId = context.id;
        segmentMeta = { segmentIndex, segmentCount };
      } else {
        if (!interview.liveAvatarContextId) {
          return NextResponse.json(
            {
              error: "This interview has no LiveAvatar context. Recreate it.",
              code: "CONTEXT_MISSING",
            },
            { status: 422 },
          );
        }
        contextId = interview.liveAvatarContextId;
      }
    }

    const avatarPersona: AvatarPersona = {
      context_id: contextId,
      language,
    };
    if (voiceId) avatarPersona.voice_id = voiceId;

    console.log("[Session API] Creating session token with:", {
      avatarId,
      contextId,
      isSandbox,
      hasLlmConfig: !!llmConfigurationId,
      mode: isRpq ? "rpq" : isDemo ? "demo" : "interview",
    });

    const session = await client.createSessionToken({
      avatarId,
      avatarPersona,
      isSandbox,
      llmConfigurationId,
    });

    console.log("[Session API] Session created:", {
      hasToken: !!session.session_token,
      sessionId: session.session_id,
      tokenLength: session.session_token?.length,
    });

    return NextResponse.json({
      sessionToken: session.session_token,
      sessionId: session.session_id,
      customLlmEnabled: Boolean(llmConfigurationId),
      isSandbox,
      mode: isRpq ? "rpq" : isDemo ? "demo" : "interview",
      ...(interviewMeta && { interview: interviewMeta }),
      ...(segmentMeta ?? {}),
    });
  } catch (error) {
    console.error("[Session API] Error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid session request.", details: error.flatten() },
        { status: 400 },
      );
    }
    if (error instanceof LiveAvatarApiError) {
      console.error("[Session API] LiveAvatar API error:", {
        status: error.status,
        code: error.code,
        message: error.message,
      });
      const isLegacyKey = error.status === 401;
      return NextResponse.json(
        {
          error: isLegacyKey
            ? "This key is not accepted by LiveAvatar. HeyGen Streaming Avatar keys must be replaced with a key from app.liveavatar.com."
            : error.message,
          code: isLegacyKey
            ? "LIVEAVATAR_KEY_REQUIRED"
            : error.code || "SESSION_TOKEN_FAILED",
        },
        { status: error.status },
      );
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to reach the LiveAvatar API.",
        code: "LIVEAVATAR_UNREACHABLE",
      },
      { status: 502 },
    );
  }
}
