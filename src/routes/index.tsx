import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Gamepad2,
  LoaderCircle,
  ShieldCheck,
  Users,
  Zap,
} from "lucide-react";
import { Brand } from "@/components/arcade/Brand";
import { ArcadeScene } from "@/components/arcade/ArcadeScene";
import { CharacterPicker } from "@/components/game/CharacterPicker";
import { InlineSvgAvatar } from "@/components/game/PlayerAvatar";
import { createRoom, joinRoom, roomExists } from "@/lib/game.functions";
import { ROOM_THEME_OPTIONS, type RoomTheme } from "@/lib/game-themes";
import { createDefaultAvatar, isPresetCharacterAvatar } from "@/lib/character-avatars";
import {
  getOrCreateClientId,
  loadAvatarSvg,
  loadNickname,
  saveAvatarSvg,
  saveIdentity,
  saveNickname,
} from "@/lib/player-identity";
import "@/styles/arcade-home.css";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "乱画俱乐部 · AFTERHOURS DRAW CLUB" },
      {
        name: "description",
        content: "画到离谱，猜到上头。给马来西亚朋友的华语画猜派对，2–12 人，免注册，手机即玩。",
      },
      { property: "og:title", content: "乱画俱乐部 · 朋友的烂画，只有你懂。" },
      { property: "og:description", content: "今晚不刷屏，一起乱画。开一局，把朋友叫齐。" },
    ],
  }),
  component: Index,
});

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
type CodeStatus = "idle" | "checking" | "found" | "missing" | "error";

