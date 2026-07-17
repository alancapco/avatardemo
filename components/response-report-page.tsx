"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppNav } from "@/components/app-nav";
import type { Analysis, Interview, InterviewResponse } from "@/types/interview";

const recommendationLabel: Record<Analysis["recommendation"], string> = {
  strong_hire: "Strong hire",
  hire: "Hire",
  maybe: "Maybe",
  no_hire: "No hire",
};

export function ResponseReportPage({ responseId }: { responseId: string }) {
  const [response, setResponse] = useState<InterviewResponse | null>(null);
  const [interview, setInterview] = useState<Interview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reanalyzing, setReanalyzing] = useState(false);

  const load = async () => {
    const res = await fetch(`/api/responses/${responseId}`);
    const data = (await res.json()) as {
      response?: InterviewResponse;
      interview?: Interview;
      error?: string;
    };
    if (!res.ok) throw new Error(data.error || "Failed to load response.");
    setResponse(data.response ?? null);
    setInterview(data.interview ?? null);
  };

  useEffect(() => {
    load().catch((caught) =>
      setError(caught instanceof Error ? caught.message : "Load failed."),
    );
  }, [responseId]);

  const reanalyze = async () => {
    setReanalyzing(true);
    setError(null);
    try {
      const res = await fetch("/api/generate-insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responseId }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Re-analysis failed.");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Re-analysis failed.");
    } finally {
      setReanalyzing(false);
    }
  };

  const analysis = response?.analysis;
  const commChart = analysis
    ? [
        { name: "Clarity", value: analysis.communication.clarity },
        { name: "Confidence", value: analysis.communication.confidence },
        { name: "Articulation", value: analysis.communication.articulation },
        { name: "Pace", value: analysis.communication.pace },
        { name: "Engagement", value: analysis.communication.engagement },
      ]
    : [];

  return (
    <main className="studio-shell platform-shell">
      <AppNav />
      <div className="studio-body platform-body">
        {error && <div className="error-panel">{error}</div>}
        {!response ? (
          <p className="muted">Loading report…</p>
        ) : (
          <>
            <section className="intro-band">
              <div className="intro-band-row">
                <div>
                  <h2>{response.candidateName}</h2>
                  <p>
                    {interview?.name ?? "Interview"} ·{" "}
                    {Math.round(response.durationSec / 60)} min ·{" "}
                    {response.tabSwitchCount} tab switches
                  </p>
                </div>
                <div className="inline-actions">
                  {interview && (
                    <Link
                      className="round-button"
                      href={`/interviews/${interview.id}`}
                    >
                      Back to interview
                    </Link>
                  )}
                  <button
                    className="primary-button"
                    type="button"
                    onClick={reanalyze}
                    disabled={reanalyzing}
                  >
                    <span>{reanalyzing ? "Analysing…" : "Re-run analysis"}</span>
                    <b>→</b>
                  </button>
                </div>
              </div>
            </section>

            {!analysis ? (
              <section className="panel-card">
                <p>Analysis pending or failed. Use re-run analysis.</p>
              </section>
            ) : (
              <>
                <section className="stat-grid">
                  <article className="stat-card">
                    <p className="eyebrow">Overall</p>
                    <strong>{analysis.overallScore.toFixed(1)}</strong>
                  </article>
                  <article className="stat-card">
                    <p className="eyebrow">Recommendation</p>
                    <strong className="stat-text">
                      {recommendationLabel[analysis.recommendation]}
                    </strong>
                  </article>
                  <article className="stat-card">
                    <p className="eyebrow">Questions scored</p>
                    <strong>{analysis.questionScores.length}</strong>
                  </article>
                  <article className="stat-card">
                    <p className="eyebrow">Attention</p>
                    <strong>{response.tabSwitchCount}</strong>
                  </article>
                </section>

                <section className="panel-card">
                  <div className="panel-heading">
                    <p className="eyebrow">Summary</p>
                    <h3>Insights</h3>
                  </div>
                  <p>{analysis.summary}</p>
                  <div className="two-col tight">
                    <div>
                      <h4>Strengths</h4>
                      <ul>
                        {analysis.strengths.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h4>Concerns</h4>
                      <ul>
                        {analysis.concerns.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  {analysis.keyQuotes.length > 0 && (
                    <div className="quotes">
                      <h4>Key quotes</h4>
                      {analysis.keyQuotes.map((quote) => (
                        <blockquote key={quote}>{quote}</blockquote>
                      ))}
                    </div>
                  )}
                </section>

                <section className="panel-card chart-panel">
                  <div className="panel-heading">
                    <p className="eyebrow">Communication</p>
                    <h3>{analysis.communication.summary}</h3>
                  </div>
                  <div className="chart-frame">
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={commChart}>
                        <CartesianGrid stroke="#e1e1e1" vertical={false} />
                        <XAxis
                          dataKey="name"
                          tick={{ fill: "#565656", fontSize: 12 }}
                        />
                        <YAxis domain={[0, 10]} tick={{ fill: "#565656", fontSize: 12 }} />
                        <Tooltip />
                        <Bar dataKey="value" fill="#222222" radius={[2, 2, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </section>

                <section className="panel-card">
                  <div className="panel-heading">
                    <p className="eyebrow">Evaluation</p>
                    <h3>Question scores</h3>
                  </div>
                  <div className="table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Question</th>
                          <th>Score</th>
                          <th>Feedback</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analysis.questionScores.map((item) => (
                          <tr key={item.questionId}>
                            <td>{item.questionText}</td>
                            <td>{item.score.toFixed(1)}</td>
                            <td>{item.feedback}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </>
            )}

            <section className="panel-card">
              <div className="panel-heading">
                <p className="eyebrow">Transcript</p>
                <h3>Conversation</h3>
              </div>
              <div className="transcript-list report-transcript">
                {response.transcript
                  .filter((item) => item.speaker !== "system")
                  .map((item) => (
                    <article
                      className={`transcript-item ${item.speaker}`}
                      key={item.id}
                    >
                      <p>{item.speaker === "you" ? "Candidate" : "Interviewer"}</p>
                      <div>{item.text}</div>
                    </article>
                  ))}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
