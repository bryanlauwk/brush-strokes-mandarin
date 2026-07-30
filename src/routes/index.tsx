import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowRight, Brush, Camera, ChevronDown, DoorOpen, Link2, MapPin, Sparkles, Tv, X } from "lucide-react";
import { SelfieAvatar } from "@/components/game/SelfieAvatar";
import { createRoom } from "@/lib/game.functions";
import { ROOM_THEME_OPTIONS, type RoomTheme } from "@/lib/game-themes";
import { homeEntryPreviewImage } from "@/lib/home-assets";
import homeUkiyoBg from "@/assets/home-ukiyo-bg.png.asset.json";
import { loadAvatarSvg, loadNickname, saveAvatarSvg, saveIdentity, saveNickname } from "@/lib/player-identity";
import "@/styles/home-ukiyo.css";

const appTitle = "画啦猜啦 · 马来西亚华语画猜派对";
const appDescription = "拍照生成入场画像，开主题房、分享号码、轮流画画，用华语猜本地题目。";

type EntryIntent = "create" | "join";

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

const highlights = [
  { icon: Camera, label: "先拍入场照", text: "进房前才生成，朋友一眼认得你。" },
  { icon: MapPin, label: "主题房", text: "槟城、马六甲、TVB 或全主题混搭。" },
  { icon: Brush, label: "顺手画", text: "笔触即时同步，朋友看得到你的每一笔。" },
];

const flow = [
  { icon: DoorOpen, title: "填名", text: "先决定怎样登场。" },
  { icon: Camera, title: "画像", text: "进房前拍一张。" },
  { icon: Tv, title: "开画", text: "主题题库随机来。" },
];

