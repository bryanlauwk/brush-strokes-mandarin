import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const identity = z.object({
  code: z.string().min(4).max(8),
  playerId: z.string().uuid(),
  token: z.string().min(10).max(128),
  turnIndex: z.number().int().min(0).max(10000),
});

type HintReason = "no-key" | "blocked" | "timeout" | "error";

type DrawingHint = {
  imageUrl: string | null;
  source: "ai" | "unavailable";
  prompt: string;
  reason?: HintReason;
};

type GatewayImageResponse = {
  data?: Array<{ b64_json?: string }>;
  error?: { message?: string; code?: string };
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
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      console.error("[drawing-hint] missing LOVABLE_API_KEY");
      return unavailableHint(prompt, "no-key");
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 18000);
      let response: Response;
      try {
        response = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3.1-flash-image",
            messages: [{ role: "user", content: prompt }],
            modalities: ["image", "text"],
          }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        console.error("[drawing-hint] gateway error", response.status, body.slice(0, 400));
        return unavailableHint(prompt, response.status === 400 ? "blocked" : "error");
      }

      const json = (await response.json()) as GatewayImageResponse;
      const image = json.data?.[0]?.b64_json;
      if (!image) {
        console.error("[drawing-hint] no image in response", JSON.stringify(json).slice(0, 400));
        return unavailableHint(prompt, "blocked");
      }

      return {
        imageUrl: `data:image/png;base64,${image}`,
        source: "ai",
        prompt,
      };
    } catch (e) {
      const aborted = e instanceof Error && e.name === "AbortError";
      console.error("[drawing-hint] request failed", aborted ? "timeout" : e);
      return unavailableHint(prompt, aborted ? "timeout" : "error");
    }
  });

function buildPrompt(word: string) {
  return [
    `Illustrate: ${word}.`,
    "Create one clear visual hint that is easy to copy by hand: strong silhouette, simple readable shapes, no clutter.",
    "Visual style: Japanese ukiyo-e print mixed with warm modern anime illustration, ink-brush outlines, washi paper texture, soft watercolor washes, lively but not photorealistic.",
    "When the subject allows, place it in a Malaysian everyday scene with tropical light, kopitiam, shophouse, pasar malam, sea breeze, or local street details.",
    "No readable text, no letters, no Chinese characters, no numbers, no watermarks, no app UI, no labels.",
    "Do not reveal the answer through written words. Make it inspirational, not a finished drawing to copy exactly.",
  ].join(" ");
}

function unavailableHint(prompt: string, reason: HintReason): DrawingHint {
  return {
    imageUrl: null,
    source: "unavailable",
    prompt,
    reason,
  };
}
