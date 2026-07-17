import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const envPath = resolve(process.cwd(), ".env.local");

function parseEnv(source) {
  return Object.fromEntries(
    source
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => {
        const separator = line.indexOf("=");
        return [line.slice(0, separator), line.slice(separator + 1)];
      }),
  );
}

function apiError(body, response) {
  if (typeof body?.error === "string") return body.error;
  if (body?.error?.message) return body.error.message;
  if (body?.message) return body.message;
  if (Array.isArray(body?.data) && body.data[0]?.message) {
    return body.data[0].message;
  }
  return response.statusText || "LiveAvatar API request failed.";
}

async function request(env, path, options = {}) {
  const response = await fetch(`https://api.liveavatar.com${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": env.LIVEAVATAR_API_KEY,
      ...options.headers,
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(apiError(body, response));
  return body.data;
}

function setEnvValues(source, values) {
  let next = source;
  for (const [key, value] of Object.entries(values)) {
    const line = `${key}=${value}`;
    const pattern = new RegExp(`^${key}=.*$`, "m");
    next = pattern.test(next)
      ? next.replace(pattern, line)
      : `${next.trimEnd()}\n${line}\n`;
  }
  return next;
}

let source;
try {
  source = await readFile(envPath, "utf8");
} catch {
  console.error("Missing .env.local. Copy .env.example first.");
  process.exit(1);
}

const env = parseEnv(source);
const required = [
  "LIVEAVATAR_API_KEY",
  "CUSTOM_LLM_API_KEY",
  "CUSTOM_LLM_MODEL",
];
const missing = required.filter((key) => !env[key]);

if (missing.length) {
  console.error(`Missing required values: ${missing.join(", ")}`);
  console.error(
    "Add your LLM key and model to .env.local, then run this command again.",
  );
  process.exit(1);
}

if (env.LIVEAVATAR_LLM_CONFIGURATION_ID) {
  console.log(
    `LLM configuration already active: ${env.LIVEAVATAR_LLM_CONFIGURATION_ID}`,
  );
  process.exit(0);
}

try {
  let secretId = env.LIVEAVATAR_LLM_SECRET_ID;

  if (!secretId) {
    const secret = await request(env, "/v1/secrets", {
      method: "POST",
      body: JSON.stringify({
        secret_name: env.CUSTOM_LLM_DISPLAY_NAME || "Signal Room LLM",
        secret_value: env.CUSTOM_LLM_API_KEY,
        secret_type: env.CUSTOM_LLM_SECRET_TYPE || "OPENAI_API_KEY",
      }),
    });
    secretId = secret?.id;
    if (!secretId) throw new Error("LiveAvatar created the secret without an ID.");
    source = setEnvValues(source, { LIVEAVATAR_LLM_SECRET_ID: secretId });
    await writeFile(envPath, source, { mode: 0o600 });
    console.log(`Encrypted LLM secret created: ${secretId}`);
  }

  const configuration = await request(env, "/v1/llm-configurations", {
    method: "POST",
    body: JSON.stringify({
      display_name: env.CUSTOM_LLM_DISPLAY_NAME || "Signal Room LLM",
      model_name: env.CUSTOM_LLM_MODEL,
      secret_id: secretId,
      ...(env.CUSTOM_LLM_BASE_URL && {
        base_url: env.CUSTOM_LLM_BASE_URL,
      }),
    }),
  });
  const configurationId = configuration?.id;
  if (!configurationId) {
    throw new Error("LiveAvatar created the LLM configuration without an ID.");
  }

  source = setEnvValues(source, {
    LIVEAVATAR_LLM_SECRET_ID: secretId,
    LIVEAVATAR_LLM_CONFIGURATION_ID: configurationId,
  });
  await writeFile(envPath, source, { mode: 0o600 });
  console.log(`LLM configuration created and enabled: ${configurationId}`);
  console.log("Restart the dev server so new sessions use the custom LLM.");
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

