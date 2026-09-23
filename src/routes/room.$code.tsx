import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Copy,
  Crown,
  Lightbulb,
  LoaderCircle,
  LogOut,
  Pencil,
  Play,
  Radio,
  RotateCcw,
  Share2,
  SlidersHorizontal,
  Sparkles,
  Trophy,
  Users,
  X,
} from "lucide-react";
import { Brand } from "@/components/arcade/Brand";
import { SoundToggle } from "@/components/arcade/SoundToggle";
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
import "@/styles/arcade-room.css";

export const Route = createFileRoute("/room/$code")({
  head: () => ({
    meta: [
      { title: "今晚这一局 · 乱画俱乐部" },
      {
        name: "description",
        content: "你的朋友，你的主场。一人乱画，全场开猜。",
      },
      { property: "og:title", content: "朋友喊你入局 · 乱画俱乐部" },
      {
        property: "og:description",
        content: "带上你的脑洞，来乱画俱乐部开一局。",
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
  const [starting, setStarting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [viewport, setViewport] = useState<{
    height: number;
    top: number;
    keyboard: boolean;
  } | null>(null);
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
    // The visible countdown is whole seconds; updating four times per second
    // only forced the canvas, roster and chat to reconcile for identical UI.
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Both resize-content browsers and Safari's visual viewport need to leave
  // the answer composer above the keyboard without distorting the canvas.
  useEffect(() => {
    const visual = window.visualViewport;
    let restingHeight = window.innerHeight;
    let measuredWidth = window.innerWidth;
    let frame = 0;
    const measure = () => {
      const height = Math.round(visual?.height ?? window.innerHeight);
      const editing = document.activeElement?.matches("input, textarea") ?? false;
      if (window.innerWidth !== measuredWidth) {
        restingHeight = window.innerHeight;
        measuredWidth = window.innerWidth;
      }
      if (!editing) restingHeight = Math.max(restingHeight, window.innerHeight);
      const next = {
        height,
        top: Math.round(visual?.offsetTop ?? 0),
        keyboard: editing && restingHeight - height > 120,
      };
      setViewport((previous) =>
        previous?.height === next.height &&
        previous.top === next.top &&
        previous.keyboard === next.keyboard
          ? previous
          : next,
      );
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("resize", schedule);
    visual?.addEventListener("resize", schedule);
    visual?.addEventListener("scroll", schedule);
    document.addEventListener("focusin", schedule);
    document.addEventListener("focusout", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", schedule);
      visual?.removeEventListener("resize", schedule);
      visual?.removeEventListener("scroll", schedule);
      document.removeEventListener("focusin", schedule);
      document.removeEventListener("focusout", schedule);
    };
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

    // The regular host heartbeat may land up to 1.5s after the visible clock
    // reaches zero. Schedule one exact deadline tick and announce its result so
    // phones do not sit at 00 while waiting for two more network cycles.
    const deadline = room.round_ends_at ? Date.parse(room.round_ends_at) : Number.NaN;
    const deadlineTimer = Number.isFinite(deadline)
      ? window.setTimeout(
          () => {
            void tickFn({ data: auth })
              .then(() => broadcastSync())
              .catch(() => undefined);
          },
          Math.max(0, deadline - Date.now() + 50),
        )
      : null;

    return () => {
      clearInterval(t);
      if (deadlineTimer !== null) window.clearTimeout(deadlineTimer);
    };
  }, [auth?.playerId, isHost, room?.status, room?.round_ends_at]); // eslint-disable-line react-hooks/exhaustive-deps

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

  useEffect(() => {
    setLockedTurnKey(null);
  }, [room?.current_round, room?.turn_index]);

  useEffect(() => {
    if (room?.status === "waiting" || room?.status === "ended") setLockedTurnKey(null);
  }, [room?.status]);

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
        // Hide the picker locally right away; the snapshot may take a poll or
        // two to flip to "drawing" on slow mobile networks.
        setLockedTurnKey(`${room.current_round}-${room.turn_index}`);
        // Push the locked word to everybody immediately instead of waiting for
        // the next poll, so all players enter the drawing round together.
        broadcastSync();
        // Mobile networks drop the odd request: nudge a few more times so the
        // blank canvas appears without waiting for the slow poll.
        [250, 700, 1500].forEach((delay) => window.setTimeout(() => broadcastSync(), delay));
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
    if (joining) return;
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

  const copyInvite = async (link = false) => {
    try {
      if (!navigator.clipboard) throw new Error("clipboard-unavailable");
      await navigator.clipboard.writeText(link ? window.location.href : upper);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
      toast.success(link ? "邀请链接复制好了，丢进群里吧。" : `房间号 ${upper} 已复制`);
    } catch {
      toast.error(`复制没成功，直接把房间号 ${upper} 发给朋友也行。`);
    }
  };

  const shareInvite = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "乱画俱乐部 · 朋友喊你入局",
          text: `房间 ${upper}，就差你了。画得越歪，笑得越大声。`,
          url: window.location.href,
        });
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        await copyInvite(true);
      }
    } else {
      await copyInvite(true);
    }
  };

  const doStart = async () => {
    if (!auth || starting) return;
    setStarting(true);
    try {
      await startFn({ data: auth });
      broadcastSync();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "还没开成，再试一次。");
    } finally {
      setStarting(false);
    }
  };

  if (!ready)
    return (
      <Shell>
        <div className="arcade-room-loading" role="status">
          <LoaderCircle className="animate-spin" />
          <p>正在点亮你的主场…</p>
        </div>
      </Shell>
    );

  if (missing) {
    return (
      <Shell>
        <div className="arcade-room-entry arcade-room-empty">
          <span className="arcade-room-eyebrow">PARTY NOT FOUND</span>
          <div className="arcade-room-error-code" aria-hidden="true">
            404
          </div>
          <h1>这局，走散了。</h1>
          <p>房间 {upper} 不在了。检查一下号码，或自己组个新局。</p>
          <Link to="/" className="arcade-room-primary">
            回俱乐部开一局 <ArrowRight size={18} />
          </Link>
        </div>
      </Shell>
    );
  }

  if (!identity) {
    return (
      <Shell>
        <div className="arcade-room-entry">
          <div className="arcade-room-entry-top">
            <span className="arcade-room-eyebrow">YOU'RE ON THE LIST</span>
            <span className="arcade-room-code-small">{upper}</span>
          </div>
          <h1>
            朋友等你，
            <br />
            <span>上线乱画。</span>
          </h1>
          <p>取个名，选个分身。今晚的笑点就靠你了。</p>
          <form
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229)
              )
                event.preventDefault();
            }}
            onSubmit={(event) => {
              event.preventDefault();
              if (roomJoinReady) void doJoin();
            }}
          >
            <label className="arcade-room-field" htmlFor="nick">
              今晚怎么叫你？
              <input
                id="nick"
                value={nickname}
                maxLength={12}
                autoComplete="nickname"
                onChange={(event) => setNickname(event.target.value)}
                placeholder="例如：不加辣"
                required
              />
            </label>
            <CharacterPicker
              value={avatarSvg}
              onChange={setAvatarSvg}
              name={nickname || "夜猫子"}
              compact
            />
            <button
              type="submit"
              disabled={joining || !roomJoinReady}
              className="arcade-room-primary"
            >
              {joining ? (
                <LoaderCircle size={18} className="animate-spin" />
              ) : (
                <ArrowRight size={18} />
              )}
              {joining ? "正在入场…" : "我来了，入局！"}
            </button>
          </form>
          <Link to="/" className="arcade-room-back">
            <ArrowLeft size={14} /> 返回俱乐部
          </Link>
        </div>
      </Shell>
    );
  }

  if (!room)
    return (
      <Shell>
        <div className="arcade-room-loading" role="status">
          <Radio size={30} />
          <p>正在连接房间 {upper}…</p>
          <span>如果刚刚断线，会接回你的原位。</span>
        </div>
      </Shell>
    );

  const currentRoomTheme = normalizeRoomTheme(room.room_theme);
  const drawer = players.find((player) => player.id === room.drawer_id) ?? null;
  const iAmDrawer = room.drawer_id === identity.playerId;
  const secondsLeft = room.round_ends_at
    ? Math.max(0, Math.ceil((Date.parse(room.round_ends_at) - now) / 1000))
    : 0;
  const inGame = room.status !== "waiting" && room.status !== "ended";
  const isLobby = room.status === "waiting";
  const guessed = !!me?.has_guessed;
  const connectedPlayers = players.filter((player) => player.connection_status !== "disconnected");
  const canStart = connectedPlayers.length >= 2;
  const wordDisplay = iAmDrawer && priv.word ? priv.word : (room.masked_word ?? "");
  const frozenOrder = Array.isArray(room.turn_order) ? room.turn_order.filter(Boolean) : [];
  const turnsPerRound = Math.max(frozenOrder.length || players.length, 1);
  const turnInRound = (room.turn_index % turnsPerRound) + 1;
  const urgent = room.status === "drawing" && secondsLeft <= 10;
  const progress = Math.min(100, Math.max(0, (secondsLeft / room.draw_seconds) * 100));
  const rankedPlayers = [...players].sort((a, b) => b.score - a.score);
  const roundWinners = [...players]
    .filter((player) => player.round_score > 0)
    .sort((a, b) => b.round_score - a.round_score);
  const withLocalAvatar = (player: Player) =>
    player.id === identity.playerId && !player.avatar_svg && avatarSvg
      ? { ...player, avatar_svg: avatarSvg }
      : player;
  const drawingHint = auth && iAmDrawer && room.status === "drawing" && priv.word;
  const lockReason =
    room.status === "choosing"
      ? `${drawer?.name ?? "画手"} 正在挑题，准备开猜。`
      : room.status === "drawing"
        ? guessed
          ? "猜中了！欣赏一下朋友的神作。"
          : "认真看画，脑洞打开。"
        : "答案揭晓，下位画手准备。";

  const chat = (
    <ChatPanel
      messages={messages}
      expanded={inGame && chatExpanded}
      onToggleExpanded={inGame ? () => setChatExpanded((value) => !value) : undefined}
      disabled={iAmDrawer && room.status === "drawing"}
      placeholder={
        isLobby || room.status === "ended"
          ? "先跟大家打个招呼…"
          : iAmDrawer && room.status === "drawing"
            ? "画手不能剧透哦"
            : guessed
              ? "猜中啦，来点掌声…"
              : "脑洞来了？输入答案…"
      }
      onSend={async (text) => {
        try {
          const result = await guessFn({ data: { ...auth!, text } });
          // The sender gets the RPC acknowledgement immediately; this sync
          // then delivers the new chat row, score and round state to everyone.
          broadcastSync();
          return result;
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "发送失败，再试一次。");
          throw error;
        }
      }}
    />
  );

  return (
    <main
      className={cn(
        "arcade-room",
        inGame && "arcade-room--playing",
        inGame && iAmDrawer && room.status === "drawing" && "arcade-room--drawing",
        inGame && chatExpanded && "arcade-room--chat-expanded",
        inGame && viewport?.keyboard && "arcade-room--keyboard",
      )}
      style={
        {
          "--room-viewport-height": viewport ? `${viewport.height}px` : "100dvh",
          "--room-viewport-top": `${viewport?.top ?? 0}px`,
        } as React.CSSProperties
      }
    >
      <header className="arcade-room-header">
        <Brand compact />
        <div className="arcade-room-header-middle">
          <button
            type="button"
            onClick={() => void copyInvite()}
            className="arcade-room-code-button"
            aria-label={`复制房间号码 ${upper}`}
          >
            <span className="arcade-room-live-dot" /> {upper}
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </button>
          <span className="arcade-room-header-caption">
            {isLobby ? "集合中" : room.status === "ended" ? "今晚的神作" : "LIVE SESSION"}
          </span>
        </div>
        <SoundToggle />
        <button
          type="button"
          onClick={() => void doLeave()}
          className="arcade-room-icon-button"
          aria-label="离开房间"
        >
          <LogOut size={18} />
          <span>离开</span>
        </button>
      </header>

      {isLobby && (
        <div className="arcade-room-lobby">
          <section className="arcade-room-lobby-main">
            <div className="arcade-room-lobby-intro">
              <span className="arcade-room-eyebrow">
                <span className="arcade-room-live-dot" /> THE PRE-PARTY
              </span>
              <h1>
                人齐了，
                <br />
                <span>就开闹。</span>
              </h1>
              <p>画功可以没有，朋友一定要有。</p>
              <div className="arcade-room-lobby-orbit" aria-hidden="true">
                <Sparkles />
              </div>
            </div>

            <div className="arcade-room-invite">
              <div>
                <span className="arcade-room-eyebrow">今晚的入场暗号</span>
                <button
                  type="button"
                  className="arcade-room-invite-code"
                  onClick={() => void copyInvite()}
                  aria-label={`复制房间号 ${upper}`}
                >
                  {upper} {copied ? <Check size={20} /> : <Copy size={20} />}
                </button>
              </div>
              <button
                type="button"
                className="arcade-room-share"
                onClick={() => void shareInvite()}
              >
                <Share2 size={18} /> 喊朋友来
              </button>
            </div>

            <section className="arcade-room-crew" aria-labelledby="crew-title">
              <div className="arcade-room-section-heading">
                <h2 id="crew-title">
                  <Users size={16} /> 今晚的阵容
                </h2>
                <span>{connectedPlayers.length} / 12 已到场</span>
              </div>
              <div className="arcade-room-crew-grid">
                {players.map((player) => (
                  <div
                    className={cn(
                      "arcade-room-crew-player",
                      player.id === identity.playerId && "arcade-room-crew-player--you",
                      player.connection_status === "disconnected" &&
                        "arcade-room-crew-player--away",
                    )}
                    key={player.id}
                  >
                    <PlayerAvatar player={withLocalAvatar(player)} size="lg" />
                    <div className="arcade-room-player-name">
                      <strong title={player.name}>{player.name}</strong>
                      <span>
                        {player.connection_status === "disconnected"
                          ? "暂时断线"
                          : player.is_host
                            ? "组局的人"
                            : player.id === identity.playerId
                              ? "就是你"
                              : "已就位"}
                      </span>
                    </div>
                    {player.is_host ? (
                      <Crown size={15} />
                    ) : (
                      <span className="arcade-room-presence-dot" />
                    )}
                  </div>
                ))}
                {players.length < 12 && (
                  <button
                    type="button"
                    onClick={() => void shareInvite()}
                    className="arcade-room-crew-empty"
                  >
                    <span>+</span>
                    <div>
                      给朋友留个位<small>点击发送邀请</small>
                    </div>
                  </button>
                )}
              </div>
            </section>

            <MatchSettings
              isHost={isHost}
              totalRounds={room.total_rounds}
              drawSeconds={room.draw_seconds}
              difficulty={room.difficulty}
              roomTheme={currentRoomTheme}
              onSettings={(settings) =>
                void settingsFn({ data: { ...auth!, ...settings } })
                  .then(() => broadcastSync())
                  .catch((error) =>
                    toast.error(
                      error instanceof Error ? error.message : "设置没保存成功，再试一次。",
                    ),
                  )
              }
            />
            <div className="arcade-room-start">
              {isHost ? (
                <button
                  type="button"
                  onClick={() => void doStart()}
                  disabled={!canStart || starting}
                  className="arcade-room-primary"
                >
                  {starting ? (
                    <LoaderCircle className="animate-spin" size={18} />
                  ) : (
                    <Play size={18} fill="currentColor" />
                  )}
                  {starting ? "派对启动中…" : canStart ? "人齐，开画！" : "还差一位朋友"}
                  <ArrowRight size={18} />
                </button>
              ) : (
                <p className="arcade-room-waiting">
                  <Radio size={18} /> {canStart ? "已就位，等房主开画。" : "再喊一位朋友就能开局。"}
                </p>
              )}
              <p>
                {isHost ? "至少 2 人就能开始。每个人都会轮到画。" : "放轻松，画得不像才有故事。"}
              </p>
            </div>
            {import.meta.env.DEV && (
              <details className="arcade-room-dev">
                <summary>本地测试工具</summary>
                <button type="button" onClick={() => void addTestPlayer()} disabled={botBusy}>
                  加一名测试玩家
                </button>
                <button
                  type="button"
                  onClick={() => void removeTestPlayers()}
                  disabled={botBusy || bots.length === 0}
                >
                  清掉测试玩家（{bots.length}）
                </button>
              </details>
            )}
          </section>
          <aside className="arcade-room-lobby-side">
            <div className="arcade-room-lobby-note">
              <span>HOUSE RULE NO. 01</span>
              <p>
                画得越歪，
                <br />
                笑得越大声。
              </p>
              <Pencil size={28} />
            </div>
            <div className="arcade-room-lobby-chat">{chat}</div>
            <details className="arcade-room-doodle">
              <summary>
                <Pencil size={16} /> 等人时，先涂两笔 <ChevronDown size={16} />
              </summary>
              <p>大家共用一张纸。开局会自动清空。</p>
              <div className="arcade-room-doodle-canvas">
                <DrawBoard
                  strokes={scratch}
                  live={live}
                  canDraw
                  modeLabel="暖场涂鸦"
                  onStroke={handleStroke}
                  onLive={broadcastLive}
                  onLiveEnd={broadcastLiveEnd}
                />
              </div>
            </details>
          </aside>
        </div>
      )}

      {inGame && (
        <>
          <section
            className={cn("arcade-room-roundbar", urgent && "arcade-room-roundbar--urgent")}
            aria-label="当前回合"
          >
            <div className="arcade-room-roundcount">
              <span>ROUND</span>
              <strong>
                {String(room.current_round).padStart(2, "0")}
                <small> / {String(room.total_rounds).padStart(2, "0")}</small>
              </strong>
              <p>
                第 {turnInRound} / {turnsPerRound} 位画手
              </p>
            </div>
            <div className="arcade-room-word">
              <span>
                {room.status === "turn_end"
                  ? "这波脑洞，接住了吗？"
                  : room.status === "choosing"
                    ? iAmDrawer
                      ? "你的回合 · 选一个题目"
                      : `${drawer?.name ?? "画手"} 正在选题`
                    : iAmDrawer
                      ? "你的秘密题目 · 别说出来"
                      : `${drawer?.name ?? "画手"} 正在画 · ${room.word_length ?? "?"} 个字`}
              </span>
              <strong>
                {room.status === "turn_end"
                  ? room.revealed_word
                  : room.status === "choosing"
                    ? "准备开画"
                    : wordDisplay || "···"}
              </strong>
            </div>
            <div className="arcade-room-timer" role="timer" aria-label={`剩余 ${secondsLeft} 秒`}>
              <strong>{String(secondsLeft).padStart(2, "0")}</strong>
              <span>SECONDS</span>
            </div>
            <div className="arcade-room-time-track" aria-hidden="true">
              <span style={{ width: `${room.status === "drawing" ? progress : 100}%` }} />
            </div>
          </section>
          <div className="arcade-room-stage">
            <aside className="arcade-room-scores">
              <div className="arcade-room-score-strip">
                <Scoreboard
                  players={players}
                  drawerId={room.drawer_id}
                  meId={identity.playerId}
                  meAvatarSvg={avatarSvg}
                  variant="strip"
                />
              </div>
              <div className="arcade-room-score-list">
                <Scoreboard
                  players={players}
                  drawerId={room.drawer_id}
                  meId={identity.playerId}
                  meAvatarSvg={avatarSvg}
                />
              </div>
            </aside>
            <div
              className={cn(
                "arcade-room-canvas",
                iAmDrawer && room.status === "drawing" && "arcade-room-canvas--drawing",
              )}
            >
              <DrawBoard
                strokes={strokes}
                live={live}
                canDraw={iAmDrawer && room.status === "drawing"}
                lockReason={lockReason}
                modeLabel={iAmDrawer && room.status === "drawing" ? "你的主场" : "现场神作"}
                onStroke={handleStroke}
                onLive={broadcastLive}
                onLiveEnd={broadcastLiveEnd}
                overlay={
                  (room.status === "choosing" &&
                    lockedTurnKey !== `${room.current_round}-${room.turn_index}`) ||
                  room.status === "turn_end" ? (
                    <>
                      {room.status === "choosing" &&
                        lockedTurnKey !== `${room.current_round}-${room.turn_index}` && (
                          <Overlay>
                            {iAmDrawer ? (
                              <div className="arcade-room-choice">
                                <span className="arcade-room-eyebrow">PICK YOUR PLOT TWIST</span>
                                <h2>这一笔，画什么？</h2>
                                <p>选一个就开画，别让朋友等太久。</p>
                                <div className="arcade-room-choices">
                                  {priv.choices.map((word, index) => (
                                    <button
                                      key={word}
                                      type="button"
                                      data-testid="word-choice"
                                      onClick={() => void handleChooseWord(word)}
                                      disabled={choosingWord}
                                      aria-pressed={selectedWord === word}
                                      className={cn(
                                        "arcade-room-choice-card",
                                        selectedWord === word &&
                                          "arcade-room-choice-card--selected",
                                      )}
                                    >
                                      <span>0{index + 1}</span>
                                      <strong>{word}</strong>
                                      {selectedWord === word ? (
                                        <Check size={18} />
                                      ) : (
                                        <ArrowRight size={18} />
                                      )}
                                    </button>
                                  ))}
                                  {priv.choices.length === 0 && (
                                    <p className="arcade-room-choice-loading" role="status">
                                      <LoaderCircle size={18} className="animate-spin" />{" "}
                                      题目正在赶来…
                                    </p>
                                  )}
                                </div>
                                {selectedWord && (
                                  <p role="status">
                                    「{selectedWord}」{choosingWord ? "正在锁定…" : "，准备开画。"}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <div className="arcade-room-on-deck">
                                {drawer && (
                                  <PlayerAvatar player={withLocalAvatar(drawer)} size="lg" />
                                )}
                                <span className="arcade-room-eyebrow">NEXT ON THE CANVAS</span>
                                <h2>
                                  {drawer?.name ?? "画手"}
                                  <br />
                                  <span>正在酝酿神作。</span>
                                </h2>
                                <p>他在选题，你先把脑洞打开。</p>
                                <div className="arcade-room-wait-dots" aria-hidden="true">
                                  <i />
                                  <i />
                                  <i />
                                </div>
                              </div>
                            )}
                          </Overlay>
                        )}
                      {room.status === "turn_end" && (
                        <Overlay>
                          <div className="arcade-room-reveal">
                            <span className="arcade-room-eyebrow">THE BIG REVEAL</span>
                            <p>原来画的是</p>
                            <h2>{room.revealed_word ?? "—"}</h2>
                            <div className="arcade-room-round-winners">
                              {roundWinners.length ? (
                                roundWinners.map((player) => (
                                  <div key={player.id}>
                                    <PlayerAvatar player={withLocalAvatar(player)} size="sm" />
                                    <span>{player.name}</span>
                                    <strong>+{player.round_score}</strong>
                                  </div>
                                ))
                              ) : (
                                <p>这波脑洞太大，全场没接住。</p>
                              )}
                            </div>
                            <span className="arcade-room-next-round">
                              下位画手准备 · {secondsLeft}s
                            </span>
                          </div>
                        </Overlay>
                      )}
                    </>
                  ) : undefined
                }
              />
            </div>
            <aside
              className={cn(
                "arcade-room-chat-column",
                chatExpanded && "arcade-room-chat-column--expanded",
              )}
            >
              {drawingHint && (
                <button
                  type="button"
                  onClick={() => setHintOpen(true)}
                  className="arcade-room-hint-button"
                >
                  <Lightbulb size={17} /> 没灵感？偷看一下提示图 <ArrowRight size={15} />
                </button>
              )}
              <div className="arcade-room-stage-chat">{chat}</div>
            </aside>
          </div>
        </>
      )}

      {room.status === "ended" && (
        <div className="arcade-room-finale">
          <section className="arcade-room-results">
            <span className="arcade-room-eyebrow">
              <Trophy size={16} /> THE AFTERPARTY
            </span>
            <h1>
              今晚，<span>谁最懂？</span>
            </h1>
            <p>有人靠画功，有人靠脑洞。反正全场都赢了笑声。</p>
            <div className="arcade-room-podium" aria-label="本局前三名">
              {rankedPlayers.slice(0, 3).map((player, index) => (
                <div
                  className={`arcade-room-podium-player arcade-room-podium-player--${index + 1}`}
                  key={player.id}
                >
                  {index === 0 && <Crown className="arcade-room-podium-crown" size={26} />}
                  <PlayerAvatar player={withLocalAvatar(player)} size="lg" />
                  <strong title={player.name}>{player.name}</strong>
                  <span>
                    {player.score}
                    <small> PTS</small>
                  </span>
                  <div className="arcade-room-podium-step">
                    <span>0{index + 1}</span>
                    <small>{["脑洞之王", "灵魂画友", "猜题高手"][index]}</small>
                  </div>
                </div>
              ))}
            </div>
            {rankedPlayers.length > 3 && (
              <ol className="arcade-room-final-ranks" start={4}>
                {rankedPlayers.slice(3).map((player, index) => (
                  <li key={player.id}>
                    <span>{String(index + 4).padStart(2, "0")}</span>
                    <PlayerAvatar player={withLocalAvatar(player)} size="sm" />
                    <strong>{player.name}</strong>
                    <span>{player.score} PTS</span>
                  </li>
                ))}
              </ol>
            )}
            <div className="arcade-room-replay">
              {isHost ? (
                <button
                  type="button"
                  onClick={() => void doStart()}
                  disabled={starting || !canStart}
                  className="arcade-room-primary"
                >
                  <RotateCcw size={18} />{" "}
                  {starting ? "准备下一局…" : canStart ? "不服？再来一局" : "等朋友回来，再来一局"}{" "}
                  <ArrowRight size={18} />
                </button>
              ) : (
                <p className="arcade-room-waiting">
                  <Radio size={17} /> 还想玩？叫房主再开一局。
                </p>
              )}
              <button
                type="button"
                onClick={() => void shareInvite()}
                className="arcade-room-secondary"
              >
                <Share2 size={16} /> 喊更多朋友来
              </button>
            </div>
          </section>
          <aside className="arcade-room-results-chat">{chat}</aside>
        </div>
      )}

      {drawingHint && hintOpen && (
        <HintDialog onClose={() => setHintOpen(false)}>
          <DrawingHintPanel auth={auth!} turnIndex={room.turn_index} word={priv.word!} compact />
        </HintDialog>
      )}
      <GameFeedback event={feedback} />
    </main>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="arcade-room-shell">
      <header>
        <Brand />
      </header>
      <div className="arcade-room-shell-content">{children}</div>
      <footer>GOOD FRIENDS. QUESTIONABLE DRAWINGS.</footer>
    </main>
  );
}

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="arcade-room-overlay">
      <div>{children}</div>
    </div>
  );
}

