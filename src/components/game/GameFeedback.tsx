import { useEffect, useState } from "react";
import { Sparkles, Flag } from "lucide-react";
import { isSoundEnabled } from "@/lib/arcade-sound";
import { playCorrectAnswerSound } from "@/lib/feedback-sound";
import "@/styles/arcade-social.css";

export type GameFeedbackKind = "correct" | "round-start" | "round-end";

export type GameFeedbackEvent = {
  id: number;
  kind: GameFeedbackKind;
  title: string;
  subtitle?: string;
};

export function GameFeedback({ event }: { event: GameFeedbackEvent | null }) {
  const [visible, setVisible] = useState<GameFeedbackEvent | null>(event);

  useEffect(() => {
    if (!event) return;
    setVisible(event);
    if (event.kind === "correct") playCorrectAnswerSound();
    else if (isSoundEnabled()) playFeedbackSound(event.kind);
    const timer = window.setTimeout(
      () => setVisible((current) => (current?.id === event.id ? null : current)),
      1900,
    );
    return () => window.clearTimeout(timer);
  }, [event]);

  // Keep this region mounted so assistive technology sees its text update.
  // The animated version below is purely decorative and would otherwise be
  // unreliable as a just-mounted live region.
  const announcement = visible
    ? [visible.title, visible.subtitle].filter(Boolean).join("。")
    : "";
  const liveRegion = (
    <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
      {announcement}
    </p>
  );

  if (!visible) return liveRegion;

  if (visible.kind === "correct") {
    return (
      <>
        {liveRegion}
        <div key={visible.id} className="social-stamp-feedback" aria-hidden="true">
          <div className="social-stamp-content">
            <div className="social-stamp-stage">
              <span className="social-stamp-dust" />
              <div className="social-stamp-mark">
                <span className="social-stamp-club">乱画俱乐部 · 默契认证</span>
                <strong className="social-stamp-lettering">
                  <span>猜中</span>
                  <span>了啦</span>
                </strong>
                <span className="social-stamp-signoff">NAIS LAH!</span>
              </div>
            </div>
            <p className="social-stamp-title">{visible.title}</p>
            {visible.subtitle && <p className="social-stamp-subtitle">{visible.subtitle}</p>}
          </div>
        </div>
      </>
    );
  }

  const Icon = visible.kind === "round-start" ? Sparkles : Flag;
  const label = visible.kind === "round-start" ? "NEXT UP" : "THAT’S A WRAP";

  return (
    <>
      {liveRegion}
      <div
        key={visible.id}
        className={`social-feedback social-feedback-${visible.kind}`}
        aria-hidden="true"
      >
        <span className="social-feedback-icon">
          <Icon />
        </span>
        <div>
          <span className="social-feedback-label">{label}</span>
          <p className="social-feedback-title">{visible.title}</p>
          {visible.subtitle && <p className="social-feedback-subtitle">{visible.subtitle}</p>}
        </div>
        <span className="social-feedback-spark">✳</span>
      </div>
    </>
  );
}

function playFeedbackSound(kind: GameFeedbackKind) {
  if (typeof window === "undefined") return;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;

  try {
    const audio = new AudioContextClass();
    const now = audio.currentTime;
    const master = audio.createGain();
    master.gain.setValueAtTime(0.001, now);
    master.gain.exponentialRampToValueAtTime(kind === "correct" ? 0.12 : 0.08, now + 0.015);
    master.gain.exponentialRampToValueAtTime(0.001, now + 0.62);
    master.connect(audio.destination);

    const notes =
      kind === "correct"
        ? [523.25, 659.25, 783.99, 1046.5]
        : kind === "round-start"
          ? [392, 523.25, 659.25]
          : [293.66, 246.94, 196];
    notes.forEach((frequency, index) => {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      const start = now + index * 0.075;
      osc.type = kind === "round-end" ? "triangle" : "sine";
      osc.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.exponentialRampToValueAtTime(kind === "correct" ? 0.5 : 0.34, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.23);
      osc.connect(gain);
      gain.connect(master);
      osc.start(start);
      osc.stop(start + 0.26);
    });

    window.setTimeout(() => void audio.close().catch(() => undefined), 900);
  } catch {
    // Audio may be blocked until a user gesture; the visual status still appears.
  }
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}
