import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { ROOM_THEMES, normalizeRoomTheme } from "@/lib/game-themes";
import type { Stroke } from "@/lib/game-types";

const identity = z.object({
  code: z.string().min(4).max(8),
  playerId: z.string().uuid(),
  token: z.string().min(10).max(128),
  clientId: z.string().uuid().optional(),
});

const difficulty = z.enum(["全部", "容易", "普通", "挑战", "高手", "简单", "中等", "困难"]);
const roomTheme = z.enum(ROOM_THEMES);
const profile = z.object({
  name: z.string().max(30),
  avatarSvg: z.string().max(5000).nullable().optional(),
  roomTheme: roomTheme.optional(),
  clientId: z.string().uuid(),
});
function insertPlayerMessage(error: { message?: string } | null) {
  const detail = (error?.message ?? "").trim();
  return detail ? `加入失败：${detail}` : "加入失败，请再试一次";
}

type PlayerInsert = Record<string, unknown>;

type SupabaseAdmin = Awaited<
  typeof import("@/integrations/supabase/client.server")
>["supabaseAdmin"];

function cleanAvatarSvg(raw?: string | null) {
  const svg = (raw ?? "").trim();
  if (!svg) return null;
  if (svg.length > 5000) return null;
  if (!svg.startsWith("<svg ") || !svg.endsWith("</svg>")) return null;
  // eslint-disable-next-line no-control-regex
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

function isMissingColumn(error: { code?: string; message?: string } | null, column: string) {
  const text = `${error?.code ?? ""} ${error?.message ?? ""}`.toLowerCase();
  return (
    text.includes(column.toLowerCase()) ||
    text.includes("could not find") ||
    text.includes("schema cache")
  );
}

async function insertRoom(supabaseAdmin: SupabaseAdmin, payload: Record<string, unknown>) {
  const withTheme = await supabaseAdmin
    .from("rooms")
    .insert(payload as never)
    .select("*")
    .single();
  if (!withTheme.error || !isMissingColumn(withTheme.error, "room_theme")) return withTheme;

  const { room_theme: _roomTheme, ...fallbackPayload } = payload;
  return supabaseAdmin
    .from("rooms")
    .insert(fallbackPayload as never)
    .select("*")
    .single();
}

async function updateRoomSettings(
  supabaseAdmin: SupabaseAdmin,
  roomId: string,
  payload: Record<string, unknown>,
) {
  const withTheme = await supabaseAdmin
    .from("rooms")
    .update(payload as never)
    .eq("id", roomId);
  if (!withTheme.error || !isMissingColumn(withTheme.error, "room_theme")) return withTheme;

  const { room_theme: _roomTheme, ...fallbackPayload } = payload;
  return supabaseAdmin
    .from("rooms")
    .update(fallbackPayload as never)
    .eq("id", roomId);
}

async function insertPlayer(supabaseAdmin: SupabaseAdmin, payload: PlayerInsert) {
  const withAvatar = await supabaseAdmin
    .from("players")
    .insert(payload as never)
    .select("*")
    .single();
  if (!withAvatar.error || !isMissingColumn(withAvatar.error, "avatar_svg")) return withAvatar;

  // Older databases may not have the avatar column yet — still let the player in.
  const { avatar_svg: _avatarSvg, ...fallbackPayload } = payload;
  return supabaseAdmin
    .from("players")
    .insert(fallbackPayload as never)
    .select("*")
    .single();
}

async function parkRoomForLowPlayers(
  supabaseAdmin: SupabaseAdmin,
  roomId: string,
  hostId: string | null,
  round: number,
) {
  const g = await import("./game.server");
  await supabaseAdmin
    .from("rooms")
    .update({
      host_id: hostId,
      status: "waiting",
      drawer_id: null,
      masked_word: null,
      word_length: null,
      revealed_word: null,
      round_started_at: null,
      round_ends_at: null,
    })
    .eq("id", roomId);
  await supabaseAdmin
    .from("room_secrets")
    .update({ word: null, choices: [], drawer_id: null })
    .eq("room_id", roomId);
  await g.say(roomId, round, "system", "人数不足，先回到等人");
}

export const createRoom = createServerFn({ method: "POST" })
  .inputValidator((d) => profile.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const g = await import("./game.server");
    const name = g.cleanName(data.name);
    const avatarSvg = cleanAvatarSvg(data.avatarSvg);
    const selectedTheme = normalizeRoomTheme(data.roomTheme);

    let code = g.makeCode();
    for (let i = 0; i < 6; i++) {
      const existing = await g.getRoomByCode(code);
      if (!existing) break;
      code = g.makeCode();
    }

    const { data: room, error } = await insertRoom(supabaseAdmin, {
      code,
      room_theme: selectedTheme,
    });
    if (error || !room) throw new Error("开局失败");

    const { data: player, error: pErr } = await insertPlayer(supabaseAdmin, {
      room_id: room.id,
      name,
      is_host: true,
      avatar: Math.floor(Math.random() * 8),
      avatar_svg: avatarSvg,
      client_id: data.clientId,
      connection_status: "connected",
      disconnected_at: null,
      last_seen: new Date().toISOString(),
    });
    if (pErr || !player) throw new Error(insertPlayerMessage(pErr));

    const token = g.makeToken();
    await supabaseAdmin.from("player_tokens").insert({ player_id: player.id, token });
    await supabaseAdmin.from("rooms").update({ host_id: player.id }).eq("id", room.id);
    await supabaseAdmin.from("room_secrets").insert({ room_id: room.id });
    await g.say(room.id, 0, "system", `${name} 开了一局 · ${selectedTheme}`);

    return {
      code: room.code,
      playerId: player.id,
      token,
      clientId: data.clientId,
    };
  });

