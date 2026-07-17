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
import { useCallback, useEffect, useRef, useState } from "react";
import { RPQ_DISCLAIMER, RPQ_QUESTIONS, RPQ_SECTIONS } from "@/lib/rpq/questionnaire";
import type { RpqAnswer, RpqQuestion } from "@/types/rpq";

type Phase = "consent" | "ready" | "active" | "segment-break" | "saving";
type MatchResponse = {
  status: "matched" | "ambiguous" | "unmatched";
  optionIds: string[];
};

function promptFor(question: RpqQuestion) {
  return `Question ${question.number}. ${question.prompt.en} Please choose one of the five options shown on screen, or say the option number.`;
}

export function RpqAssessment() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const sessionRef = useRef<LiveAvatarSession | null>(null);
  const keepAliveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionIdRef = useRef<string | undefined>(undefined);
  const answersRef = useRef<RpqAnswer[]>([]);
  const busyRef = useRef(false);
  const videoReadyRef = useRef(false);
  const connectedRef = useRef(false);
  const pendingQuestionRef = useRef<RpqQuestion | null>(null);
  const currentQuestionRef = useRef<RpqQuestion | undefined>(undefined);
  const currentIndexRef = useRef(0);
  const avatarTalkingRef = useRef(false);
  const matchingRef = useRef(false);
  const listeningAfterRef = useRef(0);

  const [phase, setPhase] = useState<Phase>("consent");
  const [sessionState, setSessionState] = useState(SessionState.INACTIVE);
  const [quality, setQuality] = useState(ConnectionQuality.UNKNOWN);
  const [streamReady, setStreamReady] = useState(false);
  const [muted, setMuted] = useState(true);
  const [avatarTalking, setAvatarTalking] = useState(false);
  const [userTalking, setUserTalking] = useState(false);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<RpqAnswer[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [undoAnswer, setUndoAnswer] = useState<RpqAnswer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [matching, setMatching] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [avatarPrompt, setAvatarPrompt] = useState("");

  const question = RPQ_QUESTIONS[index];
  const section = question ? RPQ_SECTIONS.find((item) => item.id === question.sectionId) : null;
  const segmentNumber = Math.min(4, Math.floor(index / 3) + 1);

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  useEffect(() => {
    currentQuestionRef.current = question;
    currentIndexRef.current = index;
  }, [index, question]);

  // LiveAvatar can emit SESSION_STREAM_READY before the RPQ stage is rendered.
  // Attach whenever both the stream and the <video> element are now available.
  useEffect(() => {
    if (!streamReady || phase !== "active") return;
    const session = sessionRef.current;
    if (session && videoRef.current) session.attach(videoRef.current);
  }, [phase, streamReady]);

  const speakQuestion = useCallback((nextQuestion: RpqQuestion) => {
    const session = sessionRef.current;
    if (!session || !videoReadyRef.current || !connectedRef.current) {
      pendingQuestionRef.current = nextQuestion;
      return;
    }
    try {
      // FULL Mode starts with the context opening text. The RPQ application
      // owns progression, so stop that generic turn before speaking the exact
      // on-screen question.
      session.interrupt();
      setAvatarPrompt(nextQuestion.prompt.en);
      session.repeat(promptFor(nextQuestion));
    } catch {
      pendingQuestionRef.current = nextQuestion;
    }
  }, []);

  const endSegment = useCallback(async () => {
    if (keepAliveRef.current) clearInterval(keepAliveRef.current);
    keepAliveRef.current = null;
    const session = sessionRef.current;
    sessionRef.current = null;
    videoReadyRef.current = false;
    connectedRef.current = false;
    setStreamReady(false);
    setAvatarTalking(false);
    setUserTalking(false);
    setSessionState(SessionState.INACTIVE);
    if (session) {
      try {
        session.voiceChat.stop();
        await session.stop();
      } catch {
        // The platform may already have stopped a sandbox session.
      }
    }
    setPhase("segment-break");
  }, []);

  const advance = useCallback((answer: RpqAnswer) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setAnswers((previous) => [...previous.filter((item) => item.questionId !== answer.questionId), answer]);
    setUndoAnswer(answer);
    setSelected([]);
    const nextIndex = currentIndexRef.current + 1;
    currentIndexRef.current = nextIndex;
    setIndex(nextIndex);
    window.setTimeout(() => {
      busyRef.current = false;
      if (nextIndex < RPQ_QUESTIONS.length) {
        if (nextIndex % 3 === 0) void endSegment();
        else speakQuestion(RPQ_QUESTIONS[nextIndex]);
      }
    }, 250);
    window.setTimeout(() => setUndoAnswer(null), 8_000);
  }, [endSegment, speakQuestion]);

  const accept = useCallback((optionIds: string[], source: RpqAnswer["source"]) => {
    const activeQuestion = currentQuestionRef.current;
    if (!activeQuestion || optionIds.length === 0) return;
    advance({
      questionId: activeQuestion.id,
      optionIds,
      source,
      answeredAt: new Date().toISOString(),
    });
  }, [advance]);

  const processSpeech = useCallback(async (text: string) => {
    const activeQuestion = currentQuestionRef.current;
    if (
      !activeQuestion ||
      busyRef.current ||
      matchingRef.current ||
      avatarTalkingRef.current ||
      Date.now() < listeningAfterRef.current
    ) {
      return;
    }
    matchingRef.current = true;
    setMatching(true);
    try {
      const response = await fetch("/api/rpq/match-answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: activeQuestion.id, utterance: text }),
      });
      const result = (await response.json()) as MatchResponse & { error?: string };
      if (
        response.ok &&
        result.status === "matched" &&
        result.optionIds.length &&
        currentQuestionRef.current?.id === activeQuestion.id
      ) {
        accept(result.optionIds, "speech");
      } else {
        setError("I could not confidently match that answer. Please repeat it or choose an option.");
        sessionRef.current?.repeat("I could not confidently match that answer. Please repeat it, or choose an option on screen.");
      }
    } catch {
      setError("Speech answer matching is temporarily unavailable. Please select an option.");
    } finally {
      matchingRef.current = false;
      setMatching(false);
    }
  }, [accept]);

  const startSession = async () => {
    if (isStarting || sessionRef.current) return;
    setIsStarting(true);
    setError(null);
    setStreamReady(false);
    videoReadyRef.current = false;
    connectedRef.current = false;
    try {
      const response = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "rpq" }),
      });
      const result = (await response.json()) as { sessionToken?: string; sessionId?: string; error?: string };
      if (!response.ok || !result.sessionToken) throw new Error(result.error || "Could not start LiveAvatar.");
      sessionIdRef.current = result.sessionId;
      const session = new LiveAvatarSession(result.sessionToken, { voiceChat: true });
      sessionRef.current = session;
      session.on(SessionEvent.SESSION_STATE_CHANGED, (nextState) => {
        setSessionState(nextState);
        connectedRef.current = nextState === SessionState.CONNECTED;
        if (
          nextState === SessionState.CONNECTED &&
          videoReadyRef.current &&
          pendingQuestionRef.current
        ) {
          const pending = pendingQuestionRef.current;
          pendingQuestionRef.current = null;
          speakQuestion(pending);
        }
      });
      session.on(SessionEvent.SESSION_CONNECTION_QUALITY_CHANGED, setQuality);
      session.on(SessionEvent.SESSION_STREAM_READY, async () => {
        videoReadyRef.current = true;
        setStreamReady(true);
        if (videoRef.current) session.attach(videoRef.current);
        try {
          await session.voiceChat.start();
        } catch {
          setError("The avatar is live, but microphone access was blocked. You can still use answer controls.");
        }
        const segmentQuestion = currentQuestionRef.current ?? RPQ_QUESTIONS[0];
        if (connectedRef.current) {
          speakQuestion(segmentQuestion);
        } else {
          pendingQuestionRef.current = segmentQuestion;
        }
      });
      session.voiceChat.on(VoiceChatEvent.MUTED, () => setMuted(true));
      session.voiceChat.on(VoiceChatEvent.UNMUTED, () => setMuted(false));
      session.on(AgentEventsEnum.USER_SPEAK_STARTED, () => setUserTalking(true));
      session.on(AgentEventsEnum.USER_SPEAK_ENDED, () => setUserTalking(false));
      session.on(AgentEventsEnum.AVATAR_SPEAK_STARTED, () => {
        avatarTalkingRef.current = true;
        setAvatarTalking(true);
      });
      session.on(AgentEventsEnum.AVATAR_SPEAK_ENDED, () => {
        avatarTalkingRef.current = false;
        // Ignore the microphone's tail/echo after the avatar finishes.
        listeningAfterRef.current = Date.now() + 500;
        setAvatarTalking(false);
      });
      session.on(AgentEventsEnum.AVATAR_TRANSCRIPTION, ({ text }) =>
        setAvatarPrompt(text),
      );
      session.on(AgentEventsEnum.USER_TRANSCRIPTION, ({ text }) => {
        // Do not allow the generic context agent to answer freely; only the
        // deterministic RPQ state machine can advance the questionnaire.
        if (connectedRef.current) session.interrupt();
        void processSpeech(text);
      });
      session.on(AgentEventsEnum.SESSION_STOPPED, () => {
        if (sessionRef.current !== session) return;
        void endSegment();
      });
      // Render the stage before starting so its video element is available to
      // the stream-ready handler.
      setPhase("active");
      await session.start();
      keepAliveRef.current = setInterval(() => void session.keepAlive(), 120_000);
    } catch (caught) {
      if (keepAliveRef.current) clearInterval(keepAliveRef.current);
      keepAliveRef.current = null;
      const staleSession = sessionRef.current;
      if (staleSession) await staleSession.stop().catch(() => undefined);
      sessionRef.current = null;
      videoReadyRef.current = false;
      connectedRef.current = false;
      setError(caught instanceof Error ? caught.message : "Could not start the RPQ session.");
      setPhase("ready");
    } finally {
      setIsStarting(false);
    }
  };

  const undo = () => {
    if (!undoAnswer || busyRef.current) return;
    const questionIndex = RPQ_QUESTIONS.findIndex((item) => item.id === undoAnswer.questionId);
    setAnswers((previous) => previous.filter((item) => item.questionId !== undoAnswer.questionId));
    setIndex(questionIndex);
    setSelected(undoAnswer.optionIds);
    setUndoAnswer(null);
    speakQuestion(RPQ_QUESTIONS[questionIndex]);
  };

  const saveAssessment = async () => {
    if (answers.length !== RPQ_QUESTIONS.length) return;
    setPhase("saving");
    try {
      const response = await fetch("/api/rpq/assessments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers, sessionId: sessionIdRef.current }),
      });
      const result = (await response.json()) as { assessment?: { id: string }; error?: string };
      if (!response.ok || !result.assessment) throw new Error(result.error || "Could not save your assessment.");
      const session = sessionRef.current;
      sessionRef.current = null;
      await session?.stop();
      window.location.assign(`/rpq/results/${result.assessment.id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save your assessment.");
      setPhase("active");
    }
  };

  useEffect(() => () => {
    if (keepAliveRef.current) clearInterval(keepAliveRef.current);
    void sessionRef.current?.stop();
  }, []);

  if (phase === "consent") {
    return (
      <main className="studio-shell">
        <header className="masthead"><div className="brand-lockup"><Link className="brand-wordmark" href="/">Capco</Link><div className="brand-divider" /><div className="brand-copy"><p className="eyebrow">LiveAvatar</p><h1>Risk Profile Questionnaire</h1></div></div></header>
        <div className="studio-body"><section className="rpq-consent panel-card"><p className="eyebrow">Before you begin</p><h2>Risk Profile Questionnaire</h2><p>風險評估問卷</p><p>{RPQ_DISCLAIMER}</p><p className="muted">問卷結果只供教育示範用途，並非投資建議。任何投資決定前必須由合資格顧問審閱結果。</p><button className="primary-button" onClick={() => setPhase("ready")}><span>I understand / 我明白</span><b>→</b></button></section></div>
      </main>
    );
  }

  if (phase === "ready") {
    return <main className="studio-shell"><header className="masthead"><div className="brand-lockup"><Link className="brand-wordmark" href="/">Capco</Link><div className="brand-divider" /><div className="brand-copy"><p className="eyebrow">LiveAvatar</p><h1>Risk Profile Questionnaire</h1></div></div></header><div className="studio-body"><section className="rpq-consent panel-card"><p className="eyebrow">12 questions</p><h2>Meet your LiveAvatar facilitator</h2><p>The avatar speaks English. Questions and answer options are shown in English and Traditional Chinese.</p>{error && <div className="error-panel">{error}</div>}<button className="primary-button" onClick={startSession} disabled={isStarting}><span>{isStarting ? "Connecting avatar…" : "Start assessment"}</span><b>→</b></button></section></div></main>;
  }

  if (phase === "segment-break") {
    return (
      <main className="studio-shell">
        <header className="masthead"><div className="brand-lockup"><Link className="brand-wordmark" href="/">Capco</Link><div className="brand-divider" /><div className="brand-copy"><p className="eyebrow">LiveAvatar</p><h1>Risk Profile Questionnaire</h1></div></div></header>
        <div className="studio-body">
          <section className="rpq-consent panel-card">
            <p className="eyebrow">Session {segmentNumber - 1} complete</p>
            <h2>Continue to the next section</h2>
            <p>
              Your first {index} answers remain in this assessment. To respect the
              LiveAvatar sandbox time limit, the next three questions will start
              in a fresh avatar session.
            </p>
            <p className="rpq-zh">已保留您的答案。下一節將以新的 LiveAvatar 連線繼續進行三條問題。</p>
            {error && <div className="error-panel">{error}</div>}
            <button className="primary-button" onClick={startSession} disabled={isStarting}>
              <span>{isStarting ? "Connecting avatar…" : `Start session ${segmentNumber} of 4`}</span>
              <b>→</b>
            </button>
          </section>
        </div>
      </main>
    );
  }

  if (!question) {
    return <main className="studio-shell"><div className="studio-body"><section className="rpq-consent panel-card"><h2>Assessment complete</h2>{error && <div className="error-panel">{error}</div>}<button className="primary-button" disabled={phase === "saving"} onClick={saveAssessment}><span>{phase === "saving" ? "Saving…" : "View result"}</span><b>→</b></button></section></div></main>;
  }

  return (
    <main className="studio-shell rpq-shell">
      <header className="masthead"><div className="brand-lockup"><Link className="brand-wordmark" href="/">Capco</Link><div className="brand-divider" /><div className="brand-copy"><p className="eyebrow">LiveAvatar</p><h1>Risk Profile Questionnaire</h1></div></div><div className="live-pill is-live"><span />{sessionState === SessionState.CONNECTED ? "Live" : "Connecting"}</div></header>
      <div className="studio-body">
        <section className="rpq-grid">
          <aside className="rpq-question-pane">
            <div className="rpq-progress"><span>Session {segmentNumber} of 4 · {section?.title.en} · {section?.title.zh}</span><strong>{index + 1} / 12</strong></div>
            <div className="rpq-history">{answers.map((answer) => { const answered = RPQ_QUESTIONS.find((item) => item.id === answer.questionId)!; return <p key={answer.questionId}>✓ {answered.number}. {answered.prompt.en}</p>; })}</div>
            {avatarPrompt && <div className="rpq-avatar-caption"><p className="eyebrow">Avatar is saying</p><p>{avatarPrompt}</p></div>}
            <article className="rpq-question-card">
              <p className="eyebrow">Question {question.number}</p>
              <h2>{question.prompt.en}</h2><p className="rpq-zh">{question.prompt.zh}</p>
              {question.footnote && <p className="muted">{question.footnote.en}<br />{question.footnote.zh}</p>}
              <div className="rpq-options">
                {question.options.map((option, optionIndex) => <label className={`rpq-option ${selected.includes(option.id) ? "is-selected" : ""}`} key={option.id}><input type={question.type === "multi" ? "checkbox" : "radio"} name={question.id} checked={selected.includes(option.id)} onChange={() => { if (question.type === "single") accept([option.id], "control"); else setSelected((current) => current.includes(option.id) ? current.filter((id) => id !== option.id) : [...current, option.id]); }} /><span><b>{optionIndex + 1}. {option.label.en}</b><small>{option.label.zh}</small></span></label>)}
              </div>
              {question.type === "multi" && <button className="primary-button" disabled={!selected.length} onClick={() => accept(selected, "control")}><span>Continue / 繼續</span><b>→</b></button>}
            </article>
            {undoAnswer && <div className="rpq-undo">Answer saved. <button onClick={undo}>Undo / 更改答案</button></div>}
            {error && <div className="error-panel">{error}</div>}
            {matching && <p className="muted">Matching spoken answer…</p>}
          </aside>
          <section className="stage-card rpq-avatar-stage"><div className="stage-topline"><p>LiveAvatar facilitator</p><p>{quality}</p></div><div className="video-frame"><video ref={videoRef} autoPlay playsInline />{!streamReady && <div className="standby-card"><p className="eyebrow">RPQ</p><p>Avatar on standby</p></div>}<div className="talking-badges"><span className={userTalking ? "active user" : ""}><i /> You</span><span className={avatarTalking ? "active avatar" : ""}><i /> Avatar</span></div></div><div className="control-deck"><button className="round-button" onClick={() => muted ? sessionRef.current?.voiceChat.unmute() : sessionRef.current?.voiceChat.mute()}>{muted ? "Mic off" : "Mic live"}</button><button className="round-button" onClick={() => speakQuestion(question)}>Repeat question</button><button className="round-button danger" onClick={() => void saveAssessment()} disabled={answers.length !== 12}>Finish</button></div></section>
        </section>
      </div>
    </main>
  );
}
