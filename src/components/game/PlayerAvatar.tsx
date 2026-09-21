import { type Player } from "@/lib/game-types";
import { CHARACTER_AVATARS } from "@/lib/character-avatars";
import { cn } from "@/lib/utils";

const SIZES = {
  sm: "size-7 text-base",
  md: "size-9 text-lg",
  lg: "size-12 text-2xl",
} as const;

export function svgToDataUrl(svg: string) {
  const namespacedSvg = /\sxmlns\s*=/.test(svg)
    ? svg
    : svg.replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" ');
  return `data:image/svg+xml;utf8,${encodeURIComponent(namespacedSvg)}`;
}

export function InlineSvgAvatar({
  svg,
  label,
  className,
}: {
  svg: string;
  label: string;
  className?: string;
}) {
  return (
    <img
      src={svgToDataUrl(svg)}
      alt={label}
      draggable={false}
      width={128}
      height={128}
      className={cn("block h-full w-full object-contain", className)}
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
        "grid shrink-0 place-items-center overflow-hidden rounded-xl border border-border bg-[#17171d]",
        SIZES[size],
        className,
      )}
    >
      {player.avatar_svg ? (
        <InlineSvgAvatar svg={player.avatar_svg} label={label} />
      ) : (
        <InlineSvgAvatar
          svg={CHARACTER_AVATARS[Math.abs(player.avatar) % CHARACTER_AVATARS.length].svg}
          label={label}
        />
      )}
    </span>
  );
}
