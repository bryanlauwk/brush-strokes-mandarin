import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowRight, Brush, ChevronDown, DoorOpen, Sparkles, UserRound } from "lucide-react";
import { CharacterPicker } from "@/components/game/CharacterPicker";
import { createRoom, roomExists } from "@/lib/game.functions";
import { ROOM_THEME_OPTIONS, type RoomTheme } from "@/lib/game-themes";
import { createDefaultAvatar, isPresetCharacterAvatar } from "@/lib/character-avatars";
import homeUkiyoBg from "@/assets/home-ukiyo-bg.png.asset.json";
import { loadAvatarSvg, loadNickname, saveAvatarSvg, saveIdentity, saveNickname } from "@/lib/player-identity";
import "@/styles/home-ukiyo.css";

const appTitle = "画啦猜啦 · 马来西亚华语画猜派对";
const appDescription = "选角色、开房间、一起画画猜题。";

type EntryIntent = "create" | "join";
type EntryTab = "create" | "join";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 5;

type CodeStatus = "idle" | "checking" | "found" | "missing" | "error";

function sanitizeCode(raw: string) {
  const upper = raw.toUpperCase().replace(/\s+/g, "");
  let clean = "";
  let dropped = false;
  for (const ch of upper) {
    if (CODE_ALPHABET.includes(ch)) {
      if (clean.length < CODE_LENGTH) clean += ch;
      else dropped = true;
    } else {
      dropped = true;
    }
  }
  return { clean, dropped };
}

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: appTitle },
      { name: "description", content: appDescription },
      { property: "og:title", content: appTitle },
      { property: "og:description", content: appDescription },
    ],
  }),
  component: Index,
});

const steps = [
  { icon: UserRound, label: "填名选角", text: "写个名字，挑一个角色。" },
  { icon: DoorOpen, label: "开房分享", text: "选主题开房，把号码丢给朋友。" },
  { icon: Brush, label: "开画抢答", text: "轮到谁就大胆画，其他人抢答。" },
];

