import { useEffect, useState } from "react";
import { Check, Crown, Pencil, Trophy, WifiOff } from "lucide-react";
import { PlayerAvatar } from "@/components/game/PlayerAvatar";
import type { Player } from "@/lib/game-types";
import { loadAvatarSvg } from "@/lib/player-identity";
import { cn } from "@/lib/utils";
import "@/styles/arcade-social.css";

export function Scoreboard({
  players,
  drawerId,
  meId,
  meAvatarSvg,
  variant = "list",
}: {
  players: Player[];
  drawerId: string | null;
  meId: string | null;
  meAvatarSvg?: string | null;
  variant?: "list" | "strip";
}) {
  const [localAvatarSvg, setLocalAvatarSvg] = useState<string | null>(null);
  const ranked = [...players].sort((a, b) => b.score - a.score);
  const topScore = ranked[0]?.score ?? 0;

  useEffect(() => {
    setLocalAvatarSvg(loadAvatarSvg());
  }, [meId]);

  const fallbackSvg = meAvatarSvg ?? localAvatarSvg;
  const withFallback = (player: Player) =>
    player.id === meId && !player.avatar_svg && fallbackSvg
      ? { ...player, avatar_svg: fallbackSvg }
      : player;

  const roster = ranked.map((player, index) => {
    const drawing = player.id === drawerId;
    const guessed = player.has_guessed && !drawing;
    const away = player.connection_status === "disconnected";
    const StatusIcon = away
      ? WifiOff
      : drawing
        ? Pencil
        : guessed
          ? Check
          : player.is_host
            ? Crown
            : null;
    const status = away
      ? "暂时离开"
      : drawing
        ? "正在乱画"
        : guessed
          ? "猜中啦"
          : player.is_host
            ? "房主"
            : "准备开猜";
    const leading = topScore > 0 && player.score === topScore;

    return (
      <li
        key={player.id}
        className={cn(
          "social-player",
          drawing && "social-player-drawing",
          guessed && "social-player-guessed",
          away && "social-player-away",
          player.id === meId && "social-player-me",
        )}
        title={`${player.name} · ${player.score} 分 · ${status}`}
      >
        <span className="social-player-rank" aria-label={`第 ${index + 1} 名`}>
          {String(index + 1).padStart(2, "0")}
        </span>
        <PlayerAvatar player={withFallback(player)} size={variant === "strip" ? "sm" : "md"} />
        <div className="social-player-info">
          <p className="social-player-name">
            <span>{player.name}</span>
            {player.id === meId && <small>你</small>}
          </p>
          <span className="social-player-status">
            {StatusIcon && <StatusIcon aria-hidden="true" />}
            {status}
          </span>
        </div>
        <div className={cn("social-player-score", leading && "social-player-leading")}>
          {leading && variant === "list" && <Trophy aria-label="领先" />}
          <strong>{player.score}</strong>
          <span className="sr-only">分</span>
        </div>
      </li>
    );
  });

  if (variant === "strip") {
    return (
      <section className="social-roster-strip" aria-label="玩家与分数，可左右滚动查看" tabIndex={0}>
        <ul>{roster}</ul>
      </section>
    );
  }

  return (
    <section className="social-roster" aria-label="玩家排行榜">
      <header className="social-roster-header">
        <div>
          <span className="social-eyebrow">THE LINEUP</span>
          <h2>今晚这班人</h2>
        </div>
        <span className="social-roster-count" aria-label={`${players.length} 位玩家`}>
          {String(players.length).padStart(2, "0")}
        </span>
      </header>
      <ul className="social-roster-list">{roster}</ul>
      <p className="social-roster-footnote">画技随意，默契第一。</p>
    </section>
  );
}
