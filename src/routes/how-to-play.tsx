import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Check, Pencil, Users, Zap } from "lucide-react";
import { Brand } from "@/components/arcade/Brand";
import "@/styles/arcade-guide.css";

export const Route = createFileRoute("/how-to-play")({
  head: () => ({
    meta: [
      { title: "入场须知 · 乱画俱乐部" },
      { name: "description", content: "两个人就能开局。轮流画、抢着猜，看看谁最懂朋友的脑洞。" },
      { property: "og:title", content: "入场须知 · 乱画俱乐部" },
    ],
  }),
  component: HowToPlay,
});

const guides = [
  {
    icon: Users,
    tag: "GATHER YOUR KAKIS",
    title: "朋友到齐，就开局。",
    text: "取昵称、挑分身。一个人开房，把链接或 5 位房号丢进群。2–12 人都能玩，主持人决定什么时候开始。",
    detail: "同一张桌子，或各自在家。手机打开就能加入。",
  },
  {
    icon: Pencil,
    tag: "MAKE A BEAUTIFUL MESS",
    title: "画不像？更好笑。",
    text: "每个人轮流画。从三个题目里挑一个，然后让你的线条说话。画笔、颜色、橡皮擦，够你自由发挥。",
    detail: "别直接写出答案。让朋友猜你画的东西，才好玩。",
  },
  {
    icon: Zap,
    tag: "BE FIRST. BE LOUD.",
    title: "想到什么，就猜什么。",
    text: "在答题框输入完整华语答案。越早猜中，分数越高；朋友猜对了，画的人也会得分。",
    detail: "很接近时会收到私人提示；系统会忽略空格和常见标点。",
  },
];

function HowToPlay() {
  const [active, setActive] = useState(0);
  const current = guides[active];
  const Icon = current.icon;
  return (
    <div className="arcade-guide">
      <header className="arcade-guide-nav">
        <Brand />
        <Link to="/">
          <ArrowLeft size={15} /> 返回入场
        </Link>
      </header>
      <main>
        <div className="arcade-guide-heading">
          <p className="arcade-eyebrow">THE CLUB HANDBOOK / 入场须知</p>
          <h1>
            规矩很少。
            <br />
            <span>笑声管够。</span>
          </h1>
          <p>不用会画，不用预习。带上朋友，就够了。</p>
        </div>
        <div className="arcade-guide-content">
          <div className="arcade-guide-tabs" role="tablist" aria-label="玩法步骤">
            {guides.map((guide, i) => (
              <button
                key={guide.title}
                type="button"
                role="tab"
                id={`guide-tab-${i}`}
                aria-controls="guide-panel"
                aria-selected={active === i}
                tabIndex={active === i ? 0 : -1}
                onClick={() => setActive(i)}
                onKeyDown={(event) => {
                  if (
                    !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(
                      event.key,
                    )
                  )
                    return;
                  event.preventDefault();
                  const next =
                    event.key === "Home"
                      ? 0
                      : event.key === "End"
                        ? 2
                        : ["ArrowLeft", "ArrowUp"].includes(event.key)
                          ? (i + 2) % 3
                          : (i + 1) % 3;
                  setActive(next);
                  document.getElementById(`guide-tab-${next}`)?.focus();
                }}
              >
                <span>0{i + 1}</span>
                <strong>{["开一局", "轮流画", "抢着猜"][i]}</strong>
                <ArrowRight size={17} />
              </button>
            ))}
          </div>
          <section
            className="arcade-guide-panel"
            role="tabpanel"
            tabIndex={0}
            id="guide-panel"
            aria-labelledby={`guide-tab-${active}`}
          >
            <div className="arcade-guide-symbol">
              <Icon size={38} strokeWidth={1.5} />
              <span>0{active + 1}</span>
            </div>
            <p className="arcade-eyebrow">{current.tag}</p>
            <h2>{current.title}</h2>
            <p className="arcade-guide-body">{current.text}</p>
            <p className="arcade-guide-tip">
              <Check size={15} />
              {current.detail}
            </p>
          </section>
        </div>
        <div className="arcade-guide-faq">
          <details>
            <summary>可以换主题和难度吗？</summary>
            <p>
              可以。主持人在开局前打开「本局设置」，就能调整主题、难度、轮数和作画时间。嘛嘛档、校园回忆、槟城、TVB，都有得画。
            </p>
          </details>
          <details>
            <summary>不小心关掉页面怎么办？</summary>
            <p>
              用同一部手机、同一个浏览器重新打开房间，通常就能接回原来的位置。若提示重新加入，照着页面指示即可。
            </p>
          </details>
        </div>
        <div className="arcade-guide-bottom">
          <p>好了。你已经比朋友懂更多了。</p>
          <Link to="/" className="arcade-button">
            去开一局 <ArrowRight size={18} />
          </Link>
        </div>
      </main>
      <footer className="arcade-guide-footer">GOOD FRIENDS. QUESTIONABLE DRAWINGS.</footer>
    </div>
  );
}
