import { useCallback, useEffect, useRef, useState } from "react";
import { ImageIcon, RefreshCcw, Sparkles } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { generateDrawingHint } from "@/lib/game.functions";
import { cn } from "@/lib/utils";

type Auth = {
  code: string;
  playerId: string;
  token: string;
};

type DrawingHint = {
  imageUrl: string;
  source: "ai" | "fallback";
  prompt: string;
};

type Props = {
  auth: Auth;
  turnIndex: number;
  word: string;
  compact?: boolean;
};

export function DrawingHintPanel({ auth, turnIndex, word, compact }: Props) {
  const generateFn = useServerFn(generateDrawingHint);
  const requestId = useRef(0);
  const [hint, setHint] = useState<DrawingHint | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");

  const load = useCallback(async () => {
    const id = requestId.current + 1;
    requestId.current = id;
    setStatus("loading");
    try {
      const next = await generateFn({ data: { ...auth, turnIndex } });
      if (requestId.current !== id) return;
      setHint(next);
      setStatus("ready");
    } catch {
      if (requestId.current !== id) return;
      setHint(null);
      setStatus("error");
    }
  }, [auth.code, auth.playerId, auth.token, generateFn, turnIndex]);

  useEffect(() => {
    setHint(null);
    void load();
  }, [load, word]);

  const badge = hint?.source === "ai" ? "AI 生成" : hint?.source === "fallback" ? "本机示意" : "准备中";

  return (
    <section className={cn("studio-panel overflow-hidden", compact ? "p-2" : "p-3")}>
      <div className="flex items-center gap-2">
        <span className="grid size-8 shrink-0 place-items-center rounded-md border-2 border-[var(--ink)] bg-accent">
          <Sparkles className="size-4 text-primary" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg leading-none">画家灵感图</p>
          <p className="mt-1 text-xs text-muted-foreground">只给你看</p>
        </div>
        <span className="rounded-full border-2 border-[var(--ink)] bg-card px-2 py-0.5 text-[10px] font-semibold">
          {badge}
        </span>
      </div>

      <div className={cn("mt-3 overflow-hidden rounded-md border-2 border-[var(--ink)] bg-[#fffdf7]", compact ? "aspect-[5/3]" : "aspect-square")}>
        {hint ? (
          <img src={hint.imageUrl} alt="画家灵感图" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-muted-foreground">
            <ImageIcon className={cn("text-primary", compact ? "size-6" : "size-8")} />
            <p className="text-xs">{status === "error" ? "暂时生不出来" : "正在生图…"}</p>
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground" title={word}>
          题目：{word}
        </p>
        <button
          type="button"
          onClick={() => void load()}
          disabled={status === "loading"}
          className="press flex shrink-0 items-center gap-1 rounded-md border-2 border-[var(--ink)] bg-card px-2 py-1 text-xs font-semibold shadow-[2px_2px_0_0_var(--ink)] disabled:opacity-60"
        >
          <RefreshCcw className="size-3.5" /> 换一张
        </button>
      </div>
    </section>
  );
}
