import type { TranscriptItem } from "@/types/interview";

export const ANALYZE_COMMUNICATION_SYSTEM = `You evaluate spoken communication quality from an interview transcript.
Return strict JSON:
{
  "clarity": number,
  "confidence": number,
  "articulation": number,
  "pace": number,
  "engagement": number,
  "summary": string
}
Rules:
- All metrics are 0-10.
- Infer from language patterns, filler words, completeness, and conversational flow.
- Keep summary to 2-3 sentences.`;

export function buildAnalyzeCommunicationUser(input: {
  transcript: TranscriptItem[];
  tabSwitchCount: number;
  durationSec: number;
}) {
  const candidateLines = input.transcript
    .filter((t) => t.speaker === "you")
    .map((t) => t.text)
    .join("\n");

  return `Duration seconds: ${input.durationSec}
Tab switches: ${input.tabSwitchCount}

Candidate speech:
${candidateLines || "(No candidate speech captured)"}`;
}
