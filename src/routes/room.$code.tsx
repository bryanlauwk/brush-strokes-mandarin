import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Copy, LogOut, MessageCircle, X } from "lucide-react";
import { DrawBoard } from "@/components/game/DrawBoard";
import { ChatPanel } from "@/components/game/ChatPanel";
import { DrawingHintPanel } from "@/components/game/DrawingHintPanel";
import { GameFeedback, type GameFeedbackEvent, type GameFeedbackKind } from "@/components/game/GameFeedback";
import { PlayerAvatar } from "@/components/game/PlayerAvatar";
import { Scoreboard } from "@/components/game/Scoreboard";
import { SelfieAvatar } from "@/components/game/SelfieAvatar";
import { useRoom } from "@/hooks/use-room";
import { DIFFICULTIES, ROOM_THEME_OPTIONS, normalizeRoomTheme, type Difficulty, type Player, type RoomTheme, type Stroke } from "@/lib/game-types";
import { cn } from "@/lib/utils";
import {
  chooseWord,
  getPrivateState,
  joinRoom,
  leaveRoom,
  pushStroke,
  startGame,
  submitGuess,
  tick,
  updateSettings,
} from "@/lib/game.functions";
import {
  clearIdentity,
  loadAvatarSvg,
  loadIdentity,
  loadNickname,
  saveAvatarSvg,
  saveIdentity,
  saveNickname,
} from "@/lib/player-identity";

