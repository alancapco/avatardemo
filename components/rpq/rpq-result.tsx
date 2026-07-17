"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { RPQ_DISCLAIMER } from "@/lib/rpq/questionnaire";
import type { RiskProfile, RpqAssessment, RpqQuestion } from "@/types/rpq";

type Review = {
  questionId: string;
  optionIds: string[];
  score: number;
  question: RpqQuestion;
};

export function RpqResult({ assessmentId }: { assessmentId: string }) {
  const [assessment, setAssessment] = useState<RpqAssessment | null>(null);
  const [profile, setProfile] = useState<RiskProfile | null>(null);
  const [review, setReview] = useState<Review[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/rpq/assessments?id=${encodeURIComponent(assessmentId)}`)
      .then(async (response) => {
        const data = (await response.json()) as {
          assessment?: RpqAssessment;
          profile?: RiskProfile;
          answerReview?: Review[];
          error?: string;
        };
        if (!response.ok || !data.assessment || !data.profile) {
          throw new Error(data.error || "Assessment not found.");
        }
        setAssessment(data.assessment);
        setProfile(data.profile);
        setReview(data.answerReview ?? []);
      })
      .catch((caught) =>
        setError(caught instanceof Error ? caught.message : "Unable to load assessment."),
      );
  }, [assessmentId]);

  return (
    <main className="studio-shell">
      <header className="masthead">
        <div className="brand-lockup"><Link className="brand-wordmark" href="/">Capco</Link><div className="brand-divider" /><div className="brand-copy"><p className="eyebrow">RPQ result</p><h1>Risk Profile Assessment</h1></div></div>
      </header>
      <div className="studio-body">
        {error && <div className="error-panel">{error}</div>}
        {!assessment || !profile ? <p className="muted">Loading assessment…</p> : <>
          <section className="rpq-result-hero panel-card">
            <p className="eyebrow">Assessment result / 評估結果</p>
            <div className="rpq-score">{assessment.totalScore}<small>/ 60</small></div>
            <h2>{profile.profile.en} <span>/ {profile.profile.zh}</span></h2>
            <p className="rpq-tolerance">{profile.tolerance.en} risk tolerance / {profile.tolerance.zh}風險承受程度</p>
            <p>{profile.description.en}</p><p className="rpq-zh">{profile.description.zh}</p>
          </section>
          <section className="panel-card">
            <p className="eyebrow">Answer review / 答案回顧</p><h2>How your score was calculated</h2>
            <div className="rpq-review-list">{review.map((item) => {
              const options = item.question.options.filter((option) => item.optionIds.includes(option.id));
              return <article key={item.questionId}><header><strong>{item.question.number}. {item.question.prompt.en}</strong><b>{item.score} points</b></header><p className="rpq-zh">{item.question.prompt.zh}</p>{options.map((option) => <p key={option.id}>• {option.label.en} <span className="rpq-zh">/ {option.label.zh}</span></p>)}{item.question.type === "multi" && <small>Only the highest selected product score is counted.</small>}</article>;
            })}</div>
          </section>
          <section className="rpq-disclaimer panel-card"><p>{RPQ_DISCLAIMER}</p><p className="rpq-zh">問卷結果只供教育示範用途，並非投資建議。任何投資決定前必須由合資格顧問審閱結果。</p><Link href="/rpq" className="primary-button"><span>Start again / 重新開始</span><b>→</b></Link></section>
        </>}
      </div>
    </main>
  );
}
