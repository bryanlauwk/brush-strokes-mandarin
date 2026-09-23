import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  ArrowDown,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Flame,
  MessageCircle,
  ArrowUp,
  Sparkles,
  LoaderCircle,
  RotateCcw,
} from "lucide-react";
import type { ChatMessage } from "@/lib/game-types";
import { cn } from "@/lib/utils";
import "@/styles/arcade-social.css";

type Props = {
  messages: ChatMessage[];
  disabled: boolean;
  placeholder: string;
  onSend: (text: string) => void | Promise<{ correct?: boolean; close?: boolean } | void>;
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
  const [sending, setSending] = useState(false);
  const [sendStatus, setSendStatus] = useState("");
  const [failedTexts, setFailedTexts] = useState<string[]>([]);
  const sendingRef = useRef(false);
  const draftRevisionRef = useRef(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
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
      if (smooth && !window.matchMedia("(prefers-reduced-motion: reduce)").matches)
        el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
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

  const submit = async (retryText?: string) => {
    const text = retryText ?? value.trim();
    if (!text || disabled || composingRef.current || sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    setSendStatus("正在发送…");
    setFailedTexts((previous) => previous.filter((failed) => failed !== text));
    const revision = draftRevisionRef.current;
    if (!retryText || value.trim() === retryText) setValue("");
    inputRef.current?.focus({ preventScroll: true });
    scrollToBottom();
    try {
      const pending = onSend(text);
      if (!pending) {
        // Legacy callbacks do not expose completion; do not claim delivery.
        setSendStatus("已提交");
        return;
      }
      const result = await pending;
      setSendStatus(result?.correct ? "猜中了！" : result?.close ? "就差一点！" : "发出去了");
    } catch {
      setSendStatus("没发出去");
      setFailedTexts((previous) => (previous.includes(text) ? previous : [...previous, text]));
      // A failed request must not overwrite the next guess being typed.
      if (draftRevisionRef.current === revision) {
        setValue((current) => current || text);
      }
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  useLayoutEffect(() => {
    if (atBottomRef.current) scrollToBottom();
  }, [failedTexts, scrollToBottom]);

  const showJumpButton = !atBottom || unreadCount > 0;

  return (
    <section className="social-chat" aria-label="猜答案与聊天">
      <div className="social-chat-header">
        <div className="social-chat-heading">
          <span className="social-live-dot" aria-hidden="true" />
          <h2>放胆猜</h2>
          <span className="social-eyebrow" role="status" aria-live="polite">
            {sendStatus || "LIVE CHAT"}
          </span>
        </div>
        {onToggleExpanded && (
          <button
            type="button"
            onClick={onToggleExpanded}
            aria-label={expanded ? "收起聊天" : "展开聊天"}
            aria-expanded={expanded}
            className="social-chat-toggle"
          >
            {expanded ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}
          </button>
        )}
      </div>

      <div className="social-chat-body">
        <div
          ref={listRef}
          role="log"
          tabIndex={0}
          aria-label="聊天消息"
          aria-live="polite"
          aria-relevant="additions text"
          onScroll={(e) => {
            setBottomState(isNearBottom(e.currentTarget));
          }}
          className="social-message-list"
        >
          {messages.length === 0 && failedTexts.length === 0 ? (
            <div className="social-chat-empty">
              <span className="social-chat-empty-icon">
                <MessageCircle aria-hidden="true" />
              </span>
              <div>
                <p>第一个乱猜的，会是谁？</p>
                <span>答案、吐槽、笑声，都发这里。</span>
              </div>
            </div>
          ) : (
            messages.map((m) => <MessageRow key={m.id} message={m} />)
          )}
          {failedTexts.map((text) => (
            <div key={text} className="social-event social-event-close items-center" role="alert">
              <p className="min-w-0 flex-1">
                <span className="social-event-label">没发出去</span>
                {text}
              </p>
              <button
                type="button"
                disabled={sending || disabled}
                onClick={() => void submit(text)}
                className="flex min-h-11 shrink-0 items-center gap-1 rounded-lg px-2 text-xs disabled:opacity-50"
                aria-label={`重试发送：${text}`}
              >
                <RotateCcw className="size-3" aria-hidden="true" /> 重试
              </button>
            </div>
          ))}
        </div>
        {showJumpButton && (
          <button
            type="button"
            onClick={() => scrollToBottom(true)}
            className={cn("social-chat-jump", unreadCount > 0 && "social-chat-jump-unread")}
          >
            <ArrowDown className="size-3" />
            {unreadCount > 0 ? `${unreadCount} 条新消息` : "回到最新"}
          </button>
        )}
      </div>

      <div className="social-chat-composer" role="group" aria-label="发送答案或消息">
        <input
          ref={inputRef}
          aria-label={disabled ? "这回合由你画画，暂时不能发送答案" : "输入答案或聊天消息"}
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          maxLength={40}
          autoComplete="off"
          enterKeyHint="send"
          onChange={(e) => {
            draftRevisionRef.current += 1;
            setValue(e.target.value);
            if (!sendingRef.current) setSendStatus("");
          }}
          onFocus={() => scrollToBottom()}
          onCompositionStart={() => {
            composingRef.current = true;
          }}
          onCompositionEnd={() => {
            composingRef.current = false;
          }}
          onKeyDown={(e) => {
            if (
              e.key === "Enter" &&
              !composingRef.current &&
              !e.nativeEvent.isComposing &&
              e.nativeEvent.keyCode !== 229
            ) {
              e.preventDefault();
              void submit();
            }
          }}
          className="social-chat-input"
        />
        <button
          type="button"
          onPointerDown={(event) => event.preventDefault()}
          onClick={() => void submit()}
          disabled={disabled || sending || !value.trim()}
          aria-label={sending ? "正在发送答案或消息" : "发送答案或消息"}
          aria-busy={sending}
          className="social-chat-send"
        >
          {sending ? (
            <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />
          ) : (
            <ArrowUp className="size-5" aria-hidden="true" />
          )}
        </button>
      </div>
    </section>
  );
}

function MessageRow({ message }: { message: ChatMessage }) {
  if (message.kind === "correct") {
    return (
      <div className="social-event social-event-correct">
        <CheckCircle2 aria-hidden="true" />
        <p>
          <span className="social-event-label">命中！</span>
          {message.text}
        </p>
      </div>
    );
  }
  if (message.kind === "close") {
    return (
      <div className="social-event social-event-close">
        <Flame aria-hidden="true" />
        <p>
          <span className="social-event-label">就差一点</span>
          {message.text}
        </p>
      </div>
    );
  }
  if (message.kind === "reveal") {
    return (
      <div className="social-reveal">
        <span>
          <Sparkles aria-hidden="true" />
          答案揭晓
        </span>
        <strong>{message.text}</strong>
      </div>
    );
  }
  if (message.kind === "system") {
    return <p className="social-system-message">{message.text}</p>;
  }
  return (
    <div className="social-message">
      <span className="social-message-name">{message.player_name || "玩家"}</span>
      <p>{message.text}</p>
    </div>
  );
}
