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
  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="font-display text-4xl text-primary">怎么玩</h1>
      <div className="panel mt-5 space-y-4 p-6 text-sm leading-7">
        <section>
          <h2 className="font-display text-xl">开始一局</h2>
          <p>主持人开局后，把号码发给朋友。2 人以上就可以开始，系统会轮流安排每个人画画。</p>
        </section>
        <section>
          <h2 className="font-display text-xl">选题和作画</h2>
          <p>轮到你时，从三个题目里选一个开始画。题目有容易、普通、挑战和高手难度，也会随机混入本地吃喝、地方、节庆和日常主题。</p>
        </section>
        <section>
          <h2 className="font-display text-xl">计分</h2>
          <p>越快猜中分数越高；画的人每次被猜中也会得分。每轮结束会公布答案和这一轮的得分。</p>
        </section>
        <section>
          <h2 className="font-display text-xl">猜答案</h2>
          <p>请输入完整的华语答案，系统会忽略空格和常见标点。答案很靠近时，会给你提示，但不会公开你的猜测。</p>
        </section>
      </div>
      <Link to="/" className="mt-6 inline-block text-sm text-primary underline underline-offset-4">
        回到主页
      </Link>
    </main>
  );
}
