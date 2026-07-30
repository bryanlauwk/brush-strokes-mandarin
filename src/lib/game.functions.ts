import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const identity = z.object({
  code: z.string().min(4).max(8),
  playerId: z.string().uuid(),
  token: z.string().min(10).max(128),
});

const difficulty = z.enum(["全部", "容易", "普通", "挑战", "高手", "简单", "中等", "困难"]);
const profile = z.object({ name: z.string().max(30), avatarSvg: z.string().max(5000).nullable().optional() });

type PlayerInsert = Record<string, unknown>;

function cleanAvatarSvg(raw?: string | null) {
  const svg = (raw ?? "").trim();
  if (!svg) return null;
  if (svg.length > 5000) return null;
  if (!svg.startsWith("<svg ") || !svg.endsWith("</svg>")) return null;
  if (/[\u0000-\u001f]/.test(svg)) return null;
  const lowered = svg.toLowerCase();
  if (
    lowered.includes("<script") ||
    lowered.includes("foreignobject") ||
    lowered.includes("javascript:") ||
    lowered.includes("data:") ||
    lowered.includes("http:") ||
    lowered.includes("https:") ||
    /\son[a-z]+\s*=/.test(lowered)
  ) {
    return null;
  }
  return svg;
}

async function insertPlayer(supabaseAdmin: Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"], payload: PlayerInsert) {
  const withAvatar = await supabaseAdmin.from("players").insert(payload).select("*").single();
  if (!withAvatar.error || !("avatar_svg" in payload)) return withAvatar;

  const message = `${withAvatar.error.code ?? ""} ${withAvatar.error.message ?? ""}`;
  if (!message.includes("avatar_svg")) return withAvatar;

  const { avatar_svg: _avatarSvg, ...withoutAvatar } = payload;
  return supabaseAdmin.from("players").insert(withoutAvatar).select("*").single();
}

export const createRoom = createServerFn({ method: "POST" })
  .inputValidator((d) => profile.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const g = await import("./game.server");
    const name = g.cleanName(data.name);
    const avatarSvg = cleanAvatarSvg(data.avatarSvg);

    let code = g.makeCode();
    for (let i = 0; i < 6; i++) {
      const existing = await g.getRoomByCode(code);
      if (!existing) break;
      code = g.makeCode();
    }

    const { data: room, error } = await supabaseAdmin
      .from("rooms")
      .insert({ code })
      .select("*")
      .single();
    if (error || !room) throw new Error("开局失败");

    const { data: player, error: pErr } = await insertPlayer(supabaseAdmin, {
      room_id: room.id,
      name,
      is_host: true,
      avatar: Math.floor(Math.random() * 8),
      avatar_svg: avatarSvg,
    });
    if (pErr || !player) throw new Error("加入失败");

    const token = g.makeToken();
    await supabaseAdmin.from("player_tokens").insert({ player_id: player.id, token });
    await supabaseAdmin.from("rooms").update({ host_id: player.id }).eq("id", room.id);
    await supabaseAdmin.from("room_secrets").insert({ room_id: room.id });
    await g.say(room.id, 0, "system", `${name} 开了一局`);

    return { code: room.code, playerId: player.id, token };
  });

export const joinRoom = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    profile.extend({ code: z.string().min(4).max(8) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const g = await import("./game.server");
    const room = await g.getRoomByCode(data.code);
    if (!room) throw new Error("找不到这个号码，请再检查一次");

    const players = await g.listPlayers(room.id);
    if (players.length >= 12) throw new Error("这一局满了（最多 12 人）");

    let name = g.cleanName(data.name);
    if (players.some((p) => p.name === name)) name = `${name}2`.slice(0, 12);
    const avatarSvg = cleanAvatarSvg(data.avatarSvg);

    const { data: player, error } = await insertPlayer(supabaseAdmin, {
      room_id: room.id,
      name,
      avatar: Math.floor(Math.random() * 8),
      avatar_svg: avatarSvg,
    });
    if (error || !player) throw new Error("加入失败");

    const token = g.makeToken();
    await supabaseAdmin.from("player_tokens").insert({ player_id: player.id, token });
    await g.say(room.id, room.current_round, "system", `${name} 加入这局`);

    return { code: room.code, playerId: player.id, token };
  });

export const getPrivateState = createServerFn({ method: "POST" })
  .inputValidator((d) => identity.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const g = await import("./game.server");
    const { room, player } = await g.authPlayer(data.code, data.playerId, data.token);

    await supabaseAdmin
      .from("players")
      .update({ last_seen: new Date().toISOString() })
      .eq("id", player.id);

    const isDrawer = room.drawer_id === player.id;
    if (!isDrawer) return { isDrawer: false, word: null, choices: [] as string[] };

    const { data: secret } = await supabaseAdmin
      .from("room_secrets")
      .select("word, choices")
      .eq("room_id", room.id)
      .maybeSingle();

    return {
      isDrawer: true,
      word: (secret?.word as string | null) ?? null,
      choices: room.status === "choosing" ? ((secret?.choices as string[] | null) ?? []) : [],
    };
  });

