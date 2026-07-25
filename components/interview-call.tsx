"use client";

import {
  AgentEventsEnum,
  ConnectionQuality,
  LiveAvatarSession,
  SessionEvent,
  SessionState,
  VoiceChatEvent,
} from "@heygen/liveavatar-web-sdk";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import type { Interview, TranscriptItem } from "@/types/interview";

type Phase = "lobby" | "live" | "segment-break" | "done";

const SANDBOX_WRAP_MS = 50_000;
const COVERED_SUMMARY_MAX = 800;

function labelForState(state: SessionState) {
  if (state === SessionState.CONNECTED) return "Live";
  if (state === SessionState.CONNECTING) return "Connecting";
  if (state === SessionState.DISCONNECTING) return "Closing";
  return "Offline";
}

function buildCoveredSummary(items: TranscriptItem[]): string {
  const lines = items
    .filter((t) => t.speaker === "you" || t.speaker === "avatar")
    .map((t) => `${t.speaker === "you" ? "Candidate" : "Interviewer"}: ${t.text}`);
  const joined = lines.join("\n");
  if (joined.length <= COVERED_SUMMARY_MAX) return joined;
  return `…${joined.slice(-(COVERED_SUMMARY_MAX - 1))}`;
}

/**
 * Candidate LiveAvatar interview — same Capco studio shell as the original
 * avatar demo (video avatar + mic + transcript), scoped to an interview context.
 * Sandbox mode splits into one question per ~1 min session.
 */
