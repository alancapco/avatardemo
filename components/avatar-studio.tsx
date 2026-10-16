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

type Speaker = "you" | "avatar" | "system";

type TranscriptItem = {
  id: string;
  speaker: Speaker;
  text: string;
};

const initialTranscript: TranscriptItem[] = [
  {
    id: "welcome",
    speaker: "system",
    text: "Start a session, allow microphone access, and speak naturally—or type a prompt below.",
  },
];

function labelForState(state: SessionState) {
  if (state === SessionState.CONNECTED) return "Live";
  if (state === SessionState.CONNECTING) return "Connecting";
  if (state === SessionState.DISCONNECTING) return "Closing";
  return "Offline";
}

/** Original Capco LiveAvatar studio demo (global context). */
export function AvatarStudio() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const sessionRef = useRef<LiveAvatarSession | null>(null);
  const keepAliveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
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
  const [prompt, setPrompt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] =
    useState<TranscriptItem[]>(initialTranscript);

  const appendTranscript = useCallback((speaker: Speaker, text: string) => {
    const normalized = text.trim();
    if (!normalized) return;
    setTranscript((items) => [
      ...items,
      { id: crypto.randomUUID(), speaker, text: normalized },
    ]);
  }, []);

  const resetRuntime = useCallback(() => {
    if (keepAliveRef.current) clearInterval(keepAliveRef.current);
    keepAliveRef.current = null;
    sessionRef.current = null;
    setIsStreamReady(false);
    setIsMuted(true);
    setIsUserTalking(false);
    setIsAvatarTalking(false);
    setConnectionQuality(ConnectionQuality.UNKNOWN);
  }, []);

  const stopSession = useCallback(async () => {
    const session = sessionRef.current;
    if (!session) return;
    try {
      session.voiceChat.stop();
      await session.stop();
    } finally {
      resetRuntime();
      setSessionState(SessionState.INACTIVE);
    }
  }, [resetRuntime]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  useEffect(() => {
    return () => {
      if (keepAliveRef.current) clearInterval(keepAliveRef.current);
      sessionRef.current?.voiceChat.stop();
      void sessionRef.current?.stop();
    };
  }, []);

  const startSession = async () => {
    if (isStarting || sessionRef.current) return;
    setIsStarting(true);
    setError(null);
    setTranscript(initialTranscript);

    try {
      console.log("Fetching session token...");
      const response = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "demo" }),
      });
      const result = (await response.json()) as {
        sessionToken?: string;
        customLlmEnabled?: boolean;
        error?: string;
      };

      console.log("Session token response:", { ok: response.ok, hasToken: !!result.sessionToken, error: result.error });

      if (!response.ok || !result.sessionToken) {
        throw new Error(result.error || "Could not create a LiveAvatar session.");
      }

      console.log("Creating LiveAvatar session with token:", result.sessionToken?.substring(0, 20) + "...");

      const session = new LiveAvatarSession(result.sessionToken, {
        voiceChat: true,
      });
      sessionRef.current = session;

      session.on(SessionEvent.SESSION_STATE_CHANGED, (state) => {
        console.log("Session state changed:", state);
        setSessionState(state);
      });
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
      });
      session.voiceChat.on(VoiceChatEvent.MUTED, () => setIsMuted(true));
      session.voiceChat.on(VoiceChatEvent.UNMUTED, () => setIsMuted(false));
      session.on(AgentEventsEnum.USER_SPEAK_STARTED, () =>
        setIsUserTalking(true),
      );
      session.on(AgentEventsEnum.USER_SPEAK_ENDED, () =>
        setIsUserTalking(false),
      );
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
        resetRuntime();
        setSessionState(SessionState.INACTIVE);
      });

      console.log("Starting session...");
      await session.start();
      console.log("Session started successfully");
      if (result.customLlmEnabled) {
        appendTranscript(
          "system",
          "Custom LLM connected. Voice and typed turns now use your configured model.",
        );
      }
      keepAliveRef.current = setInterval(() => {
        void session.keepAlive();
      }, 120_000);
    } catch (caughtError) {
      console.error("Session start error:", caughtError);
      resetRuntime();
      setSessionState(SessionState.INACTIVE);
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

  return (
    <main className="studio-shell">
      <header className="masthead">
        <div className="brand-lockup">
          <Link className="brand-wordmark" href="/">
            Capco
          </Link>
          <div className="brand-divider" aria-hidden />
          <div className="brand-copy">
            <p className="eyebrow">Expertise</p>
            <h1>Wealth &amp; Asset Management</h1>
          </div>
        </div>
        <div className="masthead-actions">
          <Link className="round-button" href="/">
            Dashboard
          </Link>
          <div className={`live-pill ${isConnected ? "is-live" : ""}`}>
            <span />
            {labelForState(sessionState)}
          </div>
        </div>
      </header>

      <div className="studio-body">
        <section className="intro-band">
          <h2>Interactive LiveAvatar experience</h2>
          <p>
            Explore how Capco can bring AI-enabled conversations to wealth and
            asset management—stronger client connections, clearer guidance, and
            lasting value.
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
                  <p className="eyebrow">Demo</p>
                  <p>{isStarting ? "Connecting…" : "Avatar on standby"}</p>
                  <small>
                    Start a session to speak with Capco’s interactive wealth
                    advisor experience.
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
              {!isConnected ? (
                <button
                  className="primary-button"
                  type="button"
                  onClick={startSession}
                  disabled={isStarting}
                >
                  <span>{isStarting ? "Connecting" : "Start live session"}</span>
                  <b>→</b>
                </button>
              ) : (
                <>
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
                    onClick={stopSession}
                  >
                    End session
                  </button>
                </>
              )}
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
                  <p>{item.speaker === "you" ? "You" : item.speaker}</p>
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
                    ? "Ask about wealth & asset management…"
                    : "Start a session to type"
                }
                disabled={!isConnected}
                aria-label="Message for avatar"
              />
              <button disabled={!isConnected || !prompt.trim()} type="submit">
                Send
              </button>
            </form>
          </aside>
        </section>
      </div>

      <footer className="footer-note">
        <span>Capco demo · Wealth &amp; Asset Management</span>
        <span>A Wipro Company</span>
      </footer>
    </main>
  );
}
