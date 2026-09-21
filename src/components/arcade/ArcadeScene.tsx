import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Check, RotateCcw } from "lucide-react";

const sketches = [
  {
    answer: "榴莲",
    options: ["刺猬", "榴莲", "流星锤"],
    clue: "夜市常客 · 两个字",
    paths: [
      "M61 105 69 76 81 80 84 55 98 65 112 39 126 57 143 42 148 64 167 54 168 77 192 80 181 98 198 114 179 123 185 143 163 143 151 165 133 152 113 166 103 148 80 149 82 129 61 123Z",
      "M126 57Q145 99 151 165M148 64Q135 87 117 94M167 84l-17 13M98 90l14 17M165 119l-15 6M94 128l18 6M134 48q-5-29 8-35",
    ],
  },
  {
    answer: "拉茶",
    options: ["咖啡", "拉茶", "奶瓶"],
    clue: "嘛嘛档必点 · 两个字",
    paths: [
      "M70 90h88l-8 76H80Z",
      "M158 97h13q39 3 8 38l-25 4M88 153h54M97 73q-20-12 0-24t0-24M122 72q-15-14 0-28M60 175h105",
      "M86 99q24 10 55 0",
    ],
  },
  {
    answer: "双峰塔",
    options: ["火箭", "双峰塔", "筷子"],
    clue: "KL 打卡点 · 三个字",
    paths: [
      "M68 173V95h7V69h9V45h8V23h5v22h8v24h9v27h6v77M142 173V95h7V69h9V45h8V23h5v22h8v24h9v27h6v77",
      "M120 113h22v13h-22M78 108h30m-30 17h30m-30 17h30m-30 17h30M152 108h30m-30 17h30m-30 17h30m-30 17h30M54 180h154",
    ],
  },
];

export function ArcadeScene() {
  const [index, setIndex] = useState(0);
  const [guess, setGuess] = useState<string | null>(null);
  const answersRef = useRef<HTMLDivElement>(null);
  const focusNextAnswer = useRef(false);
  const sketch = sketches[index];
  const correct = guess === sketch.answer;
  useEffect(() => {
    if (correct || focusNextAnswer.current) {
      answersRef.current?.querySelector("button")?.focus({ preventScroll: true });
      focusNextAnswer.current = false;
    }
  }, [correct, index]);
  return (
    <section className="arcade-scene" aria-label="试玩：猜猜这幅画">
      <div className="arcade-scene-heading">
        <span className="arcade-eyebrow">QUICK PLAY / 先猜一题</span>
        <span className="arcade-scene-arrow" aria-hidden="true">
          <ArrowUpRight size={19} />
        </span>
      </div>
      <div className="arcade-scene-stage">
        <div className="arcade-sketch">
          <span className="arcade-sketch-tape" aria-hidden="true" />
          <span className="arcade-sketch-note">艺术家：你的朋友</span>
          <svg
            viewBox="0 0 250 195"
            fill="none"
            aria-label={correct ? sketch.answer : sketch.clue}
            role="img"
          >
            {sketch.paths.map((path, i) => (
              <path
                key={`${index}-${i}`}
                className="arcade-sketch-line"
                d={path}
                stroke="#202028"
                strokeWidth={i === 0 ? 4 : 3}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
          </svg>
          <span className="arcade-sketch-caption">{sketch.clue}</span>
        </div>
        <svg className="arcade-scene-mascot" viewBox="0 0 190 220" fill="none" aria-hidden="true">
          <ellipse cx="100" cy="204" rx="59" ry="10" fill="#000" opacity=".25" />
          <path
            d="M45 166q-25-34-17-78Q39 41 68 51q16-41 48-25 26 10 26 38 40-3 35 36-1 27-22 50l-4 37-28 1-11-23-10 33-28-5 1-28-21 23-23-17Z"
            fill="#bda7f7"
            stroke="#101014"
            strokeWidth="5"
          />
          <ellipse cx="88" cy="86" rx="11" ry="17" fill="#f5f5ef" transform="rotate(-12 88 86)" />
          <ellipse cx="117" cy="82" rx="11" ry="17" fill="#f5f5ef" transform="rotate(-12 117 82)" />
          <ellipse cx="91" cy="87" rx="5" ry="8" fill="#101014" />
          <ellipse cx="120" cy="83" rx="5" ry="8" fill="#101014" />
          <path d="M91 113q15 15 29-5" stroke="#101014" strokeWidth="5" strokeLinecap="round" />
          <path d="M37 117Q3 95 7 62" stroke="#bda7f7" strokeWidth="15" strokeLinecap="round" />
          <path d="m9 42 10-2 22 97-10 2Z" fill="#d8ff3e" stroke="#101014" strokeWidth="3" />
          <path d="m10 44 4-21 5 19Z" fill="#f5f5ef" />
          <path
            d="m144 21 3-12m11 22 11-6"
            stroke="#d8ff3e"
            strokeWidth="4"
            strokeLinecap="round"
          />
        </svg>
        <div className="arcade-scene-bubble" aria-hidden="true">
          {correct ? "对啦！你很会哦。" : "这画的是啥啦？"}
          <span>✦</span>
        </div>
      </div>
      <div className="arcade-scene-answers" ref={answersRef}>
        {correct ? (
          <>
            <span className="arcade-demo-correct">
              <Check size={16} /> 默契上线！
            </span>
            <button
              type="button"
              onClick={() => {
                focusNextAnswer.current = true;
                setIndex((index + 1) % sketches.length);
                setGuess(null);
              }}
            >
              <RotateCcw size={14} /> 再猜一题
            </button>
          </>
        ) : (
          sketch.options.map((option) => (
            <button
              type="button"
              key={option}
              onClick={() => setGuess(option)}
              className={guess === option ? "is-wrong" : ""}
            >
              {option}
            </button>
          ))
        )}
      </div>
      <p className="arcade-scene-status" role="status">
        {guess && !correct
          ? "差一点，再看多一眼？"
          : correct
            ? "朋友的灵魂画作，也许只有你懂。"
            : "点一个答案，试试你的默契。"}
      </p>
    </section>
  );
}
