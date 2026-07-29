import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
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
  const composingRef = useRef(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  const submit = () => {
    const text = value.trim();
    if (!text || disabled) return;
    onSend(text);
    setValue("");
  };

  return (
    <div className="panel flex h-full min-h-0 flex-col overflow-hidden">
      <div className="border-b-2 border-[var(--ink)] bg-secondary px-3 py-2 font-display text-lg">
        聊天 · 猜词
      </div>
      <div className="flex-1 space-y-1 overflow-y-auto p-3 text-sm">
        {messages.map((m) => (
          <MessageRow key={m.id} message={m} />
        ))}
        <div ref={endRef} />
      </div>
      <div className="flex items-center gap-2 border-t-2 border-[var(--ink)] p-2">
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
      <p className="rounded-md bg-[var(--success)]/15 px-2 py-1 font-medium text-[var(--success)]">
        {message.text}
      </p>
    );
  }
  if (message.kind === "close") {
    return <p className="px-2 py-1 text-primary">{message.text}</p>;
  }
  if (message.kind === "reveal") {
    return (
      <p className="rounded-md bg-accent px-2 py-1 font-display text-base text-accent-foreground">
        答案是「{message.text}」
      </p>
    );
  }
  if (message.kind === "system") {
    return <p className="px-2 py-1 text-muted-foreground italic">{message.text}</p>;
  }
  return (
    <p className={cn("px-2 py-1")}>
      <span className="font-semibold">{message.player_name}：</span>
      <span className="text-foreground/85">{message.text}</span>
    </p>
  );
}