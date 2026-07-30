import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { Camera, CheckCircle2, ImagePlus, RefreshCcw, Sparkles, X } from "lucide-react";
import { svgToDataUrl } from "@/components/game/PlayerAvatar";
import { cn } from "@/lib/utils";

type Props = {
  value: string | null;
  onChange: (svg: string | null) => void;
  name?: string;
  compact?: boolean;
  required?: boolean;
};

type Rgb = { r: number; g: number; b: number };

type Palette = {
  skin: string;
  hair: string;
  shirt: string;
  accent: string;
  cheek: string;
};

const ACCENTS = ["#f4772e", "#39c0c8", "#f7c948", "#7b4bc4", "#d7263d", "#3f9142"];

export function SelfieAvatar({ value, onChange, name = "画画人", compact, required }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cameraError, setCameraError] = useState("");

  useEffect(() => {
    return () => stopCamera(streamRef);
  }, []);

  const startCamera = async () => {
    setCameraError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("这个浏览器暂时不能开相机，可以上传照片。");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      streamRef.current = stream;
      setCameraOpen(true);
      requestAnimationFrame(() => {
        if (videoRef.current) videoRef.current.srcObject = stream;
      });
    } catch {
      setCameraError("相机打不开，可以改用上传照片。");
    }
  };

  const closeCamera = () => {
    stopCamera(streamRef);
    setCameraOpen(false);
  };

  const capture = () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;
    setBusy(true);
    try {
      onChange(createAvatarFromSource(video, name));
      closeCamera();
    } finally {
      setBusy(false);
    }
  };

  const pickFile = () => inputRef.current?.click();

  const onFile = (file: File | undefined) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const image = new Image();
    setBusy(true);
    setCameraError("");
    image.onload = () => {
      try {
        onChange(createAvatarFromSource(image, name));
      } finally {
        URL.revokeObjectURL(url);
        setBusy(false);
      }
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      setBusy(false);
      setCameraError("照片读取失败，请换一张试试。");
    };
    image.src = url;
  };

  const reset = () => {
    onChange(null);
    setCameraError("");
  };

  return (
    <div className={cn("rounded-md border-2 border-[var(--ink)] bg-card/85 p-3", compact && "p-2")}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="user"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0])}
      />

      <div className={cn("grid gap-3", compact ? "grid-cols-[72px_minmax(0,1fr)]" : "grid-cols-[96px_minmax(0,1fr)]")}>
        <div
          className={cn(
            "relative grid shrink-0 place-items-center overflow-hidden rounded-full border-2 border-[var(--ink)] bg-secondary shadow-[3px_3px_0_0_var(--ink)]",
            compact ? "size-[72px]" : "size-24",
          )}
        >
          {value ? (
            <>
              <img src={svgToDataUrl(value)} alt="你的入场画像" className="h-full w-full object-cover" />
              <span className="absolute right-0 bottom-0 grid size-7 place-items-center rounded-full border-2 border-[var(--ink)] bg-[var(--success)] text-white">
                <CheckCircle2 className="size-4" />
              </span>
            </>
          ) : (
            <div className="flex flex-col items-center gap-1 text-primary">
              <Sparkles className="size-7" />
              <span className="text-[10px] font-semibold">未生成</span>
            </div>
          )}
        </div>

        <div className="min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-display text-lg leading-none">拍照生成入场画像</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                名字和画像准备好，才可以进房。照片只在浏览器处理，进房保存生成后的小画像。
              </p>
            </div>
            {required && (
              <span className="shrink-0 rounded-full border-2 border-[var(--ink)] bg-accent px-2 py-0.5 text-[10px] font-semibold">
                必填
              </span>
            )}
          </div>
        </div>
      </div>

      {cameraOpen && (
        <div className="mt-3 overflow-hidden rounded-md border-2 border-[var(--ink)] bg-[var(--ink)]">
          <video ref={videoRef} autoPlay playsInline muted className="aspect-video w-full object-cover" />
          <div className="flex gap-2 bg-card p-2">
            <button
              type="button"
              onClick={capture}
              disabled={busy}
              className="press flex flex-1 items-center justify-center gap-1 rounded-md border-2 border-[var(--ink)] bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-[2px_2px_0_0_var(--ink)] disabled:opacity-60"
            >
              <Camera className="size-4" /> 拍好，生成画像
            </button>
            <button
              type="button"
              onClick={closeCamera}
              className="press grid size-10 place-items-center rounded-md border-2 border-[var(--ink)] bg-card shadow-[2px_2px_0_0_var(--ink)]"
              aria-label="关闭相机"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
      )}

      {!cameraOpen && (
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <button
            type="button"
            onClick={startCamera}
            disabled={busy}
            className="press flex items-center justify-center gap-1 rounded-md border-2 border-[var(--ink)] bg-secondary px-2 py-2 text-xs font-semibold shadow-[2px_2px_0_0_var(--ink)] disabled:opacity-60"
          >
            <Camera className="size-4" /> 自拍
          </button>
          <button
            type="button"
            onClick={pickFile}
            disabled={busy}
            className="press flex items-center justify-center gap-1 rounded-md border-2 border-[var(--ink)] bg-card px-2 py-2 text-xs font-semibold shadow-[2px_2px_0_0_var(--ink)] disabled:opacity-60"
          >
            <ImagePlus className="size-4" /> 上传
          </button>
          <button
            type="button"
            onClick={reset}
            disabled={busy || !value}
            className="press flex items-center justify-center gap-1 rounded-md border-2 border-[var(--ink)] bg-accent px-2 py-2 text-xs font-semibold shadow-[2px_2px_0_0_var(--ink)] disabled:translate-y-0 disabled:opacity-45"
          >
            <RefreshCcw className="size-4" /> 重做
          </button>
        </div>
      )}

      {busy && <p className="mt-2 text-xs text-muted-foreground">正在生成你的入场画像…</p>}
      {cameraError && <p className="mt-2 text-xs text-primary">{cameraError}</p>}
    </div>
  );
}

