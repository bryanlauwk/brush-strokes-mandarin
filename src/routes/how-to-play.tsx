import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/how-to-play")({
  head: () => ({
    meta: [
      { title: "玩法说明 · 你画我猜（中文）" },
      { name: "description", content: "了解你画我猜的回合流程、计分规则与中文答题方式。" },
      { property: "og:title", content: "玩法说明 · 你画我猜（中文）" },
      { property: "og:description", content: "回合流程、计分规则与中文答题方式一览。" },
    ],
  }),
  component: HowToPlay,
});

function HowToPlay() {
  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="font-display text-4xl text-primary">玩法说明</h1>
      <div className="panel mt-5 space-y-4 p-6 text-sm leading-7">
        <section>
          <h2 className="font-display text-xl">回合流程</h2>
          <p>房主创建房间并分享房号，2 人以上即可开始。每回合每位玩家轮流当画者，从三个词中选一个作画，其他人用汉字抢答。</p>
        </section>
        <section>
          <h2 className="font-display text-xl">计分</h2>
          <p>猜对越快分数越高；画者每被猜中一次也会获得分数。回合结束会公布答案与本轮得分。</p>
        </section>
        <section>
          <h2 className="font-display text-xl">答题</h2>
          <p>只接受完整正确的中文词语，简繁与空格会自动忽略。接近答案时系统会提示「很接近了」，但不会公开你的猜测。</p>
        </section>
      </div>
      <Link to="/" className="mt-6 inline-block text-sm text-primary underline underline-offset-4">
        返回首页
      </Link>
    </main>
  );
}