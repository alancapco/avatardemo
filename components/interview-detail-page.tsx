"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppNav } from "@/components/app-nav";
import type {
  Interview,
  Interviewer,
  InterviewResponse,
} from "@/types/interview";

export function InterviewDetailPage({ interviewId }: { interviewId: string }) {
  const [interview, setInterview] = useState<Interview | null>(null);
  const [interviewer, setInterviewer] = useState<Interviewer | null>(null);
  const [responses, setResponses] = useState<InterviewResponse[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/interviews/${interviewId}`);
        const data = (await res.json()) as {
          interview?: Interview;
          interviewer?: Interviewer;
          responses?: InterviewResponse[];
          error?: string;
        };
        if (!res.ok) throw new Error(data.error || "Failed to load interview.");
        if (cancelled) return;
        setInterview(data.interview ?? null);
        setInterviewer(data.interviewer ?? null);
        setResponses(data.responses ?? []);
      } catch (caught) {
        if (!cancelled) {
          setError(
            caught instanceof Error ? caught.message : "Failed to load interview.",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [interviewId]);

  const shareUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/call/${interviewId}`;
  }, [interviewId]);

  const copyLink = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <main className="studio-shell platform-shell">
      <AppNav />
      <div className="studio-body platform-body">
        {error && <div className="error-panel">{error}</div>}
        {!interview ? (
          <p className="muted">Loading interview…</p>
        ) : (
          <>
            <section className="intro-band">
              <h2>{interview.name}</h2>
              <p>{interview.description || interview.objective}</p>
            </section>

            <section className="panel-card share-panel">
              <div className="panel-heading">
                <p className="eyebrow">Candidate link</p>
                <h3>One-click share</h3>
              </div>
              <code className="share-url">{shareUrl}</code>
              <div className="inline-actions">
                <button className="primary-button" type="button" onClick={copyLink}>
                  <span>{copied ? "Copied" : "Copy link"}</span>
                  <b>→</b>
                </button>
                <Link className="round-button" href={`/call/${interviewId}`}>
                  Open candidate view
                </Link>
              </div>
            </section>

            <div className="two-col">
              <section className="panel-card">
                <div className="panel-heading">
                  <p className="eyebrow">Setup</p>
                  <h3>Interview details</h3>
                </div>
                <dl className="meta-list">
                  <div>
                    <dt>Interviewer</dt>
                    <dd>{interviewer?.name ?? "—"}</dd>
                  </div>
                  <div>
                    <dt>Duration</dt>
                    <dd>{interview.estimatedDurationMin} minutes</dd>
                  </div>
                  <div>
                    <dt>Objective</dt>
                    <dd>{interview.objective}</dd>
                  </div>
                  <div>
                    <dt>Questions</dt>
                    <dd>
                      <ol className="question-list">
                        {interview.questions.map((q) => (
                          <li key={q.id}>{q.text}</li>
                        ))}
                      </ol>
                    </dd>
                  </div>
                </dl>
              </section>

              <section className="panel-card">
                <div className="panel-heading">
                  <p className="eyebrow">Candidates</p>
                  <h3>Responses ({responses.length})</h3>
                </div>
                {responses.length === 0 ? (
                  <div className="empty-state">
                    <p>No candidates have completed this interview yet.</p>
                  </div>
                ) : (
                  <div className="table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Candidate</th>
                          <th>Score</th>
                          <th>Status</th>
                          <th>Tab switches</th>
                          <th>When</th>
                        </tr>
                      </thead>
                      <tbody>
                        {responses.map((response) => (
                          <tr key={response.id}>
                            <td>
                              <Link href={`/responses/${response.id}`}>
                                {response.candidateName}
                              </Link>
                            </td>
                            <td>
                              {response.analysis?.overallScore?.toFixed(1) ?? "—"}
                            </td>
                            <td>
                              {response.isAnalysed ? "Analysed" : "Pending"}
                            </td>
                            <td>{response.tabSwitchCount}</td>
                            <td>
                              {new Date(response.createdAt).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
