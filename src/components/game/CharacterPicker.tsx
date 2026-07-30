import { CheckCircle2, Shuffle, Sparkles } from "lucide-react";
import { svgToDataUrl } from "@/components/game/PlayerAvatar";
import { CHARACTER_AVATARS, createDefaultAvatar, type CharacterAvatar } from "@/lib/character-avatars";
import { cn } from "@/lib/utils";

type Props = {
  value: string | null;
  onChange: (svg: string) => void;
  name?: string;
  compact?: boolean;
};

export function CharacterPicker({ value, onChange, name = "画画人", compact }: Props) {
  const active = CHARACTER_AVATARS.find((avatar) => avatar.svg === value) ?? null;
  const groups = groupCharacters(CHARACTER_AVATARS);

  const pickRandom = () => {
    const seed = Date.now() + Math.floor(Math.random() * 1000);
    const avatar = CHARACTER_AVATARS[seed % CHARACTER_AVATARS.length] ?? CHARACTER_AVATARS[0];
    onChange(avatar.svg);
  };

  return (
    <div className={cn("rounded-md border-2 border-[var(--ink)] bg-card/85 p-3", compact && "p-2")}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-lg leading-none text-primary">选择角色</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            选一个漫画头像登场，马上开玩。
          </p>
        </div>
        <button
          type="button"
          onClick={pickRandom}
          className="press inline-flex shrink-0 items-center gap-1 rounded-md border-2 border-[var(--ink)] bg-secondary px-2 py-1 text-xs font-semibold shadow-[2px_2px_0_0_var(--ink)]"
        >
          <Shuffle className="size-3.5" /> 随机
        </button>
      </div>

      <div className="mt-3 grid grid-cols-[64px_minmax(0,1fr)] gap-3 rounded-md border-2 border-border bg-[var(--wash)]/70 p-2">
        <span className="relative grid size-16 place-items-center overflow-hidden rounded-full border-2 border-[var(--ink)] bg-secondary shadow-[2px_2px_0_0_var(--ink)]">
          <img src={svgToDataUrl(value ?? createDefaultAvatar(name))} alt="目前角色" className="h-full w-full object-cover" />
          <span className="absolute right-0 bottom-0 grid size-5 place-items-center rounded-full border-2 border-[var(--ink)] bg-[var(--success)] text-white">
            <CheckCircle2 className="size-3" />
          </span>
        </span>
        <div className="min-w-0 self-center">
          <span className="block truncate font-display text-lg text-foreground">{active?.name ?? "默认角色"}</span>
          <span className="mt-1 inline-flex items-center gap-1 rounded-full border-2 border-[var(--ink)] bg-accent px-2 py-0.5 text-[11px] font-semibold">
            <Sparkles className="size-3" /> {active?.group ?? "漫画风"}
          </span>
        </div>
      </div>

      <div className="mt-3 space-y-3" role="radiogroup" aria-label="选择入场角色">
        {groups.map(([group, avatars]) => (
          <section key={group}>
            <p className="mb-2 text-xs font-semibold text-muted-foreground">{group}</p>
            <div className={cn("grid gap-2", compact ? "grid-cols-5" : "grid-cols-5 sm:grid-cols-5")}>
              {avatars.map((avatar) => {
                const selected = avatar.svg === value;
                return (
                  <button
                    key={avatar.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    title={`${avatar.name} · ${avatar.caption}`}
                    onClick={() => onChange(avatar.svg)}
                    className={cn(
                      "press relative aspect-square overflow-hidden rounded-full border-2 border-[var(--ink)] bg-secondary shadow-[2px_2px_0_0_var(--ink)] transition-transform hover:-translate-y-0.5 focus-visible:z-10",
                      selected && "ring-4 ring-primary ring-offset-2 ring-offset-card",
                    )}
                  >
                    <img src={svgToDataUrl(avatar.svg)} alt={avatar.name} className="h-full w-full object-cover" />
                    {selected && (
                      <span className="absolute right-0 bottom-0 grid size-5 place-items-center rounded-full border-2 border-[var(--ink)] bg-[var(--success)] text-white">
                        <CheckCircle2 className="size-3" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function groupCharacters(avatars: CharacterAvatar[]) {
  const order = ["哥妹俩风", "动漫风", "超英风"] as const;
  return order.map((group) => [group, avatars.filter((avatar) => avatar.group === group)] as const);
}
