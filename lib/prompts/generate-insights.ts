import type { Interview, TranscriptItem } from "@/types/interview";

export const GENERATE_INSIGHTS_SYSTEM = `You are an expert hiring evaluator.
Analyze a candidate interview transcript against the interview questions and objective.
Return strict JSON:
{
  "overallScore": number,
  "recommendation": "strong_hire" | "hire" | "maybe" | "no_hire",
  "summary": string,
  "strengths": string[],
  "concerns": string[],
  "keyQuotes": string[],
  "questionScores": [
    {
      "questionId": string,
      "questionText": string,
      "score": number,
      "feedback": string
    }
  ]
}
Rules:
- Scores are 0-10.
- Map answers to the closest matching question when possible.
- Include every interview question in questionScores even if unanswered (score 0).
- keyQuotes should be short verbatim-style excerpts from the candidate.
- Be concise and actionable.`;

export function buildGenerateInsightsUser(input: {
  interview: Interview;
  transcript: TranscriptItem[];
  tabSwitchCount: number;
  durationSec: number;
}) {
  const questions = input.interview.questions
    .map((q, i) => `${i + 1}. [${q.id}] ${q.text}`)
    .join("\n");

  const transcript = input.transcript
    .filter((t) => t.speaker !== "system")
    .map((t) => `${t.speaker === "you" ? "Candidate" : "Interviewer"}: ${t.text}`)
    .join("\n");

  return `Interview name: ${input.interview.name}
Objective: ${input.interview.objective}
Duration seconds: ${input.durationSec}
Tab switches during call: ${input.tabSwitchCount}

Questions:
${questions}

Transcript:
${transcript}`;
}
