import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowRight, Brush, Camera, Clock3, DoorOpen, Gauge, Link2, MapPin, Sparkles, Tv, UsersRound } from "lucide-react";
import { SelfieAvatar } from "@/components/game/SelfieAvatar";
import { createRoom } from "@/lib/game.functions";
import { ROOM_THEME_OPTIONS, type RoomTheme } from "@/lib/game-themes";
import { loadAvatarSvg, loadNickname, saveAvatarSvg, saveIdentity, saveNickname } from "@/lib/player-identity";

const appTitle = "画啦猜啦 · 马来西亚华语画猜派对";
const appDescription = "拍照生成入场画像，开主题房、分享号码、轮流画画，用华语猜本地题目。";

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
  { icon: Camera, label: "先拍入场照", text: "名字和画像准备好，朋友才知道谁来了。" },
  { icon: MapPin, label: "主题房", text: "槟城、马六甲、TVB 或全主题混搭。" },
  { icon: Brush, label: "顺手画", text: "笔触即时同步，朋友看得到你的每一笔。" },
];

const flow = [
  { icon: DoorOpen, title: "准备入场", text: "输入名字，自拍或上传照片生成画像。" },
  { icon: Tv, title: "选主题房", text: "题库跟着主题走，难度和字数继续随机。" },
  { icon: Gauge, title: "开局猜答案", text: "越快猜中分数越高，画的人也有分。" },
  { icon: Clock3, title: "轮着画", text: "每一轮换一个人画，大家都有机会出题。" },
];

