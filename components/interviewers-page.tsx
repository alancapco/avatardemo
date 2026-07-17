"use client";

import { FormEvent, useEffect, useState } from "react";
import { AppNav } from "@/components/app-nav";
import type { Interviewer, InterviewerTraits } from "@/types/interview";

const defaultTraits: InterviewerTraits = {
  empathy: 6,
  exploration: 6,
  rapport: 6,
  speakingSpeed: 5,
};

export function InterviewersPage() {
  const [interviewers, setInterviewers] = useState<Interviewer[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [traits, setTraits] = useState<InterviewerTraits>(defaultTraits);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const res = await fetch("/api/interviewers");
    const data = (await res.json()) as {
      interviewers?: Interviewer[];
      error?: string;
    };
    if (!res.ok) throw new Error(data.error || "Failed to load interviewers.");
    setInterviewers(data.interviewers ?? []);
  };

  useEffect(() => {
    load().catch((caught) =>
      setError(caught instanceof Error ? caught.message : "Load failed."),
    );
  }, []);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/interviewers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, traits }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Could not create interviewer.");
      setName("");
      setDescription("");
      setTraits(defaultTraits);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    setError(null);
    const res = await fetch(`/api/interviewers/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError(data.error || "Delete failed.");
      return;
    }
    await load();
  };

  return (
    <main className="studio-shell platform-shell">
      <AppNav active="/interviewers" />
      <div className="studio-body platform-body">
        <section className="intro-band">
          <h2>AI interviewer personas</h2>
          <p>
            Configure empathy, exploration depth, rapport, and speaking style.
            Personas shape the LiveAvatar interview context.
          </p>
        </section>

        {error && <div className="error-panel">{error}</div>}

        <div className="two-col">
          <section className="panel-card">
            <div className="panel-heading">
              <p className="eyebrow">Library</p>
              <h3>Personas</h3>
            </div>
            <div className="persona-list">
              {interviewers.map((person) => (
                <article className="persona-card" key={person.id}>
                  <div>
                    <h4>{person.name}</h4>
                    <p>{person.description}</p>
                    <ul className="trait-chips">
                      <li>Empathy {person.traits.empathy}</li>
                      <li>Explore {person.traits.exploration}</li>
                      <li>Rapport {person.traits.rapport}</li>
                      <li>Speed {person.traits.speakingSpeed}</li>
                    </ul>
                  </div>
                  <button
                    className="text-button danger"
                    type="button"
                    onClick={() => remove(person.id)}
                  >
                    Delete
                  </button>
                </article>
              ))}
            </div>
          </section>

          <section className="panel-card">
            <div className="panel-heading">
              <p className="eyebrow">Create</p>
              <h3>New persona</h3>
            </div>
            <form className="stack-form" onSubmit={onSubmit}>
              <label>
                Name
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </label>
              <label>
                Description
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </label>
              {(
                [
                  ["empathy", "Empathy"],
                  ["exploration", "Exploration"],
                  ["rapport", "Rapport"],
                  ["speakingSpeed", "Speaking speed"],
                ] as const
              ).map(([key, label]) => (
                <label key={key}>
                  {label}: {traits[key]}
                  <input
                    type="range"
                    min={0}
                    max={10}
                    value={traits[key]}
                    onChange={(e) =>
                      setTraits((prev) => ({
                        ...prev,
                        [key]: Number(e.target.value),
                      }))
                    }
                  />
                </label>
              ))}
              <button className="primary-button" disabled={saving} type="submit">
                <span>{saving ? "Saving…" : "Add interviewer"}</span>
                <b>→</b>
              </button>
            </form>
          </section>
        </div>
      </div>
    </main>
  );
}