export function createDefaultAvatar(name: string) {
  const seed = hash(name || "画画人");
  const palette: Palette = {
    skin: ["#f7c8a4", "#e8aa78", "#c98252", "#8f5a3d"][seed % 4],
    hair: ["#1f1712", "#3a2618", "#6f4322", "#2f2a28"][Math.floor(seed / 3) % 4],
    shirt: ACCENTS[Math.floor(seed / 7) % ACCENTS.length],
    accent: ACCENTS[Math.floor(seed / 11) % ACCENTS.length],
    cheek: "#ef7f90",
  };
  return buildCuteAvatar(palette, seed);
}

function createAvatarFromSource(source: CanvasImageSource, name: string) {
  const canvas = document.createElement("canvas");
  const size = 128;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return createDefaultAvatar(name);

  const { width: sourceWidth, height: sourceHeight } = getSourceSize(source, size);
  const side = Math.min(sourceWidth, sourceHeight);
  const sx = Math.max(0, (sourceWidth - side) / 2);
  const sy = Math.max(0, (sourceHeight - side) / 2);
  ctx.drawImage(source, sx, sy, side, side, 0, 0, size, size);

  const seed = hash(name + Date.now().toString(36));
  const palette: Palette = {
    skin: toHex(averageRegion(ctx, 39, 34, 89, 90, { r: 229, g: 172, b: 127 })),
    hair: darken(toHex(averageRegion(ctx, 28, 9, 100, 48, { r: 45, g: 31, b: 25 })), 0.24),
    shirt: saturate(toHex(averageRegion(ctx, 28, 88, 100, 122, { r: 57, g: 132, b: 190 })), 0.25),
    accent: ACCENTS[seed % ACCENTS.length],
    cheek: "#ef7f90",
  };

  return buildCuteAvatar(palette, seed);
}

function getSourceSize(source: CanvasImageSource, fallback: number) {
  if (source instanceof HTMLVideoElement) {
    return { width: source.videoWidth || fallback, height: source.videoHeight || fallback };
  }
  if (source instanceof HTMLImageElement) {
    return { width: source.naturalWidth || source.width || fallback, height: source.naturalHeight || source.height || fallback };
  }
  if (typeof SVGImageElement !== "undefined" && source instanceof SVGImageElement) {
    return { width: source.width.baseVal.value || fallback, height: source.height.baseVal.value || fallback };
  }
  if (source instanceof HTMLCanvasElement) {
    return { width: source.width || fallback, height: source.height || fallback };
  }
  if (typeof OffscreenCanvas !== "undefined" && source instanceof OffscreenCanvas) {
    return { width: source.width || fallback, height: source.height || fallback };
  }
  if (typeof ImageBitmap !== "undefined" && source instanceof ImageBitmap) {
    return { width: source.width || fallback, height: source.height || fallback };
  }
  return { width: fallback, height: fallback };
}

