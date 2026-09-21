import { useCallback, useEffect, useRef, useState } from "react";
import { Check, ChevronUp, Eraser, PaintBucket, Pencil, RotateCcw, Trash2 } from "lucide-react";
import { BRUSH_SIZES, PALETTE, type Stroke } from "@/lib/game-types";
import type { LiveStroke } from "@/hooks/use-room";
import { cn } from "@/lib/utils";
import "@/styles/arcade-tools.css";

type Props = {
  strokes: Stroke[];
  live: Record<string, LiveStroke>;
  canDraw: boolean;
  lockReason?: string;
  modeLabel?: string;
  onStroke: (stroke: Stroke) => void;
  onLive: (stroke: LiveStroke) => void;
  onLiveEnd: (id: string) => void;
  overlay?: React.ReactNode;
};

const WIDTH = 1200;
const HEIGHT = 900;
const LIVE_SEND_MS = 50;
const MIN_POINT_DISTANCE = 0.0022;
const COLOR_NAMES = [
  "墨黑",
  "石灰",
  "白色",
  "西瓜红",
  "橘子",
  "柠檬黄",
  "草绿",
  "海蓝",
  "葡萄紫",
  "桃粉",
  "咖啡",
  "湖水蓝",
];
const SIZE_NAMES = ["细线", "常规", "粗线", "大笔"];

function drawLine(
  ctx: CanvasRenderingContext2D,
  s: { color: string; size: number; points: [number, number][] },
) {
  const pts = s.points;
  if (!pts?.length) return;

  ctx.strokeStyle = s.color;
  ctx.lineWidth = s.size;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(pts[0][0] * WIDTH, pts[0][1] * HEIGHT);

  if (pts.length === 1) {
    ctx.lineTo(pts[0][0] * WIDTH + 0.01, pts[0][1] * HEIGHT);
  } else if (pts.length === 2) {
    ctx.lineTo(pts[1][0] * WIDTH, pts[1][1] * HEIGHT);
  } else {
    for (let i = 1; i < pts.length - 1; i++) {
      const control = pts[i];
      const next = pts[i + 1];
      const midX = ((control[0] + next[0]) / 2) * WIDTH;
      const midY = ((control[1] + next[1]) / 2) * HEIGHT;
      ctx.quadraticCurveTo(control[0] * WIDTH, control[1] * HEIGHT, midX, midY);
    }
    const last = pts[pts.length - 1];
    ctx.lineTo(last[0] * WIDTH, last[1] * HEIGHT);
  }

  ctx.stroke();
}

function posFromClient(
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number,
): [number, number] {
  const rect = canvas.getBoundingClientRect();
  return [
    Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)),
    Math.min(1, Math.max(0, (clientY - rect.top) / rect.height)),
  ];
}

function shouldAddPoint(points: [number, number][], point: [number, number]) {
  const last = points[points.length - 1];
  if (!last) return true;
  return Math.hypot(point[0] - last[0], point[1] - last[1]) >= MIN_POINT_DISTANCE;
}

