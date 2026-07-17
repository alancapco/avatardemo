import OpenAI from "openai";

export function getLlmConfig() {
  const apiKey = process.env.CUSTOM_LLM_API_KEY?.trim();
  const model = process.env.CUSTOM_LLM_MODEL?.trim() || "gpt-4o-mini";
  const baseURL =
    process.env.CUSTOM_LLM_BASE_URL?.trim() || "https://api.openai.com/v1";

  if (!apiKey) {
    throw new Error(
      "CUSTOM_LLM_API_KEY is required for question generation and analysis.",
    );
  }

  return { apiKey, model, baseURL };
}

export function createOpenAIClient() {
  const { apiKey, baseURL } = getLlmConfig();
  return new OpenAI({ apiKey, baseURL });
}

export async function chatJson<T>(input: {
  system: string;
  user: string;
  temperature?: number;
}): Promise<T> {
  const client = createOpenAIClient();
  const { model } = getLlmConfig();

  const completion = await client.chat.completions.create({
    model,
    temperature: input.temperature ?? 0.3,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: input.system },
      { role: "user", content: input.user },
    ],
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error("LLM returned an empty response.");
  }

  return JSON.parse(content) as T;
}
