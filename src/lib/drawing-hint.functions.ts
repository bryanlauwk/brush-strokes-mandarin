import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const identity = z.object({
  code: z.string().min(4).max(8),
  playerId: z.string().uuid(),
  token: z.string().min(10).max(128),
  turnIndex: z.number().int().min(0).max(10000),
});

type DrawingHint = {
  imageUrl: string;
  source: "ai" | "fallback";
  prompt: string;
};

type OpenAIImageResponse = {
  data?: Array<{ b64_json?: string }>;
  error?: { message?: string };
};

export const generateDrawingHint = createServerFn({ method: "POST" })
  .inputValidator((d) => identity.parse(d))
  .handler(async ({ data }): Promise<DrawingHint> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const g = await import("./game.server");
    const { room, player } = await g.authPlayer(data.code, data.playerId, data.token);

    if (room.drawer_id !== player.id) throw new Error("只有画的人可以看灵感图");
    if (room.status !== "drawing") throw new Error("选好题目才会有灵感图");
    if (room.turn_index !== data.turnIndex) throw new Error("这一轮已经换人了");

    const { data: secret } = await supabaseAdmin
      .from("room_secrets")
      .select("word")
      .eq("room_id", room.id)
      .maybeSingle();
    const word = ((secret?.word as string | null) ?? "").trim();
    if (!word) throw new Error("还没有题目");

    const prompt = buildPrompt(word);
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return fallbackHint(word, prompt);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);
      const response = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-2",
          prompt,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) return fallbackHint(word, prompt);
      const json = (await response.json()) as OpenAIImageResponse;
      const image = json.data?.[0]?.b64_json;
      if (!image) return fallbackHint(word, prompt);

      return {
        imageUrl: `data:image/png;base64,${image}`,
        source: "ai",
        prompt,
      };
    } catch {
      return fallbackHint(word, prompt);
    }
  });

function buildPrompt(word: string) {
  return [
    "Private reference image for the drawer in a casual Mandarin draw-and-guess party game.",
    `Secret word: ${word}.`,
    "Create one clear, simple, bright, friendly visual reference with a strong silhouette and easy shapes to copy by hand.",
    "Use a Malaysian everyday setting when it helps the subject make sense.",
    "No readable text, no letters, no Chinese characters, no numbers, no watermarks, no app UI, no labels.",
    "Avoid photorealism. Use clean flat colors, rounded forms, and a playful illustrated look.",
  ].join(" ");
}

function fallbackHint(word: string, prompt: string): DrawingHint {
  const seed = hash(word);
  const colors = ["#f4772e", "#39c0c8", "#f7c948", "#3f9142", "#7b4bc4", "#d7263d"];
  const primary = colors[seed % colors.length];
  const secondary = colors[Math.floor(seed / 5) % colors.length];
  const shape = seed % 3;
  const mainShape =
    shape === 0
      ? `<circle cx="128" cy="112" r="48" fill="${primary}" stroke="#1b1b1b" stroke-width="7"/>`
      : shape === 1
        ? `<rect x="76" y="62" width="104" height="104" rx="28" fill="${primary}" stroke="#1b1b1b" stroke-width="7"/>`
        : `<path d="M128 50 188 166H68Z" fill="${primary}" stroke="#1b1b1b" stroke-width="7" stroke-linejoin="round"/>`;

  const svg = `<svg viewBox="0 0 256 256" role="img" xmlns="http://www.w3.org/2000/svg"><rect width="256" height="256" rx="34" fill="#fff7df"/><circle cx="42" cy="42" r="18" fill="${secondary}" opacity=".32"/><circle cx="218" cy="58" r="24" fill="#39c0c8" opacity=".26"/><path d="M36 204c28-28 62-35 92-16 30-19 64-12 92 16" fill="none" stroke="#1b1b1b" stroke-width="6" stroke-linecap="round" opacity=".18"/>${mainShape}<path d="M82 188h92" stroke="#1b1b1b" stroke-width="7" stroke-linecap="round"/><path d="M95 206h66" stroke="${secondary}" stroke-width="8" stroke-linecap="round"/><text x="128" y="232" text-anchor="middle" font-size="20" font-family="system-ui, sans-serif" font-weight="700" fill="#1b1b1b">${escapeXml(word)}</text></svg>`;

  return {
    imageUrl: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`,
    source: "fallback",
    prompt,
  };
}

function hash(input: string) {
  let out = 0;
  for (let i = 0; i < input.length; i++) out = (out * 31 + input.charCodeAt(i)) >>> 0;
  return out;
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
