import {
  COACH_V2_PAL_SYSTEM_PROMPT,
  buildCoachV2ConversationalContext,
  buildCoachV2Greeting,
  type CoachV2BriefId,
  type CoachV2Emotion,
  type CoachV2Language,
} from "@/lib/prompts/coach-v2";

const TAVUS_API_BASE = "https://tavusapi.com/v2";
/** Pro stock face (Lucas - Studio) — Phoenix with emotional expression. */
const DEFAULT_FACE_ID = "r3f4182ef554";
const PAL_NAME = "Capco Insurance Customer";

type TavusErrorBody = {
  error?: string;
  message?: string;
};

export type TavusConversation = {
  conversation_id: string;
  conversation_name?: string;
  conversation_url: string;
  status: string;
  pal_id?: string;
  face_id?: string;
};

export type TavusTranscriptEntry = {
  role: string;
  content: string;
  timestamp?: number;
  seconds_from_start?: number;
  duration?: number;
};

export type TavusConversationEvent = {
  event_type?: string;
  timestamp?: string;
  properties?: {
    transcript?: TavusTranscriptEntry[];
    reason?: string;
    [key: string]: unknown;
  };
};

export type TavusConversationVerbose = TavusConversation & {
  events?: TavusConversationEvent[];
};

function getApiKey() {
  const apiKey = process.env.TAVUS_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("TAVUS_API_KEY is not configured.");
  }
  return apiKey;
}

function getFaceId() {
  return process.env.TAVUS_FACE_ID?.trim() || DEFAULT_FACE_ID;
}

