import { Check, Crown, Pencil } from "lucide-react";
import { AVATARS, type Player } from "@/lib/game-types";
import { cn } from "@/lib/utils";

export function Scoreboard({
  players,
  drawerId,
  meId,
}: {
  players: Player[];
  drawerId: string | null;
  meId: string | null;
}) {
  const ranked = [...players].sort((a, b) => b.score - a.score);
  const medals = ["🥇", "🥈", "🥉"];
  return (
    <div className="panel flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center gap-2 border-b-2 border-[var(--ink)] bg-secondary px-3 py-2 font-display text-lg">
        <span>🏆 玩家</span>
        <span className="ml-auto rounded-full border-2 border-[var(--ink)] bg-card px-2 text-sm tabular-nums">
          {players.length}
        </span>
      </div>
      <ul className="min-h-0 flex-1 divide-y divide-border overflow-y-auto">
        {ranked.map((p, i) => (
          <li
            key={p.id}
            title={p.name}
            className={cn(
              "grid grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-x-2 px-3 py-2 transition-colors",
              p.has_guessed && "bg-[var(--success)]/12",
              p.id === drawerId && "bg-accent/50",
              p.id === meId && "font-semibold",
            )}
          >
            <span className="w-4 shrink-0 text-center text-xs text-muted-foreground">
              {medals[i] ?? i + 1}
            </span>
            <span
              className={cn(
                "grid size-8 shrink-0 place-items-center rounded-full border-2 border-[var(--ink)] bg-background text-lg",
                p.id === drawerId && "bg-primary/15",
              )}
            >
              {AVATARS[p.avatar % AVATARS.length]}
            </span>
            <span className="min-w-0 text-sm leading-tight break-words [overflow-wrap:anywhere] line-clamp-2">
              {p.name}
              {p.id === meId && <span className="text-muted-foreground">（你）</span>}
            </span>
            <span className="flex shrink-0 items-center gap-1">
              {p.is_host && <Crown className="size-3.5 text-primary" aria-label="房主" />}
              {p.id === drawerId && (
                <Pencil className="size-3.5 origin-bottom animate-wiggle text-primary" aria-label="画者" />
              )}
              {p.has_guessed && p.id !== drawerId && (
                <Check className="size-3.5 text-[var(--success)]" aria-label="已猜对" />
              )}
              <span className="tabular-nums text-sm">{p.score}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}