export const Route = createFileRoute("/room/$code")({
  head: () => ({
    meta: [
      { title: "游戏桌 · 画啦猜啦" },
      { name: "description", content: "朋友一起画画、猜华语答案、比谁反应快。" },
      { property: "og:title", content: "游戏桌 · 画啦猜啦" },
      { property: "og:description", content: "输入号码即可加入，一起画画猜答案。" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RoomPage,
});

const LEGACY_DIFFICULTIES: Record<string, Difficulty> = {
  简单: "容易",
  中等: "普通",
  困难: "挑战",
};

function asDifficulty(value: string): Difficulty {
  const normalized = LEGACY_DIFFICULTIES[value] ?? value;
  return DIFFICULTIES.includes(normalized as Difficulty) ? (normalized as Difficulty) : "全部";
}

function RoomPage() {
  const { code } = Route.useParams();
  const navigate = useNavigate();
  const upper = code.toUpperCase();

  const [identity, setIdentity] = useState<{ playerId: string; token: string } | null>(null);
  const [ready, setReady] = useState(false);
  const [nickname, setNickname] = useState("");
  const [avatarSvg, setAvatarSvg] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [priv, setPriv] = useState<{ isDrawer: boolean; word: string | null; choices: string[] }>({
    isDrawer: false,
    word: null,
    choices: [],
  });
  const [now, setNow] = useState(() => Date.now());
  const [chatOpen, setChatOpen] = useState(false);
  const [feedback, setFeedback] = useState<GameFeedbackEvent | null>(null);
  const feedbackIdRef = useRef(0);
  const roomFeedbackKeyRef = useRef<string | null>(null);
  const correctMessageIdRef = useRef(0);

  const joinFn = useServerFn(joinRoom);
  const privFn = useServerFn(getPrivateState);
  const tickFn = useServerFn(tick);
  const startFn = useServerFn(startGame);
  const chooseFn = useServerFn(chooseWord);
  const guessFn = useServerFn(submitGuess);
  const strokeFn = useServerFn(pushStroke);
  const settingsFn = useServerFn(updateSettings);
  const leaveFn = useServerFn(leaveRoom);

  const triggerFeedback = useCallback((kind: GameFeedbackKind, title: string, subtitle?: string) => {
    feedbackIdRef.current += 1;
    setFeedback({ id: feedbackIdRef.current, kind, title, subtitle });
  }, []);

  useEffect(() => {
    const stored = loadIdentity(upper);
    if (stored) setIdentity({ playerId: stored.playerId, token: stored.token });
    setNickname(loadNickname());
    setAvatarSvg(loadAvatarSvg());
    setReady(true);
  }, [upper]);

  const { room, players, messages, strokes, live, missing, me, broadcastLive, broadcastLiveEnd, appendLocalStroke } =
    useRoom(upper, identity);

  const auth = identity ? { code: upper, playerId: identity.playerId, token: identity.token } : null;
  const roomJoinReady = nickname.trim().length > 0 && !!avatarSvg;

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  // Private state (the drawer's word / word choices)
  useEffect(() => {
    if (!auth || !room) return;
    let alive = true;
    const pull = async () => {
      try {
        const res = await privFn({ data: auth });
        if (alive) setPriv(res);
      } catch {
        /* transient */
      }
    };
    void pull();
    const t = setInterval(pull, 4000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [auth?.playerId, room?.status, room?.drawer_id, room?.turn_index]); // eslint-disable-line react-hooks/exhaustive-deps

  // The host drives the clock forward.
  const isHost = !!me?.is_host;
  useEffect(() => {
    if (!auth || !isHost || !room) return;
    if (room.status === "waiting" || room.status === "ended") return;
    const t = setInterval(() => {
      void tickFn({ data: auth }).catch(() => undefined);
    }, 1500);
    return () => clearInterval(t);
  }, [auth?.playerId, isHost, room?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!room || !identity) return;
    const key = `${room.status}:${room.turn_index}:${room.current_round}`;
    if (roomFeedbackKeyRef.current === null) {
      roomFeedbackKeyRef.current = key;
      return;
    }
    if (roomFeedbackKeyRef.current === key) return;
    roomFeedbackKeyRef.current = key;

    const drawerName = players.find((p) => p.id === room.drawer_id)?.name ?? "画画人";
    if (room.status === "drawing") {
      triggerFeedback(
        "round-start",
        room.drawer_id === identity.playerId ? "轮到你画！" : "开画啦！",
        room.drawer_id === identity.playerId ? "朋友们等着猜，放胆画。" : `${drawerName} 开始画了，快看线索。`,
      );
    }
    if (room.status === "turn_end") {
      triggerFeedback("round-end", "答案揭晓", room.revealed_word ? `答案是「${room.revealed_word}」` : "这一回合结束");
    }
    if (room.status === "ended") {
      triggerFeedback("round-end", "最后排名", "这一局结束，来看谁最会猜。");
    }
  }, [identity, players, room, triggerFeedback]);

  useEffect(() => {
    const latestCorrect = [...messages].reverse().find((message) => message.kind === "correct");
    if (!latestCorrect || latestCorrect.id === correctMessageIdRef.current) return;
    correctMessageIdRef.current = latestCorrect.id;
    triggerFeedback("correct", "猜中了！", latestCorrect.text ?? "有人答对了");
  }, [messages, triggerFeedback]);

  const handleStroke = useCallback(
    (stroke: Stroke) => {
      if (!auth) return;
      appendLocalStroke(stroke);
      void strokeFn({ data: { ...auth, stroke } }).catch(() => undefined);
    },
    [auth, appendLocalStroke, strokeFn],
  );

  const doJoin = async () => {
    const trimmedName = nickname.trim();
    if (!trimmedName) {
      toast.error("先输入你的名字");
      return;
    }
    if (!avatarSvg) {
      toast.error("先拍照或上传照片，生成入场画像");
      return;
    }

    setJoining(true);
    try {
      const res = await joinFn({ data: { code: upper, name: trimmedName, avatarSvg } });
      saveNickname(trimmedName);
      saveAvatarSvg(avatarSvg);
      saveIdentity(res);
      setIdentity({ playerId: res.playerId, token: res.token });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "加入失败");
    } finally {
      setJoining(false);
    }
  };

  const doLeave = async () => {
    if (auth) await leaveFn({ data: auth }).catch(() => undefined);
    clearIdentity(upper);
    void navigate({ to: "/" });
  };

  if (!ready) return <Shell><p className="text-muted-foreground">载入中…</p></Shell>;

  if (missing) {
    return (
      <Shell>
        <div className="panel max-w-md p-6 text-center">
          <h1 className="font-display text-2xl">找不到这一局</h1>
          <p className="mt-2 text-sm text-muted-foreground">号码 {upper} 可能已经结束，或输入有误。</p>
          <Link to="/" className="mt-4 inline-block rounded-md border-2 border-[var(--ink)] bg-primary px-4 py-2 text-primary-foreground">
            回到主页
          </Link>
        </div>
      </Shell>
    );
  }

  if (!identity) {
    return (
      <Shell>
        <div className="panel w-full max-w-sm p-6">
          <h1 className="font-display text-2xl">加入 {upper}</h1>
          <p className="mt-1 text-sm text-muted-foreground">先做好入场画像，再进房跟朋友开画。</p>
          <label className="mt-4 block text-sm font-medium" htmlFor="nick">
            1. 你的名字
          </label>
          <input
            id="nick"
            value={nickname}
            maxLength={12}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="例如：Bryan"
            className="mt-1 w-full rounded-md border-2 border-[var(--ink)] bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-primary"
          />
          <div className="mt-4">
            <p className="mb-2 text-sm font-medium">2. 拍照生成画像</p>
            <SelfieAvatar value={avatarSvg} onChange={setAvatarSvg} name={nickname} compact required />
          </div>
          <button
            type="button"
            onClick={doJoin}
            disabled={joining || !roomJoinReady}
            className="mt-4 w-full rounded-md border-2 border-[var(--ink)] bg-primary px-4 py-2 font-display text-lg text-primary-foreground shadow-[3px_3px_0_0_var(--ink)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {joining ? "加入中…" : roomJoinReady ? "加入这一局" : "完成画像后加入"}
          </button>
        </div>
      </Shell>
    );
  }

  if (!room) return <Shell><p className="text-muted-foreground">正在连接这一局…</p></Shell>;

  const currentRoomTheme = normalizeRoomTheme(room.room_theme);
  const drawer = players.find((p) => p.id === room.drawer_id) ?? null;
  const iAmDrawer = room.drawer_id === identity.playerId;
  const secondsLeft = room.round_ends_at
    ? Math.max(0, Math.ceil((Date.parse(room.round_ends_at) - now) / 1000))
    : 0;
  const inGame = room.status !== "waiting" && room.status !== "ended";
  const guessed = !!me?.has_guessed;

  const wordDisplay = iAmDrawer && priv.word ? [...priv.word].join(" ") : (room.masked_word ?? "");
  const frozenOrder = Array.isArray(room.turn_order) ? room.turn_order.filter(Boolean) : [];
  const turnsPerRound = Math.max(frozenOrder.length || players.length, 1);
  const turnInRound = (room.turn_index % turnsPerRound) + 1;
  const urgent = inGame && room.status === "drawing" && secondsLeft <= 10;
  const withLocalAvatar = (player: Player) =>
    player.id === identity.playerId && !player.avatar_svg && avatarSvg ? { ...player, avatar_svg: avatarSvg } : player;
  const drawingHint = auth && iAmDrawer && room.status === "drawing" && priv.word ? (
    <DrawingHintPanel auth={auth} turnIndex={room.turn_index} word={priv.word} compact />
  ) : null;

  const chat = (
    <ChatPanel
      messages={messages}
      disabled={iAmDrawer && room.status === "drawing"}
      placeholder={
        iAmDrawer && room.status === "drawing"
          ? "你负责画，先别猜"
          : guessed
            ? "你已经猜中，可以聊天"
            : "输入华语答案…"
      }
      onSend={(text) =>
        void guessFn({ data: { ...auth!, text } }).catch((e) =>
          toast.error(e instanceof Error ? e.message : "发送失败"),
        )
      }
    />
  );

  return (
    <main className="mx-auto flex h-[100dvh] max-w-6xl flex-col gap-3 overflow-hidden p-3 sm:p-5">
      <header className="panel flex shrink-0 flex-wrap items-center gap-3 px-4 py-2 sm:py-3">
        <Link to="/" className="font-display text-xl text-primary">
          画啦猜啦
        </Link>
        <button
          type="button"
          title="复制号码"
          aria-label={`复制号码 ${upper}`}
          onClick={() => {
            void navigator.clipboard?.writeText(upper);
            toast.success(`号码 ${upper} 已复制`);
          }}
          className="press flex items-center gap-1 rounded-md border-2 border-[var(--ink)] bg-secondary px-3 py-1 text-sm tracking-[0.2em] shadow-[2px_2px_0_0_var(--ink)]"
        >
          {upper}
          <Copy className="size-3.5" />
        </button>
        <span className="rounded-full border-2 border-[var(--ink)] bg-accent px-3 py-1 text-xs font-semibold">
          {currentRoomTheme}
        </span>
        {inGame && (
          <>
            <span className="rounded-full border-2 border-[var(--ink)] bg-card px-3 py-1 text-xs sm:text-sm">
              第 {room.current_round}/{room.total_rounds} 轮 · 这一轮 {turnInRound}/{turnsPerRound} 位
            </span>
            <span
              className={cn(
                "ml-auto flex size-11 items-center justify-center rounded-full border-2 border-[var(--ink)] font-display text-lg tabular-nums",
                urgent ? "animate-urgent bg-primary text-primary-foreground" : "bg-accent",
              )}
            >
              {secondsLeft}
            </span>
          </>
        )}
        <div className={inGame ? "" : "ml-auto"}>
          <button
            type="button"
            onClick={doLeave}
            className="press flex items-center gap-1 rounded-md border-2 border-[var(--ink)] bg-card px-3 py-1 text-sm shadow-[2px_2px_0_0_var(--ink)] hover:bg-accent"
          >
            <LogOut className="size-3.5" /> 离开
          </button>
        </div>
      </header>

      {inGame && (
        <div className="panel shrink-0 px-4 py-2 text-center">
          <p className="text-xs text-muted-foreground">
            {iAmDrawer ? "你正在画：" : `${drawer?.name ?? "画画人"} 正在画 · ${room.word_length ?? "?"} 个字`}
          </p>
          <p className="font-display text-2xl tracking-[0.3em] break-all">{wordDisplay || "…"}</p>
        </div>
      )}

      <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_auto_auto] gap-3 lg:grid-cols-[220px_minmax(0,1fr)_290px] lg:grid-rows-1">
        <div className="order-2 h-32 min-h-0 lg:order-1 lg:h-auto">
          <Scoreboard players={players} drawerId={room.drawer_id} meId={identity.playerId} meAvatarSvg={avatarSvg} />
        </div>

        <div className="order-1 min-h-0 lg:order-2">
          <DrawBoard
            strokes={strokes}
            live={live}
            canDraw={iAmDrawer && room.status === "drawing"}
            onStroke={handleStroke}
            onLive={broadcastLive}
            onLiveEnd={broadcastLiveEnd}
            overlay={
              <>
                {room.status === "waiting" && (
                  <Overlay>
                    <WaitingCard
                      canStart={isHost && players.length >= 2}
                      isHost={isHost}
                      code={upper}
                      totalRounds={room.total_rounds}
                      drawSeconds={room.draw_seconds}
                      difficulty={room.difficulty}
                      roomTheme={currentRoomTheme}
                      onSettings={(s) =>
                        void settingsFn({ data: { ...auth!, ...s } }).catch((e) =>
                          toast.error(e instanceof Error ? e.message : "保存失败"),
                        )
                      }
                      onStart={() =>
                        void startFn({ data: auth! }).catch((e) =>
                          toast.error(e instanceof Error ? e.message : "无法开始"),
                        )
                      }
                    />
                  </Overlay>
                )}

                {room.status === "choosing" && (
                  <Overlay>
                    {iAmDrawer ? (
                      <div className="text-center">
                        <p className="font-display text-xl">选一个题目开始画</p>
                        <div className="mt-3 flex flex-wrap justify-center gap-2">
                          {priv.choices.map((w) => (
                            <button
                              key={w}
                              type="button"
                              onClick={() =>
                                void chooseFn({ data: { ...auth!, word: w } }).catch(() => undefined)
                              }
                              className="press animate-pop-in rounded-md border-2 border-[var(--ink)] bg-card px-4 py-2 font-display text-lg shadow-[3px_3px_0_0_var(--ink)] hover:bg-accent"
                            >
                              {w}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="font-display text-xl">{drawer?.name ?? "画画人"} 正在选题…</p>
                    )}
                  </Overlay>
                )}

                {room.status === "turn_end" && (
                  <Overlay>
                    <div className="panel animate-pop-in max-w-xs px-6 py-4 text-center">
                      <p className="text-sm text-muted-foreground">答案是</p>
                      <p className="stamp mx-auto mt-1 inline-block rounded-md px-3 py-1 font-display text-3xl">
                        {room.revealed_word ?? "—"}
                      </p>
                      <ul className="mt-3 space-y-1 text-sm">
                        {players
                          .filter((p) => p.round_score > 0)
                          .sort((a, b) => b.round_score - a.round_score)
                          .map((p, i) => (
                            <li
                              key={p.id}
                              className="animate-pop-in flex items-center justify-center gap-1"
                              style={{ animationDelay: `${i * 90}ms` }}
                            >
                              <PlayerAvatar player={withLocalAvatar(p)} size="sm" />
                              <span className="max-w-32 truncate" title={p.name}>{p.name}</span>
                              <span className="font-semibold text-[var(--success)]">+{p.round_score}</span>
                            </li>
                          ))}
                      </ul>
                    </div>
                  </Overlay>
                )}

                {room.status === "ended" && (
                  <Overlay>
                    <div className="panel animate-pop-in max-w-xs px-6 py-4 text-center">
                      <p className="font-display text-2xl">🏆 最后排名</p>
                      <ol className="mt-3 space-y-1 text-base">
                        {[...players]
                          .sort((a, b) => b.score - a.score)
                          .map((p, i) => (
                            <li
                              key={p.id}
                              className="animate-pop-in flex items-center justify-center gap-1"
                              style={{ animationDelay: `${i * 120}ms` }}
                            >
                              <span>{["🥇", "🥈", "🥉"][i] ?? `${i + 1}.`}</span>
                              <PlayerAvatar player={withLocalAvatar(p)} size="sm" />
                              <span className="max-w-32 truncate" title={p.name}>{p.name}</span>
                              <span className="tabular-nums">· {p.score}</span>
                            </li>
                          ))}
                      </ol>
                      {isHost && (
                        <button
                          type="button"
                          onClick={() =>
                            void startFn({ data: auth! }).catch((e) =>
                              toast.error(e instanceof Error ? e.message : "无法开始"),
                            )
                          }
                          className="press mt-4 rounded-md border-2 border-[var(--ink)] bg-primary px-5 py-2 font-display text-lg text-primary-foreground shadow-[3px_3px_0_0_var(--ink)]"
                        >
                          再来一局
                        </button>
                      )}
                    </div>
                  </Overlay>
                )}
              </>
            }
          />
        </div>

        <div
          className={cn(
            "order-3 min-h-0",
            drawingHint ? "h-44 lg:flex lg:h-auto lg:flex-col lg:gap-3" : "hidden lg:block",
          )}
        >
          {drawingHint && <div className="shrink-0">{drawingHint}</div>}
          <div className={cn("hidden min-h-0 lg:block", drawingHint && "lg:flex-1")}>{chat}</div>
        </div>
      </div>

      {/* Mobile: chat lives in a bottom sheet so it never pushes the canvas away */}
      <button
        type="button"
        onClick={() => setChatOpen(true)}
        className="press fixed right-4 bottom-4 z-40 flex items-center gap-1 rounded-full border-2 border-[var(--ink)] bg-primary px-4 py-2 text-sm text-primary-foreground shadow-[3px_3px_0_0_var(--ink)] lg:hidden"
      >
        <MessageCircle className="size-4" /> 聊天
      </button>
      {chatOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-background/60 backdrop-blur-[2px] lg:hidden">
          <button
            type="button"
            aria-label="关闭聊天"
            onClick={() => setChatOpen(false)}
            className="flex-1"
          />
          <div className="relative h-[60vh] p-2">
            <button
              type="button"
              aria-label="关闭聊天"
              onClick={() => setChatOpen(false)}
              className="absolute -top-2 right-4 z-10 grid size-9 place-items-center rounded-full border-2 border-[var(--ink)] bg-card shadow-[2px_2px_0_0_var(--ink)]"
            >
              <X className="size-4" />
            </button>
            {chat}
          </div>
        </div>
      )}
      <GameFeedback event={feedback} />
    </main>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="flex min-h-screen items-center justify-center p-6">{children}</main>;
}

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-background/85 p-4 backdrop-blur-[2px]">
      {children}
    </div>
  );
}

function WaitingCard({
  canStart,
  isHost,
  code,
  totalRounds,
  drawSeconds,
  difficulty,
  roomTheme,
  onSettings,
  onStart,
}: {
  canStart: boolean;
  isHost: boolean;
  code: string;
  totalRounds: number;
  drawSeconds: number;
  difficulty: string;
  roomTheme: RoomTheme;
  onSettings: (s: { totalRounds: number; drawSeconds: number; difficulty: Difficulty; roomTheme: RoomTheme }) => void;
  onStart: () => void;
}) {
  const currentDifficulty = asDifficulty(difficulty);
  const currentRoomTheme = normalizeRoomTheme(roomTheme);
  const select =
    "mt-1 w-full rounded-md border-2 border-[var(--ink)] bg-background px-2 py-1 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-60";
  return (
    <div className="panel w-full max-w-sm p-5 text-center">
      <p className="font-display text-xl">等大家加入</p>
      <p className="mt-1 text-sm text-muted-foreground">
        把号码 <span className="font-semibold tracking-[0.2em]">{code}</span> 发给朋友
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2 text-left">
        <label className="text-xs font-medium">
          主题房
          <select
            className={select}
            disabled={!isHost}
            value={currentRoomTheme}
            onChange={(e) =>
              onSettings({
                totalRounds,
                drawSeconds,
                difficulty: currentDifficulty,
                roomTheme: normalizeRoomTheme(e.target.value),
              })
            }
          >
            {ROOM_THEME_OPTIONS.map((theme) => (
              <option key={theme.value} value={theme.value}>{theme.label}</option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium">
          难度
          <select
            className={select}
            disabled={!isHost}
            value={currentDifficulty}
            onChange={(e) =>
              onSettings({
                totalRounds,
                drawSeconds,
                difficulty: asDifficulty(e.target.value),
                roomTheme: currentRoomTheme,
              })
            }
          >
            {DIFFICULTIES.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium">
          轮数
          <select
            className={select}
            disabled={!isHost}
            value={totalRounds}
            onChange={(e) =>
              onSettings({
                totalRounds: Number(e.target.value),
                drawSeconds,
                difficulty: currentDifficulty,
                roomTheme: currentRoomTheme,
              })
            }
          >
            {[1, 2, 3, 4, 5, 6, 8, 10].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium">
          每轮秒数
          <select
            className={select}
            disabled={!isHost}
            value={drawSeconds}
            onChange={(e) =>
              onSettings({
                totalRounds,
                drawSeconds: Number(e.target.value),
                difficulty: currentDifficulty,
                roomTheme: currentRoomTheme,
              })
            }
          >
            {[40, 60, 80, 100, 120].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        {isHost ? "全部难度会随机出题；主题和设置会自动保存" : "等主持人调整主题和设置"}
      </p>
      {isHost ? (
        <button
          type="button"
          onClick={onStart}
          disabled={!canStart}
          className="mt-4 w-full rounded-md border-2 border-[var(--ink)] bg-primary px-4 py-2 font-display text-lg text-primary-foreground shadow-[3px_3px_0_0_var(--ink)] disabled:opacity-50"
        >
          {canStart ? "开始这一局" : "至少 2 人"}
        </button>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">等主持人开始…</p>
      )}
    </div>
  );
}
