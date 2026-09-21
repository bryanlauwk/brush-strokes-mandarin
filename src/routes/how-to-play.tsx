import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/how-to-play")({
  head: () => ({
    meta: [
      { title: "怎么玩 · 画啦猜啦" },
      { name: "description", content: "了解画啦猜啦的轮流画画、计分和华语答案规则。" },
      { property: "og:title", content: "怎么玩 · 画啦猜啦" },
      { property: "og:description", content: "轮流画画、计分和华语答案规则一览。" },
    ],
  }),
  component: HowToPlay,
});

function HowToPlay() {
  const rules = [
    ["01", "开一间房", "主持人把五位号码发给朋友。两个人到齐，就能开画。"],
    ["02", "选题出招", "轮到你时，从三个题目挑一个。别画字，也别偷偷提示。"],
    ["03", "快猜快赢", "越早猜中，分数越高；有人猜中，画的人也会得分。"],
    ["04", "大胆乱猜", "直接输入完整华语答案。很接近时，系统会悄悄提醒你。"],
  ];
  return (
    <main className="guide-shell mx-auto min-h-screen max-w-5xl p-6 sm:p-10">
      <header className="guide-hero">
        <p>HOUSE RULES · 规矩很少</p>
        <h1 className="font-display text-6xl text-primary sm:text-8xl">怎么玩？</h1>
        <p className="mt-4 max-w-xl text-lg leading-8">
          不会画，最好。这里比的不是画功，是谁最懂朋友脑袋里的奇怪东西。
        </p>
      </header>
      <div className="guide-grid mt-10 grid gap-4 sm:grid-cols-2">
        {rules.map(([number, title, body]) => (
          <section key={number} className="guide-card panel p-6">
            <span>{number}</span>
            <h2 className="mt-8 font-display text-3xl">{title}</h2>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">{body}</p>
          </section>
        ))}
      </div>
      <Link
        to="/"
        className="press mt-8 inline-flex border-2 border-[var(--ink)] bg-primary px-5 py-3 font-display text-lg text-primary-foreground shadow-[5px_5px_0_var(--ink)]"
      >
        好了，开玩 →
      </Link>
    </main>
  );
}
