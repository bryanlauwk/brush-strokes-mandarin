import { useId, useState } from "react";
import { Check, ChevronDown, Shuffle } from "lucide-react";
import { InlineSvgAvatar } from "@/components/game/PlayerAvatar";
import { CHARACTER_AVATARS, createDefaultAvatar } from "@/lib/character-avatars";
import { cn } from "@/lib/utils";
import "@/styles/arcade-tools.css";

type Props = {
  value: string | null;
  onChange: (svg: string) => void;
  name?: string;
  compact?: boolean;
};

export function CharacterPicker({ value, onChange, name = "夜猫子", compact }: Props) {
  const [expanded, setExpanded] = useState(!compact);
  const labelId = useId();
  const gridId = useId();
  const currentSvg = value ?? createDefaultAvatar(name);
  const selected = CHARACTER_AVATARS.find((avatar) => avatar.svg === currentSvg);
  const compactAvatars = CHARACTER_AVATARS.slice(0, 4);
  if (selected && !compactAvatars.includes(selected)) compactAvatars[3] = selected;
  const visibleAvatars = expanded ? CHARACTER_AVATARS : compactAvatars;

  function pickRandom() {
    const options = CHARACTER_AVATARS.filter((avatar) => avatar.svg !== currentSvg);
    onChange(options[Math.floor(Math.random() * options.length)].svg);
  }

  return (
    <div className="arcade-character-picker">
      <div className="arcade-picker-heading">
        <span id={labelId}>选个分身，今晚放飞。</span>
        <button
          type="button"
          className="arcade-shuffle"
          onClick={pickRandom}
          aria-label="随机换一个角色"
        >
          <Shuffle size={15} aria-hidden="true" /> 随缘
        </button>
      </div>

      <div id={gridId} className="arcade-character-grid" role="group" aria-labelledby={labelId}>
        {visibleAvatars.map((avatar) => {
          const isSelected = avatar.svg === currentSvg;
          return (
            <button
              key={avatar.id}
              type="button"
              aria-pressed={isSelected}
              aria-label={`${avatar.name}：${avatar.caption}`}
              title={avatar.caption}
              onClick={() => onChange(avatar.svg)}
              className={cn("arcade-character-option", isSelected && "arcade-character-selected")}
              style={{ "--character-color": avatar.accent } as React.CSSProperties}
            >
              <span className="arcade-character-art">
                <InlineSvgAvatar svg={avatar.svg} label="" />
                {isSelected && (
                  <span className="arcade-character-check">
                    <Check size={11} strokeWidth={3} aria-hidden="true" />
                  </span>
                )}
              </span>
              <span className="arcade-character-name">{avatar.name}</span>
            </button>
          );
        })}
      </div>

      <div className="arcade-character-caption" aria-live="polite">
        <span>{selected?.caption ?? "今晚的神秘嘉宾，已就位。"}</span>
        {compact && (
          <button
            type="button"
            className="arcade-picker-expand"
            aria-expanded={expanded}
            aria-controls={gridId}
            onClick={() => setExpanded((current) => !current)}
          >
            {expanded ? "收起" : "全部 8 位"}
            <ChevronDown size={13} className={expanded ? "arcade-rotate" : ""} aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}
