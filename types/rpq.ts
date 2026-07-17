import { z } from "zod";

export const bilingualTextSchema = z.object({
  zh: z.string().min(1),
  en: z.string().min(1),
});

export const rpqOptionSchema = z.object({
  id: z.string().min(1),
  label: bilingualTextSchema,
  score: z.number().int().min(1).max(5),
  aliases: z.array(z.string()).default([]),
});

export const rpqQuestionSchema = z.object({
  id: z.string().min(1),
  number: z.number().int().min(1).max(12),
  sectionId: z.string().min(1),
  type: z.enum(["single", "multi"]),
  prompt: bilingualTextSchema,
  options: z.array(rpqOptionSchema).length(5),
  footnote: bilingualTextSchema.optional(),
});

export const rpqSectionSchema = z.object({
  id: z.string().min(1),
  title: bilingualTextSchema,
});

export const rpqAnswerSchema = z.object({
  questionId: z.string().min(1),
  optionIds: z.array(z.string().min(1)).min(1),
  source: z.enum(["control", "speech"]),
  answeredAt: z.string(),
});

export const riskProfileSchema = z.object({
  id: z.enum([
    "conservative",
    "stable",
    "balance",
    "growth",
    "aggressive",
  ]),
  minScore: z.number().int(),
  maxScore: z.number().int(),
  tolerance: bilingualTextSchema,
  profile: bilingualTextSchema,
  description: bilingualTextSchema,
});

export const rpqAssessmentSchema = z.object({
  id: z.string().min(1),
  answers: z.array(rpqAnswerSchema).length(12),
  totalScore: z.number().int().min(12).max(60),
  profileId: riskProfileSchema.shape.id,
  sessionId: z.string().optional(),
  createdAt: z.string(),
});

export const createRpqAssessmentSchema = z.object({
  answers: z.array(rpqAnswerSchema).length(12),
  sessionId: z.string().optional(),
});

export type BilingualText = z.infer<typeof bilingualTextSchema>;
export type RpqOption = z.infer<typeof rpqOptionSchema>;
export type RpqQuestion = z.infer<typeof rpqQuestionSchema>;
export type RpqSection = z.infer<typeof rpqSectionSchema>;
export type RpqAnswer = z.infer<typeof rpqAnswerSchema>;
export type RiskProfile = z.infer<typeof riskProfileSchema>;
export type RpqAssessment = z.infer<typeof rpqAssessmentSchema>;
export type CreateRpqAssessment = z.infer<typeof createRpqAssessmentSchema>;
