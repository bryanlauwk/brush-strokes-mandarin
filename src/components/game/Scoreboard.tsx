import { useEffect, useState } from "react";
import { Check, Crown, Pencil, Trophy, UsersRound } from "lucide-react";
import { PlayerAvatar } from "@/components/game/PlayerAvatar";
import type { Player } from "@/lib/game-types";
import { loadAvatarSvg } from "@/lib/player-identity";
import { cn } from "@/lib/utils";

export function Scoreboard({
  players,
  drawerId,
  meId,
  meAvatarSvg,
}: {
  players: Player[];
  drawerId: string | null;
  meId: string | null;
  meAvatarSvg?: string | null;
}) {
  const [localAvatarSvg, setLocalAvatarSvg] = useState<string | null>(null);
  const ranked = [...players].sort((a, b) => b.score - a.score);
  const topScore = ranked[0]?.score ?? 0;

  useEffect(() => {
    setLocalAvatarSvg(loadAvatarSvg());
  }, [meId]);

  return (
    <div className="studio-panel flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center gap-2 border-b-2 border-[var(--ink)] bg-secondary px-3 py-2">
        <span className="grid size-8 place-items-center rounded-md border-2 border-[var(--ink)] bg-card">
          <Trophy className="size-4 text-primary" />
        </span>
        <div className="min-w-0">
          <p className="font-display text-lg leading-none">分数榜</p>
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <UsersRound className="size-3" /> {players.length} 人在线
          </p>
        </div>
      </div>

      <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
        {ranked.map((p, i) => {
          const scoreWidth = topScore > 0 ? Math.max(12, Math.round((p.score / topScore) * 100)) : 0;
          const fallbackSvg = meAvatarSvg ?? localAvatarSvg;
          const displayPlayer = p.id === meId && !p.avatar_svg && fallbackSvg ? { ...p, avatar_svg: fallbackSvg } : p;
          return (
            <li
              key={p.id}
              title={p.name}
              className={cn(
                "relative overflow-hidden rounded-md border-2 border-border bg-card px-2 py-2 transition-colors",
                p.has_guessed && "border-[var(--success)]/60 bg-[var(--success)]/10",
                p.id === drawerId && "border-primary/70 bg-accent/55",
                p.id === meId && "border-[var(--ink)]",
              )}
            >
              {scoreWidth > 0 && (
                <span
                  className="absolute inset-y-0 left-0 bg-primary/10"
                  style={{ width: `${scoreWidth}%` }}
                />
              )}
              <div className="relative grid grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-x-2">
                <span className="w-5 shrink-0 text-center font-display text-sm text-primary">{i + 1}</span>
                <PlayerAvatar
                  player={displayPlayer}
                  className={cn(i === 0 && "bg-[var(--gold)]/60", p.id === drawerId && "bg-primary/15")}
                />
                <span className="min-w-0 text-sm leading-tight break-words [overflow-wrap:anywhere] line-clamp-2">
                  {p.name}
                  {p.id === meId && <span className="text-muted-foreground">（你）</span>}
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  {p.is_host && <Crown className="size-3.5 text-primary" aria-label="主持人" />}
                  {p.id === drawerId && (
                    <Pencil className="size-3.5 origin-bottom animate-wiggle text-primary" aria-label="画的人" />
                  )}
                  {p.has_guessed && p.id !== drawerId && (
                    <Check className="size-3.5 text-[var(--success)]" aria-label="已猜中" />
                  )}
                  <span className="tabular-nums text-sm font-semibold">{p.score}</span>
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
