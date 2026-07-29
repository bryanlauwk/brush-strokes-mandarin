import { Crown, Pencil } from "lucide-react";
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
  return (
    <div className="panel flex h-full min-h-0 flex-col overflow-hidden">
      <div className="border-b-2 border-[var(--ink)] bg-secondary px-3 py-2 font-display text-lg">
        玩家 · {players.length}
      </div>
      <ul className="flex-1 divide-y divide-border overflow-y-auto">
        {ranked.map((p, i) => (
          <li
            key={p.id}
            className={cn(
              "flex items-center gap-2 px-3 py-2",
              p.has_guessed && "bg-[var(--success)]/12",
              p.id === meId && "font-semibold",
            )}
          >
            <span className="w-5 text-sm text-muted-foreground">{i + 1}</span>
            <span className="text-xl">{AVATARS[p.avatar % AVATARS.length]}</span>
            <span className="min-w-0 flex-1 truncate text-sm">
              {p.name}
              {p.id === meId && <span className="text-muted-foreground">（你）</span>}
            </span>
            {p.is_host && <Crown className="size-4 text-primary" aria-label="房主" />}
            {p.id === drawerId && <Pencil className="size-4 text-primary" aria-label="画者" />}
            <span className="tabular-nums text-sm">{p.score}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}