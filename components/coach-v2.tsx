"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { AppNav } from "@/components/app-nav";
import {
  COACH_V2_BRIEFS,
  COACH_V2_EMOTIONS,
  COACH_V2_LANGUAGES,
  type CoachV2BriefId,
  type CoachV2Emotion,
  type CoachV2Feedback,
  type CoachV2Language,
} from "@/lib/prompts/coach-v2";

type SessionPhase = "setup" | "live" | "ending" | "feedback";

type SessionResponse = {
  conversationId: string;
  conversationUrl: string;
  status?: string;
  palId?: string;
  error?: string;
};

type FeedbackResponse = {
  conversationId?: string;
  feedback?: CoachV2Feedback | null;
  message?: string;
  error?: string;
};

export function CoachV2() {
  const [emotion, setEmotion] = useState<CoachV2Emotion>("neutral");
  const [language, setLanguage] = useState<CoachV2Language>("en");
  const [briefId, setBriefId] = useState<CoachV2BriefId>("family-life");
  const [customSituation, setCustomSituation] = useState("");
  const [phase, setPhase] = useState<SessionPhase>("setup");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversationUrl, setConversationUrl] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<CoachV2Feedback | null>(null);
  const [feedbackNote, setFeedbackNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const conversationIdRef = useRef<string | null>(null);
  const sessionLanguageRef = useRef<CoachV2Language>("en");

  const endRemoteSession = useCallback(async (id: string) => {
    try {
      await fetch(`/api/coachv2/session/${encodeURIComponent(id)}/end`, {
        method: "POST",
      });
    } catch {
      // Best-effort cleanup when leaving the page.
    }
  }, []);

  useEffect(() => {
    conversationIdRef.current = conversationId;
  }, [conversationId]);

  useEffect(() => {
    return () => {
      const id = conversationIdRef.current;
      if (id) void endRemoteSession(id);
    };
  }, [endRemoteSession]);

  const startSession = async (event: FormEvent) => {
    event.preventDefault();
    if (isStarting || phase === "live") return;

    setIsStarting(true);
    setError(null);
    setFeedback(null);
    setFeedbackNote(null);

    try {
      const response = await fetch("/api/coachv2/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emotion,
          language,
          briefId,
          customSituation: customSituation.trim() || undefined,
        }),
      });
      const result = (await response.json()) as SessionResponse;
      if (!response.ok || !result.conversationId || !result.conversationUrl) {
        throw new Error(result.error || "Could not start Coach v2 session.");
      }

      sessionLanguageRef.current = language;
      setConversationId(result.conversationId);
      setConversationUrl(result.conversationUrl);
      setPhase("live");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not start Coach v2 session.",
      );
      setPhase("setup");
    } finally {
      setIsStarting(false);
    }
  };

  const endSession = async () => {
    if (!conversationId || phase === "ending") return;
    setPhase("ending");
    setError(null);

    try {
      await endRemoteSession(conversationId);

      const response = await fetch(
        `/api/coachv2/session/${encodeURIComponent(conversationId)}/feedback`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ language: sessionLanguageRef.current }),
        },
      );
      const result = (await response.json()) as FeedbackResponse;
      if (!response.ok) {
        throw new Error(result.error || "Could not load session feedback.");
      }

      setFeedback(result.feedback ?? null);
      setFeedbackNote(result.message ?? null);
      setConversationUrl(null);
      setPhase("feedback");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not end Coach v2 session.",
      );
      setConversationUrl(null);
      setPhase("feedback");
    }
  };

  const resetToSetup = () => {
    setConversationId(null);
    setConversationUrl(null);
    setFeedback(null);
    setFeedbackNote(null);
    setError(null);
    setPhase("setup");
  };

  const selectedBrief = COACH_V2_BRIEFS.find((brief) => brief.id === briefId);
  const briefLabel =
    language === "zh"
      ? (selectedBrief?.labelZh ?? briefId)
      : (selectedBrief?.label ?? briefId);
  const languageLabel =
    COACH_V2_LANGUAGES.find((item) => item.id === language)?.label ?? language;

  return (
    <main className="studio-shell platform-shell">
      <AppNav active="/coachv2" />

      <div className="studio-body platform-body">
        <section className="intro-band">
          <div className="intro-band-row">
            <div>
              <h2>Coach v2 · Insurance role-play</h2>
              <p>
                Practise selling to a Tavus PAL customer. Pick the buyer&apos;s
                starting emotion, run a live video pitch, then get coaching
                feedback when you end the call.
              </p>
            </div>
            {phase === "live" && (
              <div className="live-pill is-live">
                <span />
                Live
              </div>
            )}
          </div>
        </section>

        {phase === "setup" && (
          <section className="studio-grid">
            <form className="stage-card coach-setup-card" onSubmit={startSession}>
              <div className="stage-topline">
                <p>Session setup</p>
                <p>Tavus CVI</p>
              </div>

              <label className="coach-field">
                <span>Session language</span>
                <select
                  value={language}
                  onChange={(event) =>
                    setLanguage(event.target.value as CoachV2Language)
                  }
                >
                  {COACH_V2_LANGUAGES.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="coach-field">
                <span>Customer starting emotion</span>
                <select
                  value={emotion}
                  onChange={(event) =>
                    setEmotion(event.target.value as CoachV2Emotion)
                  }
                >
                  {COACH_V2_EMOTIONS.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>

              <fieldset className="coach-fieldset">
                <legend>Customer brief</legend>
                {COACH_V2_BRIEFS.map((brief) => (
                  <label key={brief.id} className="coach-radio">
                    <input
                      type="radio"
                      name="briefId"
                      value={brief.id}
                      checked={briefId === brief.id}
                      onChange={() => setBriefId(brief.id)}
                    />
                    <span>
                      <strong>
                        {language === "zh" ? brief.labelZh : brief.label}
                      </strong>
                      <small>
                        {language === "zh" ? brief.situationZh : brief.situation}
                      </small>
                    </span>
                  </label>
                ))}
              </fieldset>

              <label className="coach-field">
                <span>
                  {language === "zh" ? "可选补充情境" : "Optional extra situation"}
                </span>
                <textarea
                  value={customSituation}
                  onChange={(event) => setCustomSituation(event.target.value)}
                  rows={3}
                  maxLength={800}
                  placeholder={
                    language === "zh"
                      ? "例如：今年预算紧张；配偶已有公司医疗保障…"
                      : "e.g. Budget is tight this year; spouse already has cover at work…"
                  }
                />
              </label>

              {error && <div className="error-panel">{error}</div>}

              <div className="control-deck">
                <button
                  className="primary-button"
                  type="submit"
                  disabled={isStarting}
                >
                  <span>
                    {isStarting ? "Starting session…" : "Start role-play"}
                  </span>
                  <b>→</b>
                </button>
              </div>
            </form>

            <aside className="conversation-card">
              <div className="conversation-heading">
                <div>
                  <p className="eyebrow">How it works</p>
                  <h2>Coach the pitch</h2>
                </div>
              </div>
              <div className="transcript-list">
                <article className="transcript-item system">
                  <p>1</p>
                  <div>
                    Choose language (English or Mandarin Chinese), emotion, and
                    brief. The PAL joins as the customer and stays in character.
                  </div>
                </article>
                <article className="transcript-item system">
                  <p>2</p>
                  <div>
                    Allow camera and mic, then practise the sale in that
                    language. The customer can shift across neutral, angry,
                    excited, elated, content, sad, dejected, scared, contempt,
                    disgusted, and surprised.
                  </div>
                </article>
                <article className="transcript-item system">
                  <p>3</p>
                  <div>
                    End the call for a spoken debrief on the PAL plus a written
                    scorecard from the transcript, in the same language.
                  </div>
                </article>
              </div>
            </aside>
          </section>
        )}

        {(phase === "live" || phase === "ending") && conversationUrl && (
          <section className="studio-grid coach-live-grid">
            <div className="stage-card coach-call-card">
              <div className="stage-topline">
                <p>
                  Live customer · {languageLabel} · {briefLabel} · {emotion}
                </p>
                <p>{phase === "ending" ? "Ending…" : "In call"}</p>
              </div>
              <div className="coach-iframe-wrap">
                <iframe
                  title="Tavus Coach v2 conversation"
                  src={conversationUrl}
                  allow="camera; microphone; fullscreen; display-capture; autoplay"
                />
              </div>
              <div className="control-deck">
                <button
                  className="round-button danger"
                  type="button"
                  onClick={endSession}
                  disabled={phase === "ending"}
                >
                  {phase === "ending" ? "Generating feedback…" : "End session"}
                </button>
              </div>
              {error && <div className="error-panel">{error}</div>}
            </div>

            <aside className="conversation-card">
              <div className="conversation-heading">
                <div>
                  <p className="eyebrow">During the call</p>
                  <h2>Tips</h2>
                </div>
              </div>
              <div className="transcript-list">
                <article className="transcript-item system">
                  <p>Role</p>
                  <div>
                    You are the insurance agent. The PAL is the customer and will
                    react to rapport, clarity, and pressure.
                  </div>
                </article>
                <article className="transcript-item system">
                  <p>Close</p>
                  <div>
                    When finished, say the meeting is over or ask how you did —
                    then press End session for the written scorecard.
                  </div>
                </article>
              </div>
            </aside>
          </section>
        )}

        {phase === "feedback" && (
          <section className="studio-grid">
            <div className="stage-card">
              <div className="stage-topline">
                <p>Session complete</p>
                <p>{briefLabel}</p>
              </div>

              {feedback ? (
                <div className="coach-feedback">
                  <div className="coach-score">
                    <span className="eyebrow">Overall score</span>
                    <strong>{feedback.overallScore}</strong>
                  </div>
                  <p className="coach-summary">{feedback.summary}</p>

                  <div className="coach-columns">
                    <div>
                      <h3>Strengths</h3>
                      <ul>
                        {feedback.strengths.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h3>Improvements</h3>
                      <ul>
                        {feedback.improvements.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="coach-note">
                    <h3>Emotion handling</h3>
                    <p>{feedback.emotionHandling}</p>
                  </div>
                  <div className="coach-note">
                    <h3>Compliance</h3>
                    <p>{feedback.complianceNote}</p>
                  </div>
                </div>
              ) : (
                <div className="standby-card coach-empty-feedback">
                  <p className="eyebrow">Feedback</p>
                  <p>
                    {feedbackNote ||
                      "Written feedback is unavailable for this session."}
                  </p>
                </div>
              )}

              {error && <div className="error-panel">{error}</div>}

              <div className="control-deck">
                <button
                  className="primary-button"
                  type="button"
                  onClick={resetToSetup}
                >
                  <span>Start another session</span>
                  <b>→</b>
                </button>
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
