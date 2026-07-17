import {
  getRpqQuestion,
  RISK_PROFILES,
  RPQ_QUESTIONS,
} from "@/lib/rpq/questionnaire";
import type { RiskProfile, RpqAnswer } from "@/types/rpq";

export type ScoredAnswer = {
  questionId: string;
  optionIds: string[];
  score: number;
};

export type RpqScoreResult = {
  totalScore: number;
  profile: RiskProfile;
  scoredAnswers: ScoredAnswer[];
};

export function scoreRpqAnswer(answer: Pick<RpqAnswer, "questionId" | "optionIds">): ScoredAnswer {
  const question = getRpqQuestion(answer.questionId);
  if (!question) throw new Error(`Unknown RPQ question: ${answer.questionId}`);

  const uniqueOptionIds = [...new Set(answer.optionIds)];
  if (question.type === "single" && uniqueOptionIds.length !== 1) {
    throw new Error(`Question ${question.number} requires exactly one answer.`);
  }
  if (question.type === "multi" && uniqueOptionIds.length < 1) {
    throw new Error(`Question ${question.number} requires at least one answer.`);
  }

  const options = uniqueOptionIds.map((id) => {
    const option = question.options.find((candidate) => candidate.id === id);
    if (!option) throw new Error(`Invalid option "${id}" for question ${question.number}.`);
    return option;
  });

  return {
    questionId: question.id,
    optionIds: uniqueOptionIds,
    score: question.type === "multi"
      ? Math.max(...options.map((item) => item.score))
      : options[0].score,
  };
}

export function scoreRpqAssessment(answers: Pick<RpqAnswer, "questionId" | "optionIds">[]): RpqScoreResult {
  if (answers.length !== RPQ_QUESTIONS.length) {
    throw new Error("All 12 RPQ questions must be answered.");
  }

  const answeredIds = new Set(answers.map((answer) => answer.questionId));
  if (answeredIds.size !== RPQ_QUESTIONS.length) {
    throw new Error("Each RPQ question may only be answered once.");
  }

  for (const question of RPQ_QUESTIONS) {
    if (!answeredIds.has(question.id)) {
      throw new Error(`Question ${question.number} is missing.`);
    }
  }

  const scoredAnswers = answers.map(scoreRpqAnswer);
  const totalScore = scoredAnswers.reduce((sum, answer) => sum + answer.score, 0);
  const profile = RISK_PROFILES.find(
    (candidate) =>
      totalScore >= candidate.minScore && totalScore <= candidate.maxScore,
  );

  if (!profile) throw new Error(`No RPQ profile matches total score ${totalScore}.`);
  return { totalScore, profile, scoredAnswers };
}
