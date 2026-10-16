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

/** Strip fences, extract the first object/array, and close truncated JSON when needed. */
export function parseLlmJson<T>(content: string): T {
  let text = content.trim();
  text = text.replace(/^```(?:json)?\s*/i, "");
  text = text.replace(/\s*```(?:\s*)$/i, "");
  text = text.replace(/\s*```[\s\S]*$/i, "");

  const objectStart = text.search(/[\{\[]/);
  if (objectStart >= 0) {
    text = text.slice(objectStart);
  }

  const candidates = [
    text,
    escapeInteriorQuotes(text),
    repairTruncatedJson(text),
    repairTruncatedJson(escapeInteriorQuotes(text)),
  ];
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as T;
    } catch {
      // try next
    }
  }

  throw new Error(
    `Failed to parse LLM response as JSON. Content: ${content.substring(0, 500)}`,
  );
}

/**
 * Models often put raw " inside Chinese/English string values.
 * Escape a quote when the next non-space char is not a JSON delimiter.
 */
function escapeInteriorQuotes(raw: string): string {
  let out = "";
  let inString = false;
  let escape = false;

  for (let i = 0; i < raw.length; i += 1) {
    const char = raw[i];

    if (escape) {
      out += char;
      escape = false;
      continue;
    }

    if (char === "\\") {
      out += char;
      escape = true;
      continue;
    }

    if (char === '"') {
      if (!inString) {
        inString = true;
        out += char;
        continue;
      }

      let j = i + 1;
      while (j < raw.length && /\s/.test(raw[j])) j += 1;
      const next = raw[j] ?? "";
      const closesValue = next === "" || /[,:\]\}]/.test(next);

      if (closesValue) {
        inString = false;
        out += char;
      } else {
        out += '\\"';
      }
      continue;
    }

    out += char;
  }

  return out;
}

function repairTruncatedJson(raw: string): string {
  let s = raw.trim().replace(/,\s*$/, "");

  let inString = false;
  let escape = false;
  for (let i = 0; i < s.length; i += 1) {
    const char = s[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (char === "\\") {
      escape = true;
      continue;
    }
    if (char === '"') inString = !inString;
  }
  if (inString) s += '"';

  s = s.replace(/,\s*$/, "");

  const stack: string[] = [];
  inString = false;
  escape = false;
  for (let i = 0; i < s.length; i += 1) {
    const char = s[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (char === "\\") {
      escape = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === "{") stack.push("}");
    else if (char === "[") stack.push("]");
    else if (char === "}" || char === "]") stack.pop();
  }

  while (stack.length > 0) {
    s += stack.pop();
  }

  return s;
}

export async function chatJson<T>(input: {
  system: string;
  user: string;
  temperature?: number;
  maxTokens?: number;
}): Promise<T> {
  const client = createOpenAIClient();
  const { model } = getLlmConfig();

  const completion = await client.chat.completions.create({
    model,
    temperature: input.temperature ?? 0.3,
    response_format: { type: "json_object" },
    max_tokens: input.maxTokens ?? 2048,
    messages: [
      { role: "system", content: input.system },
      { role: "user", content: input.user },
    ],
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error("LLM returned an empty response.");
  }

  try {
    return parseLlmJson<T>(content);
  } catch (parseError) {
    console.error("JSON parse error:", parseError);
    console.error("Raw content:", content);
    throw parseError instanceof Error
      ? parseError
      : new Error("Failed to parse LLM response as JSON.");
  }
}