function Index() {
  const navigate = useNavigate();
  const createFn = useServerFn(createRoom);
  const roomExistsFn = useServerFn(roomExists);
  const [name, setName] = useState("");
  const [avatarSvg, setAvatarSvg] = useState<string | null>(null);
  const [roomTheme, setRoomTheme] = useState<RoomTheme>("全部主题");
  const [code, setCode] = useState("");
  const [tab, setTab] = useState<EntryTab>("create");
  const [codeHint, setCodeHint] = useState<string | null>(null);
  const [codeStatus, setCodeStatus] = useState<CodeStatus>("idle");
  const [busy, setBusy] = useState(false);
  const nameRef = useRef<HTMLInputElement | null>(null);
  const themeRef = useRef<HTMLSelectElement | null>(null);
  const codeRef = useRef<HTMLInputElement | null>(null);
  const createButtonRef = useRef<HTMLButtonElement | null>(null);
  const codeHintTimer = useRef<number | null>(null);

  useEffect(() => {
    const savedName = loadNickname();
    const savedAvatar = loadAvatarSvg();
    setName(savedName);
    setAvatarSvg(isPresetCharacterAvatar(savedAvatar) ? savedAvatar : createDefaultAvatar(savedName || "画画人"));
  }, []);

  const trimmedName = name.trim();
  const activeTheme = ROOM_THEME_OPTIONS.find((theme) => theme.value === roomTheme) ?? ROOM_THEME_OPTIONS[0];
  const codeComplete = code.length === CODE_LENGTH;

  // 自动校验：号码输满后，去后台确认这个房间还在不在。
  useEffect(() => {
    if (!codeComplete) {
      setCodeStatus("idle");
      return;
    }
    let cancelled = false;
    setCodeStatus("checking");
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const res = await roomExistsFn({ data: { code } });
          if (!cancelled) setCodeStatus(res.exists ? "found" : "missing");
        } catch {
          if (!cancelled) setCodeStatus("error");
        }
      })();
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [code, codeComplete, roomExistsFn]);

  const codeMessage = (() => {
    if (codeHint) return { tone: "error" as const, text: codeHint };
    if (!code) return null;
    if (!codeComplete)
      return { tone: "hint" as const, text: `号码是 ${CODE_LENGTH} 位，还差 ${CODE_LENGTH - code.length} 位。` };
    if (codeStatus === "checking") return { tone: "hint" as const, text: "查看这局还在不在…" };
    if (codeStatus === "found") return { tone: "ok" as const, text: "找到这一局了，可以进去。" };
    if (codeStatus === "missing")
      return { tone: "error" as const, text: "找不到这个号码，可能已经结束或打错了。" };
    if (codeStatus === "error") return { tone: "error" as const, text: "网络不稳，等下再试一次。" };
    return null;
  })();

  const handleCodeChange = (raw: string) => {
    const { clean, dropped } = sanitizeCode(raw);
    setCode(clean);
    // 提示要停留一下，不然下一个按键就把它冲掉了。
    if (!dropped) return;
    if (codeHintTimer.current) window.clearTimeout(codeHintTimer.current);
    setCodeHint("号码只用字母和数字，不含 I、O、0、1。");
    codeHintTimer.current = window.setTimeout(() => setCodeHint(null), 2600);
  };

  useEffect(() => () => {
    if (codeHintTimer.current) window.clearTimeout(codeHintTimer.current);
  }, []);

  const focusControl = (target: HTMLElement | null) => {
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => target?.focus(), 220);
  };

  const focusEntry = (intent: EntryIntent) => {
    setTab(intent);
    if (!trimmedName) {
      focusControl(nameRef.current);
      return;
    }
    window.setTimeout(() => focusControl(intent === "create" ? themeRef.current : codeRef.current), 0);
  };

  const validateName = () => {
    if (!trimmedName) {
      toast.error("先输入你的名字");
      focusControl(nameRef.current);
      return false;
    }
    return true;
  };

  const validateJoinCode = () => {
    if (!code) {
      toast.error("先输入房间号码");
      focusControl(codeRef.current);
      return false;
    }
    if (!codeComplete) {
      toast.error(`房间号码是 ${CODE_LENGTH} 位`);
      focusControl(codeRef.current);
      return false;
    }
    if (codeStatus === "missing") {
      toast.error("找不到这个号码，检查一下再试。");
      focusControl(codeRef.current);
      return false;
    }
    return true;
  };

  const requestEntry = (intent: EntryIntent) => {
    if (!validateName()) return;
    if (intent === "join" && !validateJoinCode()) return;
    if (intent === "create") void createWithProfile();
    else joinWithProfile();
  };

  const createWithProfile = async () => {
    if (!validateName()) return;
    const svg = avatarSvg ?? createDefaultAvatar(trimmedName);
    setBusy(true);
    try {
      const res = await createFn({ data: { name: trimmedName, avatarSvg: svg, roomTheme } });
      saveNickname(trimmedName);
      saveAvatarSvg(svg);
      saveIdentity(res);
      void navigate({ to: "/room/$code", params: { code: res.code } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "开局失败");
      setBusy(false);
    }
  };

  const joinWithProfile = () => {
    if (!validateName() || !validateJoinCode()) return;
    const svg = avatarSvg ?? createDefaultAvatar(trimmedName);
    saveNickname(trimmedName);
    saveAvatarSvg(svg);
    void navigate({ to: "/room/$code", params: { code } });
  };

  const field =
    "home-field w-full rounded-md border-2 border-[var(--ink)] bg-card px-3 py-3 outline-none transition-shadow placeholder:text-muted-foreground focus:ring-2 focus:ring-primary";

  return (
    <main className="home-shell mx-auto grid min-h-screen w-full max-w-6xl items-center gap-5 px-5 py-6 sm:px-8 lg:grid-cols-[minmax(0,1fr)_440px]">
      <div aria-hidden="true" className="home-ukiyo-bg">
        <span className="ukiyo-art" style={{ backgroundImage: `url(${homeUkiyoBg.url})` }} />
        <span className="ukiyo-veil" />
      </div>

      <section className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="label-chip text-xs font-semibold text-primary animate-pop-in">
            <Sparkles className="size-3.5 animate-sparkle" /> 马来西亚华语画猜
          </span>
        </div>

        <div className="title-backing relative block w-full min-w-0 rounded-2xl border-2 border-[var(--ink)]/15 bg-[var(--card)]/72 p-5 shadow-[4px_4px_0_0_var(--ink)] backdrop-blur-sm sm:p-6">
          <div className="absolute -right-3 -top-3 hidden text-5xl opacity-30 sm:block">✦</div>
          <h1 className="ink-title title-anim font-display text-5xl leading-none text-primary sm:text-6xl xl:text-7xl 2xl:text-8xl whitespace-nowrap">
            {"画啦猜啦".split("").map((char, i) => (
              <span key={i} className="title-char">
                {char}
              </span>
            ))}
          </h1>
          <div className="title-underline mt-2 h-2 max-w-[12rem] rounded-full bg-[var(--primary)]/80" />
          <p className="subtitle-paper mt-4 max-w-xl rounded-xl border-2 border-[var(--ink)]/20 bg-[var(--wash)]/92 px-4 py-3 text-lg leading-8 text-muted-foreground shadow-[3px_3px_0_0_color-mix(in_oklab,var(--ink)_35%,transparent)] backdrop-blur-sm">
            开个主题房，朋友进来就画。
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => focusEntry("create")}
              aria-label="前往开房表单"
              className="press cta-pulse inline-flex items-center gap-2 rounded-md border-2 border-[var(--ink)] bg-primary px-5 py-3 font-display text-xl text-primary-foreground shadow-[5px_5px_0_0_var(--ink)] lg:hidden"
            >
              <DoorOpen className="size-5" />
              开始玩
            </button>
            <span className="text-sm text-muted-foreground">免注册，选角即玩 · 右边填好就能开局</span>
          </div>
        </div>

        <ol className="home-steps grid gap-3 sm:grid-cols-3">
          {steps.map(({ icon: Icon, label, text }, i) => (
            <li key={label} className="home-step studio-panel relative p-4">
              <div className="flex items-center gap-2">
                <span className="home-step-num grid size-8 shrink-0 place-items-center rounded-full border-2 border-[var(--ink)] bg-primary font-display text-lg text-primary-foreground">
                  {i + 1}
                </span>
                <Icon className="size-5 shrink-0 text-primary" />
                <h2 className="min-w-0 truncate font-display text-xl text-foreground">{label}</h2>
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
            </li>
          ))}
        </ol>
      </section>

      <aside className="studio-panel p-4 sm:p-5">
        <div className="relative overflow-hidden rounded-md border-2 border-[var(--ink)] bg-[var(--wash)] p-4">
          <span className="absolute -right-2 -top-2 text-3xl opacity-25">✦</span>
          <p className="font-display text-2xl text-primary">准备开玩</p>
          <p className="mt-1 text-sm text-muted-foreground">填好就可以开局。</p>
        </div>

        <div className="mt-4 space-y-4">
          <div>
            <label className="mb-2 block text-sm font-semibold" htmlFor="name">
              你的名字
            </label>
            <input
              id="name"
              ref={nameRef}
              value={name}
              maxLength={12}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                e.preventDefault();
                if (!e.currentTarget.value.trim()) {
                  validateName();
                  return;
                }
                focusControl(themeRef.current);
              }}
              placeholder="画画人"
              className={field}
            />
          </div>

          <CharacterPicker value={avatarSvg} onChange={setAvatarSvg} name={trimmedName || "画画人"} compact />

          <div role="tablist" aria-label="开房或加入" className="home-tabs grid grid-cols-2 gap-2 rounded-md border-2 border-[var(--ink)] bg-card/70 p-1">
            {(["create", "join"] as const).map((key) => (
              <button
                key={key}
                role="tab"
                type="button"
                id={`tab-${key}`}
                aria-selected={tab === key}
                aria-controls={`panel-${key}`}
                tabIndex={tab === key ? 0 : -1}
                onClick={() => setTab(key)}
                onKeyDown={(e) => {
                  if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
                  e.preventDefault();
                  setTab(key === "create" ? "join" : "create");
                }}
                className={`press rounded-sm px-3 py-2 font-display text-lg transition-colors ${
                  tab === key
                    ? "border-2 border-[var(--ink)] bg-primary text-primary-foreground"
                    : "border-2 border-transparent text-muted-foreground"
                }`}
              >
                {key === "create" ? "开新房" : "加入房"}
              </button>
            ))}
          </div>

          <div
            role="tabpanel"
            id="panel-create"
            aria-labelledby="tab-create"
            hidden={tab !== "create"}
            className="space-y-4"
          >
            <div>
            <label className="mb-2 block text-sm font-semibold" htmlFor="room-theme">
              主题房
            </label>
            <div className="relative">
              <select
                id="room-theme"
                ref={themeRef}
                value={roomTheme}
                onChange={(event) => setRoomTheme(event.target.value as RoomTheme)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  e.preventDefault();
                  focusControl(createButtonRef.current);
                }}
                className={`${field} appearance-none pr-10 font-semibold`}
              >
                {ROOM_THEME_OPTIONS.map((theme) => (
                  <option key={theme.value} value={theme.value}>
                    {theme.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-5 -translate-y-1/2 text-primary" />
            </div>
            <p className="mt-2 rounded-md border-2 border-border bg-card/70 px-3 py-2 text-sm leading-6 text-muted-foreground">
              {activeTheme.description}
            </p>
            </div>

          <button
            ref={createButtonRef}
            type="button"
            onClick={() => requestEntry("create")}
            disabled={busy || !trimmedName}
            className="press flex w-full items-center justify-center gap-2 rounded-md border-2 border-[var(--ink)] bg-primary px-4 py-3 font-display text-xl text-primary-foreground shadow-[5px_5px_0_0_var(--ink)] disabled:translate-y-0 disabled:opacity-50"
          >
            {busy ? "准备中…" : "创建房间"}
            <ArrowRight className="size-5" />
          </button>
          </div>

          <div role="tabpanel" id="panel-join" aria-labelledby="tab-join" hidden={tab !== "join"}>
            <div className="grid grid-cols-[minmax(0,1fr)_96px] gap-2">
              <input
                ref={codeRef}
                id="room-code"
                value={code}
                maxLength={CODE_LENGTH}
                inputMode="text"
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                aria-label="房间号码"
                aria-invalid={codeMessage?.tone === "error"}
                aria-describedby="room-code-status"
                onChange={(e) => handleCodeChange(e.target.value)}
                onPaste={(e) => {
                  e.preventDefault();
                  handleCodeChange(e.clipboardData.getData("text"));
                }}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  e.preventDefault();
                  requestEntry("join");
                }}
                placeholder="输入号码"
                style={
                  codeMessage?.tone === "error"
                    ? { borderColor: "var(--destructive)" }
                    : codeMessage?.tone === "ok"
                      ? { borderColor: "var(--teal)" }
                      : undefined
                }
                className={`${field} tracking-[0.28em]`}
              />
              <button
                type="button"
                onClick={() => requestEntry("join")}
                disabled={busy || !trimmedName || !codeComplete || codeStatus === "missing"}
                className="press rounded-md border-2 border-[var(--ink)] bg-accent px-4 font-display text-lg text-accent-foreground shadow-[4px_4px_0_0_var(--ink)] disabled:translate-y-0 disabled:opacity-50"
              >
                加入
              </button>
            </div>
            <p
              id="room-code-status"
              role="status"
              aria-live="polite"
              className={`mt-2 text-sm leading-6 ${
                codeMessage?.tone === "error"
                  ? "font-semibold text-destructive"
                  : codeMessage?.tone === "ok"
                    ? "font-semibold text-[var(--teal)]"
                    : "text-muted-foreground"
              }`}
            >
              {codeMessage?.text ?? `跟朋友要 ${CODE_LENGTH} 位号码，例如 K7M3D。`}
            </p>
          </div>
        </div>

        <Link to="/how-to-play" className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-primary underline underline-offset-4">
          怎么玩
          <ArrowRight className="size-3.5" />
        </Link>
      </aside>
    </main>
  );
}
