import { Link } from "@tanstack/react-router";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      to="/"
      className={`arcade-brand${compact ? " arcade-brand--compact" : ""}`}
      aria-label="乱画俱乐部 · 回到首页"
    >
      <svg className="arcade-brand-mark" viewBox="0 0 40 40" fill="none" aria-hidden="true">
        <path
          d="M19 2 24 11 34 7 30 17 39 21 29 25 32 35 22 30 16 39 13 28 2 30 8 20 1 13 13 13Z"
          fill="currentColor"
        />
        <path d="m15 17 2 6m7-8-1 6" stroke="#101014" strokeWidth="3" strokeLinecap="round" />
      </svg>
      <span>
        <span className="arcade-brand-name">乱画俱乐部</span>
        <span className="arcade-brand-sub">AFTERHOURS DRAW CLUB</span>
      </span>
    </Link>
  );
}