function Index() {
  const navigate = useNavigate();
  const createFn = useServerFn(createRoom);
  const [name, setName] = useState("");
  const [avatarSvg, setAvatarSvg] = useState<string | null>(null);
  const [roomTheme, setRoomTheme] = useState<RoomTheme>("全部主题");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setName(loadNickname());
    setAvatarSvg(loadAvatarSvg());
  }, []);

  const trimmedName = name.trim();
  const profileReady = trimmedName.length > 0 && !!avatarSvg;

  const rememberProfile = () => {
    saveNickname(trimmedName);
    saveAvatarSvg(avatarSvg);
  };

  const ensureProfile = () => {
    if (!trimmedName) {
      toast.error("先输入你的名字");
      return false;
    }
    if (!avatarSvg) {
      toast.error("先拍照或上传照片，生成入场画像");
      return false;
    }
    return true;
  };

  const create = async () => {
    if (!ensureProfile()) return;
    setBusy(true);
    try {
      const res = await createFn({ data: { name, avatarSvg, roomTheme } });
      rememberProfile();
      saveIdentity(res);
      void navigate({ to: "/room/$code", params: { code: res.code } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "开局失败");
      setBusy(false);
    }
  };

  const join = () => {
    if (!ensureProfile()) return;
    const c = code.trim().toUpperCase();
    if (c.length < 4) {
      toast.error("请输入号码");
      return;
    }
    rememberProfile();
    void navigate({ to: "/room/$code", params: { code: c } });
  };

  const field =
    "w-full rounded-md border-2 border-[var(--ink)] bg-card px-3 py-3 outline-none transition-shadow placeholder:text-muted-foreground focus:ring-2 focus:ring-primary";

  return (
    <main className="mx-auto grid min-h-screen w-full max-w-6xl items-center gap-5 px-5 py-6 sm:px-8 lg:grid-cols-[minmax(0,1fr)_440px]">
      <section className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="label-chip text-xs font-semibold text-primary">
            <Sparkles className="size-3.5" /> 马来西亚华语画猜
          </span>
          <span className="label-chip text-xs font-semibold">
            <Link2 className="size-3.5 text-[var(--teal)]" /> 主题房，马上玩
          </span>
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div>
            <h1 className="ink-title font-display text-6xl leading-none text-primary sm:text-7xl lg:text-8xl">
              画啦猜啦
            </h1>
            <p className="mt-4 max-w-xl text-lg leading-8 text-muted-foreground">
              先输入名字，把自拍变成圆脸动漫入场画像，再选一个主题房开画。题目可能从姓周桥跳到鸡场街，也可能突然变成一场港剧名场面。
            </p>
          </div>

          <div className="studio-panel hidden min-h-64 p-4 xl:block">
            <div className="paper relative h-full overflow-hidden rounded-md border-2 border-[var(--ink)] p-4">
              <div className="absolute right-4 top-4 rounded-full border-2 border-[var(--ink)] bg-accent px-3 py-1 text-xs font-semibold">
                主题房
              </div>
              <svg viewBox="0 0 260 160" className="mt-8 h-40 w-full" aria-hidden="true">
                <circle cx="130" cy="72" r="58" fill="#9bdcff" stroke="var(--ink)" strokeWidth="6" />
                <circle cx="130" cy="78" r="34" fill="#f7c8a4" stroke="var(--ink)" strokeWidth="5" />
                <path d="M96 64c8-27 38-39 68-24 12 7 20 18 21 33-24-18-55-20-89-9Z" fill="#1f1712" stroke="var(--ink)" strokeWidth="5" />
                <ellipse cx="116" cy="78" rx="5" ry="8" fill="var(--ink)" />
                <ellipse cx="144" cy="78" rx="5" ry="8" fill="var(--ink)" />
                <path d="M118 96c7 6 17 6 24 0" fill="none" stroke="var(--ink)" strokeWidth="5" strokeLinecap="round" />
                <path d="M80 132c18-27 35-39 50-39s33 12 50 39" fill="var(--primary)" stroke="var(--ink)" strokeWidth="5" />
                <path d="M54 118l17-22M70 118l6-26" stroke="var(--ink)" strokeWidth="5" strokeLinecap="round" />
              </svg>
              <div className="absolute bottom-4 left-4 right-4 grid grid-cols-3 gap-2 text-xs">
                {["自拍", "主题", "开玩"].map((item) => (
                  <span key={item} className="rounded-md border-2 border-[var(--ink)] bg-card py-1 text-center font-display text-lg">
                    {item}
                  </span>
                ))}
              </div>
            </div>
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
        <div className="rounded-md border-2 border-[var(--ink)] bg-[var(--wash)] p-3">
          <p className="font-display text-2xl text-primary">先做好入场证</p>
          <p className="mt-1 text-sm text-muted-foreground">名字、画像、主题、房号，一步一步来。</p>
        </div>

        <div className="mt-4 space-y-4">
          <label className="block text-sm font-semibold" htmlFor="name">
            1. 你的名字
          </label>
          <input
            id="name"
            value={name}
            maxLength={12}
            onChange={(e) => setName(e.target.value)}
            placeholder="画画人"
            className={field}
          />

          <div>
            <p className="mb-2 text-sm font-semibold">2. 拍照生成画像</p>
            <SelfieAvatar value={avatarSvg} onChange={setAvatarSvg} name={name} required />
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold">3. 选择主题房</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {ROOM_THEME_OPTIONS.map((theme) => {
                const active = roomTheme === theme.value;
                return (
                  <button
                    key={theme.value}
                    type="button"
                    onClick={() => setRoomTheme(theme.value)}
                    className={`press rounded-md border-2 border-[var(--ink)] p-3 text-left shadow-[3px_3px_0_0_var(--ink)] ${
                      active ? "bg-primary text-primary-foreground" : "bg-card hover:bg-accent"
                    }`}
                    aria-pressed={active}
                  >
                    <span className="block font-display text-lg leading-none">{theme.label}</span>
                    <span className={`mt-1 block text-xs leading-5 ${active ? "text-primary-foreground/85" : "text-muted-foreground"}`}>
                      {theme.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={create}
            disabled={busy || !profileReady}
            className="press flex w-full items-center justify-center gap-2 rounded-md border-2 border-[var(--ink)] bg-primary px-4 py-3 font-display text-xl text-primary-foreground shadow-[5px_5px_0_0_var(--ink)] disabled:translate-y-0 disabled:opacity-50"
          >
            {busy ? "准备中…" : profileReady ? "4. 开一局" : "完成画像后开局"}
            <ArrowRight className="size-5" />
          </button>

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            或加入朋友局
            <span className="h-px flex-1 bg-border" />
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)_96px] gap-2">
            <input
              value={code}
              maxLength={8}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="输入号码"
              className={`${field} tracking-[0.28em]`}
            />
            <button
              type="button"
              onClick={join}
              disabled={busy || !profileReady}
              className="press rounded-md border-2 border-[var(--ink)] bg-accent px-4 font-display text-lg text-accent-foreground shadow-[4px_4px_0_0_var(--ink)] disabled:translate-y-0 disabled:opacity-50"
            >
              加入
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-2">
          {flow.map(({ icon: Icon, title, text }) => (
            <div key={title} className="grid grid-cols-[36px_minmax(0,1fr)] gap-3 rounded-md border-2 border-border bg-card/70 p-3">
              <span className="grid size-9 place-items-center rounded-md border-2 border-[var(--ink)] bg-secondary">
                <Icon className="size-4" />
              </span>
              <span>
                <span className="block font-display text-lg leading-none text-primary">{title}</span>
                <span className="mt-1 block text-sm leading-6 text-muted-foreground">{text}</span>
              </span>
            </div>
          ))}
        </div>

        <Link to="/how-to-play" className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-primary underline underline-offset-4">
          怎么玩
          <ArrowRight className="size-3.5" />
        </Link>
      </aside>
    </main>
  );
}