export function DrawBoard({
  strokes,
  live,
  canDraw,
  lockReason,
  modeLabel,
  onStroke,
  onLive,
  onLiveEnd,
  overlay,
}: Props) {
  const committedCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasStageRef = useRef<HTMLDivElement | null>(null);
  const transientCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef<LiveStroke | null>(null);
  const lastSentRef = useRef(0);
  const [color, setColor] = useState(PALETTE[0]);
  const [size, setSize] = useState(BRUSH_SIZES[1]);
  const [tool, setTool] = useState<"pen" | "eraser" | "fill">("pen");
  const [boardSize, setBoardSize] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    const stage = canvasStageRef.current;
    if (!stage) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (!width || !height) return;
      const fittedWidth = Math.min(width, (height * WIDTH) / HEIGHT);
      setBoardSize({ width: fittedWidth, height: (fittedWidth * HEIGHT) / WIDTH });
    });
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  // Committed history is expensive to replay, so keep it on its own layer and
  // rebuild that layer only when the committed stroke list changes.
  const paintCommitted = useCallback(() => {
    const canvas = committedCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#fffdf7";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    const committed: Stroke[] = [];
    for (const s of strokes) {
      if (s.kind === "clear") committed.length = 0;
      else if (s.kind === "undo") committed.pop();
      else committed.push(s);
    }
    for (const s of committed) {
      if (s.kind === "fill") {
        ctx.fillStyle = s.color ?? "#fffdf7";
        ctx.fillRect(0, 0, WIDTH, HEIGHT);
      } else if (s.kind === "line") {
        drawLine(ctx, {
          color: s.color ?? "#000",
          size: s.size ?? 8,
          points: s.points ?? [],
        });
      }
    }
  }, [strokes]);

  useEffect(() => {
    paintCommitted();
  }, [paintCommitted]);

  // Remote in-progress strokes live on a cheap transient layer. Repainting
  // this layer never replays the committed history underneath it.
  useEffect(() => {
    const canvas = transientCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    for (const stroke of Object.values(live)) drawLine(ctx, stroke);
    if (drawingRef.current) drawLine(ctx, drawingRef.current);
  }, [live, strokes]);

  const paintLocalIncrement = useCallback((fromIndex: number) => {
    const canvas = transientCanvasRef.current;
    const current = drawingRef.current;
    if (!canvas || !current) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Include two previous points so the quadratic join stays continuous, but
    // never redraw the full stroke on pointermove.
    drawLine(ctx, {
      ...current,
      points: current.points.slice(Math.max(0, fromIndex - 2)),
    });
  }, []);

  const addPoint = useCallback((point: [number, number]) => {
    const current = drawingRef.current;
    if (!current || !shouldAddPoint(current.points, point)) return false;
    current.points.push(point);
    return true;
  }, []);

  const addPointerPoints = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const native = e.nativeEvent as PointerEvent & {
        getCoalescedEvents?: () => PointerEvent[];
      };
      const events = native.getCoalescedEvents?.() ?? [native];
      const fromIndex = drawingRef.current?.points.length ?? 0;
      let changed = false;
      for (const event of events) {
        changed = addPoint(posFromClient(e.currentTarget, event.clientX, event.clientY)) || changed;
      }
      return changed ? fromIndex : -1;
    },
    [addPoint],
  );

  const handleDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!canDraw) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const point = posFromClient(e.currentTarget, e.clientX, e.clientY);

    if (tool === "fill") {
      onStroke({ id: crypto.randomUUID(), kind: "fill", color });
      return;
    }
    drawingRef.current = {
      id: crypto.randomUUID(),
      color: tool === "eraser" ? "#fffdf7" : color,
      size: tool === "eraser" ? size * 2.2 : size,
      points: [point],
    };
    lastSentRef.current = performance.now();
    onLive({ ...drawingRef.current, points: [...drawingRef.current.points] });
    paintLocalIncrement(0);
  };

  const handleMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const current = drawingRef.current;
    if (!canDraw || !current) return;
    const fromIndex = addPointerPoints(e);
    if (fromIndex < 0) return;
    paintLocalIncrement(fromIndex);

    const now = performance.now();
    if (now - lastSentRef.current > LIVE_SEND_MS) {
      lastSentRef.current = now;
      onLive({ ...current, points: [...current.points] });
    }
  };

  const handleUp = (e?: React.PointerEvent<HTMLCanvasElement>) => {
    const fromIndex = e && drawingRef.current ? addPointerPoints(e) : -1;
    if (fromIndex >= 0) paintLocalIncrement(fromIndex);
    const current = drawingRef.current;
    drawingRef.current = null;
    if (!current) return;
    const finalStroke: Stroke = {
      id: current.id,
      kind: "line",
      color: current.color,
      size: current.size,
      points: current.points.slice(0, 4000),
    };
    onStroke(finalStroke);
    onLiveEnd(current.id);
  };

  const activeLabel = tool === "pen" ? "画笔" : tool === "eraser" ? "橡皮" : "整张填色";

  return (
    <div className="arcade-drawboard">
      <div className="arcade-canvas-shell">
        <div className="arcade-canvas-heading">
          <span className={cn("arcade-canvas-signal", canDraw && "arcade-canvas-signal-active")} />
          <p>{canDraw ? `你的画场 · ${activeLabel}` : (lockReason ?? "灵魂画作，正在发生")}</p>
          {modeLabel && <span className="arcade-canvas-mode">{modeLabel}</span>}
        </div>

        <div ref={canvasStageRef} className="arcade-canvas-stage">
          <div className="arcade-canvas-paper" style={boardSize ?? undefined}>
            <canvas
              ref={committedCanvasRef}
              width={WIDTH}
              height={HEIGHT}
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 block h-full w-full"
            />
            <canvas
              ref={transientCanvasRef}
              width={WIDTH}
              height={HEIGHT}
              onPointerDown={handleDown}
              onPointerMove={handleMove}
              onPointerUp={handleUp}
              onPointerCancel={handleUp}
              aria-label={canDraw ? "绘画区域：用手指或鼠标作画" : "实时画作"}
              className={cn(
                "absolute inset-0 block h-full w-full",
                canDraw ? "touch-none cursor-crosshair" : "touch-pan-y cursor-default",
              )}
            />
            {overlay}
          </div>
        </div>
      </div>

      {canDraw ? (
        <div className="arcade-drawing-controls" aria-label="绘画工具">
          <div className="arcade-tools-main" role="group" aria-label="选择工具">
            <ToolButton active={tool === "pen"} onClick={() => setTool("pen")} label="画笔">
              <Pencil size={18} />
            </ToolButton>
            <ToolButton active={tool === "eraser"} onClick={() => setTool("eraser")} label="橡皮">
              <Eraser size={18} />
            </ToolButton>
            <ToolButton active={tool === "fill"} onClick={() => setTool("fill")} label="整张填色">
              <PaintBucket size={18} />
            </ToolButton>
            <span className="arcade-tools-divider" />
            <ToolButton
              onClick={() => onStroke({ id: crypto.randomUUID(), kind: "undo" })}
              label="撤销"
            >
              <RotateCcw size={18} />
            </ToolButton>
            <ToolButton
              onClick={() => onStroke({ id: crypto.randomUUID(), kind: "clear" })}
              label="清空"
            >
              <Trash2 size={18} />
            </ToolButton>
            <details
              className="arcade-brush-menu"
              onKeyDown={(event) => {
                if (event.key !== "Escape" || !event.currentTarget.open) return;
                event.preventDefault();
                event.currentTarget.open = false;
                event.currentTarget.querySelector("summary")?.focus();
              }}
            >
              <summary aria-label={`笔刷粗细：${SIZE_NAMES[BRUSH_SIZES.indexOf(size)]}`}>
                <span
                  className="arcade-brush-preview"
                  style={{ width: size / 2 + 3, height: size / 2 + 3 }}
                />
                <ChevronUp size={12} aria-hidden="true" />
              </summary>
              <div className="arcade-brush-options" role="group" aria-label="笔刷粗细">
                {BRUSH_SIZES.map((brushSize, index) => (
                  <button
                    key={brushSize}
                    type="button"
                    aria-pressed={size === brushSize}
                    onClick={(event) => {
                      setSize(brushSize);
                      const menu = event.currentTarget.closest("details");
                      if (menu) {
                        menu.open = false;
                        menu.querySelector("summary")?.focus();
                      }
                    }}
                  >
                    <span
                      className="arcade-brush-preview"
                      style={{ width: brushSize / 2 + 3, height: brushSize / 2 + 3 }}
                    />
                    <span>{SIZE_NAMES[index]}</span>
                    {size === brushSize && <Check size={14} aria-hidden="true" />}
                  </button>
                ))}
              </div>
            </details>
          </div>

          <div className="arcade-color-strip" role="group" aria-label="画笔颜色，可横向滚动">
            {PALETTE.map((c, index) => (
              <button
                key={c}
                type="button"
                aria-label={COLOR_NAMES[index]}
                title={COLOR_NAMES[index]}
                aria-pressed={color === c && tool !== "eraser"}
                onClick={() => {
                  setColor(c);
                  if (tool === "eraser") setTool("pen");
                }}
                style={{ "--swatch": c } as React.CSSProperties}
                className={cn(
                  "arcade-color-swatch",
                  color === c && tool !== "eraser" && "arcade-color-selected",
                )}
              >
                <span>
                  {color === c && tool !== "eraser" && (
                    <Check
                      size={14}
                      strokeWidth={3}
                      style={{ color: [0, 3, 6, 7, 8, 10].includes(index) ? "white" : "#101014" }}
                      aria-hidden="true"
                    />
                  )}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <p className="arcade-spectator-note">画得抽象？靠默契的时候到了。</p>
      )}
    </div>
  );
}

function ToolButton({
  children,
  onClick,
  active,
  label,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn("arcade-tool-button", active && "arcade-tool-active")}
    >
      {children}
      <span>{label === "整张填色" ? "填色" : label}</span>
    </button>
  );
}
