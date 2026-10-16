const DEFAULT_API_URL = "https://api.liveavatar.com";

export type LiveAvatarSecretType =
  | "OPENAI_API_KEY"
  | "GEMINI_API_KEY"
  | "ELEVENLABS_API_KEY";

export type AvatarPersona = {
  context_id: string;
  language: string;
  voice_id?: string;
};

export type SessionTokenInput = {
  avatarId: string;
  avatarPersona: AvatarPersona;
  isSandbox?: boolean;
  llmConfigurationId?: string;
};

export type SessionTokenResult = {
  session_id: string;
  session_token: string;
};

type ApiEnvelope<T> = {
  data: T;
};

type ApiErrorBody = {
  error?: string | { code?: string; message?: string };
  message?: string;
  data?: Array<{ message?: string }>;
};

function errorMessage(body: ApiErrorBody) {
  if (typeof body.error === "string") return body.error;
  if (body.error?.message) return body.error.message;
  if (body.message) return body.message;
  if (Array.isArray(body.data) && body.data[0]?.message) {
    return body.data[0].message;
  }
  return "LiveAvatar API request failed.";
}

export class LiveAvatarApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "LiveAvatarApiError";
  }
}

export class LiveAvatarServer {
  constructor(
    private readonly apiKey: string,
    private readonly apiUrl = DEFAULT_API_URL,
  ) {}

  private async request<T>(path: string, init: RequestInit = {}) {
    const url = `${this.apiUrl}${path}`;
    console.log(`[LiveAvatar Client] ${init.method || 'GET'} ${url}`);

    const response = await fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": this.apiKey,
        ...init.headers,
      },
      cache: "no-store",
    });
    const body = (await response.json().catch(() => ({}))) as ApiEnvelope<T> &
      ApiErrorBody;

    console.log(`[LiveAvatar Client] Response ${response.status}:`, JSON.stringify(body, null, 2));

    if (!response.ok) {
      const apiCode =
        typeof body.error === "object" ? body.error?.code : undefined;
      throw new LiveAvatarApiError(
        errorMessage(body),
        response.status,
        apiCode,
      );
    }

    return body.data;
  }

  createSessionToken(input: SessionTokenInput) {
    const payload = {
      avatar_id: input.avatarId,
      avatar_persona: input.avatarPersona,
      is_sandbox: input.isSandbox ?? false,
      video_settings: {
        quality: "high",
        encoding: "H264",
      },
      ...(input.llmConfigurationId && {
        llm_configuration_id: input.llmConfigurationId,
      }),
    };
    console.log("[LiveAvatar Client] Creating session token with payload:", JSON.stringify(payload, null, 2));
    return this.request<SessionTokenResult>("/v1/sessions/token", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  createSecret(input: {
    name: string;
    value: string;
    type: LiveAvatarSecretType;
  }) {
    return this.request<{ id: string; secret_name: string }>("/v1/secrets", {
      method: "POST",
      body: JSON.stringify({
        secret_name: input.name,
        secret_value: input.value,
        secret_type: input.type,
      }),
    });
  }

  createLlmConfiguration(input: {
    displayName: string;
    modelName: string;
    secretId: string;
    baseUrl?: string;
  }) {
    return this.request<{
      id: string;
      display_name: string;
      model_name: string;
      secret_id: string;
      base_url: string;
    }>("/v1/llm-configurations", {
      method: "POST",
      body: JSON.stringify({
        display_name: input.displayName,
        model_name: input.modelName,
        secret_id: input.secretId,
        ...(input.baseUrl && { base_url: input.baseUrl }),
      }),
    });
  }

  createContext(input: {
    name: string;
    prompt: string;
    opening_text: string;
  }) {
    return this.request<{ id: string; name: string }>("/v1/contexts", {
      method: "POST",
      body: JSON.stringify({
        name: input.name,
        prompt: input.prompt,
        opening_text: input.opening_text,
      }),
    });
  }
}