export const joinRoom = createServerFn({ method: "POST" })
  .inputValidator((d) => profile.extend({ code: z.string().min(4).max(8) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const g = await import("./game.server");
    const room = await g.getRoomByCode(data.code);
    if (!room) throw new Error("找不到这个号码，请再检查一次");

    await g.reconcileRoomPresence(room);
    const avatarSvg = cleanAvatarSvg(data.avatarSvg);
    const reconnect = async () => {
      const { data: existing } = await supabaseAdmin
        .from("players")
        .select("*")
        .eq("room_id", room.id)
        .eq("client_id", data.clientId)
        .maybeSingle();
      if (!existing) return null;

      const name = g.cleanName(data.name);
      const { data: player, error: reconnectError } = await supabaseAdmin
        .from("players")
        .update({
          name,
          avatar_svg: avatarSvg,
          connection_status: "connected",
          disconnected_at: null,
          last_seen: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .select("*")
        .single();
      if (reconnectError || !player) throw new Error(insertPlayerMessage(reconnectError));

      const { data: savedToken } = await supabaseAdmin
        .from("player_tokens")
        .select("token")
        .eq("player_id", player.id)
        .maybeSingle();
      const token = savedToken?.token ?? g.makeToken();
      if (!savedToken) {
        await supabaseAdmin.from("player_tokens").insert({ player_id: player.id, token });
      }
      const refreshedRoom = await g.getRoomByCode(room.code);
      if (refreshedRoom) await g.reconcileRoomPresence(refreshedRoom);
      await g.say(room.id, room.current_round, "system", `${name} 重新连上线`);
      return {
        code: room.code,
        playerId: player.id,
        token,
        clientId: data.clientId,
      };
    };

    const resumed = await reconnect();
    if (resumed) return resumed;

    const players = await g.listPlayers(room.id);
    if (players.length >= 12) throw new Error("这一局满了（最多 12 人）");

    let name = g.cleanName(data.name);
    if (players.some((p) => p.name === name)) name = `${name}2`.slice(0, 12);

    const { data: player, error } = await insertPlayer(supabaseAdmin, {
      room_id: room.id,
      name,
      avatar: Math.floor(Math.random() * 8),
      avatar_svg: avatarSvg,
      client_id: data.clientId,
      connection_status: "connected",
      disconnected_at: null,
      last_seen: new Date().toISOString(),
    });
    if (error || !player) {
      // Two tabs from the same browser can submit together. The database's
      // (room_id, client_id) unique index picks one row; the loser resumes it.
      if (error?.code === "23505") {
        const concurrentResume = await reconnect();
        if (concurrentResume) return concurrentResume;
      }
      throw new Error(insertPlayerMessage(error));
    }

    const token = g.makeToken();
    await supabaseAdmin.from("player_tokens").insert({ player_id: player.id, token });
    const refreshedRoom = await g.getRoomByCode(room.code);
    if (refreshedRoom) await g.reconcileRoomPresence(refreshedRoom);
    await g.say(room.id, room.current_round, "system", `${name} 加入这局`);

    return {
      code: room.code,
      playerId: player.id,
      token,
      clientId: data.clientId,
    };
  });

export const getPrivateState = createServerFn({ method: "POST" })
  .inputValidator((d) => identity.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const g = await import("./game.server");
    const { room, player } = await g.authPlayer(
      data.code,
      data.playerId,
      data.token,
      data.clientId,
    );

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
        roomTheme: roomTheme.optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const g = await import("./game.server");
    const { room, player } = await g.authPlayer(
      data.code,
      data.playerId,
      data.token,
      data.clientId,
    );
    if (room.host_id !== player.id) throw new Error("只有主持人可以改设置");
    if (room.status !== "waiting" && room.status !== "ended") throw new Error("这一局已经开始了");

    const saved = await updateRoomSettings(supabaseAdmin, room.id, {
      total_rounds: data.totalRounds,
      draw_seconds: data.drawSeconds,
      difficulty: g.normalizeDifficulty(data.difficulty),
      room_theme: normalizeRoomTheme(data.roomTheme ?? room.room_theme),
    });
    if (saved.error) throw new Error("保存失败");
    return { ok: true };
  });

export const startGame = createServerFn({ method: "POST" })
  .inputValidator((d) => identity.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const g = await import("./game.server");
    const { room, player } = await g.authPlayer(
      data.code,
      data.playerId,
      data.token,
      data.clientId,
    );
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
  .inputValidator((d) =>
    identity
      .extend({
        word: z.string().min(1).max(12),
        turnIndex: z.number().int().nonnegative(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const g = await import("./game.server");
    const { room, player } = await g.authPlayer(
      data.code,
      data.playerId,
      data.token,
      data.clientId,
    );
    if (room.drawer_id !== player.id) throw new Error("现在还没轮到你选题");
    if (room.status !== "choosing") throw new Error("现在不能选题");
    if (room.turn_index !== data.turnIndex) throw new Error("这一轮的选题已经结束");

    const { data: secret } = await supabaseAdmin
      .from("room_secrets")
      .select("choices")
      .eq("room_id", room.id)
      .maybeSingle();
    const choices = (secret?.choices as string[] | null) ?? [];
    if (!choices.includes(data.word)) throw new Error("这个题目不能选");

    const lockedWord = await g.lockWord(room, data.word);
    if (!lockedWord) throw new Error("题目没有锁定，请再试一次");
    return { ok: true, word: lockedWord };
  });

export const submitGuess = createServerFn({ method: "POST" })
  .inputValidator((d) => identity.extend({ text: z.string().min(1).max(40) }).parse(d))
  .handler(async ({ data }) => {
    const g = await import("./game.server");
    const { room, player } = await g.authPlayer(
      data.code,
      data.playerId,
      data.token,
      data.clientId,
    );
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
          points: z
            .array(z.tuple([z.number(), z.number()]))
            .max(4000)
            .optional(),
        }),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const g = await import("./game.server");
    const { room, player } = await g.authPlayer(
      data.code,
      data.playerId,
      data.token,
      data.clientId,
    );
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
    const { room, player } = await g.authPlayer(
      data.code,
      data.playerId,
      data.token,
      data.clientId,
    );
    await supabaseAdmin
      .from("players")
      .update({ last_seen: new Date().toISOString() })
      .eq("id", player.id);

    if (room.status === "choosing" || room.status === "drawing") {
      const players = await g.listPlayers(room.id);
      if (players.length < 2) {
        await parkRoomForLowPlayers(supabaseAdmin, room.id, room.host_id, room.current_round);
        return { ok: true };
      }
      if (!room.drawer_id || !players.some((p) => p.id === room.drawer_id)) {
        await g.endTurn(room, null);
        return { ok: true };
      }
    }

    await g.advance(room);
    return { ok: true };
  });

export const leaveRoom = createServerFn({ method: "POST" })
  .inputValidator((d) => identity.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const g = await import("./game.server");
    const { room, player } = await g.authPlayer(
      data.code,
      data.playerId,
      data.token,
      data.clientId,
    );

    await supabaseAdmin.from("players").delete().eq("id", player.id);
    await g.say(room.id, room.current_round, "system", `${player.name} 离开这局`);

    const rest = await g.listPlayers(room.id);
    const retained = await g.listRetainedPlayers(room.id);
    if (retained.length === 0) {
      await supabaseAdmin.from("rooms").delete().eq("id", room.id);
      return { ok: true };
    }

    const nextHost = room.host_id === player.id ? rest[0] : null;
    if (nextHost) {
      await supabaseAdmin.from("players").update({ is_host: true }).eq("id", nextHost.id);
    }

    if (rest.length < 2) {
      const activeHost = rest.find((candidate) => candidate.id === room.host_id);
      await parkRoomForLowPlayers(
        supabaseAdmin,
        room.id,
        nextHost?.id ?? activeHost?.id ?? rest[0]?.id ?? null,
        room.current_round,
      );
      return { ok: true };
    }

    if (nextHost) {
      await supabaseAdmin.from("rooms").update({ host_id: nextHost.id }).eq("id", room.id);
    }
    if (room.drawer_id === player.id && room.status !== "waiting" && room.status !== "ended") {
      await g.endTurn(room, null);
    }
    return { ok: true };
  });

export const roomExists = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ code: z.string().min(4).max(8) }).parse(d))
  .handler(async ({ data }) => {
    const g = await import("./game.server");
    const room = await g.getRoomByCode(data.code);
    return { exists: Boolean(room) };
  });

export const getRoomSnapshot = createServerFn({ method: "POST" })
  .inputValidator((d) => identity.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const g = await import("./game.server");
    const { room } = await g.authPlayer(data.code, data.playerId, data.token, data.clientId);

    const players = await g.listPlayers(room.id);
    const [{ data: strokes }, { data: messages }] = await Promise.all([
      supabaseAdmin
        .from("strokes")
        .select("payload")
        .eq("room_id", room.id)
        .eq("round", room.current_round)
        .eq("turn_index", room.turn_index)
        .order("id", { ascending: true }),
      supabaseAdmin
        .from("guesses")
        .select("id, round, player_id, player_name, text, kind, created_at")
        .eq("room_id", room.id)
        .order("id", { ascending: true })
        .limit(200),
    ]);

    return {
      room,
      players,
      strokes: ((strokes ?? []) as unknown as { payload: Stroke }[]).map((r) => r.payload),
      messages: messages ?? [],
    };
  });
