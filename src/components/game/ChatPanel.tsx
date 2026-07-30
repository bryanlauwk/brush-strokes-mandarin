import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown, Send } from "lucide-react";
import type { ChatMessage } from "@/lib/game-types";
import { cn } from "@/lib/utils";

type Props = {
  messages: ChatMessage[];
  disabled: boolean;
  placeholder: string;
  onSend: (text: string) => void;
};

export function ChatPanel({ messages, disabled, placeholder, onSend }: Props) {
  const [value, setValue] = useState("");
  const [atBottom, setAtBottom] = useState(true);
  const composingRef = useRef(false);
  const listRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = useCallback((smooth = false) => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }, []);

  // Only follow new messages when the reader is already at the bottom.
  useEffect(() => {
    if (atBottom) scrollToBottom();
  }, [messages.length, atBottom, scrollToBottom]);

  const submit = () => {
    const text = value.trim();
    if (!text || disabled) return;
    onSend(text);
    setValue("");
    setAtBottom(true);
  };

  return (
    <div className="panel flex h-full min-h-0 flex-col overflow-hidden">
      <div className="shrink-0 border-b-2 border-[var(--ink)] bg-secondary px-3 py-2 font-display text-lg">
        💬 聊天 · 猜词
      </div>
      <div className="relative min-h-0 flex-1">
      <div
        ref={listRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 40);
        }}
        className="h-full space-y-1 overflow-y-auto overscroll-contain p-3 text-sm"
      >
        {messages.length === 0 ? (
          <div className="flex h-full min-h-32 items-center justify-center rounded-md border-2 border-dashed border-border px-3 text-center text-muted-foreground">
            等第一位玩家开口
          </div>
        ) : (
          messages.map((m) => <MessageRow key={m.id} message={m} />)
        )}
      </div>
        {!atBottom && (
          <button
            type="button"
            onClick={() => {
              setAtBottom(true);
              scrollToBottom(true);
            }}
            className="absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full border-2 border-[var(--ink)] bg-card px-3 py-1 text-xs shadow-[2px_2px_0_0_var(--ink)]"
          >
            <ArrowDown className="size-3" /> 回到最新
          </button>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2 border-t-2 border-[var(--ink)] p-2">
        <input
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          maxLength={40}
          onChange={(e) => setValue(e.target.value)}
          onCompositionStart={() => {
            composingRef.current = true;
          }}
          onCompositionEnd={() => {
            composingRef.current = false;
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !composingRef.current && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
          className="min-w-0 flex-1 rounded-md border-2 border-[var(--ink)] bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary disabled:opacity-50"
        />
        <button
          type="button"
          onClick={submit}
          disabled={disabled}
          aria-label="发送"
          className="flex size-10 shrink-0 items-center justify-center rounded-md border-2 border-[var(--ink)] bg-primary text-primary-foreground disabled:opacity-50"
        >
          <Send className="size-4" />
        </button>
      </div>
    </div>
  );
}

function MessageRow({ message }: { message: ChatMessage }) {
  if (message.kind === "correct") {
    return (
      <p className="animate-pop-in rounded-md border-2 border-[var(--success)] bg-[var(--success)]/15 px-2 py-1 font-medium text-[var(--success)]">
        <span className="mr-1">🎉</span>
        {message.text}
      </p>
    );
  }
  if (message.kind === "close") {
    return (
      <p className="animate-pop-in rounded-md bg-accent/60 px-2 py-1 text-accent-foreground">
        🔥 {message.text}
      </p>
    );
  }
  if (message.kind === "reveal") {
    return (
      <p className="stamp animate-pop-in rounded-md bg-card px-2 py-1 text-center font-display text-base">
        答案是「{message.text}」
      </p>
    );
  }
  if (message.kind === "system") {
    return <p className="px-2 py-1 text-center text-xs text-muted-foreground italic">{message.text}</p>;
  }
  return (
    <p className={cn("rounded-md bg-secondary/50 px-2 py-1 [overflow-wrap:anywhere]")}>
      <span className="font-semibold">{message.player_name}：</span>
      <span className="text-foreground/85">{message.text}</span>
    </p>
  );
}
