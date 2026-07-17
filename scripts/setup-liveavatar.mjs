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

function avatarList(body) {
  if (Array.isArray(body?.data?.avatars)) return body.data.avatars;
  if (Array.isArray(body?.data)) return body.data;
  if (Array.isArray(body?.avatars)) return body.avatars;
  return [];
}

async function api(path, options = {}) {
  const response = await fetch(`https://api.liveavatar.com${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": env.LIVEAVATAR_API_KEY,
      ...options.headers,
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body?.message || body?.error?.message || body?.error || response.statusText);
    error.status = response.status;
    throw error;
  }
  return body;
}

async function setEnvValue(source, key, value) {
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, "m");
  const next = pattern.test(source)
    ? source.replace(pattern, line)
    : `${source.trimEnd()}\n${line}\n`;
  await writeFile(envPath, next, { mode: 0o600 });
}

let source;
try {
  source = await readFile(envPath, "utf8");
} catch {
  console.error("Missing .env.local. Copy .env.example first.");
  process.exit(1);
}

const env = parseEnv(source);
if (!env.LIVEAVATAR_API_KEY || !env.LIVEAVATAR_AVATAR_ID) {
  console.error("LIVEAVATAR_API_KEY and LIVEAVATAR_AVATAR_ID are required.");
  process.exit(1);
}

try {
  const isSandbox = env.LIVEAVATAR_SANDBOX === "true";

  if (isSandbox) {
    console.log(`Sandbox avatar configured: ${env.LIVEAVATAR_AVATAR_ID}`);
  } else {
    const avatarsResponse = await api("/v1/avatars");
    const avatars = avatarList(avatarsResponse);
    const selected = avatars.find(
      (avatar) =>
        avatar.id === env.LIVEAVATAR_AVATAR_ID ||
        avatar.avatar_id === env.LIVEAVATAR_AVATAR_ID,
    );

    if (!selected) {
      console.error("The configured avatar ID is not present in this LiveAvatar account.");
      if (avatars.length) {
        console.error("Available avatars:");
        for (const avatar of avatars.slice(0, 12)) {
          console.error(`- ${avatar.name || avatar.avatar_name || "Unnamed"}: ${avatar.id || avatar.avatar_id}`);
        }
      }
      process.exit(1);
    }

    console.log(`Avatar verified: ${selected.name || selected.avatar_name || env.LIVEAVATAR_AVATAR_ID}`);
  }

  if (env.LIVEAVATAR_CONTEXT_ID) {
    console.log(`Context already configured: ${env.LIVEAVATAR_CONTEXT_ID}`);
    process.exit(0);
  }

  const contextResponse = await api("/v1/contexts", {
    method: "POST",
    body: JSON.stringify({
      name: "Signal Room Demo",
      prompt:
        "You are a polished, friendly live demo host. Answer clearly and conversationally. Keep most answers under four sentences, ask useful follow-up questions, and never claim to have performed actions you cannot verify.",
      opening_text:
        "Welcome to the Signal Room. I am live and ready—what would you like to explore together?",
    }),
  });
  const contextId = contextResponse?.data?.id;
  if (!contextId) throw new Error("Context was created without an ID.");
  await setEnvValue(source, "LIVEAVATAR_CONTEXT_ID", contextId);
  console.log(`Context created and saved: ${contextId}`);
} catch (error) {
  if (error?.status === 401) {
    console.error(
      "This API key is not accepted by LiveAvatar. Create a replacement key at app.liveavatar.com; legacy HeyGen Streaming Avatar keys no longer work with the sunset API.",
    );
  } else {
    console.error(error instanceof Error ? error.message : error);
  }
  process.exit(1);
}
