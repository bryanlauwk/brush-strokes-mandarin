import { useCallback, useEffect, useRef, useState } from "react";
import { ImageIcon, RefreshCcw, Sparkles } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { generateDrawingHint } from "@/lib/drawing-hint.functions";
import { cn } from "@/lib/utils";

type Auth = {
  code: string;
  playerId: string;
  token: string;
};

type DrawingHint = {
  imageUrl: string | null;
  source: "ai" | "unavailable";
  prompt: string;
  reason?: "no-key" | "blocked" | "timeout" | "error";
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
      setStatus(next.source === "ai" && next.imageUrl ? "ready" : "error");
    } catch {
      if (requestId.current !== id) return;
      setHint(null);
      setStatus("error");
    }
  // generateFn is provided by useServerFn; the actual request should be keyed to room identity and turn only.
  }, [auth.code, auth.playerId, auth.token, turnIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setHint(null);
    void load();
  }, [load, word]);

  const imageReady = hint?.source === "ai" && !!hint.imageUrl;
  const badge = imageReady ? "AI 生成" : status === "loading" ? "准备中" : "AI 未出图";
  const failText = (() => {
    if (status === "loading") return null;
    switch (hint?.reason) {
      case "no-key":
        return { title: "AI 还没接上", hint: "稍后再试一次。" };
      case "blocked":
        return { title: "这题被模型挡下来了", hint: "点重试，换个画面再生成。" };
      case "timeout":
        return { title: "生图太慢了", hint: "网络慢了，点一下重试。" };
      default:
        return { title: "AI 图没生成", hint: "点一下重试。" };
    }
  })();

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

      <div className={cn("mt-3 overflow-hidden rounded-md border-2 border-[var(--ink)] bg-[#fff7df]", compact ? "aspect-[5/3]" : "aspect-square")}>
        {imageReady ? (
          <img src={hint.imageUrl!} alt="AI 生成的画家灵感图" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 bg-[radial-gradient(circle_at_30%_20%,#ffe0a3_0_14%,transparent_15%),linear-gradient(135deg,#fff7df,#f8e6bf)] px-4 text-center text-muted-foreground">
            <ImageIcon className={cn("text-primary", compact ? "size-6" : "size-8")} />
            <p className="text-xs font-semibold text-foreground">
              {status === "loading" ? "正在生图…" : failText?.title}
            </p>
            {failText && <p className="text-[11px] leading-4">{failText.hint}</p>}
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
          <RefreshCcw className="size-3.5" /> 重试
        </button>
      </div>
    </section>
  );
}