function Index() {
  const navigate = useNavigate();
  const createFn = useServerFn(createRoom);
  const joinFn = useServerFn(joinRoom);
  const existsFn = useServerFn(roomExists);
  const [step, setStep] = useState<1 | 2>(1);
  const [intent, setIntent] = useState<"create" | "join">("create");
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [theme, setTheme] = useState<RoomTheme>("全部主题");
  const [code, setCode] = useState("");
  const [codeStatus, setCodeStatus] = useState<CodeStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const submitRef = useRef(false);
  const mountedRef = useRef(true);
  const didChangeStep = useRef(false);
  const savedAvatar = avatar ?? createDefaultAvatar(name.trim() || "夜猫");
  const chosenTheme = ROOM_THEME_OPTIONS.find((option) => option.value === theme)!;

  useEffect(() => {
    mountedRef.current = true;
    const storedName = loadNickname();
    const storedAvatar = loadAvatarSvg();
    setName(storedName);
    setAvatar(
      isPresetCharacterAvatar(storedAvatar)
        ? storedAvatar
        : createDefaultAvatar(storedName || "夜猫"),
    );
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!didChangeStep.current) return;
    headingRef.current?.focus({ preventScroll: true });
  }, [step]);

  useEffect(() => {
    if (intent !== "join" || code.length !== 5) {
      setCodeStatus("idle");
      return;
    }
    let cancelled = false;
    setCodeStatus("checking");
    const timer = window.setTimeout(async () => {
      try {
        const result = await existsFn({ data: { code } });
        if (!cancelled) setCodeStatus(result.exists ? "found" : "missing");
      } catch {
        if (!cancelled) setCodeStatus("error");
      }
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [code, intent, existsFn]);

  const codeHint =
    codeStatus === "checking"
      ? "正在找你的朋友…"
      : codeStatus === "found"
        ? "房间找到了，朋友等你入场。"
        : codeStatus === "missing"
          ? "找不到这个房号，请跟朋友确认一下。"
          : codeStatus === "error"
            ? "暂时查不到房间，仍可点击加入重试。"
            : code.length > 0 && code.length < 5
              ? `还差 ${5 - code.length} 位房号。`
              : "跟朋友要一个 5 位房号，例如 K7M3D。";

  const advance = () => {
    if (!name.trim()) {
      setError("先取个昵称，让朋友认得你。");
      nameRef.current?.focus();
      return;
    }
    setError(null);
    saveNickname(name.trim());
    saveAvatarSvg(savedAvatar);
    didChangeStep.current = true;
    setStep(2);
  };

  const enterRoom = async () => {
    if (submitRef.current) return;
    if (!name.trim()) {
      setError("先取个昵称，让朋友认得你。");
      setStep(1);
      return;
    }
    if (intent === "join" && code.length !== 5) {
      setError("房号需要 5 位，检查一下再试。");
      return;
    }
    if (intent === "join" && codeStatus === "missing") {
      setError("找不到这个房号，请跟朋友确认一下。");
      return;
    }
    submitRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const profile = {
        name: name.trim(),
        avatarSvg: savedAvatar,
        clientId: getOrCreateClientId(),
      };
      const identity =
        intent === "create"
          ? await createFn({ data: { ...profile, roomTheme: theme } })
          : await joinFn({ data: { ...profile, code } });
      saveNickname(profile.name);
      saveAvatarSvg(savedAvatar);
      saveIdentity(identity);
      if (mountedRef.current)
        await navigate({ to: "/room/$code", params: { code: identity.code } });
    } catch (err) {
      if (mountedRef.current) {
        const message = err instanceof Error ? err.message : "";
        setError(
          message.includes("满")
            ? "这一局坐满了（12 人），试试自己开一间。"
            : message || "没连上，检查网络后再试一次。",
        );
        setBusy(false);
      }
    } finally {
      submitRef.current = false;
    }
  };

  const updateCode = (raw: string) => {
    const normalized = raw.toUpperCase().replace(/\s/g, "");
    const cleaned = [...normalized]
      .filter((character) => CODE_ALPHABET.includes(character))
      .join("")
      .slice(0, 5);
    setCode(cleaned);
    setCodeStatus("idle");
    setError(normalized !== cleaned ? "房号只含 5 位字母和数字，不含 I、O、0、1。" : null);
  };

  return (
    <div className="arcade-home">
      <a className="arcade-skip" href="#entry">
        跳到入场
      </a>
      <header className="arcade-home-nav">
        <Brand />
        <nav aria-label="主导航">
          <Link to="/how-to-play">
            怎么玩 <ArrowUpRightIcon />
          </Link>
          <span className="arcade-region">
            <span /> MY / 中文
          </span>
        </nav>
      </header>
      <main className="arcade-home-main">
        <section className="arcade-hero" aria-labelledby="hero-title">
          <p className="arcade-hero-kicker">
            <span /> THE NIGHT IS STILL YOUNG
          </p>
          <h1 id="hero-title">
            画到离谱。
            <br />
            <span>猜到上头。</span>
            <svg viewBox="0 0 36 42" aria-hidden="true">
              <path d="m22 1-9 17H2l13 7-3 16 11-15h12l-11-7Z" fill="currentColor" />
            </svg>
          </h1>
          <p className="arcade-hero-description">
            朋友的灵魂画作，只有你懂。
            <br />
            叫上你的 kaki，今晚一起乱画。
          </p>
          <div className="arcade-hero-facts">
            <span>
              <Users size={14} /> 2–12 人
            </span>
            <span>
              <Zap size={14} /> 免下载
            </span>
            <span>
              <Gamepad2 size={14} /> 华语画猜
            </span>
          </div>
          <ArcadeScene />
        </section>
        <section className="arcade-entry" id="entry" aria-labelledby="entry-title">
          <div className="arcade-entry-top">
            <span className="arcade-eyebrow">YOUR NIGHT STARTS HERE</span>
            <span className="arcade-entry-light" aria-hidden="true" />
          </div>
          <div className="arcade-entry-progress" aria-label={`入场步骤 ${step} / 2`}>
            <span className={step >= 1 ? "active" : ""} />
            <span className={step >= 2 ? "active" : ""} />
          </div>
          <div className="arcade-entry-heading">
            <span className="arcade-step-number" aria-hidden="true">
              0{step}
            </span>
            <div>
              <h2 id="entry-title" tabIndex={-1} ref={headingRef}>
                {step === 1 ? "今晚，你是谁？" : "朋友，齐了没？"}
              </h2>
              <p>{step === 1 ? "挑个分身，带上你的奇怪画风。" : "当一回局长，或去朋友那一局。"}</p>
            </div>
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (step === 1) advance();
              else void enterRoom();
            }}
            aria-busy={busy}
          >
            {step === 1 ? (
              <div className="arcade-entry-fields">
                <div>
                  <label className="arcade-label" htmlFor="player-name">
                    怎么称呼你？ <small>YOUR ALIAS</small>
                  </label>
                  <input
                    ref={nameRef}
                    id="player-name"
                    className="arcade-field"
                    value={name}
                    onChange={(event) => {
                      setName(event.target.value);
                      setError(null);
                    }}
                    maxLength={12}
                    autoComplete="nickname"
                    placeholder="例如：画不到重点"
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? "entry-error" : undefined}
                    onKeyDown={(event) => {
                      if (
                        event.key === "Enter" &&
                        (event.nativeEvent.isComposing || event.keyCode === 229)
                      )
                        event.preventDefault();
                    }}
                  />
                </div>
                <CharacterPicker
                  value={avatar}
                  onChange={setAvatar}
                  name={name.trim() || "夜猫"}
                  compact
                />
                {error && (
                  <p id="entry-error" className="arcade-entry-error" role="alert">
                    {error}
                  </p>
                )}
                <button type="submit" className="arcade-button arcade-entry-submit">
                  就这个我，继续 <ArrowRight size={18} />
                </button>
              </div>
            ) : (
              <div className="arcade-entry-fields">
                <div className="arcade-entry-profile">
                  <div>
                    <InlineSvgAvatar svg={savedAvatar} label={`${name} 的分身`} />
                  </div>
                  <span>
                    <small>PLAYER READY</small>
                    <strong>{name}</strong>
                  </span>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setStep(1);
                      setError(null);
                    }}
                    aria-label="返回更换昵称或分身"
                  >
                    <ArrowLeft size={14} /> 更换
                  </button>
                </div>
                <div role="tablist" aria-label="创建或加入房间" className="arcade-entry-tabs">
                  {(["create", "join"] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      role="tab"
                      id={`entry-tab-${value}`}
                      aria-selected={intent === value}
                      aria-controls="entry-room-panel"
                      tabIndex={intent === value ? 0 : -1}
                      disabled={busy}
                      onClick={() => {
                        setIntent(value);
                        setError(null);
                      }}
                      onKeyDown={(event) => {
                        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
                        event.preventDefault();
                        const next =
                          event.key === "Home"
                            ? "create"
                            : event.key === "End"
                              ? "join"
                              : value === "create"
                                ? "join"
                                : "create";
                        setIntent(next);
                        setError(null);
                        document.getElementById(`entry-tab-${next}`)?.focus();
                      }}
                    >
                      {value === "create" ? "我来开一局" : "找朋友的局"}
                    </button>
                  ))}
                </div>
                <div
                  role="tabpanel"
                  id="entry-room-panel"
                  aria-labelledby={`entry-tab-${intent}`}
                  className="arcade-room-options"
                >
                  {intent === "create" ? (
                    <>
                      <label className="arcade-label" htmlFor="room-theme">
                        今晚画什么？ <small>THEME PACK</small>
                      </label>
                      <div className="arcade-select-wrap">
                        <select
                          className="arcade-field"
                          id="room-theme"
                          value={theme}
                          disabled={busy}
                          onChange={(event) => setTheme(event.target.value as RoomTheme)}
                        >
                          {ROOM_THEME_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <ChevronDown size={16} />
                      </div>
                      <p className="arcade-entry-hint">{chosenTheme.description}</p>
                    </>
                  ) : (
                    <>
                      <label className="arcade-label" htmlFor="room-code">
                        朋友的房号 <small>ROOM CODE</small>
                      </label>
                      <input
                        id="room-code"
                        className="arcade-field arcade-code-input"
                        value={code}
                        onChange={(event) => updateCode(event.target.value)}
                        onPaste={(event) => {
                          event.preventDefault();
                          updateCode(event.clipboardData.getData("text"));
                        }}
                        autoComplete="off"
                        autoCapitalize="characters"
                        spellCheck={false}
                        placeholder="K7M3D"
                        disabled={busy}
                        aria-invalid={codeStatus === "missing" || Boolean(error)}
                        aria-describedby="room-code-hint"
                      />
                      <p
                        className={`arcade-entry-hint ${codeStatus === "found" ? "is-success" : codeStatus === "missing" ? "is-error" : ""}`}
                        id="room-code-hint"
                        role="status"
                      >
                        {codeStatus === "found" && <Check size={13} />}
                        {codeHint}
                      </p>
                    </>
                  )}
                </div>
                {error && (
                  <p id="entry-error" className="arcade-entry-error" role="alert">
                    {error}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={busy || (intent === "join" && codeStatus === "missing")}
                  className="arcade-button arcade-entry-submit"
                >
                  {busy ? (
                    <>
                      <LoaderCircle size={18} className="arcade-loading" /> 正在入场…
                    </>
                  ) : (
                    <>
                      {intent === "create" ? "开一局，叫上朋友" : "加入朋友的局"}
                      <ArrowRight size={18} />
                    </>
                  )}
                </button>
              </div>
            )}
          </form>
          <p className="arcade-entry-footnote">
            <ShieldCheck size={13} /> 免注册。没有下载。只有你们的烂画。
          </p>
        </section>
      </main>
      <section className="arcade-home-strip" aria-label="游戏玩法">
        <div>
          <span>01 /</span>
          <strong>开一局</strong>
          <p>房号丢进群，kaki 自动集合。</p>
        </div>
        <span className="arcade-strip-star" aria-hidden="true">
          ✳
        </span>
        <div>
          <span>02 /</span>
          <strong>放胆画</strong>
          <p>画技不重要，脑洞要够大。</p>
        </div>
        <span className="arcade-strip-star" aria-hidden="true">
          ✳
        </span>
        <div>
          <span>03 /</span>
          <strong>抢着猜</strong>
          <p>越快答中，分数越上头。</p>
        </div>
      </section>
      <footer className="arcade-home-footer">
        <span>
          MADE FOR YOUR KAKIS. <span aria-hidden="true">✦</span>
        </span>
        <span>画得好不好，朋友说了算。</span>
        <Link to="/how-to-play">
          入场须知 <ArrowRight size={12} />
        </Link>
      </footer>
    </div>
  );
}
function ArrowUpRightIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M4 12 12 4M4 4h8v8" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
