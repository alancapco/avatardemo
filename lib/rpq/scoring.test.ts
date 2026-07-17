import { describe, expect, it } from "vitest";
import { RPQ_QUESTIONS } from "@/lib/rpq/questionnaire";
import { scoreRpqAssessment } from "@/lib/rpq/scoring";

function answerAll(optionIndex: number) {
  return RPQ_QUESTIONS.map((question) => ({
    questionId: question.id,
    optionIds: [question.options[optionIndex].id],
    source: "control" as const,
    answeredAt: new Date().toISOString(),
  }));
}

describe("RPQ deterministic scoring", () => {
  it("maps all lowest answers to Conservative", () => {
    const result = scoreRpqAssessment(answerAll(4));
    expect(result.totalScore).toBe(12);
    expect(result.profile.id).toBe("conservative");
  });

  it("maps all highest answers to Aggressive", () => {
    const result = scoreRpqAssessment(answerAll(0));
    expect(result.totalScore).toBe(60);
    expect(result.profile.id).toBe("aggressive");
  });

  it("uses only question 4's highest selected score", () => {
    const answers = answerAll(4);
    const products = RPQ_QUESTIONS.find((question) => question.id === "products")!;
    answers[3].optionIds = [
      products.options.find((option) => option.id === "bonds")!.id,
      products.options.find((option) => option.id === "derivatives")!.id,
    ];
    const result = scoreRpqAssessment(answers);
    expect(result.scoredAnswers.find((answer) => answer.questionId === "products")?.score).toBe(5);
    expect(result.totalScore).toBe(16);
  });

  it("rejects incomplete and duplicate answers", () => {
    expect(() => scoreRpqAssessment(answerAll(0).slice(1))).toThrow("All 12");
    const duplicate = answerAll(0);
    duplicate[1].questionId = duplicate[0].questionId;
    expect(() => scoreRpqAssessment(duplicate)).toThrow("only be answered once");
  });
});
