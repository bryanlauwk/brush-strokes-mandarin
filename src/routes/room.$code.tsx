import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Copy, Lightbulb, LogOut, X } from "lucide-react";
import { DrawBoard } from "@/components/game/DrawBoard";
import { ChatPanel } from "@/components/game/ChatPanel";
import { CharacterPicker } from "@/components/game/CharacterPicker";
import { DrawingHintPanel } from "@/components/game/DrawingHintPanel";
import {
  GameFeedback,
  type GameFeedbackEvent,
  type GameFeedbackKind,
} from "@/components/game/GameFeedback";
import { PlayerAvatar } from "@/components/game/PlayerAvatar";
import { Scoreboard } from "@/components/game/Scoreboard";
import { createDefaultAvatar, isPresetCharacterAvatar } from "@/lib/character-avatars";
import { retryTransient } from "@/lib/retry";
import { useRoom } from "@/hooks/use-room";
import {
  DIFFICULTIES,
  ROOM_THEME_OPTIONS,
  normalizeRoomTheme,
  type Difficulty,
  type Player,
  type RoomTheme,
  type Stroke,
} from "@/lib/game-types";
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
  getOrCreateClientId,
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
      {
        name: "description",
        content: "朋友一起画画、猜华语答案、比谁反应快。",
      },
      { property: "og:title", content: "游戏桌 · 画啦猜啦" },
      {
        property: "og:description",
        content: "输入号码即可加入，一起画画猜答案。",
      },
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

  const [identity, setIdentity] = useState<{
    playerId: string;
    token: string;
    clientId: string;
  } | null>(null);
  const [ready, setReady] = useState(false);
  const [nickname, setNickname] = useState("");
  const [avatarSvg, setAvatarSvg] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [priv, setPriv] = useState<{
    isDrawer: boolean;
    word: string | null;
    choices: string[];
  }>({
    isDrawer: false,
    word: null,
    choices: [],
  });
  const [now, setNow] = useState(() => Date.now());
  const [chatExpanded, setChatExpanded] = useState(false);
  const [hintOpen, setHintOpen] = useState(false);
  const [feedback, setFeedback] = useState<GameFeedbackEvent | null>(null);
  const feedbackIdRef = useRef(0);
  const roomFeedbackKeyRef = useRef<string | null>(null);
  const correctMessageIdRef = useRef(0);
  const [bots, setBots] = useState<{ playerId: string; token: string }[]>([]);
  const [botBusy, setBotBusy] = useState(false);
  const botChoosingRef = useRef<string | null>(null);
  const choiceRequestRef = useRef(false);
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [choosingWord, setChoosingWord] = useState(false);
  // Turn key that this client already locked a word for. Lets us drop the
  // "choosing" overlay immediately instead of waiting for the next snapshot.
  const [lockedTurnKey, setLockedTurnKey] = useState<string | null>(null);

  const joinFn = useServerFn(joinRoom);
  const privFn = useServerFn(getPrivateState);
  const tickFn = useServerFn(tick);
  const startFn = useServerFn(startGame);
  const chooseFn = useServerFn(chooseWord);
  const guessFn = useServerFn(submitGuess);
  const strokeFn = useServerFn(pushStroke);
  const settingsFn = useServerFn(updateSettings);
  const leaveFn = useServerFn(leaveRoom);

  const triggerFeedback = useCallback(
    (kind: GameFeedbackKind, title: string, subtitle?: string) => {
      feedbackIdRef.current += 1;
      setFeedback({ id: feedbackIdRef.current, kind, title, subtitle });
    },
    [],
  );

  useEffect(() => {
    const stored = loadIdentity(upper);
    const savedName = loadNickname();
    const savedAvatar = loadAvatarSvg();
    if (stored)
      setIdentity({
        playerId: stored.playerId,
        token: stored.token,
        clientId: stored.clientId,
      });
    setNickname(savedName);
    setAvatarSvg(
      isPresetCharacterAvatar(savedAvatar)
        ? savedAvatar
        : createDefaultAvatar(savedName || "画画人"),
    );
    setReady(true);
  }, [upper]);

  const {
    room,
    players,
    messages,
    strokes,
    scratch,
    live,
    missing,
    identityInvalid,
    me,
    broadcastLive,
    broadcastLiveEnd,
    appendLocalStroke,
    appendScratchStroke,
    clearScratch,
    broadcastSync,
  } = useRoom(upper, identity);

  const auth = useMemo(
    () =>
      identity
        ? {
            code: upper,
            playerId: identity.playerId,
            token: identity.token,
            clientId: identity.clientId,
          }
        : null,
    [identity, upper],
  );
  const roomJoinReady = nickname.trim().length > 0;

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
        // Stale identity is handled by the rejoin flow; ignore the payload.
        if (alive && !res.authError) setPriv(res);
      } catch {
        /* transient */
      }
    };
    void pull();
    // While the drawer is waiting for the three options (the room flips to
    // "choosing" a moment before the options land) poll fast so the picker does
    // not appear seconds late.
    const waitingForChoices = room.status === "choosing" && room.drawer_id === auth.playerId;
    const t = setInterval(pull, waitingForChoices ? 700 : 4000);
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

  // Local test bots need a heartbeat, otherwise presence reconcile drops them.
  useEffect(() => {
    if (!import.meta.env.DEV || !bots.length) return;
    const beat = () => {
      bots.forEach((b) => {
        void privFn({
          data: { code: upper, playerId: b.playerId, token: b.token },
        }).catch(() => undefined);
      });
    };
    beat();
    const t = setInterval(beat, 4000);
    return () => clearInterval(t);
  }, [bots, upper, privFn]);

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
        room.drawer_id === identity.playerId
          ? "朋友们等着猜，放胆画。"
          : `${drawerName} 开始画了，快看线索。`,
      );
    }
    if (room.status === "turn_end") {
      triggerFeedback(
        "round-end",
        "答案揭晓",
        room.revealed_word ? `答案是「${room.revealed_word}」` : "这一回合结束",
      );
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

  // Lobby doodles are throwaway: wipe them the moment a real round begins.
  useEffect(() => {
    if (room && room.status !== "waiting") clearScratch();
  }, [room?.status, clearScratch]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!identityInvalid) return;
    clearIdentity(upper);
    setIdentity(null);
    toast.info("连接已过期，请重新加入；系统会接回原本的玩家位置。", {
      id: "identity-expired",
    });
  }, [identityInvalid, upper]);

  useEffect(() => {
    choiceRequestRef.current = false;
    setChoosingWord(false);
    setSelectedWord(null);
  }, [room?.turn_index, room?.status]);

  // Test mode: if a test player is the drawer, auto-pick a word so the turn keeps moving.
  useEffect(() => {
    if (!room || room.status !== "choosing" || !bots.length) return;
    const bot = bots.find((b) => b.playerId === room.drawer_id);
    if (!bot) return;
    const key = `${room.current_round}-${room.turn_index}-${bot.playerId}`;
    if (botChoosingRef.current === key) return;
    botChoosingRef.current = key;
    void (async () => {
      try {
        const botAuth = {
          code: upper,
          playerId: bot.playerId,
          token: bot.token,
        };
        const state = await privFn({ data: botAuth });
        const word = state.choices?.[0];
        if (word)
          await chooseFn({
            data: { ...botAuth, word, turnIndex: room.turn_index },
          });
      } catch {
        botChoosingRef.current = null;
      }
    })();
  }, [room, bots, upper, privFn, chooseFn]);

  const handleChooseWord = useCallback(
    async (word: string) => {
      if (!auth || !room || room.status !== "choosing" || choiceRequestRef.current) return;
      choiceRequestRef.current = true;
      setSelectedWord(word);
      setChoosingWord(true);
      try {
        const result = await chooseFn({
          data: { ...auth, word, turnIndex: room.turn_index },
        });
        setSelectedWord(result.word);
        setPriv((previous) => ({
          ...previous,
          word: result.word,
          choices: [],
        }));
        // Push the locked word to everybody immediately instead of waiting for
        // the next poll, so all players enter the drawing round together.
        broadcastSync();
        if (result.word !== word) {
          toast.info(`倒计时已先锁定「${result.word}」`);
        }
      } catch (error) {
        choiceRequestRef.current = false;
        setSelectedWord(null);
        toast.error(error instanceof Error ? error.message : "选题失败，请再试一次");
      } finally {
        setChoosingWord(false);
      }
    },
    [auth, room, chooseFn, broadcastSync],
  );

  const handleStroke = useCallback(
    (stroke: Stroke) => {
      if (!auth) return;
      if (room?.status === "waiting") {
        appendScratchStroke(stroke);
        return;
      }
      appendLocalStroke(stroke);
      void strokeFn({ data: { ...auth, stroke } }).catch(() => undefined);
    },
    [auth, room?.status, appendScratchStroke, appendLocalStroke, strokeFn],
  );

  const doJoin = async () => {
    const trimmedName = nickname.trim();
    if (!trimmedName) {
      toast.error("先输入你的名字");
      return;
    }
    const svg = avatarSvg ?? createDefaultAvatar(trimmedName);

    setJoining(true);
    try {
      // Weak networks drop the join request outright; retry a few times with
      // backoff so a single lost packet does not leave the player outside.
      const res = await retryTransient(() =>
        joinFn({
          data: {
            code: upper,
            name: trimmedName,
            avatarSvg: svg,
            clientId: getOrCreateClientId(),
          },
        }),
      );
      saveNickname(trimmedName);
      saveAvatarSvg(svg);
      saveIdentity(res);
      setIdentity({
        playerId: res.playerId,
        token: res.token,
        clientId: res.clientId,
      });
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

  // Local test mode: spin up a throwaway second player so a round can start.
  const addTestPlayer = async () => {
    setBotBusy(true);
    try {
      const name = `测试玩家${bots.length + 1}`;
      const res = await joinFn({
        data: {
          code: upper,
          name,
          avatarSvg: createDefaultAvatar(name),
          clientId: crypto.randomUUID(),
        },
      });
      setBots((prev) => [...prev, { playerId: res.playerId, token: res.token }]);
      toast.success(`${name} 已加入（仅本地测试）`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "加入测试玩家失败");
    } finally {
      setBotBusy(false);
    }
  };

  const removeTestPlayers = async () => {
    setBotBusy(true);
    try {
      await Promise.all(
        bots.map((b) =>
          leaveFn({
            data: { code: upper, playerId: b.playerId, token: b.token },
          }).catch(() => undefined),
        ),
      );
      setBots([]);
    } finally {
      setBotBusy(false);
    }
  };

  if (!ready)
    return (
      <Shell>
        <p className="text-muted-foreground">载入中…</p>
      </Shell>
    );

  if (missing) {
    return (
      <Shell>
        <div className="panel max-w-md p-6 text-center">
          <h1 className="font-display text-2xl">找不到这一局</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            号码 {upper} 可能已经结束，或输入有误。
          </p>
          <Link
            to="/"
            className="mt-4 inline-block rounded-md border-2 border-[var(--ink)] bg-primary px-4 py-2 text-primary-foreground"
          >
            回到主页
          </Link>
        </div>
      </Shell>
    );
  }

  if (!identity) {
    return (
      <Shell>
        <div className="panel w-full max-w-md p-5 sm:p-6">
          <h1 className="font-display text-2xl">加入 {upper}</h1>
          <p className="mt-1 text-sm text-muted-foreground">输入名字，选个角色，就可以进房。</p>
          <label className="mt-4 block text-sm font-medium" htmlFor="nick">
            你的名字
          </label>
          <input
            id="nick"
            value={nickname}
            maxLength={12}
            onChange={(e) => setNickname(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              if (roomJoinReady) void doJoin();
            }}
            placeholder="例如：Bryan"
            className="mt-1 w-full rounded-md border-2 border-[var(--ink)] bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-primary"
          />
          <div className="mt-4">
            <CharacterPicker
              value={avatarSvg}
              onChange={setAvatarSvg}
              name={nickname || "画画人"}
              compact
            />
          </div>
          <button
            type="button"
            onClick={doJoin}
            disabled={joining || !roomJoinReady}
            className="mt-4 w-full rounded-md border-2 border-[var(--ink)] bg-primary px-4 py-2 font-display text-lg text-primary-foreground shadow-[3px_3px_0_0_var(--ink)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {joining ? "加入中…" : roomJoinReady ? "加入这一局" : "先输入名字"}
          </button>
        </div>
      </Shell>
    );
  }

  if (!room)
    return (
      <Shell>
        <p className="text-muted-foreground">正在连接这一局…</p>
      </Shell>
    );

  const currentRoomTheme = normalizeRoomTheme(room.room_theme);
  const drawer = players.find((p) => p.id === room.drawer_id) ?? null;
  const iAmDrawer = room.drawer_id === identity.playerId;
  const secondsLeft = room.round_ends_at
    ? Math.max(0, Math.ceil((Date.parse(room.round_ends_at) - now) / 1000))
    : 0;
  const inGame = room.status !== "waiting" && room.status !== "ended";
  const isLobby = room.status === "waiting";
  const lockReason = (() => {
    if (isLobby) return "等开局，先随便涂两笔";
    if (room.status === "choosing") return "画画人在选题目…";
    if (room.status === "drawing") return `轮到 ${drawer?.name ?? "画画人"} 画，你负责猜`;
    if (room.status === "turn_end") return "这一回合结束了";
    return "这一局结束了";
  })();
  const guessed = !!me?.has_guessed;

  const wordDisplay = iAmDrawer && priv.word ? [...priv.word].join(" ") : (room.masked_word ?? "");
  const frozenOrder = Array.isArray(room.turn_order) ? room.turn_order.filter(Boolean) : [];
  const turnsPerRound = Math.max(frozenOrder.length || players.length, 1);
  const turnInRound = (room.turn_index % turnsPerRound) + 1;
  const urgent = inGame && room.status === "drawing" && secondsLeft <= 10;
  const withLocalAvatar = (player: Player) =>
    player.id === identity.playerId && !player.avatar_svg && avatarSvg
      ? { ...player, avatar_svg: avatarSvg }
      : player;
  const drawingHint =
    auth && iAmDrawer && room.status === "drawing" && priv.word ? (
      <DrawingHintPanel auth={auth} turnIndex={room.turn_index} word={priv.word} compact />
    ) : null;

  const chat = (
    <ChatPanel
      messages={messages}
      expanded={chatExpanded}
      onToggleExpanded={() => setChatExpanded((v) => !v)}
      disabled={iAmDrawer && room.status === "drawing"}
      placeholder={
        iAmDrawer && room.status === "drawing"
          ? "你负责画，先别答"
          : guessed
            ? "你已经答对，可以聊聊"
            : "输入你的答案…"
      }
      onSend={(text) =>
        void guessFn({ data: { ...auth!, text } }).catch((e) =>
          toast.error(e instanceof Error ? e.message : "发送失败"),
        )
      }
    />
  );

  return (
    <main className="mx-auto flex h-[100dvh] max-w-6xl flex-col gap-2 overflow-hidden p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:gap-3 sm:p-5">
      <header className="panel flex shrink-0 flex-wrap items-center gap-2 px-2.5 py-1.5 sm:gap-3 sm:px-4 sm:py-3">
        <Link to="/" className="hidden font-display text-xl text-primary sm:block">
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
          className="press flex items-center gap-1 rounded-md border-2 border-[var(--ink)] bg-secondary px-2.5 py-1 text-sm tracking-[0.2em] shadow-[2px_2px_0_0_var(--ink)]"
        >
          {upper}
          <Copy className="size-3.5" />
        </button>
        <span className="hidden rounded-full border-2 border-[var(--ink)] bg-accent px-3 py-1 text-xs font-semibold sm:inline">
          {currentRoomTheme}
        </span>
        {inGame && (
          <>
            <span className="rounded-full border-2 border-[var(--ink)] bg-card px-2.5 py-1 text-[11px] sm:px-3 sm:text-sm">
              第 {room.current_round}/{room.total_rounds} 轮 · {turnInRound}/{turnsPerRound}
              <span className="hidden sm:inline"> 位</span>
            </span>
            <span
              className={cn(
                "ml-auto flex size-9 items-center justify-center rounded-full border-2 border-[var(--ink)] font-display text-base tabular-nums sm:size-11 sm:text-lg",
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
            aria-label="离开房间"
            className="press flex items-center gap-1 rounded-md border-2 border-[var(--ink)] bg-card px-2.5 py-1 text-sm shadow-[2px_2px_0_0_var(--ink)] hover:bg-accent"
          >
            <LogOut className="size-3.5" /> <span className="hidden sm:inline">离开</span>
          </button>
        </div>
      </header>

      {inGame && (
        <div className="panel shrink-0 px-3 py-1.5 text-center sm:px-4 sm:py-2">
          <p className="truncate text-[11px] text-muted-foreground sm:text-xs">
            {iAmDrawer
              ? "你正在画："
              : `${drawer?.name ?? "画画人"} 正在画 · ${room.word_length ?? "?"} 个字`}
          </p>
          <p className="font-display text-xl tracking-[0.25em] break-all sm:text-2xl sm:tracking-[0.3em]">
            {wordDisplay || "…"}
          </p>
        </div>
      )}

      <div className="grid min-h-0 min-w-0 flex-1 grid-cols-[minmax(0,1fr)] grid-rows-[auto_minmax(0,1fr)_auto] gap-2 lg:grid-cols-[220px_minmax(0,1fr)_290px] lg:grid-rows-1 lg:gap-3">
        <div className="order-1 min-w-0 shrink-0 lg:order-1 lg:h-auto lg:min-h-0">
          {/* Mobile: horizontal avatar strip. Desktop keeps the tall leaderboard. */}
          <div className="lg:hidden">
            <Scoreboard
              players={players}
              drawerId={room.drawer_id}
              meId={identity.playerId}
              meAvatarSvg={avatarSvg}
              variant="strip"
            />
          </div>
          <div className="hidden h-full min-h-0 lg:block">
            <Scoreboard
              players={players}
              drawerId={room.drawer_id}
              meId={identity.playerId}
              meAvatarSvg={avatarSvg}
            />
          </div>
        </div>

        <div className="relative order-2 min-h-0 min-w-0 lg:order-2">
          <DrawBoard
            strokes={isLobby ? scratch : strokes}
            live={live}
            canDraw={isLobby || (iAmDrawer && room.status === "drawing")}
            lockReason={lockReason}
            modeLabel={
              isLobby ? "自由涂鸦" : iAmDrawer && room.status === "drawing" ? "轮到你画" : undefined
            }
            onStroke={handleStroke}
            onLive={broadcastLive}
            onLiveEnd={broadcastLiveEnd}
            overlay={
              <>
                {room.status === "waiting" && (
                  <Overlay transparent>
                    <WaitingCard
                      canStart={isHost && players.length >= 2}
                      playerCount={players.length}
                      isHost={isHost}
                      code={upper}
                      totalRounds={room.total_rounds}
                      drawSeconds={room.draw_seconds}
                      difficulty={room.difficulty}
                      roomTheme={currentRoomTheme}
                      devTools={
                        import.meta.env.DEV
                          ? {
                              botCount: bots.length,
                              busy: botBusy,
                              onAdd: addTestPlayer,
                              onClear: removeTestPlayers,
                            }
                          : null
                      }
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
                              data-testid="word-choice"
                              onClick={() => void handleChooseWord(w)}
                              disabled={choosingWord}
                              aria-pressed={selectedWord === w}
                              className={cn(
                                "press animate-pop-in rounded-md border-2 border-[var(--ink)] px-4 py-2 font-display text-lg shadow-[3px_3px_0_0_var(--ink)] disabled:cursor-wait",
                                selectedWord === w
                                  ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2"
                                  : "bg-card hover:bg-accent",
                                choosingWord && selectedWord !== w && "opacity-45",
                              )}
                            >
                              {selectedWord === w ? `✓ ${w}` : w}
                            </button>
                          ))}
                        </div>
                        {selectedWord && (
                          <p className="mt-3 text-sm font-semibold" role="status">
                            已选「{selectedWord}」{choosingWord ? "，正在锁定…" : ""}
                          </p>
                        )}
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
                              <span className="max-w-32 truncate" title={p.name}>
                                {p.name}
                              </span>
                              <span className="font-semibold text-[var(--success)]">
                                +{p.round_score}
                              </span>
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
                              <span className="max-w-32 truncate" title={p.name}>
                                {p.name}
                              </span>
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

        {/* Mobile: 答题室 is always on screen under the canvas; desktop keeps
            the right column with the drawer hint stacked above it. */}
        <div
          className="order-3 min-h-0 min-w-0 overflow-hidden lg:flex lg:h-full lg:flex-col lg:gap-3"
          style={{ ["--chat-h" as string]: chatExpanded ? "56dvh" : "30dvh" }}
        >
          {drawingHint && <div className="hidden shrink-0 lg:block">{drawingHint}</div>}
          <div
            className={cn(
              "h-[var(--chat-h)] min-h-0 overflow-hidden transition-[height] duration-200 lg:h-auto",
              drawingHint ? "lg:flex-1" : "lg:h-full",
            )}
          >
            {chat}
          </div>
        </div>
      </div>

      {/* Mobile: the drawer hint opens on demand instead of eating canvas space */}
      {drawingHint && (
        <button
          type="button"
          onClick={() => setHintOpen(true)}
          className="press fixed right-3 bottom-[38dvh] z-40 flex items-center gap-1 rounded-full border-2 border-[var(--ink)] bg-primary px-3 py-2 text-sm text-primary-foreground shadow-[3px_3px_0_0_var(--ink)] lg:hidden"
        >
          <Lightbulb className="size-4" /> 提示图
        </button>
      )}
      {drawingHint && hintOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-4 backdrop-blur-[2px] lg:hidden">
          <button
            type="button"
            aria-label="关闭提示图"
            onClick={() => setHintOpen(false)}
            className="absolute inset-0"
          />
          <div className="relative w-full max-w-sm">
            <button
              type="button"
              aria-label="关闭提示图"
              onClick={() => setHintOpen(false)}
              className="absolute -top-3 -right-2 z-10 grid size-9 place-items-center rounded-full border-2 border-[var(--ink)] bg-card shadow-[2px_2px_0_0_var(--ink)]"
            >
              <X className="size-4" />
            </button>
            {drawingHint}
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

function Overlay({ children, transparent }: { children: React.ReactNode; transparent?: boolean }) {
  // `transparent` keeps the canvas usable underneath (lobby doodling).
  return (
    <div
      className={cn(
        "absolute inset-0 flex items-center justify-center overflow-y-auto overscroll-contain p-2 sm:p-4",
        transparent ? "pointer-events-none" : "bg-background/85 backdrop-blur-[2px]",
      )}
    >
      <div className={cn("my-auto max-h-full w-full max-w-md", transparent && "pointer-events-auto")}>
        {children}
      </div>
    </div>
  );
}

function WaitingCard({
  canStart,
  playerCount,
  isHost,
  code,
  totalRounds,
  drawSeconds,
  difficulty,
  roomTheme,
  devTools,
  onSettings,
  onStart,
}: {
  canStart: boolean;
  playerCount: number;
  isHost: boolean;
  code: string;
  totalRounds: number;
  drawSeconds: number;
  difficulty: string;
  roomTheme: RoomTheme;
  devTools?: {
    botCount: number;
    busy: boolean;
    onAdd: () => void;
    onClear: () => void;
  } | null;
  onSettings: (s: {
    totalRounds: number;
    drawSeconds: number;
    difficulty: Difficulty;
    roomTheme: RoomTheme;
  }) => void;
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
              <option key={theme.value} value={theme.value}>
                {theme.label}
              </option>
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
              <option key={d} value={d}>
                {d}
              </option>
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
              <option key={n} value={n}>
                {n}
              </option>
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
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        {playerCount < 2
          ? `还差 ${2 - playerCount} 人才能开始（现在 ${playerCount}/2）`
          : isHost
            ? "全部难度会随机出题；主题和设置会自动保存"
            : "等主持人调整主题和设置"}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">画纸现在可以自由涂鸦，开局会自动清空。</p>
      {isHost ? (
        <button
          type="button"
          onClick={onStart}
          disabled={!canStart}
          className="mt-4 w-full rounded-md border-2 border-[var(--ink)] bg-primary px-4 py-2 font-display text-lg text-primary-foreground shadow-[3px_3px_0_0_var(--ink)] disabled:opacity-50"
        >
          {canStart ? "开始这一局" : `还差 ${Math.max(1, 2 - playerCount)} 人才能开始`}
        </button>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">等主持人开始…</p>
      )}
      {devTools && (
        <div className="mt-4 rounded-md border-2 border-dashed border-[var(--ink)]/40 p-3 text-left">
          <p className="text-xs font-semibold">本地测试模式</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            一键补一名测试玩家凑够人数；轮到它画时会自动选题，方便你验证落笔与回合流程。
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={devTools.onAdd}
              disabled={devTools.busy}
              className="flex-1 rounded-md border-2 border-[var(--ink)] bg-card px-3 py-1.5 text-xs font-medium shadow-[2px_2px_0_0_var(--ink)] disabled:opacity-50"
            >
              {devTools.busy ? "处理中…" : "加一名测试玩家"}
            </button>
            <button
              type="button"
              onClick={devTools.onClear}
              disabled={devTools.busy || devTools.botCount === 0}
              className="rounded-md border-2 border-[var(--ink)] bg-background px-3 py-1.5 text-xs font-medium disabled:opacity-40"
            >
              清掉（{devTools.botCount}）
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
