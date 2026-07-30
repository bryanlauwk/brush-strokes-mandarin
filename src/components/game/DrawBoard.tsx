import { useCallback, useEffect, useRef, useState } from "react";
import { Eraser, PaintBucket, Pencil, RotateCcw, Trash2 } from "lucide-react";
import { BRUSH_SIZES, PALETTE, type Stroke } from "@/lib/game-types";
import type { LiveStroke } from "@/hooks/use-room";
import { cn } from "@/lib/utils";

type Props = {
  strokes: Stroke[];
  live: Record<string, LiveStroke>;
  canDraw: boolean;
  onStroke: (stroke: Stroke) => void;
  onLive: (stroke: LiveStroke) => void;
  onLiveEnd: (id: string) => void;
  overlay?: React.ReactNode;
};

const WIDTH = 1200;
const HEIGHT = 900;

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
  } else {
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0] * WIDTH, pts[i][1] * HEIGHT);
  }
  ctx.stroke();
}

export function DrawBoard({ strokes, live, canDraw, onStroke, onLive, onLiveEnd, overlay }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef<LiveStroke | null>(null);
  const lastSentRef = useRef(0);
  const [color, setColor] = useState(PALETTE[0]);
  const [size, setSize] = useState(BRUSH_SIZES[1]);
  const [tool, setTool] = useState<"pen" | "eraser" | "fill">("pen");
  const [, forceRender] = useState(0);

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    const committed: Stroke[] = [];
    for (const s of strokes) {
      if (s.kind === "clear") committed.length = 0;
      else if (s.kind === "undo") committed.pop();
      else committed.push(s);
    }
    for (const s of committed) {
      if (s.kind === "fill") {
        ctx.fillStyle = s.color ?? "#ffffff";
        ctx.fillRect(0, 0, WIDTH, HEIGHT);
      } else if (s.kind === "line") {
        drawLine(ctx, { color: s.color ?? "#000", size: s.size ?? 8, points: s.points ?? [] });
      }
    }
    for (const s of Object.values(live)) drawLine(ctx, s);
    if (drawingRef.current) drawLine(ctx, drawingRef.current);
  }, [strokes, live]);

  useEffect(() => {
    paint();
  }, [paint]);

  const posFrom = (e: React.PointerEvent<HTMLCanvasElement>): [number, number] => {
    const rect = e.currentTarget.getBoundingClientRect();
    return [
      Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
      Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
    ];
  };

  const handleDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!canDraw) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const point = posFrom(e);

    if (tool === "fill") {
      onStroke({ id: crypto.randomUUID(), kind: "fill", color });
      return;
    }
    drawingRef.current = {
      id: crypto.randomUUID(),
      color: tool === "eraser" ? "#ffffff" : color,
      size: tool === "eraser" ? size * 2.2 : size,
      points: [point],
    };
    paint();
  };

  const handleMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const current = drawingRef.current;
    if (!canDraw || !current) return;
    current.points.push(posFrom(e));
    paint();
    const now = Date.now();
    if (now - lastSentRef.current > 60) {
      lastSentRef.current = now;
      onLive({ ...current, points: [...current.points] });
    }
  };

  const handleUp = () => {
    const current = drawingRef.current;
    drawingRef.current = null;
    if (!current) return;
    onLiveEnd(current.id);
    onStroke({
      id: current.id,
      kind: "line",
      color: current.color,
      size: current.size,
      points: current.points.slice(0, 4000),
    });
    forceRender((n) => n + 1);
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <div className="paper relative aspect-[4/3] max-h-full w-full max-w-full overflow-hidden rounded-lg border-2 border-[var(--ink)] shadow-[6px_6px_0_0_var(--ink)]">
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

      {canDraw && (
        <div className="panel flex shrink-0 flex-wrap items-center justify-center gap-3 p-2 sm:p-3">
          <div className="grid grid-cols-6 gap-1">
            {PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`颜色 ${c}`}
                onClick={() => {
                  setColor(c);
                  if (tool === "eraser") setTool("pen");
                }}
                style={{ backgroundColor: c }}
                className={cn(
                  "size-7 rounded-md border-2 border-[var(--ink)] transition-transform",
                  color === c && tool !== "eraser" ? "scale-110 ring-2 ring-primary" : "hover:scale-105",
                )}
              />
            ))}
          </div>

          <div className="flex items-center gap-1">
            {BRUSH_SIZES.map((s) => (
              <button
                key={s}
                type="button"
                aria-label={`笔刷 ${s}`}
                onClick={() => setSize(s)}
                className={cn(
                  "flex size-9 items-center justify-center rounded-md border-2 border-[var(--ink)] bg-card",
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

          <div className="flex items-center gap-1">
            <ToolButton active={tool === "pen"} onClick={() => setTool("pen")} label="画笔">
              <Pencil className="size-4" />
            </ToolButton>
            <ToolButton active={tool === "eraser"} onClick={() => setTool("eraser")} label="橡皮">
              <Eraser className="size-4" />
            </ToolButton>
            <ToolButton active={tool === "fill"} onClick={() => setTool("fill")} label="填充">
              <PaintBucket className="size-4" />
            </ToolButton>
            <ToolButton
              onClick={() => onStroke({ id: crypto.randomUUID(), kind: "undo" })}
              label="撤销"
            >
              <RotateCcw className="size-4" />
            </ToolButton>
            <ToolButton
              onClick={() => onStroke({ id: crypto.randomUUID(), kind: "clear" })}
              label="清空"
            >
              <Trash2 className="size-4" />
            </ToolButton>
          </div>
        </div>
      )}
    </div>
  );
}

function ToolButton({
  children,
  onClick,
  active,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={cn(
        "press flex size-9 items-center justify-center rounded-md border-2 border-[var(--ink)] bg-card shadow-[2px_2px_0_0_var(--ink)] transition-colors hover:bg-accent",
        active && "bg-primary text-primary-foreground",
      )}
    >
      {children}
    </button>
  );
}