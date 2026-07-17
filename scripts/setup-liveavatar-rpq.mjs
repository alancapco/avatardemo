import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const envPath = path.join(root, ".env.local");

function readEnv(source) {
  return Object.fromEntries(
    source
      .split(/\r?\n/)
      .filter((line) => line.includes("=") && !line.trim().startsWith("#"))
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
      }),
  );
}

function upsertEnv(source, key, value) {
  const expression = new RegExp(`^${key}=.*$`, "m");
  const line = `${key}=${value}`;
  return expression.test(source)
    ? source.replace(expression, line)
    : `${source.trimEnd()}\n${line}\n`;
}

const source = await fs.readFile(envPath, "utf8").catch(() => "");
const env = readEnv(source);
if (!env.LIVEAVATAR_API_KEY) {
  throw new Error("LIVEAVATAR_API_KEY must be set in .env.local.");
}
if (env.LIVEAVATAR_RPQ_CONTEXT_ID) {
  console.log(`RPQ context already configured: ${env.LIVEAVATAR_RPQ_CONTEXT_ID}`);
  process.exit(0);
}

const response = await fetch("https://api.liveavatar.com/v1/contexts", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-API-KEY": env.LIVEAVATAR_API_KEY,
  },
  body: JSON.stringify({
    name: "Capco RPQ Facilitator",
    opening_text:
      "Welcome. This is a risk profile questionnaire demonstration. Please use the answer controls on screen, or answer verbally in English when I ask each question.",
    prompt:
      "You are Capco's Risk Profile Questionnaire facilitator. This is an educational demonstration only, not investment advice. Speak English only. The web application controls question order, answer capture, scoring, and progression. Do not calculate scores, change questions, recommend investments, or give suitability advice. Keep responses concise and neutral.",
  }),
});
const payload = await response.json().catch(() => ({}));
if (!response.ok || !payload?.data?.id) {
  throw new Error(payload?.message || payload?.error?.message || "Unable to create RPQ LiveAvatar context.");
}

await fs.writeFile(
  envPath,
  upsertEnv(source, "LIVEAVATAR_RPQ_CONTEXT_ID", payload.data.id),
  "utf8",
);
console.log(`RPQ context created and saved: ${payload.data.id}`);
