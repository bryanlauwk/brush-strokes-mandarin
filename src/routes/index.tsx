import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { createRoom } from "@/lib/game.functions";
import { loadNickname, saveIdentity, saveNickname } from "@/lib/player-identity";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "你画我猜 · 中文多人在线画图猜词游戏" },
      {
        name: "description",
        content: "创建房间、邀请好友，轮流作画并用汉字抢答。300 个中文词库，实时同步画布与聊天。",
      },
      { property: "og:title", content: "你画我猜 · 中文多人在线画图猜词游戏" },
      { property: "og:description", content: "创建房间、邀请好友，轮流作画并用汉字抢答。300 个中文词库，实时同步画布与聊天。" },
    ],
  }),
  component: Index,
});

const highlights = ["中文词库", "实时画布", "免注册开局"];
const steps = [
  { title: "开房", text: "输入昵称，一键生成房号。" },
  { title: "轮流画", text: "画者选词，其他玩家抢答。" },
  { title: "看排名", text: "越快猜中，分数越高。" },
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
      toast.error(e instanceof Error ? e.message : "创建失败");
      setBusy(false);
    }
  };

  const join = () => {
    const c = code.trim().toUpperCase();
    if (c.length < 4) {
      toast.error("请输入房号");
      return;
    }
    saveNickname(name.trim());
    void navigate({ to: "/room/$code", params: { code: c } });
  };

  const field =
    "w-full rounded-md border-2 border-[var(--ink)] bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-primary";

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center gap-6 p-5 sm:p-8">
      <section className="grid items-center gap-6 lg:grid-cols-[1fr_400px]">
        <div className="space-y-5 text-center lg:text-left">
          <div>
            <h1 className="font-display text-5xl leading-tight text-primary sm:text-6xl">你画我猜</h1>
            <p className="mt-2 text-base text-muted-foreground sm:text-lg">中文多人在线 · 画图 + 汉字抢答</p>
          </div>

          <div className="flex flex-wrap justify-center gap-2 lg:justify-start">
            {highlights.map((item) => (
              <span
                key={item}
                className="rounded-md border-2 border-[var(--ink)] bg-secondary px-3 py-1 text-sm font-medium shadow-[2px_2px_0_0_var(--ink)]"
              >
                {item}
              </span>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {steps.map((step, index) => (
              <article key={step.title} className="panel p-4 text-left">
                <p className="font-display text-xl text-primary">{index + 1}. {step.title}</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{step.text}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="panel w-full p-6">
          <label className="block text-sm font-medium" htmlFor="name">
            昵称
          </label>
          <input
            id="name"
            value={name}
            maxLength={12}
            onChange={(e) => setName(e.target.value)}
            placeholder="小画家"
            className={`mt-1 ${field}`}
          />

          <button
            type="button"
            onClick={create}
            disabled={busy}
            className="mt-4 w-full rounded-md border-2 border-[var(--ink)] bg-primary px-4 py-3 font-display text-xl text-primary-foreground shadow-[4px_4px_0_0_var(--ink)] transition-transform hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-60"
          >
            {busy ? "创建中…" : "创建房间"}
          </button>

          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />或<span className="h-px flex-1 bg-border" />
          </div>

          <div className="flex gap-2">
            <input
              value={code}
              maxLength={8}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="输入房号"
              className={`${field} tracking-[0.3em]`}
            />
            <button
              type="button"
              onClick={join}
              disabled={busy}
              className="shrink-0 rounded-md border-2 border-[var(--ink)] bg-accent px-5 font-display text-lg text-accent-foreground shadow-[3px_3px_0_0_var(--ink)] transition-transform hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-60"
            >
              加入
            </button>
          </div>
        </div>
      </section>

      <Link to="/how-to-play" className="self-center text-sm text-primary underline underline-offset-4">
        玩法说明
      </Link>
    </main>
  );
}