function buildCuteAvatar(palette: Palette, seed: number) {
  const flip = seed % 2 === 0;
  const smile = seed % 3;
  const hairTop = flip
    ? "M26 54c4-28 25-44 53-40 20 3 34 17 35 40-14-12-31-15-49-11-15 3-27 7-39 11Z"
    : "M20 55c5-29 29-46 57-40 22 4 34 20 31 43-13-14-32-19-52-13-14 4-25 8-36 10Z";
  const fringe = flip
    ? "M39 40c8 13 23 17 44 12M48 34c-6 11-14 18-25 22"
    : "M34 46c16-1 31-6 47-17M84 38c8 8 13 15 18 26";
  const hand = flip
    ? "<path d=\"M14 89c12-3 19 4 18 16M18 91l-9-13M25 91l-2-16\" fill=\"none\" stroke=\"#1b1b1b\" stroke-width=\"4\" stroke-linecap=\"round\"/>"
    : "<path d=\"M114 91c-12-3-19 4-18 16M110 93l9-13M103 93l2-16\" fill=\"none\" stroke=\"#1b1b1b\" stroke-width=\"4\" stroke-linecap=\"round\"/>";

  return `<svg viewBox="0 0 128 128" role="img"><rect width="128" height="128" rx="38" fill="#9bdcff"/><circle cx="64" cy="50" r="44" fill="#fff7df" opacity=".2"/><path d="M0 108c20-18 39-21 58-9 20-13 45-11 70 8v21H0Z" fill="${palette.accent}" opacity=".2"/><path d="M32 126c4-28 17-42 32-42s31 14 35 42" fill="${palette.shirt}" stroke="#1b1b1b" stroke-width="4" stroke-linecap="round"/><circle cx="31" cy="67" r="10" fill="${palette.skin}" stroke="#1b1b1b" stroke-width="4"/><circle cx="97" cy="67" r="10" fill="${palette.skin}" stroke="#1b1b1b" stroke-width="4"/><circle cx="64" cy="63" r="35" fill="${palette.skin}" stroke="#1b1b1b" stroke-width="4"/><path d="${hairTop}" fill="${palette.hair}" stroke="#1b1b1b" stroke-width="4" stroke-linejoin="round"/><path d="${fringe}" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" opacity=".5"/><ellipse cx="48" cy="67" rx="5" ry="7" fill="#111"/><ellipse cx="80" cy="67" rx="5" ry="7" fill="#111"/><circle cx="46" cy="64" r="2" fill="#fff"/><circle cx="78" cy="64" r="2" fill="#fff"/><circle cx="44" cy="78" r="6" fill="${palette.cheek}" opacity=".48"/><circle cx="84" cy="78" r="6" fill="${palette.cheek}" opacity=".48"/><path d="${smile === 0 ? "M55 84c5 7 15 7 20 0" : smile === 1 ? "M55 85c6 4 13 4 19 0" : "M56 86h17"}" fill="none" stroke="#1b1b1b" stroke-width="4" stroke-linecap="round"/><circle cx="56" cy="76" r="1.4" fill="#b66a45"/><circle cx="72" cy="76" r="1.4" fill="#b66a45"/>${hand}<path d="M43 103c13 6 29 6 42 0" fill="none" stroke="#ffffff" stroke-width="4" stroke-linecap="round" opacity=".7"/></svg>`;
}

function averageRegion(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, fallback: Rgb) {
  const data = ctx.getImageData(x0, y0, x1 - x0, y1 - y0).data;
  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;
  for (let i = 0; i < data.length; i += 16) {
    const alpha = data[i + 3];
    if (alpha < 180) continue;
    const px = { r: data[i], g: data[i + 1], b: data[i + 2] };
    const brightness = (px.r + px.g + px.b) / 3;
    if (brightness < 18 || brightness > 242) continue;
    r += px.r;
    g += px.g;
    b += px.b;
    count += 1;
  }
  if (!count) return fallback;
  return { r: Math.round(r / count), g: Math.round(g / count), b: Math.round(b / count) };
}

function stopCamera(streamRef: MutableRefObject<MediaStream | null>) {
  streamRef.current?.getTracks().forEach((track) => track.stop());
  streamRef.current = null;
}

function hash(input: string) {
  let out = 0;
  for (let i = 0; i < input.length; i++) out = (out * 31 + input.charCodeAt(i)) >>> 0;
  return out;
}

function toHex({ r, g, b }: Rgb) {
  return `#${[r, g, b]
    .map((value) => Math.round(Math.max(0, Math.min(255, value))).toString(16).padStart(2, "0"))
    .join("")}`;
}

function hexToRgb(hex: string): Rgb {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}

function darken(hex: string, amount: number) {
  const rgb = hexToRgb(hex);
  return toHex({ r: rgb.r * (1 - amount), g: rgb.g * (1 - amount), b: rgb.b * (1 - amount) });
}

function saturate(hex: string, amount: number) {
  const rgb = hexToRgb(hex);
  const avg = (rgb.r + rgb.g + rgb.b) / 3;
  return toHex({
    r: rgb.r + (rgb.r - avg) * amount,
    g: rgb.g + (rgb.g - avg) * amount,
    b: rgb.b + (rgb.b - avg) * amount,
  });
}