function HintDialog({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={dialogRef}
      className="arcade-room-hint-dialog"
      aria-label="只给画手看的灵感提示"
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div>
        <div className="arcade-room-hint-heading">
          <span>画手专属 · 不许剧透</span>
          <button type="button" onClick={onClose} aria-label="关闭提示图" autoFocus>
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}

function MatchSettings({
  isHost,
  totalRounds,
  drawSeconds,
  difficulty,
  roomTheme,
  onSettings,
}: {
  isHost: boolean;
  totalRounds: number;
  drawSeconds: number;
  difficulty: string;
  roomTheme: RoomTheme;
  onSettings: (settings: {
    totalRounds: number;
    drawSeconds: number;
    difficulty: Difficulty;
    roomTheme: RoomTheme;
  }) => void;
}) {
  const currentDifficulty = asDifficulty(difficulty);
  const settings = { totalRounds, drawSeconds, difficulty: currentDifficulty, roomTheme };
  return (
    <details className="arcade-room-settings">
      <summary>
        <SlidersHorizontal size={17} />
        <span>
          <strong>今晚怎么玩</strong>
          <small>
            {roomTheme} · {totalRounds} 轮 · {drawSeconds} 秒 · {currentDifficulty}
          </small>
        </span>
        <ChevronDown size={17} />
      </summary>
      <div className="arcade-room-settings-fields">
        <label>
          题目频道
          <select
            disabled={!isHost}
            value={roomTheme}
            onChange={(event) =>
              onSettings({ ...settings, roomTheme: normalizeRoomTheme(event.target.value) })
            }
          >
            {ROOM_THEME_OPTIONS.map((theme) => (
              <option key={theme.value} value={theme.value}>
                {theme.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          脑洞难度
          <select
            disabled={!isHost}
            value={currentDifficulty}
            onChange={(event) =>
              onSettings({ ...settings, difficulty: asDifficulty(event.target.value) })
            }
          >
            {DIFFICULTIES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label>
          玩几轮
          <select
            disabled={!isHost}
            value={totalRounds}
            onChange={(event) =>
              onSettings({ ...settings, totalRounds: Number(event.target.value) })
            }
          >
            {[1, 2, 3, 4, 5, 6, 8, 10].map((value) => (
              <option key={value} value={value}>
                {value} 轮
              </option>
            ))}
          </select>
        </label>
        <label>
          每人画多久
          <select
            disabled={!isHost}
            value={drawSeconds}
            onChange={(event) =>
              onSettings({ ...settings, drawSeconds: Number(event.target.value) })
            }
          >
            {[40, 60, 80, 100, 120].map((value) => (
              <option key={value} value={value}>
                {value} 秒
              </option>
            ))}
          </select>
        </label>
      </div>
      <p>{isHost ? "设置自动保存，全场一起同步。" : "房主决定今晚的玩法。"}</p>
    </details>
  );
}