function Index() {
  const navigate = useNavigate();
  const createFn = useServerFn(createRoom);
  const [name, setName] = useState("");
  const [avatarSvg, setAvatarSvg] = useState<string | null>(null);
  const [roomTheme, setRoomTheme] = useState<RoomTheme>("全部主题");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [entryIntent, setEntryIntent] = useState<EntryIntent | null>(null);
  const nameRef = useRef<HTMLInputElement | null>(null);
  const codeRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setName(loadNickname());
    setAvatarSvg(loadAvatarSvg());
  }, []);


  const focusEntry = (intent: EntryIntent) => {
    const target = intent === "create" ? nameRef.current : codeRef.current;
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => target?.focus(), 320);
  };

  const trimmedName = name.trim();
  const activeTheme = ROOM_THEME_OPTIONS.find((theme) => theme.value === roomTheme) ?? ROOM_THEME_OPTIONS[0];

  const rememberProfile = () => {
    saveNickname(trimmedName);
    saveAvatarSvg(avatarSvg);
  };

  const validateName = () => {
    if (!trimmedName) {
      toast.error("先输入你的名字");
      return false;
    }
    return true;
  };

  const validateJoinCode = () => {
    const c = code.trim().toUpperCase();
    if (c.length < 4) {
      toast.error("请输入号码");
      return false;
    }
    return true;
  };

  const requestEntry = (intent: EntryIntent) => {
    if (!validateName()) return;
    if (intent === "join" && !validateJoinCode()) return;
    if (!avatarSvg) {
      setEntryIntent(intent);
      return;
    }
    if (intent === "create") void createWithProfile();
    else joinWithProfile();
  };

  const createWithProfile = async () => {
    if (!validateName() || !avatarSvg) return;
    setBusy(true);
    try {
      const res = await createFn({ data: { name: trimmedName, avatarSvg, roomTheme } });
      rememberProfile();
      saveIdentity(res);
      void navigate({ to: "/room/$code", params: { code: res.code } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "开局失败");
      setBusy(false);
    }
  };

  const joinWithProfile = () => {
    if (!validateName() || !validateJoinCode() || !avatarSvg) return;
    rememberProfile();
    void navigate({ to: "/room/$code", params: { code: code.trim().toUpperCase() } });
  };

  const continueEntry = () => {
    if (!avatarSvg) {
      toast.error("先拍照或上传照片，生成入场画像");
      return;
    }
    const intent = entryIntent;
    setEntryIntent(null);
    if (intent === "create") void createWithProfile();
    if (intent === "join") joinWithProfile();
  };

  const field =
    "w-full rounded-md border-2 border-[var(--ink)] bg-card px-3 py-3 outline-none transition-shadow placeholder:text-muted-foreground focus:ring-2 focus:ring-primary";

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
          <span className="label-chip text-xs font-semibold animate-pop-in" style={{ animationDelay: "120ms" }}>
            <Link2 className="size-3.5 text-[var(--teal)]" /> 主题房，马上玩
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
              先输入名字，把自拍变成圆脸动漫入场画像，再选一个主题房开画。题目可能从姓周桥跳到鸡场街，也可能突然变成一场港剧名场面。
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => focusEntry("create")}
                className="press cta-pulse inline-flex items-center gap-2 rounded-md border-2 border-[var(--ink)] bg-primary px-5 py-3 font-display text-xl text-primary-foreground shadow-[5px_5px_0_0_var(--ink)]"
              >
                <DoorOpen className="size-5" />
                创建房间
              </button>
              <button
                type="button"
                onClick={() => focusEntry("join")}
                className="press inline-flex items-center gap-2 rounded-md border-2 border-[var(--ink)] bg-accent px-5 py-3 font-display text-xl text-accent-foreground shadow-[5px_5px_0_0_var(--ink)]"
              >
                <Link2 className="size-5" />
                加入房间
              </button>
              <span className="text-sm text-muted-foreground">免注册，30 秒开局</span>
            </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {highlights.map(({ icon: Icon, label, text }) => (
            <article key={label} className="studio-panel p-4">
              <Icon className="size-5 text-primary" />
              <h2 className="mt-3 font-display text-xl text-foreground">{label}</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{text}</p>
            </article>
          ))}
        </div>
      </section>

      <aside className="studio-panel p-4 sm:p-5">
        <div className="relative overflow-hidden rounded-md border-2 border-[var(--ink)] bg-[var(--wash)] p-4">
          <span className="absolute -right-2 -top-2 text-3xl opacity-25">✦</span>
          <p className="font-display text-2xl text-primary">准备开玩</p>
          <p className="mt-1 text-sm text-muted-foreground">名字和主题先选好，画像进房前再拍。</p>
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
              placeholder="画画人"
              className={field}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold" htmlFor="room-theme">
              主题房
            </label>
            <div className="relative">
              <select
                id="room-theme"
                value={roomTheme}
                onChange={(event) => setRoomTheme(event.target.value as RoomTheme)}
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

          <div className="grid grid-cols-[48px_minmax(0,1fr)] gap-3 rounded-md border-2 border-[var(--ink)] bg-card/80 p-3">
            <span className="grid size-12 place-items-center overflow-hidden rounded-full border-2 border-[var(--ink)] bg-secondary">
              {avatarSvg ? <img src={`data:image/svg+xml;utf8,${encodeURIComponent(avatarSvg)}`} alt="你的入场画像" className="h-full w-full object-cover" /> : <Camera className="size-5 text-primary" />}
            </span>
            <span className="min-w-0 self-center">
              <span className="block font-display text-lg leading-none text-primary">入场画像</span>
              <span className="mt-1 block text-sm leading-5 text-muted-foreground">
                {avatarSvg ? "已准备好，可以直接进房。" : "进房前会要求自拍或上传。"}
              </span>
            </span>
          </div>

          <button
            type="button"
            onClick={() => requestEntry("create")}
            disabled={busy || !trimmedName}
            className="press flex w-full items-center justify-center gap-2 rounded-md border-2 border-[var(--ink)] bg-primary px-4 py-3 font-display text-xl text-primary-foreground shadow-[5px_5px_0_0_var(--ink)] disabled:translate-y-0 disabled:opacity-50"
          >
            {busy ? "准备中…" : "开主题房"}
            <ArrowRight className="size-5" />
          </button>

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            或加入朋友局
            <span className="h-px flex-1 bg-border" />
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)_96px] gap-2">
            <input
              ref={codeRef}
              value={code}
              maxLength={8}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="输入号码"
              className={`${field} tracking-[0.28em]`}
            />
            <button
              type="button"
              onClick={() => requestEntry("join")}
              disabled={busy || !trimmedName}
              className="press rounded-md border-2 border-[var(--ink)] bg-accent px-4 font-display text-lg text-accent-foreground shadow-[4px_4px_0_0_var(--ink)] disabled:translate-y-0 disabled:opacity-50"
            >
              加入
            </button>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2 rounded-md border-2 border-border bg-card/60 p-3">
          {flow.map(({ icon: Icon, title, text }) => (
            <div key={title} className="min-w-0 text-center">
              <span className="mx-auto grid size-9 place-items-center rounded-md border-2 border-[var(--ink)] bg-secondary">
                <Icon className="size-4" />
              </span>
              <span className="mt-2 block font-display text-lg leading-none text-primary">{title}</span>
              <span className="mt-1 block text-xs leading-5 text-muted-foreground">{text}</span>
            </div>
          ))}
        </div>

        <Link to="/how-to-play" className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-primary underline underline-offset-4">
          怎么玩
          <ArrowRight className="size-3.5" />
        </Link>
      </aside>

      {entryIntent && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[var(--ink)]/55 px-4 py-6 backdrop-blur-sm">
          <div className="studio-panel max-h-full w-full max-w-md overflow-y-auto p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-display text-3xl leading-none text-primary">进房前，拍一张</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  我们会把照片转成圆脸漫画入场画像，风格参考首页示例。
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEntryIntent(null)}
                className="press grid size-10 shrink-0 place-items-center rounded-md border-2 border-[var(--ink)] bg-card shadow-[2px_2px_0_0_var(--ink)]"
                aria-label="关闭入场画像"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-[96px_minmax(0,1fr)] gap-3 rounded-md border-2 border-[var(--ink)] bg-[var(--wash)] p-3">
              <img
                src={homeEntryPreviewImage}
                alt="入场画像风格参考"
                className="size-24 rounded-full border-4 border-[var(--ink)] object-cover shadow-[3px_3px_0_0_var(--ink)]"
              />
              <div className="self-center text-sm leading-6 text-muted-foreground">
                名字会先保留，画像生成好后才正式进入房间。
              </div>
            </div>

            <div className="mt-4">
              <SelfieAvatar value={avatarSvg} onChange={setAvatarSvg} name={name} compact required />
            </div>

            <button
              type="button"
              onClick={continueEntry}
              disabled={busy || !avatarSvg}
              className="press mt-4 flex w-full items-center justify-center gap-2 rounded-md border-2 border-[var(--ink)] bg-primary px-4 py-3 font-display text-xl text-primary-foreground shadow-[5px_5px_0_0_var(--ink)] disabled:translate-y-0 disabled:opacity-50"
            >
              {entryIntent === "create" ? "生成好了，开房" : "生成好了，进房"}
              <ArrowRight className="size-5" />
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