export function InterviewCall({ interviewId }: { interviewId: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const sessionRef = useRef<LiveAvatarSession | null>(null);
  const keepAliveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wrapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const startedAtRef = useRef<number | null>(null);
  const tabSwitchRef = useRef(0);
  const transcriptRef = useRef<TranscriptItem[]>([]);
  const sessionIdRef = useRef<string | undefined>(undefined);
  const submittedRef = useRef(false);
  const endingIntentionallyRef = useRef(false);
  const segmentIndexRef = useRef(0);
  const segmentCountRef = useRef(1);
  const isSandboxRef = useRef(false);

  const [phase, setPhase] = useState<Phase>("lobby");
  const [interview, setInterview] = useState<Interview | null>(null);
  const [isSandbox, setIsSandbox] = useState(false);
  const [segmentIndex, setSegmentIndex] = useState(0);
  const [segmentCount, setSegmentCount] = useState(1);
  const [candidateName, setCandidateName] = useState("");
  const [sessionState, setSessionState] = useState<SessionState>(
    SessionState.INACTIVE,
  );
  const [connectionQuality, setConnectionQuality] = useState<ConnectionQuality>(
    ConnectionQuality.UNKNOWN,
  );
  const [isStreamReady, setIsStreamReady] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isUserTalking, setIsUserTalking] = useState(false);
  const [isAvatarTalking, setIsAvatarTalking] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [responseId, setResponseId] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptItem[]>([
    {
      id: "welcome",
      speaker: "system",
      text: "Start the LiveAvatar session, allow microphone access, and speak with your interviewer—or type below.",
    },
  ]);

  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  useEffect(() => {
    segmentIndexRef.current = segmentIndex;
  }, [segmentIndex]);

  useEffect(() => {
    segmentCountRef.current = segmentCount;
  }, [segmentCount]);

  useEffect(() => {
    isSandboxRef.current = isSandbox;
  }, [isSandbox]);

  useEffect(() => {
    fetch(`/api/interviews/${interviewId}`)
      .then(async (res) => {
        const data = (await res.json()) as {
          interview?: Interview;
          isSandbox?: boolean;
          error?: string;
        };
        if (!res.ok) throw new Error(data.error || "Interview not found.");
        setInterview(data.interview ?? null);
        const sandbox = Boolean(data.isSandbox);
        setIsSandbox(sandbox);
        isSandboxRef.current = sandbox;
        if (data.interview) {
          const count = Math.max(1, data.interview.questions.length);
          setSegmentCount(count);
          segmentCountRef.current = count;
        }
      })
      .catch((caught) =>
        setError(
          caught instanceof Error ? caught.message : "Failed to load interview.",
        ),
      );
  }, [interviewId]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden && phase === "live") {
        tabSwitchRef.current += 1;
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [phase]);

  const appendTranscript = useCallback(
    (speaker: TranscriptItem["speaker"], text: string) => {
      const normalized = text.trim();
      if (!normalized) return;
      const item: TranscriptItem = {
        id: crypto.randomUUID(),
        speaker,
        text: normalized,
        at: new Date().toISOString(),
      };
      setTranscript((items) => [...items, item]);
    },
    [],
  );

  const clearWrapTimer = useCallback(() => {
    if (wrapTimerRef.current) {
      clearTimeout(wrapTimerRef.current);
      wrapTimerRef.current = null;
    }
  }, []);

  const resetRuntime = useCallback(() => {
    if (keepAliveRef.current) clearInterval(keepAliveRef.current);
    keepAliveRef.current = null;
    clearWrapTimer();
    sessionRef.current = null;
    setIsStreamReady(false);
    setIsMuted(true);
    setIsUserTalking(false);
    setIsAvatarTalking(false);
    setConnectionQuality(ConnectionQuality.UNKNOWN);
  }, [clearWrapTimer]);

  const submitResponse = useCallback(async () => {
    if (submittedRef.current || isSubmitting) return;
    submittedRef.current = true;
    setIsSubmitting(true);
    setError(null);
    try {
      const durationSec = startedAtRef.current
        ? Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000))
        : 0;
      const res = await fetch("/api/responses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          interviewId,
          candidateName: candidateName.trim() || "Candidate",
          transcript: transcriptRef.current.filter((t) => t.speaker !== "system"),
          durationSec,
          tabSwitchCount: tabSwitchRef.current,
          callSessionId: sessionIdRef.current,
          analyze: true,
        }),
      });
      const data = (await res.json()) as {
        response?: { id: string };
        error?: string;
        warning?: string;
      };
      if (!res.ok || !data.response) {
        throw new Error(data.error || "Could not save interview response.");
      }
      if (data.warning) setError(data.warning);
      setResponseId(data.response.id);
      setPhase("done");
    } catch (caught) {
      submittedRef.current = false;
      setError(
        caught instanceof Error ? caught.message : "Failed to submit response.",
      );
      setPhase("done");
    } finally {
      setIsSubmitting(false);
    }
  }, [candidateName, interviewId, isSubmitting]);

  const handleSessionStopped = useCallback(() => {
    resetRuntime();
    setSessionState(SessionState.INACTIVE);
    if (endingIntentionallyRef.current) {
      endingIntentionallyRef.current = false;
      return;
    }
    const sandbox = isSandboxRef.current;
    const index = segmentIndexRef.current;
    const count = segmentCountRef.current;
    if (sandbox && index + 1 < count) {
      setSegmentIndex(index + 1);
      setPhase("segment-break");
      return;
    }
    void submitResponse();
  }, [resetRuntime, submitResponse]);

  const stopSession = useCallback(
    async (submit: boolean) => {
      endingIntentionallyRef.current = true;
      const session = sessionRef.current;
      if (session) {
        try {
          session.voiceChat.stop();
          await session.stop();
        } catch {
          // ignore stop errors
        }
      }
      resetRuntime();
      setSessionState(SessionState.INACTIVE);
      if (submit) await submitResponse();
      else setPhase("done");
    },
    [resetRuntime, submitResponse],
  );

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  useEffect(() => {
    return () => {
      if (keepAliveRef.current) clearInterval(keepAliveRef.current);
      if (wrapTimerRef.current) clearTimeout(wrapTimerRef.current);
      sessionRef.current?.voiceChat.stop();
      void sessionRef.current?.stop();
    };
  }, []);

  const startSession = async (nextSegmentIndex?: number) => {
    if (isStarting || sessionRef.current) return;
    const index = nextSegmentIndex ?? segmentIndex;
    setIsStarting(true);
    setError(null);
    endingIntentionallyRef.current = false;

    const isContinuation = phase === "segment-break" || index > 0;
    if (!isContinuation) {
      setTranscript([
        {
          id: "welcome",
          speaker: "system",
          text: "Connecting your LiveAvatar interviewer…",
        },
      ]);
      tabSwitchRef.current = 0;
      submittedRef.current = false;
      startedAtRef.current = Date.now();
      setSegmentIndex(0);
      segmentIndexRef.current = 0;
    } else {
      appendTranscript(
        "system",
        `Connecting for question ${index + 1} of ${segmentCountRef.current}…`,
      );
    }

    setPhase("live");

    try {
      const coveredSummary =
        isContinuation && isSandboxRef.current
          ? buildCoveredSummary(transcriptRef.current)
          : undefined;

      const response = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          interviewId,
          ...(isSandboxRef.current && {
            segmentIndex: index,
            ...(coveredSummary && { coveredSummary }),
          }),
        }),
      });
      const result = (await response.json()) as {
        sessionToken?: string;
        sessionId?: string;
        customLlmEnabled?: boolean;
        isSandbox?: boolean;
        segmentIndex?: number;
        segmentCount?: number;
        questionText?: string;
        error?: string;
      };

      if (!response.ok || !result.sessionToken) {
        throw new Error(result.error || "Could not create a LiveAvatar session.");
      }

      if (typeof result.isSandbox === "boolean") {
        setIsSandbox(result.isSandbox);
        isSandboxRef.current = result.isSandbox;
      }
      if (typeof result.segmentCount === "number") {
        setSegmentCount(result.segmentCount);
        segmentCountRef.current = result.segmentCount;
      }
      if (typeof result.segmentIndex === "number") {
        setSegmentIndex(result.segmentIndex);
        segmentIndexRef.current = result.segmentIndex;
      }

      sessionIdRef.current = result.sessionId;
      const session = new LiveAvatarSession(result.sessionToken, {
        voiceChat: true,
      });
      sessionRef.current = session;

      session.on(SessionEvent.SESSION_STATE_CHANGED, setSessionState);
      session.on(
        SessionEvent.SESSION_CONNECTION_QUALITY_CHANGED,
        setConnectionQuality,
      );
      session.on(SessionEvent.SESSION_STREAM_READY, async () => {
        setIsStreamReady(true);
        if (videoRef.current) session.attach(videoRef.current);
        try {
          await session.voiceChat.start();
        } catch {
          setError(
            "The avatar is live, but microphone access was blocked. You can still use text prompts.",
          );
        }
        if (isSandboxRef.current) {
          clearWrapTimer();
          wrapTimerRef.current = setTimeout(() => {
            appendTranscript(
              "system",
              "We may need a short pause soon to continue with the next question…",
            );
            try {
              session.message(
                "Please wrap up this question briefly—we will continue after a short pause.",
              );
            } catch {
              // session may already be closing
            }
          }, SANDBOX_WRAP_MS);
        }
      });
      session.voiceChat.on(VoiceChatEvent.MUTED, () => setIsMuted(true));
      session.voiceChat.on(VoiceChatEvent.UNMUTED, () => setIsMuted(false));
      session.on(AgentEventsEnum.USER_SPEAK_STARTED, () => setIsUserTalking(true));
      session.on(AgentEventsEnum.USER_SPEAK_ENDED, () => setIsUserTalking(false));
      session.on(AgentEventsEnum.AVATAR_SPEAK_STARTED, () =>
        setIsAvatarTalking(true),
      );
      session.on(AgentEventsEnum.AVATAR_SPEAK_ENDED, () =>
        setIsAvatarTalking(false),
      );
      session.on(AgentEventsEnum.USER_TRANSCRIPTION, ({ text }) =>
        appendTranscript("you", text),
      );
      session.on(AgentEventsEnum.AVATAR_TRANSCRIPTION, ({ text }) =>
        appendTranscript("avatar", text),
      );
      session.on(AgentEventsEnum.SESSION_STOPPED, () => {
        if (sessionRef.current !== session) return;
        handleSessionStopped();
      });

      await session.start();
      appendTranscript(
        "system",
        result.customLlmEnabled
          ? "LiveAvatar connected with your custom LLM. Speak naturally with the interviewer."
          : isSandboxRef.current
            ? `LiveAvatar connected (question ${index + 1} of ${segmentCountRef.current}). Speak naturally.`
            : "LiveAvatar connected. Speak naturally with the interviewer.",
      );
      keepAliveRef.current = setInterval(() => {
        void session.keepAlive();
      }, 120_000);
    } catch (caughtError) {
      resetRuntime();
      setSessionState(SessionState.INACTIVE);
      setPhase(isContinuation ? "segment-break" : "lobby");
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "The LiveAvatar session could not start.",
      );
    } finally {
      setIsStarting(false);
    }
  };

  const toggleMute = async () => {
    const voiceChat = sessionRef.current?.voiceChat;
    if (!voiceChat) return;
    if (isMuted) await voiceChat.unmute();
    else await voiceChat.mute();
  };

  const sendPrompt = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const message = prompt.trim();
    if (!message || sessionState !== SessionState.CONNECTED) return;
    sessionRef.current?.message(message);
    appendTranscript("you", message);
    setPrompt("");
  };

  const isConnected = sessionState === SessionState.CONNECTED;

  if (phase === "done") {
    return (
      <main className="studio-shell">
        <header className="masthead">
          <div className="brand-lockup">
            <span className="brand-wordmark">Capco</span>
            <div className="brand-divider" aria-hidden />
            <div className="brand-copy">
              <p className="eyebrow">Interview complete</p>
              <h1>Wealth &amp; Asset Management</h1>
            </div>
          </div>
        </header>
        <div className="studio-body">
          <section className="intro-band">
            <h2>Thank you, {candidateName || "candidate"}</h2>
            <p>
              Your LiveAvatar interview has been submitted. The hiring team will
              review the conversation and AI-generated insights.
            </p>
          </section>
          <section className="panel-card thank-you-card">
            {error && <div className="error-panel">{error}</div>}
            {responseId && (
              <p className="muted">
                Reference ID: <code>{responseId}</code>
              </p>
            )}
            {isSubmitting && <p className="muted">Saving and analysing…</p>}
            <Link className="primary-button" href="/">
              <span>Done</span>
              <b>→</b>
            </Link>
          </section>
        </div>
        <footer className="footer-note">
          <span>Capco · LiveAvatar interview</span>
          <span>A Wipro Company</span>
        </footer>
      </main>
    );
  }

  if (phase === "segment-break") {
    return (
      <main className="studio-shell">
        <header className="masthead">
          <div className="brand-lockup">
            <span className="brand-wordmark">Capco</span>
            <div className="brand-divider" aria-hidden />
            <div className="brand-copy">
              <p className="eyebrow">LiveAvatar interview</p>
              <h1>Wealth &amp; Asset Management</h1>
            </div>
          </div>
        </header>
        <div className="studio-body">
          <section className="panel-card lobby-card">
            <p className="eyebrow">
              Question {segmentIndex} of {segmentCount} complete
            </p>
            <h2>Continue to the next question</h2>
            <p>
              Your answers so far are saved in this session. Free LiveAvatar
              sandbox sessions last about one minute, so the next question starts
              in a fresh avatar connection.
            </p>
            {error && <div className="error-panel">{error}</div>}
            <button
              className="primary-button"
              type="button"
              disabled={isStarting}
              onClick={() => startSession(segmentIndex)}
            >
              <span>
                {isStarting
                  ? "Connecting avatar…"
                  : `Continue · question ${segmentIndex + 1} of ${segmentCount}`}
              </span>
              <b>→</b>
            </button>
            <button
              className="round-button danger"
              type="button"
              style={{ marginTop: "0.75rem" }}
              disabled={isSubmitting}
              onClick={() => stopSession(true)}
            >
              {isSubmitting ? "Submitting…" : "End interview early"}
            </button>
          </section>
        </div>
        <footer className="footer-note">
          <span>Capco demo · LiveAvatar interviewer</span>
          <span>A Wipro Company</span>
        </footer>
      </main>
    );
  }

  if (phase === "lobby") {
    return (
      <main className="studio-shell">
        <header className="masthead">
          <div className="brand-lockup">
            <span className="brand-wordmark">Capco</span>
            <div className="brand-divider" aria-hidden />
            <div className="brand-copy">
              <p className="eyebrow">LiveAvatar interview</p>
              <h1>Wealth &amp; Asset Management</h1>
            </div>
          </div>
        </header>
        <div className="studio-body">
          <section className="intro-band">
            <h2>{interview?.name ?? "Loading interview…"}</h2>
            <p>
              {interview?.description ||
                interview?.objective ||
                "You will meet a Capco LiveAvatar interviewer on video—speak naturally, just as you would in person."}
            </p>
          </section>
          {error && <div className="error-panel">{error}</div>}
          <section className="panel-card lobby-card">
            <p className="eyebrow">Before you begin</p>
            <h2>Meet your AI interviewer</h2>
            <p>
              This is a full LiveAvatar session: realtime video avatar, lip-sync,
              and conversational voice—not a phone-only call.
            </p>
            <ul className="lobby-meta">
              <li>
                Estimated duration: {interview?.estimatedDurationMin ?? "—"} minutes
              </li>
              <li>{interview?.questions.length ?? 0} questions</li>
              <li>Camera view of the avatar · microphone required</li>
              {isSandbox && (
                <li>
                  Short pauses between questions may occur (sandbox session limit)
                </li>
              )}
            </ul>
            <label>
              Your name
              <input
                value={candidateName}
                onChange={(e) => setCandidateName(e.target.value)}
                placeholder="Full name"
                required
              />
            </label>
            <button
              className="primary-button"
              type="button"
              disabled={!candidateName.trim() || !interview || isStarting}
              onClick={() => startSession(0)}
            >
              <span>
                {isStarting ? "Connecting avatar…" : "Start LiveAvatar interview"}
              </span>
              <b>→</b>
            </button>
          </section>
        </div>
        <footer className="footer-note">
          <span>Capco demo · LiveAvatar interviewer</span>
          <span>A Wipro Company</span>
        </footer>
      </main>
    );
  }

  /* —— Live stage: original Capco avatar studio layout —— */
  return (
    <main className="studio-shell">
      <header className="masthead">
        <div className="brand-lockup">
          <span className="brand-wordmark">Capco</span>
          <div className="brand-divider" aria-hidden />
          <div className="brand-copy">
            <p className="eyebrow">LiveAvatar interview</p>
            <h1>Wealth &amp; Asset Management</h1>
          </div>
        </div>
        <div className="masthead-actions">
          <div className={`live-pill ${isConnected ? "is-live" : ""}`}>
            <span />
            {labelForState(sessionState)}
            {isSandbox && segmentCount > 1
              ? ` · Q${segmentIndex + 1}/${segmentCount}`
              : ""}
          </div>
        </div>
      </header>

      <div className="studio-body">
        <section className="intro-band">
          <h2>{interview?.name ?? "Interactive avatar interview"}</h2>
          <p>
            You are speaking with Capco’s LiveAvatar interviewer
            {candidateName ? ` — ${candidateName}` : ""}. Answer out loud; the
            avatar sees and responds in realtime.
          </p>
        </section>

        <section className="studio-grid">
          <div className="stage-card">
            <div className="stage-topline">
              <p>LiveAvatar session</p>
              <p>{connectionQuality}</p>
            </div>

            <div className="video-frame">
              <video ref={videoRef} autoPlay playsInline />
              {!isStreamReady && (
                <div className="standby-card">
                  <p className="eyebrow">Interview</p>
                  <p>{isStarting ? "Connecting…" : "Avatar on standby"}</p>
                  <small>
                    Your LiveAvatar interviewer will appear here in a moment.
                  </small>
                </div>
              )}
              <div className="talking-badges">
                <span className={isUserTalking ? "active user" : ""}>
                  <i /> You
                </span>
                <span className={isAvatarTalking ? "active avatar" : ""}>
                  <i /> Avatar
                </span>
              </div>
            </div>

            <div className="control-deck">
              <button className="round-button" type="button" onClick={toggleMute}>
                {isMuted ? "Mic off" : "Mic live"}
              </button>
              <button
                className="round-button"
                type="button"
                onClick={() => sessionRef.current?.interrupt()}
              >
                Interrupt
              </button>
              <button
                className="round-button danger"
                type="button"
                onClick={() => stopSession(true)}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Submitting…" : "End interview"}
              </button>
            </div>
          </div>

          <aside className="conversation-card">
            <div className="conversation-heading">
              <div>
                <p className="eyebrow">Live transcript</p>
                <h2>Conversation</h2>
              </div>
              <span>{transcript.length.toString().padStart(2, "0")}</span>
            </div>

            <div className="transcript-list" aria-live="polite">
              {transcript.map((item) => (
                <article className={`transcript-item ${item.speaker}`} key={item.id}>
                  <p>
                    {item.speaker === "you"
                      ? "You"
                      : item.speaker === "avatar"
                        ? "Avatar"
                        : "System"}
                  </p>
                  <div>{item.text}</div>
                </article>
              ))}
              <div ref={transcriptEndRef} />
            </div>

            {error && <div className="error-panel">{error}</div>}

            <form className="prompt-bar" onSubmit={sendPrompt}>
              <input
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder={
                  isConnected
                    ? "Type a response if needed…"
                    : "Waiting for LiveAvatar…"
                }
                disabled={!isConnected}
                aria-label="Message for avatar interviewer"
              />
              <button disabled={!isConnected || !prompt.trim()} type="submit">
                Send
              </button>
            </form>
          </aside>
        </section>
      </div>

      <footer className="footer-note">
        <span>Capco · LiveAvatar interview · Wealth &amp; Asset Management</span>
        <span>A Wipro Company</span>
      </footer>
    </main>
  );
}