async function tavusFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<{ ok: boolean; status: number; data: T }> {
  const response = await fetch(`${TAVUS_API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": getApiKey(),
      ...(init?.headers ?? {}),
    },
  });

  if (response.status === 204) {
    return { ok: true, status: 204, data: {} as T };
  }

  const data = (await response.json().catch(() => ({}))) as T & TavusErrorBody;
  return { ok: response.ok, status: response.status, data };
}

function errorMessage(data: TavusErrorBody, fallback: string) {
  return data.error || data.message || fallback;
}

export async function listPals(): Promise<
  Array<{ pal_id: string; pal_name?: string; default_face_id?: string }>
> {
  const { ok, data } = await tavusFetch<{
    data?: Array<{
      pal_id: string;
      pal_name?: string;
      default_face_id?: string;
    }>;
    error?: string;
    message?: string;
  }>("/pals");

  if (!ok) {
    throw new Error(errorMessage(data, "Failed to list Tavus PALs."));
  }

  return data.data ?? [];
}

export async function createCoachPal(): Promise<string> {
  const { ok, data } = await tavusFetch<{
    pal_id?: string;
    error?: string;
    message?: string;
  }>("/pals", {
    method: "POST",
    body: JSON.stringify({
      pal_name: PAL_NAME,
      system_prompt: COACH_V2_PAL_SYSTEM_PROMPT,
      pipeline_mode: "full",
      default_face_id: getFaceId(),
      languages: ["en", "zh"],
      greeting:
        "Hi. Thanks for meeting. What did you want to walk me through today?",
    }),
  });

  if (!ok || !data.pal_id) {
    throw new Error(errorMessage(data, "Failed to create Coach v2 PAL."));
  }

  return data.pal_id;
}

/**
 * Prefer TAVUS_PAL_ID. Otherwise reuse a PAL named Capco Insurance Customer,
 * or create one. Callers should persist the returned id in env when possible.
 */
export async function ensureCoachPalId(): Promise<string> {
  const configured = process.env.TAVUS_PAL_ID?.trim();
  if (configured) return configured;

  const pals = await listPals();
  const existing = pals.find((pal) => pal.pal_name === PAL_NAME);
  if (existing?.pal_id) return existing.pal_id;

  return createCoachPal();
}

export async function createCoachConversation(input: {
  emotion: CoachV2Emotion;
  briefId: CoachV2BriefId;
  language: CoachV2Language;
  customSituation?: string;
}): Promise<TavusConversation & { pal_id: string }> {
  const palId = await ensureCoachPalId();
  const conversationalContext = buildCoachV2ConversationalContext(input);
  const customGreeting = buildCoachV2Greeting(input.emotion, input.language);

  const { ok, data } = await tavusFetch<
    TavusConversation & TavusErrorBody
  >("/conversations", {
    method: "POST",
    body: JSON.stringify({
      pal_id: palId,
      face_id: getFaceId(),
      conversation_name: `Coach v2 · ${input.language} · ${input.briefId} · ${input.emotion}`,
      conversational_context: conversationalContext,
      custom_greeting: customGreeting,
      properties: {
        max_call_duration: 900,
        participant_left_timeout: 30,
        participant_absent_timeout: 300,
        // First entry is the opening language for the session.
        languages: [input.language],
      },
    }),
  });

  if (!ok || !data.conversation_id || !data.conversation_url) {
    throw new Error(
      errorMessage(data, "Failed to create Tavus conversation."),
    );
  }

  return {
    conversation_id: data.conversation_id,
    conversation_name: data.conversation_name,
    conversation_url: data.conversation_url,
    status: data.status,
    pal_id: data.pal_id ?? palId,
    face_id: data.face_id,
  };
}

export async function endConversation(conversationId: string): Promise<void> {
  const { ok, status, data } = await tavusFetch<TavusErrorBody>(
    `/conversations/${encodeURIComponent(conversationId)}/end`,
    { method: "POST" },
  );

  // Already ended / missing is fine for cleanup paths.
  if (!ok && status !== 400 && status !== 404) {
    throw new Error(errorMessage(data, "Failed to end Tavus conversation."));
  }
}

export async function getConversationVerbose(
  conversationId: string,
): Promise<TavusConversationVerbose> {
  const { ok, data } = await tavusFetch<
    TavusConversationVerbose & TavusErrorBody
  >(`/conversations/${encodeURIComponent(conversationId)}?verbose=true`);

  if (!ok) {
    throw new Error(errorMessage(data, "Failed to fetch Tavus conversation."));
  }

  return data;
}

export function extractTranscript(
  conversation: TavusConversationVerbose,
): TavusTranscriptEntry[] {
  const events = conversation.events ?? [];
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const event = events[i];
    if (event.event_type === "application.transcription_ready") {
      return event.properties?.transcript ?? [];
    }
  }
  return [];
}

/** Keep spoken turns only — drop system/tool/prompt dumps. */
export function dialogueTranscript(
  transcript: TavusTranscriptEntry[],
): TavusTranscriptEntry[] {
  return transcript.filter((entry) => {
    const role = (entry.role || "").toLowerCase();
    if (role === "system" || role === "tool") return false;
    const content = entry.content?.trim();
    if (!content) return false;
    // Tavus sometimes puts the PAL system prompt in an early assistant/system turn.
    if (
      content.startsWith("You are Capco Insurance Customer") ||
      content.includes("photorealistic AI role-play partner")
    ) {
      return false;
    }
    return role === "user" || role === "assistant" || role === "human";
  });
}

export function formatTranscriptForLlm(
  transcript: TavusTranscriptEntry[],
): string {
  return dialogueTranscript(transcript)
    .map((entry) => {
      const role =
        entry.role === "assistant"
          ? "Customer (AI)"
          : entry.role === "user" || entry.role === "human"
            ? "Agent"
            : entry.role;
      return `${role}: ${entry.content.trim()}`;
    })
    .join("\n");
}

export async function waitForTranscript(
  conversationId: string,
  options?: { attempts?: number; delayMs?: number },
): Promise<TavusTranscriptEntry[]> {
  const attempts = options?.attempts ?? 12;
  const delayMs = options?.delayMs ?? 2500;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const conversation = await getConversationVerbose(conversationId);
    const transcript = extractTranscript(conversation);
    // Wait until the transcription event exists; dialogue filtering happens later.
    if (
      (conversation.events ?? []).some(
        (event) => event.event_type === "application.transcription_ready",
      )
    ) {
      return transcript;
    }

    if (attempt < attempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return extractTranscript(await getConversationVerbose(conversationId));
}
