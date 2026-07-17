import { describe, expect, it } from "vitest";
import { matchRpqAnswer } from "@/lib/rpq/answer-matcher";

describe("RPQ deterministic speech matching", () => {
  it("matches a spoken numbered option", () => {
    expect(matchRpqAnswer("age", "option one")).toMatchObject({
      status: "matched",
      optionIds: ["18-30"],
    });
  });

  it("matches a product alias", () => {
    expect(matchRpqAnswer("products", "I have invested in stocks and bonds")).toMatchObject({
      status: "matched",
      optionIds: expect.arrayContaining(["stocks", "bonds"]),
    });
  });

  it("does not advance an ambiguous single-choice number response", () => {
    expect(matchRpqAnswer("education", "option one or two")).toMatchObject({
      status: "ambiguous",
      optionIds: [],
    });
  });
});
