import { useEffect, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { isSoundEnabled, setSoundEnabled, SOUND_CHANGE_EVENT } from "@/lib/arcade-sound";

export function SoundToggle() {
  const [enabled, setEnabled] = useState(true);
  useEffect(() => {
    setEnabled(isSoundEnabled());
    const sync = (event: Event) => setEnabled((event as CustomEvent<boolean>).detail);
    window.addEventListener(SOUND_CHANGE_EVENT, sync);
    return () => window.removeEventListener(SOUND_CHANGE_EVENT, sync);
  }, []);
  return (
    <button
      type="button"
      className="arcade-sound-toggle"
      aria-label={enabled ? "关闭游戏音效" : "开启游戏音效"}
      title={enabled ? "关闭游戏音效" : "开启游戏音效"}
      aria-pressed={enabled}
      onClick={() => {
        setEnabled(!enabled);
        setSoundEnabled(!enabled);
      }}
    >
      {enabled ? <Volume2 size={17} /> : <VolumeX size={17} />}
    </button>
  );
}
