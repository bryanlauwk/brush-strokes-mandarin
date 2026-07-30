import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { Camera, ImagePlus, RefreshCcw, Sparkles, X } from "lucide-react";
import { svgToDataUrl } from "@/components/game/PlayerAvatar";
import { cn } from "@/lib/utils";

type Props = {
  value: string | null;
  onChange: (svg: string | null) => void;
  name?: string;
  compact?: boolean;
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

export function SelfieAvatar({ value, onChange, name = "画画人", compact }: Props) {
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

  const useDefault = () => onChange(createDefaultAvatar(name));

  return (
    <div className={cn("rounded-md border-2 border-[var(--ink)] bg-card/80 p-3", compact && "p-2")}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="user"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0])}
      />

      <div className="flex items-center gap-3">
        <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-[var(--ink)] bg-secondary shadow-[2px_2px_0_0_var(--ink)]">
          {value ? (
            <img src={svgToDataUrl(value)} alt="你的可爱角色" className="h-full w-full object-cover" />
          ) : (
            <Sparkles className="size-6 text-primary" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg leading-none">自拍变角色</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            原照片只在你的浏览器处理，进房只会保存生成后的小角色。
          </p>
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
              <Camera className="size-4" /> 生成角色
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
        <div className="mt-3 grid grid-cols-3 gap-2">
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
            onClick={value ? () => onChange(null) : useDefault}
            disabled={busy}
            className="press flex items-center justify-center gap-1 rounded-md border-2 border-[var(--ink)] bg-accent px-2 py-2 text-xs font-semibold shadow-[2px_2px_0_0_var(--ink)] disabled:opacity-60"
          >
            <RefreshCcw className="size-4" /> {value ? "重做" : "随机"}
          </button>
        </div>
      )}

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
  const size = 96;
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
    skin: toHex(averageRegion(ctx, 30, 26, 66, 67, { r: 229, g: 172, b: 127 })),
    hair: darken(toHex(averageRegion(ctx, 22, 8, 74, 38, { r: 45, g: 31, b: 25 })), 0.22),
    shirt: saturate(toHex(averageRegion(ctx, 24, 68, 72, 94, { r: 57, g: 132, b: 190 })), 0.2),
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
  if (source instanceof SVGImageElement) {
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
  const hairFlip = seed % 2 === 0;
  const smile = seed % 3;
  const blushY = smile === 0 ? 57 : 58;
  const hairPath = hairFlip
    ? "M24 42c2-19 16-31 35-28 15 2 25 12 26 28-10-8-21-10-34-8-11 1-20 4-27 8Z"
    : "M18 43c3-19 19-32 38-29 16 3 26 14 24 30-8-9-21-13-36-10-10 2-18 5-26 9Z";

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" role="img"><rect width="96" height="96" rx="28" fill="#fff7df"/><circle cx="18" cy="18" r="9" fill="${palette.accent}" opacity=".45"/><circle cx="80" cy="22" r="7" fill="#39c0c8" opacity=".35"/><path d="M24 92c3-20 15-31 25-31s23 11 25 31" fill="${palette.shirt}" stroke="#1b1b1b" stroke-width="3" stroke-linecap="round"/><circle cx="27" cy="52" r="8" fill="${palette.skin}" stroke="#1b1b1b" stroke-width="3"/><circle cx="69" cy="52" r="8" fill="${palette.skin}" stroke="#1b1b1b" stroke-width="3"/><circle cx="48" cy="49" r="26" fill="${palette.skin}" stroke="#1b1b1b" stroke-width="3"/><path d="${hairPath}" fill="${palette.hair}" stroke="#1b1b1b" stroke-width="3" stroke-linejoin="round"/><path d="M31 48c3-3 8-3 11 0M56 48c3-3 8-3 11 0" fill="none" stroke="#1b1b1b" stroke-width="3" stroke-linecap="round"/><circle cx="36" cy="54" r="3" fill="#1b1b1b"/><circle cx="60" cy="54" r="3" fill="#1b1b1b"/><circle cx="32" cy="${blushY}" r="4" fill="${palette.cheek}" opacity=".45"/><circle cx="64" cy="${blushY}" r="4" fill="${palette.cheek}" opacity=".45"/><path d="${smile === 0 ? "M42 64c3 4 9 4 12 0" : smile === 1 ? "M42 64c4 3 8 3 12 0" : "M43 65h10"}" fill="none" stroke="#1b1b1b" stroke-width="3" stroke-linecap="round"/><path d="M34 75c8 4 19 4 28 0" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" opacity=".75"/></svg>`;
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
