import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowRight, Brush, Clock3, DoorOpen, Gauge, Link2, Sparkles, UsersRound } from "lucide-react";
import { createRoom } from "@/lib/game.functions";
import { loadNickname, saveIdentity, saveNickname } from "@/lib/player-identity";

const appTitle = "画啦猜啦 · 马来西亚华语画猜派对";
const appDescription = "开一局、分享号码、轮流画画，用华语猜答案。题目收录本地吃喝、地方、节庆和日常生活。";

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
  { icon: Brush, label: "顺手画", text: "笔触即时同步，朋友看得到你的每一笔。" },
  { icon: UsersRound, label: "朋友局", text: "复制号码就能进来，不用注册。" },
  { icon: Sparkles, label: "本地题目", text: "吃喝、地方、节庆、校园和日常随机出现。" },
];

const flow = [
  { icon: DoorOpen, title: "开一局", text: "填名字，系统马上给你一个号码。" },
  { icon: Gauge, title: "猜答案", text: "越快猜中分数越高，画的人也有分。" },
  { icon: Clock3, title: "轮着画", text: "每一轮换一个人画，大家都有机会出题。" },
];

function Index() {
  const navigate = useNavigate();
  const createFn = useServerFn(createRoom);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setName(loadNickname());
  }, []);

  const create = async () => {
    setBusy(true);
    try {
      const res = await createFn({ data: { name } });
      saveNickname(name.trim());
      saveIdentity(res);
      void navigate({ to: "/room/$code", params: { code: res.code } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "开局失败");
      setBusy(false);
    }
  };

  const join = () => {
    const c = code.trim().toUpperCase();
    if (c.length < 4) {
      toast.error("请输入号码");
      return;
    }
    saveNickname(name.trim());
    void navigate({ to: "/room/$code", params: { code: c } });
  };

  const field =
    "w-full rounded-md border-2 border-[var(--ink)] bg-card px-3 py-3 outline-none transition-shadow placeholder:text-muted-foreground focus:ring-2 focus:ring-primary";

  return (
    <main className="mx-auto grid min-h-screen w-full max-w-6xl items-center gap-5 px-5 py-6 sm:px-8 lg:grid-cols-[minmax(0,1fr)_420px]">
      <section className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="label-chip text-xs font-semibold text-primary">
            <Sparkles className="size-3.5" /> 马来西亚华语画猜
          </span>
          <span className="label-chip text-xs font-semibold">
            <Link2 className="size-3.5 text-[var(--teal)]" /> 免注册，马上玩
          </span>
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div>
            <h1 className="ink-title font-display text-6xl leading-none text-primary sm:text-7xl lg:text-8xl">
              画啦猜啦
            </h1>
            <p className="mt-4 max-w-xl text-lg leading-8 text-muted-foreground">
              像大家围着一张大画纸：一人画，朋友用华语猜。题目会突然从椰浆饭跳到双峰塔，也可能冒出一道高手题。
            </p>
          </div>

          <div className="studio-panel hidden min-h-64 p-4 xl:block">
            <div className="paper relative h-full overflow-hidden rounded-md border-2 border-[var(--ink)] p-4">
              <div className="absolute right-4 top-4 rounded-full border-2 border-[var(--ink)] bg-accent px-3 py-1 text-xs font-semibold">
                第 2 轮
              </div>
              <svg viewBox="0 0 260 160" className="mt-10 h-36 w-full" aria-hidden="true">
                <path
                  d="M28 112 C64 58 106 134 142 78 C164 44 196 54 222 34"
                  fill="none"
                  stroke="var(--primary)"
                  strokeWidth="12"
                  strokeLinecap="round"
                  className="animate-draw-dash"
                />
                <path
                  d="M52 126 C82 102 105 107 126 130 C151 155 184 138 205 116"
                  fill="none"
                  stroke="var(--teal)"
                  strokeWidth="8"
                  strokeLinecap="round"
                  className="animate-draw-dash"
                  style={{ animationDelay: "160ms" }}
                />
                <circle cx="74" cy="54" r="14" fill="var(--gold)" stroke="var(--ink)" strokeWidth="4" />
                <circle cx="188" cy="92" r="18" fill="oklch(0.55 0.13 255)" stroke="var(--ink)" strokeWidth="4" />
              </svg>
              <div className="absolute bottom-4 left-4 right-4 grid grid-cols-3 gap-2 text-xs">
                {['茶', '_', '_'].map((item, i) => (
                  <span key={`${item}-${i}`} className="rounded-md border-2 border-[var(--ink)] bg-card py-1 text-center font-display text-lg">
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
          <p className="font-display text-2xl text-primary">今晚玩哪一局？</p>
          <p className="mt-1 text-sm text-muted-foreground">开新局，或输入朋友给你的号码。</p>
        </div>

        <div className="mt-4 space-y-4">
          <label className="block text-sm font-semibold" htmlFor="name">
            你的名字
          </label>
          <input
            id="name"
            value={name}
            maxLength={12}
            onChange={(e) => setName(e.target.value)}
            placeholder="画画人"
            className={field}
          />

          <button
            type="button"
            onClick={create}
            disabled={busy}
            className="press flex w-full items-center justify-center gap-2 rounded-md border-2 border-[var(--ink)] bg-primary px-4 py-3 font-display text-xl text-primary-foreground shadow-[5px_5px_0_0_var(--ink)] disabled:translate-y-0 disabled:opacity-60"
          >
            {busy ? "准备中…" : "开一局"}
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
              disabled={busy}
              className="press rounded-md border-2 border-[var(--ink)] bg-accent px-4 font-display text-lg text-accent-foreground shadow-[4px_4px_0_0_var(--ink)] disabled:translate-y-0 disabled:opacity-60"
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
