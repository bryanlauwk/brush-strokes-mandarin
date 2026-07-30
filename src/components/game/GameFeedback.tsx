import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { CheckCircle2, PartyPopper, Sparkles, TimerReset } from "lucide-react";

export type GameFeedbackKind = "correct" | "round-start" | "round-end";

export type GameFeedbackEvent = {
  id: number;
  kind: GameFeedbackKind;
  title: string;
  subtitle?: string;
};

type Particle = {
  id: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
  rotate: number;
  delay: number;
  size: number;
  color: string;
  shape: "dot" | "star" | "dash";
};

const COLORS = ["#f4772e", "#f7c948", "#39c0c8", "#d7263d", "#7b4bc4", "#3f9142", "#ffffff"];

export function GameFeedback({ event }: { event: GameFeedbackEvent | null }) {
  const [visible, setVisible] = useState<GameFeedbackEvent | null>(null);
  const particles = useMemo(() => (event ? makeParticles(event.kind, event.id) : []), [event]);

  useEffect(() => {
    if (!event) return;
    setVisible(event);
    playFeedbackSound(event.kind);
    const timer = window.setTimeout(() => setVisible((current) => (current?.id === event.id ? null : current)), 1700);
    return () => window.clearTimeout(timer);
  }, [event]);

  if (!visible) return null;

  const Icon = visible.kind === "correct" ? CheckCircle2 : visible.kind === "round-start" ? Sparkles : TimerReset;

  return (
    <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden" aria-live="polite" aria-atomic="true">
      <style>{feedbackCss}</style>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(247,201,72,.18),transparent_34%)]" />
      {particles.map((particle) => (
        <span
          key={`${visible.id}-${particle.id}`}
          className={`game-feedback-particle game-feedback-${particle.shape}`}
          style={
            {
              "--x": `${particle.x}vw`,
              "--y": `${particle.y}vh`,
              "--dx": `${particle.dx}px`,
              "--dy": `${particle.dy}px`,
              "--rot": `${particle.rotate}deg`,
              "--delay": `${particle.delay}ms`,
              "--size": `${particle.size}px`,
              "--color": particle.color,
            } as CSSProperties
          }
        />
      ))}

      <div className="absolute left-1/2 top-[18%] w-[min(88vw,380px)] -translate-x-1/2 text-center">
        <div className="game-feedback-card rounded-md border-2 border-[var(--ink)] bg-card px-5 py-4 shadow-[6px_6px_0_0_var(--ink)]">
          <span className="mx-auto mb-2 grid size-12 place-items-center rounded-full border-2 border-[var(--ink)] bg-accent text-primary shadow-[3px_3px_0_0_var(--ink)]">
            <Icon className="size-6" />
          </span>
          <p className="font-display text-4xl leading-none text-primary sm:text-5xl">{visible.title}</p>
          {visible.subtitle && <p className="mt-2 text-sm font-semibold text-muted-foreground">{visible.subtitle}</p>}
        </div>
      </div>
    </div>
  );
}

function makeParticles(kind: GameFeedbackKind, seed: number) {
  const count = kind === "correct" ? 44 : kind === "round-start" ? 28 : 34;
  const centerY = kind === "round-start" ? 32 : kind === "round-end" ? 46 : 38;
  const particles: Particle[] = [];
  let value = seed || 1;
  const rand = () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };

  for (let i = 0; i < count; i++) {
    const angle = -Math.PI + rand() * Math.PI * 2;
    const distance = kind === "round-start" ? 120 + rand() * 170 : 160 + rand() * 240;
    particles.push({
      id: i,
      x: 50 + (rand() - 0.5) * 14,
      y: centerY + (rand() - 0.5) * 12,
      dx: Math.cos(angle) * distance,
      dy: Math.sin(angle) * distance + 80,
      rotate: -260 + rand() * 520,
      delay: rand() * 180,
      size: 7 + rand() * 13,
      color: COLORS[Math.floor(rand() * COLORS.length)],
      shape: i % 5 === 0 ? "star" : i % 3 === 0 ? "dash" : "dot",
    });
  }
  return particles;
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
    master.gain.exponentialRampToValueAtTime(kind === "correct" ? 0.22 : 0.16, now + 0.015);
    master.gain.exponentialRampToValueAtTime(0.001, now + 0.62);
    master.connect(audio.destination);

    const notes = kind === "correct" ? [523.25, 659.25, 783.99, 1046.5] : kind === "round-start" ? [392, 523.25, 659.25] : [293.66, 246.94, 196];
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

    const closeDelay = window.setTimeout(() => void audio.close().catch(() => undefined), 900);
    window.setTimeout(() => window.clearTimeout(closeDelay), 950);
  } catch {
    /* Browsers can block audio until the first user gesture. Visual feedback still runs. */
  }
}

const feedbackCss = `
@keyframes game-feedback-card-in {
  0% { opacity: 0; transform: translateY(18px) scale(.82) rotate(-2deg); }
  58% { opacity: 1; transform: translateY(-5px) scale(1.05) rotate(1deg); }
  100% { opacity: 1; transform: translateY(0) scale(1) rotate(0deg); }
}
@keyframes game-feedback-card-out {
  0%, 72% { opacity: 1; }
  100% { opacity: 0; transform: translateY(-10px) scale(.96); }
}
@keyframes game-feedback-burst {
  0% { opacity: 0; transform: translate3d(var(--x), var(--y), 0) scale(.4) rotate(0deg); }
  12% { opacity: 1; }
  100% { opacity: 0; transform: translate3d(calc(var(--x) + var(--dx)), calc(var(--y) + var(--dy)), 0) scale(.9) rotate(var(--rot)); }
}
.game-feedback-card { animation: game-feedback-card-in 520ms cubic-bezier(.2,1.35,.35,1) both, game-feedback-card-out 1700ms ease both; }
.game-feedback-particle { position: absolute; left: 0; top: 0; width: var(--size); height: var(--size); background: var(--color); border: 2px solid var(--ink); animation: game-feedback-burst 1250ms cubic-bezier(.13,.72,.2,1) var(--delay) both; }
.game-feedback-dot { border-radius: 999px; }
.game-feedback-star { clip-path: polygon(50% 0,61% 35%,98% 35%,68% 56%,79% 91%,50% 70%,21% 91%,32% 56%,2% 35%,39% 35%); }
.game-feedback-dash { width: calc(var(--size) * 1.8); height: calc(var(--size) * .48); border-radius: 999px; }
`;

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}
