import { useEffect, useState } from "react";
import { Check, Sparkles, Flag } from "lucide-react";
import { isSoundEnabled } from "@/lib/arcade-sound";
import "@/styles/arcade-social.css";

export type GameFeedbackKind = "correct" | "round-start" | "round-end";

export type GameFeedbackEvent = {
  id: number;
  kind: GameFeedbackKind;
  title: string;
  subtitle?: string;
};

export function GameFeedback({ event }: { event: GameFeedbackEvent | null }) {
  const [visible, setVisible] = useState<GameFeedbackEvent | null>(null);

  useEffect(() => {
    if (!event) return;
    setVisible(event);
    if (isSoundEnabled()) playFeedbackSound(event.kind);
    const timer = window.setTimeout(
      () => setVisible((current) => (current?.id === event.id ? null : current)),
      1900,
    );
    return () => window.clearTimeout(timer);
  }, [event]);

  if (!visible) return null;

  const Icon =
    visible.kind === "correct" ? Check : visible.kind === "round-start" ? Sparkles : Flag;
  const label =
    visible.kind === "correct"
      ? "NAIS LAH!"
      : visible.kind === "round-start"
        ? "NEXT UP"
        : "THAT’S A WRAP";

  return (
    <div
      key={visible.id}
      className={`social-feedback social-feedback-${visible.kind}`}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <span className="social-feedback-icon" aria-hidden="true">
        <Icon />
      </span>
      <div>
        <span className="social-feedback-label">{label}</span>
        <p className="social-feedback-title">{visible.title}</p>
        {visible.subtitle && <p className="social-feedback-subtitle">{visible.subtitle}</p>}
      </div>
      <span className="social-feedback-spark" aria-hidden="true">
        ✳
      </span>
    </div>
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