export const updateSettings = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    identity
      .extend({
        totalRounds: z.number().int().min(1).max(10),
        drawSeconds: z.number().int().min(30).max(180),
        difficulty,
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const g = await import("./game.server");
    const { room, player } = await g.authPlayer(data.code, data.playerId, data.token);
    if (room.host_id !== player.id) throw new Error("只有主持人可以改设置");
    if (room.status !== "waiting" && room.status !== "ended") throw new Error("这一局已经开始了");

    await supabaseAdmin
      .from("rooms")
      .update({
        total_rounds: data.totalRounds,
        draw_seconds: data.drawSeconds,
        difficulty: g.normalizeDifficulty(data.difficulty),
      })
      .eq("id", room.id);
    return { ok: true };
  });

export const startGame = createServerFn({ method: "POST" })
  .inputValidator((d) => identity.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const g = await import("./game.server");
    const { room, player } = await g.authPlayer(data.code, data.playerId, data.token);
    if (room.host_id !== player.id) throw new Error("只有主持人可以开始");

    const players = await g.listPlayers(room.id);
    if (players.length < 2) throw new Error("至少需要 2 位玩家");

    await supabaseAdmin
      .from("players")
      .update({ score: 0, round_score: 0, has_guessed: false })
      .eq("room_id", room.id);
    await supabaseAdmin.from("strokes").delete().eq("room_id", room.id);
    await supabaseAdmin.from("guesses").delete().eq("room_id", room.id);
    await supabaseAdmin
      .from("rooms")
      .update({
        turn_index: 0,
        current_round: 0,
        status: "waiting",
        turn_order: players.map((p) => p.id),
      })
      .eq("id", room.id);

    await g.startTurn({
      ...room,
      turn_index: 0,
      current_round: 0,
      turn_order: players.map((p) => p.id),
    });
    return { ok: true };
  });

export const chooseWord = createServerFn({ method: "POST" })
  .inputValidator((d) => identity.extend({ word: z.string().min(1).max(12) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const g = await import("./game.server");
    const { room, player } = await g.authPlayer(data.code, data.playerId, data.token);
    if (room.drawer_id !== player.id) throw new Error("现在还没轮到你选题");
    if (room.status !== "choosing") throw new Error("现在不能选题");

    const { data: secret } = await supabaseAdmin
      .from("room_secrets")
      .select("choices")
      .eq("room_id", room.id)
      .maybeSingle();
    const choices = (secret?.choices as string[] | null) ?? [];
    if (!choices.includes(data.word)) throw new Error("这个题目不能选");

    await g.lockWord(room, data.word);
    return { ok: true };
  });

export const submitGuess = createServerFn({ method: "POST" })
  .inputValidator((d) => identity.extend({ text: z.string().min(1).max(40) }).parse(d))
  .handler(async ({ data }) => {
    const g = await import("./game.server");
    const { room, player } = await g.authPlayer(data.code, data.playerId, data.token);
    const result = await g.scoreGuess(room, player, data.text);
    await g.advance({ ...room });
    return result;
  });

export const pushStroke = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    identity
      .extend({
        stroke: z.object({
          id: z.string().max(64),
          kind: z.enum(["line", "fill", "clear", "undo"]),
          color: z.string().max(32).optional(),
          size: z.number().min(0).max(80).optional(),
          points: z.array(z.tuple([z.number(), z.number()])).max(4000).optional(),
        }),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const g = await import("./game.server");
    const { room, player } = await g.authPlayer(data.code, data.playerId, data.token);
    if (room.drawer_id !== player.id) throw new Error("只有画画的人可以动笔");
    if (room.status !== "drawing") throw new Error("现在还不能画");

    await supabaseAdmin.from("strokes").insert({
      room_id: room.id,
      round: room.current_round,
      turn_index: room.turn_index,
      payload: data.stroke,
    });
    return { ok: true };
  });

export const tick = createServerFn({ method: "POST" })
  .inputValidator((d) => identity.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const g = await import("./game.server");
    const { room, player } = await g.authPlayer(data.code, data.playerId, data.token);
    await supabaseAdmin
      .from("players")
      .update({ last_seen: new Date().toISOString() })
      .eq("id", player.id);
    await g.advance(room);
    return { ok: true };
  });

export const leaveRoom = createServerFn({ method: "POST" })
  .inputValidator((d) => identity.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const g = await import("./game.server");
    const { room, player } = await g.authPlayer(data.code, data.playerId, data.token);

    await supabaseAdmin.from("players").delete().eq("id", player.id);
    await g.say(room.id, room.current_round, "system", `${player.name} 离开这局`);

    const rest = await g.listPlayers(room.id);
    if (rest.length === 0) {
      await supabaseAdmin.from("rooms").delete().eq("id", room.id);
      return { ok: true };
    }
    if (room.host_id === player.id) {
      await supabaseAdmin.from("rooms").update({ host_id: rest[0].id }).eq("id", room.id);
      await supabaseAdmin.from("players").update({ is_host: true }).eq("id", rest[0].id);
    }
    if (room.drawer_id === player.id && room.status !== "waiting" && room.status !== "ended") {
      await g.endTurn(room, null);
    }
    return { ok: true };
  });
