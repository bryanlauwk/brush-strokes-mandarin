import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const identity = z.object({
  code: z.string().min(4).max(8),
  playerId: z.string().uuid(),
  token: z.string().min(10).max(128),
  turnIndex: z.number().int().min(0).max(10000),
});

type DrawingHint = {
  imageUrl: string | null;
  source: "ai" | "unavailable";
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
    if (!apiKey) return unavailableHint(prompt);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 18000);
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

      if (!response.ok) return unavailableHint(prompt);
      const json = (await response.json()) as OpenAIImageResponse;
      const image = json.data?.[0]?.b64_json;
      if (!image) return unavailableHint(prompt);

      return {
        imageUrl: `data:image/png;base64,${image}`,
        source: "ai",
        prompt,
      };
    } catch {
      return unavailableHint(prompt);
    }
  });

function buildPrompt(word: string) {
  return [
    "Private reference image for the drawer in a casual Malaysian Mandarin draw-and-guess party game.",
    `Secret word: ${word}.`,
    "Create one clear visual hint that is easy to copy by hand: strong silhouette, simple readable shapes, no clutter.",
    "Visual style: Japanese ukiyo-e print mixed with warm modern anime illustration, ink-brush outlines, washi paper texture, soft watercolor washes, lively but not photorealistic.",
    "When the subject allows, place it in a Malaysian everyday scene with tropical light, kopitiam, shophouse, pasar malam, sea breeze, or local street details.",
    "No readable text, no letters, no Chinese characters, no numbers, no watermarks, no app UI, no labels.",
    "Do not reveal the answer through written words. Make it inspirational, not a finished drawing to copy exactly.",
  ].join(" ");
}

function unavailableHint(prompt: string): DrawingHint {
  return {
    imageUrl: null,
    source: "unavailable",
    prompt,
  };
}
