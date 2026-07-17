"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppNav } from "@/components/app-nav";
import type { Interviewer } from "@/types/interview";

type DraftQuestion = { text: string };

export function NewInterviewPage() {
  const router = useRouter();
  const [interviewers, setInterviewers] = useState<Interviewer[]>([]);
  const [jobDescription, setJobDescription] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [objective, setObjective] = useState("");
  const [interviewerId, setInterviewerId] = useState("");
  const [estimatedDurationMin, setEstimatedDurationMin] = useState(15);
  const [questions, setQuestions] = useState<DraftQuestion[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/interviewers")
      .then(async (res) => {
        const data = (await res.json()) as { interviewers?: Interviewer[] };
        const list = data.interviewers ?? [];
        setInterviewers(list);
        if (list[0]) setInterviewerId(list[0].id);
      })
      .catch(() => setError("Could not load interviewers."));
  }, []);

  const parsePdf = async (file: File) => {
    setBusy("Parsing PDF…");
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/parse-jd-pdf", { method: "POST", body: form });
      const data = (await res.json()) as { text?: string; error?: string };
      if (!res.ok || !data.text) throw new Error(data.error || "PDF parse failed.");
      setJobDescription(data.text);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "PDF parse failed.");
    } finally {
      setBusy(null);
    }
  };

  const generateQuestions = async () => {
    setBusy("Generating questions…");
    setError(null);
    try {
      const res = await fetch("/api/generate-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobDescription }),
      });
      const data = (await res.json()) as {
        questions?: DraftQuestion[];
        suggestedName?: string;
        suggestedObjective?: string;
        suggestedDescription?: string;
        estimatedDurationMin?: number;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || "Generation failed.");
      setQuestions(data.questions ?? []);
      if (data.suggestedName) setName(data.suggestedName);
      if (data.suggestedObjective) setObjective(data.suggestedObjective);
      if (data.suggestedDescription) setDescription(data.suggestedDescription);
      if (data.estimatedDurationMin)
        setEstimatedDurationMin(data.estimatedDurationMin);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Question generation failed.",
      );
    } finally {
      setBusy(null);
    }
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (questions.length === 0) {
      setError("Generate or add at least one question.");
      return;
    }
    setBusy("Creating interview…");
    setError(null);
    try {
      const res = await fetch("/api/interviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          objective,
          jobDescription,
          interviewerId,
          estimatedDurationMin,
          questions,
        }),
      });
      const data = (await res.json()) as {
        interview?: { id: string };
        error?: string;
      };
      if (!res.ok || !data.interview) {
        throw new Error(data.error || "Could not create interview.");
      }
      router.push(`/interviews/${data.interview.id}`);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Interview create failed.",
      );
      setBusy(null);
    }
  };

  return (
    <main className="studio-shell platform-shell">
      <AppNav active="/interviews/new" />
      <div className="studio-body platform-body">
        <section className="intro-band">
          <h2>Create interview</h2>
          <p>
            Paste a job description or upload a PDF. AI generates tailored
            LiveAvatar interview questions you can edit before sharing.
          </p>
        </section>

        {error && <div className="error-panel">{error}</div>}
        {busy && <div className="info-panel">{busy}</div>}

        <form className="stack-form panel-card" onSubmit={onSubmit}>
          <label>
            Job description
            <textarea
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              rows={8}
              required
              minLength={40}
              placeholder="Paste the role description here…"
            />
          </label>

          <div className="inline-actions">
            <label className="file-button">
              Upload PDF
              <input
                type="file"
                accept="application/pdf"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void parsePdf(file);
                }}
              />
            </label>
            <button
              className="round-button"
              type="button"
              onClick={generateQuestions}
              disabled={!!busy || jobDescription.trim().length < 40}
            >
              Generate questions
            </button>
          </div>

          <div className="two-col tight">
            <label>
              Interview name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </label>
            <label>
              Interviewer
              <select
                value={interviewerId}
                onChange={(e) => setInterviewerId(e.target.value)}
                required
              >
                {interviewers.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label>
            Short description
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>

          <label>
            Objective
            <textarea
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              rows={3}
              required
            />
          </label>

          <label>
            Estimated duration (minutes)
            <input
              type="number"
              min={5}
              max={60}
              value={estimatedDurationMin}
              onChange={(e) => setEstimatedDurationMin(Number(e.target.value))}
            />
          </label>

          <div className="questions-editor">
            <div className="panel-heading">
              <p className="eyebrow">Questions</p>
              <h3>{questions.length} prepared</h3>
            </div>
            {questions.map((question, index) => (
              <div className="question-row" key={`q-${index}`}>
                <span>{index + 1}</span>
                <textarea
                  value={question.text}
                  rows={2}
                  onChange={(e) => {
                    const next = [...questions];
                    next[index] = { text: e.target.value };
                    setQuestions(next);
                  }}
                />
                <button
                  className="text-button danger"
                  type="button"
                  onClick={() =>
                    setQuestions(questions.filter((_, i) => i !== index))
                  }
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              className="text-button"
              type="button"
              onClick={() => setQuestions([...questions, { text: "" }])}
            >
              + Add question
            </button>
          </div>

          <button
            className="primary-button"
            type="submit"
            disabled={!!busy || !name || !objective || questions.length === 0}
          >
            <span>Save &amp; create share link</span>
            <b>→</b>
          </button>
        </form>
      </div>
    </main>
  );
}
