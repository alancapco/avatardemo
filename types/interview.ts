import { z } from "zod";

export const traitScoreSchema = z.number().min(0).max(10);

export const interviewerTraitsSchema = z.object({
  empathy: traitScoreSchema,
  exploration: traitScoreSchema,
  rapport: traitScoreSchema,
  speakingSpeed: traitScoreSchema,
});

export const interviewerSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  description: z.string(),
  traits: interviewerTraitsSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const interviewQuestionSchema = z.object({
  id: z.string(),
  text: z.string().min(1),
});

export const interviewSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  description: z.string(),
  objective: z.string(),
  jobDescription: z.string(),
  questions: z.array(interviewQuestionSchema),
  interviewerId: z.string(),
  liveAvatarContextId: z.string(),
  estimatedDurationMin: z.number().int().positive().default(15),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const transcriptSpeakerSchema = z.enum(["you", "avatar", "system"]);

export const transcriptItemSchema = z.object({
  id: z.string(),
  speaker: transcriptSpeakerSchema,
  text: z.string(),
  at: z.string().optional(),
});

export const questionScoreSchema = z.object({
  questionId: z.string(),
  questionText: z.string(),
  score: z.number().min(0).max(10),
  feedback: z.string(),
});

export const communicationMetricsSchema = z.object({
  clarity: z.number().min(0).max(10),
  confidence: z.number().min(0).max(10),
  articulation: z.number().min(0).max(10),
  pace: z.number().min(0).max(10),
  engagement: z.number().min(0).max(10),
  summary: z.string(),
});

export const analysisSchema = z.object({
  overallScore: z.number().min(0).max(10),
  recommendation: z.enum(["strong_hire", "hire", "maybe", "no_hire"]),
  summary: z.string(),
  strengths: z.array(z.string()),
  concerns: z.array(z.string()),
  keyQuotes: z.array(z.string()),
  questionScores: z.array(questionScoreSchema),
  communication: communicationMetricsSchema,
});

export const responseSchema = z.object({
  id: z.string(),
  interviewId: z.string(),
  candidateName: z.string(),
  transcript: z.array(transcriptItemSchema),
  durationSec: z.number().nonnegative(),
  tabSwitchCount: z.number().int().nonnegative(),
  callSessionId: z.string().optional(),
  isAnalysed: z.boolean(),
  analysis: analysisSchema.optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const feedbackSchema = z.object({
  id: z.string(),
  responseId: z.string().optional(),
  interviewId: z.string(),
  rating: z.number().min(1).max(5),
  comment: z.string(),
  createdAt: z.string(),
});

export type InterviewerTraits = z.infer<typeof interviewerTraitsSchema>;
export type Interviewer = z.infer<typeof interviewerSchema>;
export type InterviewQuestion = z.infer<typeof interviewQuestionSchema>;
export type Interview = z.infer<typeof interviewSchema>;
export type TranscriptItem = z.infer<typeof transcriptItemSchema>;
export type QuestionScore = z.infer<typeof questionScoreSchema>;
export type CommunicationMetrics = z.infer<typeof communicationMetricsSchema>;
export type Analysis = z.infer<typeof analysisSchema>;
export type InterviewResponse = z.infer<typeof responseSchema>;
export type Feedback = z.infer<typeof feedbackSchema>;

export type CreateInterviewerInput = {
  name: string;
  description: string;
  traits: InterviewerTraits;
};

export type CreateInterviewInput = {
  name: string;
  description: string;
  objective: string;
  jobDescription: string;
  questions: Array<{ text: string }>;
  interviewerId: string;
  estimatedDurationMin?: number;
};

export type CreateResponseInput = {
  interviewId: string;
  candidateName: string;
  transcript: TranscriptItem[];
  durationSec: number;
  tabSwitchCount: number;
  callSessionId?: string;
};
