import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  ArrowDown,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Flame,
  MessageCircle,
  Send,
} from "lucide-react";
import type { ChatMessage } from "@/lib/game-types";
import { cn } from "@/lib/utils";

type Props = {
  messages: ChatMessage[];
  disabled: boolean;
  placeholder: string;
  onSend: (text: string) => void;
  expanded?: boolean;
  onToggleExpanded?: () => void;
};

export function ChatPanel({
  messages,
  disabled,
  placeholder,
  onSend,
  expanded,
  onToggleExpanded,
}: Props) {
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

  const scrollToBottom = useCallback(
    (smooth = false) => {
      const el = listRef.current;
      if (!el) return;
      if (smooth) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
      else el.scrollTop = el.scrollHeight;
      setBottomState(true);
    },
    [setBottomState],
  );

  // Run after the new rows are committed to the DOM so scrollHeight already
  // includes the incoming message. A normal effect plus rAF could lose a race
  // with the one-second room polling render.
  useLayoutEffect(() => {
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
      scrollToBottom();
      return;
    }

    if (latestId === null || latestId === previousId) return;

    if (atBottomRef.current) {
      scrollToBottom();
      return;
    }

    const newMessages =
      previousId === null
        ? messages.length
        : messages.filter((message) => message.id > previousId).length;
    setUnreadCount((count) => count + Math.max(newMessages, 1));
  }, [messages, scrollToBottom]);

  // Keep the bottom anchored when the panel itself changes height (desktop
  // grid resize, mobile sheet opening, or virtual keyboard). Manual readers
  // who scrolled up are deliberately left where they are.
  useEffect(() => {
    const el = listRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      if (atBottomRef.current) el.scrollTop = el.scrollHeight;
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const submit = () => {
    const text = value.trim();
    if (!text || disabled) return;
    onSend(text);
    setValue("");
    scrollToBottom(true);
  };

  const showJumpButton = !atBottom || unreadCount > 0;

  return (
    <div className="studio-panel flex h-full max-h-full min-h-0 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center gap-2 border-b-2 border-[var(--ink)] bg-secondary px-3 py-1.5 sm:py-2">
        <span className="grid size-7 place-items-center rounded-md border-2 border-[var(--ink)] bg-card sm:size-8">
          <MessageCircle className="size-4 text-primary" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-base leading-none sm:text-lg">答题室</p>
          <p className="hidden text-xs text-muted-foreground sm:block">
            答案、提示和欢呼都在这里
          </p>
        </div>
        {onToggleExpanded && (
          <button
            type="button"
            onClick={onToggleExpanded}
            aria-label={expanded ? "收起答题室" : "展开答题室"}
            aria-expanded={expanded}
            className="press grid size-9 shrink-0 place-items-center rounded-md border-2 border-[var(--ink)] bg-card shadow-[2px_2px_0_0_var(--ink)] lg:hidden"
          >
            {expanded ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}
          </button>
        )}
      </div>

      <div className="relative min-h-0 flex-1">
        <div
          ref={listRef}
          onScroll={(e) => {
            setBottomState(isNearBottom(e.currentTarget));
          }}
          className="h-full min-h-0 space-y-2 overflow-y-auto overscroll-contain p-3 text-sm"
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

      <div className="flex shrink-0 items-center gap-2 border-t-2 border-[var(--ink)] bg-card/75 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] lg:pb-2">
        <input
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          maxLength={40}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => scrollToBottom()}
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
          className="min-w-0 flex-1 rounded-md border-2 border-[var(--ink)] bg-background px-3 py-2.5 text-base outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary disabled:opacity-50 sm:py-2 sm:text-sm"
        />
        <button
          type="button"
          onClick={submit}
          disabled={disabled}
          aria-label="发送"
          className="press flex size-11 shrink-0 items-center justify-center rounded-md border-2 border-[var(--ink)] bg-primary text-primary-foreground shadow-[2px_2px_0_0_var(--ink)] disabled:translate-y-0 disabled:opacity-50 sm:size-10"
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
    return (
      <p className="px-2 py-1 text-center text-xs text-muted-foreground italic">{message.text}</p>
    );
  }
  return (
    <p
      className={cn(
        "rounded-md border border-border bg-secondary/45 px-2 py-2 [overflow-wrap:anywhere]",
      )}
    >
      <span className="font-semibold">{message.player_name}：</span>
      <span className="text-foreground/85">{message.text}</span>
    </p>
  );
}
