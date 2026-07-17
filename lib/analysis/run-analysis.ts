import { z } from "zod";
import { chatJson } from "@/lib/openai/client";
import {
  ANALYZE_COMMUNICATION_SYSTEM,
  buildAnalyzeCommunicationUser,
} from "@/lib/prompts/analyze-communication";
import {
  buildGenerateInsightsUser,
  GENERATE_INSIGHTS_SYSTEM,
} from "@/lib/prompts/generate-insights";
import {
  getInterview,
  getResponse,
  updateResponse,
} from "@/lib/store/repositories";
import {
  analysisSchema,
  communicationMetricsSchema,
  type Analysis,
} from "@/types/interview";

export async function runAnalysis(responseId: string) {
  const response = await getResponse(responseId);
  if (!response) throw new Error("Response not found.");

  const interview = await getInterview(response.interviewId);
  if (!interview) throw new Error("Interview not found for response.");

  const communication = await chatJson<z.infer<typeof communicationMetricsSchema>>(
    {
      system: ANALYZE_COMMUNICATION_SYSTEM,
      user: buildAnalyzeCommunicationUser({
        transcript: response.transcript,
        tabSwitchCount: response.tabSwitchCount,
        durationSec: response.durationSec,
      }),
    },
  );

  const insights = await chatJson<{
    overallScore: number;
    recommendation: Analysis["recommendation"];
    summary: string;
    strengths: string[];
    concerns: string[];
    keyQuotes: string[];
    questionScores: Analysis["questionScores"];
  }>({
    system: GENERATE_INSIGHTS_SYSTEM,
    user: buildGenerateInsightsUser({
      interview,
      transcript: response.transcript,
      tabSwitchCount: response.tabSwitchCount,
      durationSec: response.durationSec,
    }),
  });

  const analysis = analysisSchema.parse({
    ...insights,
    communication: communicationMetricsSchema.parse(communication),
  });

  return updateResponse(responseId, {
    analysis,
    isAnalysed: true,
  });
}
