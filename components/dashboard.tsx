"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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

type InterviewRow = {
  id: string;
  name: string;
  createdAt: string;
  responseCount: number;
  analysedCount: number;
  avgScore: number | null;
  estimatedDurationMin: number;
};

export function Dashboard() {
  const [interviews, setInterviews] = useState<InterviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/interviews");
        const data = (await res.json()) as {
          interviews?: InterviewRow[];
          error?: string;
        };
        if (!res.ok) throw new Error(data.error || "Failed to load interviews.");
        if (!cancelled) setInterviews(data.interviews ?? []);
      } catch (caught) {
        if (!cancelled) {
          setError(
            caught instanceof Error ? caught.message : "Failed to load dashboard.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const stats = useMemo(() => {
    const totalResponses = interviews.reduce((s, i) => s + i.responseCount, 0);
    const analysed = interviews.reduce((s, i) => s + i.analysedCount, 0);
    const scored = interviews.filter((i) => i.avgScore != null);
    const avgScore =
      scored.length > 0
        ? scored.reduce((s, i) => s + (i.avgScore ?? 0), 0) / scored.length
        : null;
    return {
      interviews: interviews.length,
      responses: totalResponses,
      analysed,
      avgScore,
    };
  }, [interviews]);

  const chartData = interviews
    .filter((i) => i.responseCount > 0)
    .slice(0, 8)
    .map((i) => ({
      name: i.name.length > 18 ? `${i.name.slice(0, 18)}…` : i.name,
      responses: i.responseCount,
      avgScore: i.avgScore ?? 0,
    }));

  return (
    <main className="studio-shell platform-shell">
      <AppNav active="/" />
      <div className="studio-body platform-body">
        <section className="intro-band">
          <div className="intro-band-row">
            <div>
              <h2>Interview dashboard</h2>
              <p>
                Create LiveAvatar video interviews from any job description,
                share a candidate link, and review scored insights.
              </p>
            </div>
            <Link className="primary-button" href="/interviews/new">
              <span>Create interview</span>
              <b>→</b>
            </Link>
          </div>
        </section>

        {error && <div className="error-panel">{error}</div>}

        <section className="stat-grid">
          <article className="stat-card">
            <p className="eyebrow">Interviews</p>
            <strong>{stats.interviews}</strong>
          </article>
          <article className="stat-card">
            <p className="eyebrow">Responses</p>
            <strong>{stats.responses}</strong>
          </article>
          <article className="stat-card">
            <p className="eyebrow">Analysed</p>
            <strong>{stats.analysed}</strong>
          </article>
          <article className="stat-card">
            <p className="eyebrow">Avg score</p>
            <strong>
              {stats.avgScore == null ? "—" : stats.avgScore.toFixed(1)}
            </strong>
          </article>
        </section>

        {chartData.length > 0 && (
          <section className="panel-card chart-panel">
            <div className="panel-heading">
              <p className="eyebrow">Activity</p>
              <h3>Responses by interview</h3>
            </div>
            <div className="chart-frame">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chartData}>
                  <CartesianGrid stroke="#e1e1e1" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: "#565656", fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fill: "#565656", fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="responses" fill="#c00d0d" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        )}

        <section className="panel-card">
          <div className="panel-heading">
            <p className="eyebrow">Library</p>
            <h3>All interviews</h3>
          </div>
          {loading ? (
            <p className="muted">Loading…</p>
          ) : interviews.length === 0 ? (
            <div className="empty-state">
              <p>No interviews yet.</p>
              <Link href="/interviews/new">Create your first interview</Link>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Responses</th>
                    <th>Avg score</th>
                    <th>Duration</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {interviews.map((interview) => (
                    <tr key={interview.id}>
                      <td>
                        <Link href={`/interviews/${interview.id}`}>
                          {interview.name}
                        </Link>
                      </td>
                      <td>{interview.responseCount}</td>
                      <td>
                        {interview.avgScore == null
                          ? "—"
                          : interview.avgScore.toFixed(1)}
                      </td>
                      <td>{interview.estimatedDurationMin} min</td>
                      <td>
                        {new Date(interview.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
      <footer className="footer-note">
        <span>Capco · AI Voice Interviews · MVP1</span>
        <span>Local JSON store · No auth yet</span>
      </footer>
    </main>
  );
}
