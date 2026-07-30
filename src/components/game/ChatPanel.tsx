import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown, CheckCircle2, Flame, MessageCircle, Send } from "lucide-react";
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
  const [unreadCount, setUnreadCount] = useState(0);
  const atBottomRef = useRef(true);
  const composingRef = useRef(false);
  const hydratedRef = useRef(false);
  const lastMessageIdRef = useRef<number | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const isNearBottom = useCallback((el: HTMLDivElement) => {
    return el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  }, []);

  const setBottomState = useCallback((next: boolean) => {
    atBottomRef.current = next;
    setAtBottom(next);
    if (next) setUnreadCount(0);
  }, []);

  const scrollToBottom = useCallback((smooth = false) => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
    setBottomState(true);
  }, [setBottomState]);

  useEffect(() => {
    if (messages.length === 0) {
      hydratedRef.current = false;
      lastMessageIdRef.current = null;
      setUnreadCount(0);
      return;
    }

    const latestId = messages[messages.length - 1]?.id ?? null;
    const previousId = lastMessageIdRef.current;
    lastMessageIdRef.current = latestId;

    if (!hydratedRef.current) {
      hydratedRef.current = true;
      requestAnimationFrame(() => scrollToBottom());
      return;
    }

    if (latestId === null || latestId === previousId) return;

    if (atBottomRef.current) {
      requestAnimationFrame(() => scrollToBottom());
      return;
    }

    const newMessages = previousId === null
      ? messages.length
      : messages.filter((message) => message.id > previousId).length;
    setUnreadCount((count) => count + Math.max(newMessages, 1));
  }, [messages, scrollToBottom]);

  const submit = () => {
    const text = value.trim();
    if (!text || disabled) return;
    onSend(text);
    setValue("");
    scrollToBottom(true);
  };

  const showJumpButton = !atBottom || unreadCount > 0;

  return (
    <div className="studio-panel flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center gap-2 border-b-2 border-[var(--ink)] bg-secondary px-3 py-2">
        <span className="grid size-8 place-items-center rounded-md border-2 border-[var(--ink)] bg-card">
          <MessageCircle className="size-4 text-primary" />
        </span>
        <div className="min-w-0">
          <p className="font-display text-lg leading-none">猜答案区</p>
          <p className="text-xs text-muted-foreground">答案、提示和欢呼都在这里</p>
        </div>
      </div>

      <div className="relative min-h-0 flex-1">
        <div
          ref={listRef}
          onScroll={(e) => {
            setBottomState(isNearBottom(e.currentTarget));
          }}
          className="h-full space-y-2 overflow-y-auto overscroll-contain p-3 text-sm"
        >
          {messages.length === 0 ? (
            <div className="flex h-full min-h-32 flex-col items-center justify-center rounded-md border-2 border-dashed border-border bg-card/55 px-4 text-center text-muted-foreground">
              <MessageCircle className="mb-2 size-6 text-primary" />
              <p className="font-medium text-foreground">这里还很安静</p>
              <p className="mt-1 text-xs">等第一位朋友开口或猜中答案。</p>
            </div>
          ) : (
            messages.map((m) => <MessageRow key={m.id} message={m} />)
          )}
        </div>
        {showJumpButton && (
          <button
            type="button"
            onClick={() => scrollToBottom(true)}
            className={cn(
              "press absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full border-2 border-[var(--ink)] px-3 py-1 text-xs shadow-[2px_2px_0_0_var(--ink)]",
              unreadCount > 0 ? "bg-primary text-primary-foreground" : "bg-card",
            )}
          >
            <ArrowDown className="size-3" />
            {unreadCount > 0 ? `${unreadCount} 条新消息` : "回到最新"}
          </button>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2 border-t-2 border-[var(--ink)] bg-card/75 p-2">
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
          className="press flex size-10 shrink-0 items-center justify-center rounded-md border-2 border-[var(--ink)] bg-primary text-primary-foreground shadow-[2px_2px_0_0_var(--ink)] disabled:translate-y-0 disabled:opacity-50"
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
      <p className="animate-pop-in flex items-start gap-2 rounded-md border-2 border-[var(--success)] bg-[var(--success)]/15 px-2 py-2 font-medium text-[var(--success)]">
        <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
        <span>{message.text}</span>
      </p>
    );
  }
  if (message.kind === "close") {
    return (
      <p className="animate-pop-in flex items-start gap-2 rounded-md bg-accent/70 px-2 py-2 text-accent-foreground">
        <Flame className="mt-0.5 size-4 shrink-0 text-primary" />
        <span>{message.text}</span>
      </p>
    );
  }
  if (message.kind === "reveal") {
    return (
      <p className="stamp animate-pop-in rounded-md bg-card px-2 py-2 text-center font-display text-base">
        答案是「{message.text}」
      </p>
    );
  }
  if (message.kind === "system") {
    return <p className="px-2 py-1 text-center text-xs text-muted-foreground italic">{message.text}</p>;
  }
  return (
    <p className={cn("rounded-md border border-border bg-secondary/45 px-2 py-2 [overflow-wrap:anywhere]")}>
      <span className="font-semibold">{message.player_name}：</span>
      <span className="text-foreground/85">{message.text}</span>
    </p>
  );
}
