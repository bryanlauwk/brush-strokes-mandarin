import { useEffect, useRef, useState } from "react";
import { CheckCircle2, ChevronDown, Shuffle, Sparkles } from "lucide-react";
import { InlineSvgAvatar } from "@/components/game/PlayerAvatar";
import { CHARACTER_AVATARS, createDefaultAvatar, type CharacterAvatar } from "@/lib/character-avatars";
import { cn } from "@/lib/utils";

type Props = {
  value: string | null;
  onChange: (svg: string) => void;
  name?: string;
  compact?: boolean;
};

export function CharacterPicker({ value, onChange, name = "画画人", compact }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const active = CHARACTER_AVATARS.find((avatar) => avatar.svg === value) ?? null;
  const groups = groupCharacters(CHARACTER_AVATARS);
  const currentSvg = value ?? createDefaultAvatar(name);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const pickRandom = () => {
    const seed = Date.now() + Math.floor(Math.random() * 1000);
    const avatar = CHARACTER_AVATARS[seed % CHARACTER_AVATARS.length] ?? CHARACTER_AVATARS[0];
    onChange(avatar.svg);
    setOpen(false);
  };

  const selectAvatar = (svg: string) => {
    onChange(svg);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative">
      <label className="mb-2 block text-sm font-semibold" id="character-picker-label">
        角色
      </label>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby="character-picker-label"
        onClick={() => setOpen((current) => !current)}
        className={cn(
          "press flex w-full items-center gap-3 rounded-md border-2 border-[var(--ink)] bg-card px-3 py-2 text-left shadow-[3px_3px_0_0_var(--ink)]",
          open && "bg-[var(--wash)]",
        )}
      >
        <span className="relative grid size-14 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-[var(--ink)] bg-secondary">
          <InlineSvgAvatar svg={currentSvg} label="目前角色" />
          <span className="absolute right-0 bottom-0 grid size-4 place-items-center rounded-full border-2 border-[var(--ink)] bg-[var(--success)] text-white">
            <CheckCircle2 className="size-2.5" />
          </span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-lg leading-none text-primary">已选角色</span>
          <span className="mt-1 inline-flex items-center gap-1 rounded-full border-2 border-[var(--ink)] bg-accent px-2 py-0.5 text-[11px] font-semibold">
            <Sparkles className="size-3" /> {active?.group ?? "漫画风"}
          </span>
        </span>
        <ChevronDown className={cn("size-5 shrink-0 text-primary transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 z-30 mt-2 rounded-md border-2 border-[var(--ink)] bg-card p-3 shadow-[5px_5px_0_0_var(--ink)]">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-muted-foreground">选择一个头像</p>
            <button
              type="button"
              onClick={pickRandom}
              className="press inline-flex shrink-0 items-center gap-1 rounded-md border-2 border-[var(--ink)] bg-secondary px-2 py-1 text-xs font-semibold shadow-[2px_2px_0_0_var(--ink)]"
            >
              <Shuffle className="size-3.5" /> 随机
            </button>
          </div>

          <div className="max-h-[min(55vh,420px)] space-y-3 overflow-y-auto pr-1" role="radiogroup" aria-label="选择入场角色">
            {groups.map(([group, avatars]) => (
              <section key={group}>
                <p className="mb-2 text-xs font-semibold text-muted-foreground">{group}</p>
                <div className={cn("grid gap-2", compact ? "grid-cols-5" : "grid-cols-5")}>
                  {avatars.map((avatar, index) => {
                    const selected = avatar.svg === value;
                    return (
                      <button
                        key={avatar.id}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        aria-label={`${group}角色 ${index + 1}`}
                        title={`${group}角色 ${index + 1}`}
                        onClick={() => selectAvatar(avatar.svg)}
                        className={cn(
                          "press relative aspect-square min-w-0 overflow-hidden rounded-full border-2 border-[var(--ink)] bg-secondary shadow-[2px_2px_0_0_var(--ink)] transition-transform hover:-translate-y-0.5 focus-visible:z-10",
                          selected && "ring-4 ring-primary ring-offset-2 ring-offset-card",
                        )}
                      >
                        <InlineSvgAvatar svg={avatar.svg} label={`${group}角色 ${index + 1}`} />
                        {selected && (
                          <span className="absolute right-0 top-0 grid size-5 place-items-center rounded-full border-2 border-[var(--ink)] bg-[var(--success)] text-white">
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
      )}
    </div>
  );
}

function groupCharacters(avatars: CharacterAvatar[]) {
  const order = ["圆脸漫画风", "动漫风", "超英风"] as const;
  return order.map((group) => [group, avatars.filter((avatar) => avatar.group === group)] as const);
}
