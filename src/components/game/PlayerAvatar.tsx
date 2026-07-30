import { AVATARS, type Player } from "@/lib/game-types";
import { cn } from "@/lib/utils";

const SIZES = {
  sm: "size-7 text-base",
  md: "size-9 text-lg",
  lg: "size-12 text-2xl",
} as const;

export function svgToDataUrl(svg: string) {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function InlineSvgAvatar({ svg, label, className }: { svg: string; label: string; className?: string }) {
  return (
    <span
      role="img"
      aria-label={label}
      className={cn("block h-full w-full [&>svg]:h-full [&>svg]:w-full", className)}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

export function PlayerAvatar({
  player,
  size = "md",
  className,
}: {
  player: Pick<Player, "avatar" | "avatar_svg" | "name">;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const label = `${player.name} 的角色`;

  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center overflow-hidden rounded-full border-2 border-[var(--ink)] bg-background",
        SIZES[size],
        className,
      )}
    >
      {player.avatar_svg ? (
        <InlineSvgAvatar svg={player.avatar_svg} label={label} />
      ) : (
        <span aria-label={label}>{AVATARS[player.avatar % AVATARS.length]}</span>
      )}
    </span>
  );
}
