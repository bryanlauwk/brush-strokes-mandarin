import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Copy, LogOut } from "lucide-react";
import { DrawBoard } from "@/components/game/DrawBoard";
import { ChatPanel } from "@/components/game/ChatPanel";
import { Scoreboard } from "@/components/game/Scoreboard";
import { useRoom } from "@/hooks/use-room";
import { AVATARS, type Stroke } from "@/lib/game-types";
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
import { clearIdentity, loadIdentity, loadNickname, saveIdentity, saveNickname } from "@/lib/player-identity";

export const Route = createFileRoute("/room/$code")({
  head: () => ({
    meta: [
      { title: "游戏房间 · 你画我猜（中文）" },
      { name: "description", content: "和好友一起在中文你画我猜房间里作画、抢答、比拼分数。" },
      { property: "og:title", content: "游戏房间 · 你画我猜（中文）" },
      { property: "og:description", content: "输入房号即可加入，一起画画猜汉字。" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RoomPage,
});

function RoomPage() {
  const { code } = Route.useParams();
  const navigate = useNavigate();
  const upper = code.toUpperCase();

  const [identity, setIdentity] = useState<{ playerId: string; token: string } | null>(null);
  const [ready, setReady] = useState(false);
  const [nickname, setNickname] = useState("");
  const [joining, setJoining] = useState(false);
  const [priv, setPriv] = useState<{ isDrawer: boolean; word: string | null; choices: string[] }>({
    isDrawer: false,
    word: null,
    choices: [],
  });
  const [now, setNow] = useState(() => Date.now());

  const joinFn = useServerFn(joinRoom);
  const privFn = useServerFn(getPrivateState);
  const tickFn = useServerFn(tick);
  const startFn = useServerFn(startGame);
  const chooseFn = useServerFn(chooseWord);
  const guessFn = useServerFn(submitGuess);
  const strokeFn = useServerFn(pushStroke);
  const settingsFn = useServerFn(updateSettings);
  const leaveFn = useServerFn(leaveRoom);

  useEffect(() => {
    const stored = loadIdentity(upper);
    if (stored) setIdentity({ playerId: stored.playerId, token: stored.token });
    setNickname(loadNickname());
    setReady(true);
  }, [upper]);

  const { room, players, messages, strokes, live, missing, me, broadcastLive, broadcastLiveEnd, appendLocalStroke } =
    useRoom(upper, identity?.playerId ?? null);

  const auth = identity ? { code: upper, playerId: identity.playerId, token: identity.token } : null;

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

  const handleStroke = useCallback(
    (stroke: Stroke) => {
      if (!auth) return;
      appendLocalStroke(stroke);
      void strokeFn({ data: { ...auth, stroke } }).catch(() => undefined);
    },
    [auth, appendLocalStroke, strokeFn],
  );

  const doJoin = async () => {
    setJoining(true);
    try {
      const res = await joinFn({ data: { code: upper, name: nickname } });
      saveNickname(nickname.trim());
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

  if (!ready) return <Shell><p className="text-muted-foreground">加载中…</p></Shell>;

  if (missing) {
    return (
      <Shell>
        <div className="panel max-w-md p-6 text-center">
          <h1 className="font-display text-2xl">房间不存在</h1>
          <p className="mt-2 text-sm text-muted-foreground">房号 {upper} 已关闭或输入有误。</p>
          <Link to="/" className="mt-4 inline-block rounded-md border-2 border-[var(--ink)] bg-primary px-4 py-2 text-primary-foreground">
            回到首页
          </Link>
        </div>
      </Shell>
    );
  }

  if (!identity) {
    return (
      <Shell>
        <div className="panel w-full max-w-sm p-6">
          <h1 className="font-display text-2xl">加入房间 {upper}</h1>
          <label className="mt-4 block text-sm font-medium" htmlFor="nick">
            你的昵称
          </label>
          <input
            id="nick"
            value={nickname}
            maxLength={12}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="小画家"
            className="mt-1 w-full rounded-md border-2 border-[var(--ink)] bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-primary"
          />
          <button
            type="button"
            onClick={doJoin}
            disabled={joining}
            className="mt-4 w-full rounded-md border-2 border-[var(--ink)] bg-primary px-4 py-2 font-display text-lg text-primary-foreground shadow-[3px_3px_0_0_var(--ink)] disabled:opacity-60"
          >
            进入房间
          </button>
        </div>
      </Shell>
    );
  }

  if (!room) return <Shell><p className="text-muted-foreground">正在连接房间…</p></Shell>;

  const drawer = players.find((p) => p.id === room.drawer_id) ?? null;
  const iAmDrawer = room.drawer_id === identity.playerId;
  const secondsLeft = room.round_ends_at
    ? Math.max(0, Math.ceil((Date.parse(room.round_ends_at) - now) / 1000))
    : 0;
  const inGame = room.status !== "waiting" && room.status !== "ended";
  const guessed = !!me?.has_guessed;

  const wordDisplay = iAmDrawer && priv.word ? [...priv.word].join(" ") : (room.masked_word ?? "");

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-3 p-3 sm:p-5">
      <header className="panel flex flex-wrap items-center gap-3 px-4 py-3">
        <Link to="/" className="font-display text-xl text-primary">
          你画我猜
        </Link>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard?.writeText(upper);
            toast.success(`房号 ${upper} 已复制`);
          }}
          className="flex items-center gap-1 rounded-md border-2 border-[var(--ink)] bg-secondary px-3 py-1 text-sm tracking-[0.2em]"
        >
          {upper}
          <Copy className="size-3.5" />
        </button>
        {inGame && (
          <>
            <span className="text-sm text-muted-foreground">
              第 {room.current_round}/{room.total_rounds} 回合
            </span>
            <span className="ml-auto flex size-11 items-center justify-center rounded-full border-2 border-[var(--ink)] bg-accent font-display text-lg tabular-nums">
              {secondsLeft}
            </span>
          </>
        )}
        <div className={inGame ? "" : "ml-auto"}>
          <button
            type="button"
            onClick={doLeave}
            className="flex items-center gap-1 rounded-md border-2 border-[var(--ink)] bg-card px-3 py-1 text-sm hover:bg-accent"
          >
            <LogOut className="size-3.5" /> 离开
          </button>
        </div>
      </header>

      {inGame && (
        <div className="panel px-4 py-3 text-center">
          <p className="text-xs text-muted-foreground">
            {iAmDrawer ? "你正在画：" : `${drawer?.name ?? "?"} 正在画 · ${room.word_length ?? "?"} 个字`}
          </p>
          <p className="font-display text-2xl tracking-[0.3em]">{wordDisplay || "…"}</p>
        </div>
      )}

      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[220px_1fr_290px]">
        <div className="order-2 h-56 lg:order-1 lg:h-auto">
          <Scoreboard players={players} drawerId={room.drawer_id} meId={identity.playerId} />
        </div>

        <div className="order-1 lg:order-2">
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
                        <p className="font-display text-xl">选一个词开始作画</p>
                        <div className="mt-3 flex flex-wrap justify-center gap-2">
                          {priv.choices.map((w) => (
                            <button
                              key={w}
                              type="button"
                              onClick={() =>
                                void chooseFn({ data: { ...auth!, word: w } }).catch(() => undefined)
                              }
                              className="rounded-md border-2 border-[var(--ink)] bg-card px-4 py-2 font-display text-lg shadow-[3px_3px_0_0_var(--ink)] hover:bg-accent"
                            >
                              {w}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="font-display text-xl">{drawer?.name ?? "画者"} 正在选词…</p>
                    )}
                  </Overlay>
                )}

                {room.status === "turn_end" && (
                  <Overlay>
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">答案是</p>
                      <p className="font-display text-3xl text-primary">{room.revealed_word ?? "—"}</p>
                      <ul className="mt-3 space-y-1 text-sm">
                        {players
                          .filter((p) => p.round_score > 0)
                          .sort((a, b) => b.round_score - a.round_score)
                          .map((p) => (
                            <li key={p.id}>
                              {AVATARS[p.avatar % AVATARS.length]} {p.name} +{p.round_score}
                            </li>
                          ))}
                      </ul>
                    </div>
                  </Overlay>
                )}

                {room.status === "ended" && (
                  <Overlay>
                    <div className="text-center">
                      <p className="font-display text-2xl">最终排名</p>
                      <ol className="mt-3 space-y-1 text-base">
                        {[...players]
                          .sort((a, b) => b.score - a.score)
                          .map((p, i) => (
                            <li key={p.id}>
                              {["🥇", "🥈", "🥉"][i] ?? `${i + 1}.`} {p.name} · {p.score}
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
                          className="mt-4 rounded-md border-2 border-[var(--ink)] bg-primary px-5 py-2 font-display text-lg text-primary-foreground shadow-[3px_3px_0_0_var(--ink)]"
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

        <div className="order-3 h-72 lg:h-auto">
          <ChatPanel
            messages={messages}
            disabled={iAmDrawer && room.status === "drawing"}
            placeholder={
              iAmDrawer && room.status === "drawing"
                ? "你是画者，安静作画吧"
                : guessed
                  ? "你已猜对，聊聊天吧"
                  : "输入中文答案…"
            }
            onSend={(text) =>
              void guessFn({ data: { ...auth!, text } }).catch((e) =>
                toast.error(e instanceof Error ? e.message : "发送失败"),
              )
            }
          />
        </div>
      </div>
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
  onSettings,
  onStart,
}: {
  canStart: boolean;
  isHost: boolean;
  code: string;
  totalRounds: number;
  drawSeconds: number;
  difficulty: string;
  onSettings: (s: { totalRounds: number; drawSeconds: number; difficulty: "全部" | "简单" | "中等" | "困难" }) => void;
  onStart: () => void;
}) {
  const select =
    "rounded-md border-2 border-[var(--ink)] bg-background px-2 py-1 text-sm outline-none disabled:opacity-60";
  return (
    <div className="panel w-full max-w-sm p-5 text-center">
      <p className="font-display text-xl">等待玩家加入</p>
      <p className="mt-1 text-sm text-muted-foreground">
        把房号 <span className="font-semibold tracking-[0.2em]">{code}</span> 发给好友
      </p>
      <div className="mt-4 grid grid-cols-3 gap-2 text-left">
        <label className="text-xs">
          回合数
          <select
            className={select}
            disabled={!isHost}
            value={totalRounds}
            onChange={(e) =>
              onSettings({ totalRounds: Number(e.target.value), drawSeconds, difficulty: difficulty as "全部" })
            }
          >
            {[1, 2, 3, 4, 5, 6, 8, 10].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>
        <label className="text-xs">
          每回合秒
          <select
            className={select}
            disabled={!isHost}
            value={drawSeconds}
            onChange={(e) =>
              onSettings({ totalRounds, drawSeconds: Number(e.target.value), difficulty: difficulty as "全部" })
            }
          >
            {[40, 60, 80, 100, 120].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>
        <label className="text-xs">
          难度
          <select
            className={select}
            disabled={!isHost}
            value={difficulty}
            onChange={(e) =>
              onSettings({
                totalRounds,
                drawSeconds,
                difficulty: e.target.value as "全部" | "简单" | "中等" | "困难",
              })
            }
          >
            {["全部", "简单", "中等", "困难"].map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </label>
      </div>
      {isHost ? (
        <button
          type="button"
          onClick={onStart}
          disabled={!canStart}
          className="mt-4 w-full rounded-md border-2 border-[var(--ink)] bg-primary px-4 py-2 font-display text-lg text-primary-foreground shadow-[3px_3px_0_0_var(--ink)] disabled:opacity-50"
        >
          {canStart ? "开始游戏" : "至少需要 2 人"}
        </button>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">等待房主开始…</p>
      )}
    </div>
  );
}