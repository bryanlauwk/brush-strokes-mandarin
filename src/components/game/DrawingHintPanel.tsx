import { useCallback, useEffect, useRef, useState } from "react";
import { EyeOff, Lightbulb, RefreshCcw, Sparkles } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { generateDrawingHint } from "@/lib/drawing-hint.functions";
import { cn } from "@/lib/utils";
import "@/styles/arcade-social.css";

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
    return () => {
      requestId.current += 1;
    };
  }, [load, word]);

  const imageReady = hint?.source === "ai" && !!hint.imageUrl;
  const failText = (() => {
    if (status === "loading") return null;
    switch (hint?.reason) {
      case "no-key":
        return { title: "灵感暂时缺席", hint: "随手画也可以，朋友会懂的。" };
      case "blocked":
        return { title: "这题靠你发挥了", hint: "也可以点刷新，换个灵感。" };
      case "timeout":
        return { title: "灵感来得有点慢", hint: "先动笔，或点刷新再试一次。" };
      default:
        return { title: "灵感还没跟上", hint: "随手画，或点刷新再试一次。" };
    }
  })();

  return (
    <section
      className={cn("social-hint", compact && "social-hint-compact")}
      aria-label="仅画画的人可见的参考图"
    >
      <div className="social-hint-header">
        <span className="social-hint-icon">
          <Lightbulb aria-hidden="true" />
        </span>
        <div>
          <h3>灵感小抄</h3>
          <span>
            <EyeOff aria-hidden="true" />
            只有你看得到
          </span>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={status === "loading"}
          className="social-hint-refresh"
          aria-label="重新生成参考图"
          title="刷新灵感"
        >
          <RefreshCcw aria-hidden="true" />
        </button>
      </div>

      <div className="social-hint-image" aria-busy={status === "loading"}>
        {imageReady ? (
          <img src={hint.imageUrl!} alt={`${word}的绘画参考`} />
        ) : (
          <div className="social-hint-placeholder" role="status">
            <Sparkles aria-hidden="true" />
            <p>{status === "loading" ? "给你的灵感正在路上…" : failText?.title}</p>
            {failText && <span>{failText.hint}</span>}
          </div>
        )}
      </div>

      <p className="social-hint-footer">灵感参考而已。你的画风，你说了算。</p>
    </section>
  );
}
