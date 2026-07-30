import { useCallback, useEffect, useRef, useState } from "react";
import { Brush, Eraser, PaintBucket, Pencil, RotateCcw, Trash2 } from "lucide-react";
import { BRUSH_SIZES, PALETTE, type Stroke } from "@/lib/game-types";
import type { LiveStroke } from "@/hooks/use-room";
import { cn } from "@/lib/utils";

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
const LIVE_SEND_MS = 30;
const MIN_POINT_DISTANCE = 0.0022;

function drawLine(ctx: CanvasRenderingContext2D, s: { color: string; size: number; points: [number, number][] }) {
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

function posFromClient(canvas: HTMLCanvasElement, clientX: number, clientY: number): [number, number] {
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
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef<LiveStroke | null>(null);
  const lastSentRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const paintRef = useRef<() => void>(() => undefined);
  const [color, setColor] = useState(PALETTE[0]);
  const [size, setSize] = useState(BRUSH_SIZES[1]);
  const [tool, setTool] = useState<"pen" | "eraser" | "fill">("pen");
  const [, forceRender] = useState(0);

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
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
        drawLine(ctx, { color: s.color ?? "#000", size: s.size ?? 8, points: s.points ?? [] });
      }
    }
    for (const s of Object.values(live)) drawLine(ctx, s);
    if (drawingRef.current) drawLine(ctx, drawingRef.current);
  }, [strokes, live]);

  paintRef.current = paint;

  const schedulePaint = useCallback(() => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      paintRef.current();
    });
  }, []);

  useEffect(() => {
    schedulePaint();
  }, [schedulePaint, strokes, live]);

  useEffect(
    () => () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  const addPoint = useCallback((point: [number, number]) => {
    const current = drawingRef.current;
    if (!current || !shouldAddPoint(current.points, point)) return false;
    current.points.push(point);
    return true;
  }, []);

  const addPointerPoints = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const native = e.nativeEvent as PointerEvent & { getCoalescedEvents?: () => PointerEvent[] };
      const events = native.getCoalescedEvents?.() ?? [native];
      let changed = false;
      for (const event of events) {
        changed = addPoint(posFromClient(e.currentTarget, event.clientX, event.clientY)) || changed;
      }
      return changed;
    },
    [addPoint],
  );

  const handleDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!canDraw) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const point = posFromClient(e.currentTarget, e.clientX, e.clientY);

    if (tool === "fill") {
      onStroke({ id: crypto.randomUUID(), kind: "fill", color });
      schedulePaint();
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
    schedulePaint();
  };

  const handleMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const current = drawingRef.current;
    if (!canDraw || !current) return;
    if (!addPointerPoints(e)) return;
    schedulePaint();

    const now = performance.now();
    if (now - lastSentRef.current > LIVE_SEND_MS) {
      lastSentRef.current = now;
      onLive({ ...current, points: [...current.points] });
    }
  };

  const handleUp = (e?: React.PointerEvent<HTMLCanvasElement>) => {
    if (e && drawingRef.current) addPointerPoints(e);
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
    schedulePaint();
    forceRender((n) => n + 1);
  };

  const activeLabel = tool === "pen" ? "笔" : tool === "eraser" ? "擦" : "填色";

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <div className="studio-panel relative flex h-full max-h-full w-full flex-col overflow-hidden p-2 sm:p-3">
          <div className="mb-2 flex shrink-0 items-center gap-2 px-1">
            <span className="grid size-8 place-items-center rounded-md border-2 border-[var(--ink)] bg-secondary">
              <Brush className="size-4 text-primary" />
            </span>
            <div className="min-w-0">
              <p className="font-display text-lg leading-none">大画纸</p>
              <p className="truncate text-xs text-muted-foreground">
                {canDraw ? `${activeLabel} · ${size}px` : (lockReason ?? "看大家怎么画")}
              </p>
            </div>
            {modeLabel && (
              <span className="ml-auto shrink-0 rounded-full border-2 border-[var(--ink)] bg-card px-3 py-1 text-xs font-semibold">
                {modeLabel}
              </span>
            )}
          </div>

          <div className="flex min-h-0 flex-1 items-center justify-center">
            <div className="paper relative aspect-[4/3] max-h-full w-full max-w-full overflow-hidden rounded-md border-2 border-[var(--ink)] shadow-[4px_4px_0_0_var(--ink)]">
              <canvas
                ref={canvasRef}
                width={WIDTH}
                height={HEIGHT}
                onPointerDown={handleDown}
                onPointerMove={handleMove}
                onPointerUp={handleUp}
                onPointerCancel={handleUp}
                className={cn(
                  "absolute inset-0 block h-full w-full touch-none",
                  canDraw ? "cursor-crosshair" : "cursor-default",
                )}
              />
              {overlay}
            </div>
          </div>
        </div>
      </div>

      <div
        className={cn(
          "studio-panel flex shrink-0 flex-wrap items-center justify-center gap-3 p-2 sm:p-3",
          !canDraw && "pointer-events-none opacity-45 saturate-50",
        )}
        aria-disabled={!canDraw}
      >
          <div className="grid grid-cols-6 gap-1">
            {PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                disabled={!canDraw}
                aria-label={`颜色 ${c}`}
                onClick={() => {
                  setColor(c);
                  if (tool === "eraser") setTool("pen");
                }}
                style={{ backgroundColor: c }}
                className={cn(
                  "press size-7 rounded-md border-2 border-[var(--ink)] shadow-[1px_1px_0_0_var(--ink)]",
                  color === c && tool !== "eraser" ? "scale-110 ring-2 ring-primary" : "hover:scale-105",
                )}
              />
            ))}
          </div>

          <div className="flex items-center gap-1 rounded-md border-2 border-border bg-card/70 p-1">
            {BRUSH_SIZES.map((s) => (
              <button
                key={s}
                type="button"
                disabled={!canDraw}
                aria-label={`笔刷 ${s}`}
                onClick={() => setSize(s)}
                className={cn(
                  "press flex size-9 items-center justify-center rounded-md border-2 border-[var(--ink)] bg-card shadow-[1px_1px_0_0_var(--ink)]",
                  size === s && "bg-accent",
                )}
              >
                <span
                  className="rounded-full bg-[var(--ink)]"
                  style={{ width: s / 1.6 + 4, height: s / 1.6 + 4 }}
                />
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 rounded-md border-2 border-border bg-card/70 p-1">
            <ToolButton disabled={!canDraw} active={tool === "pen"} onClick={() => setTool("pen")} label="画笔">
              <Pencil className="size-4" />
            </ToolButton>
            <ToolButton disabled={!canDraw} active={tool === "eraser"} onClick={() => setTool("eraser")} label="擦掉">
              <Eraser className="size-4" />
            </ToolButton>
            <ToolButton disabled={!canDraw} active={tool === "fill"} onClick={() => setTool("fill")} label="填色">
              <PaintBucket className="size-4" />
            </ToolButton>
            <ToolButton
              disabled={!canDraw}
              onClick={() => onStroke({ id: crypto.randomUUID(), kind: "undo" })}
              label="退一步"
            >
              <RotateCcw className="size-4" />
            </ToolButton>
            <ToolButton
              disabled={!canDraw}
              onClick={() => onStroke({ id: crypto.randomUUID(), kind: "clear" })}
              label="清空画纸"
            >
              <Trash2 className="size-4" />
            </ToolButton>
          </div>
      </div>
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
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "press flex size-9 items-center justify-center rounded-md border-2 border-[var(--ink)] bg-card shadow-[2px_2px_0_0_var(--ink)] hover:bg-accent",
        active && "bg-primary text-primary-foreground",
      )}
    >
      {children}
    </button>
  );
}
