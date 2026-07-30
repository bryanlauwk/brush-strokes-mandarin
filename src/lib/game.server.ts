import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const CHOOSE_SECONDS = 15;
export const TURN_END_SECONDS = 6;

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function makeCode() {
  let out = "";
  for (let i = 0; i < 5; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
}

export function makeToken() {
  return crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
}

export function cleanName(raw: string) {
  const name = (raw ?? "").trim().replace(/\s+/g, " ").slice(0, 12);
  return name.length ? name : "神秘画手";
}

/** Normalize a guess: strip whitespace/punctuation, full-width -> half-width. */
export function normalizeGuess(raw: string) {
  return (raw ?? "")
    .replace(/[\s\u3000]+/g, "")
    .replace(/[，。！？、；：""''（）,.!?;:"'()]/g, "")
    .replace(/[\uFF01-\uFF5E]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .toLowerCase();
}

function hintOrder(len: number) {
  const order: number[] = [];
  let lo = 0;
  let hi = len - 1;
  while (lo <= hi) {
    order.push(lo);
    if (hi !== lo) order.push(hi);
    lo++;
    hi--;
  }
  return order;
}

export function maskWord(word: string, revealCount = 0) {
  const chars = [...word];
  const shown = new Set(hintOrder(chars.length).slice(0, Math.min(revealCount, chars.length - 1)));
  return chars.map((c, i) => (shown.has(i) ? c : "_")).join(" ");
}

export type RoomRow = {
  id: string;
  code: string;
  host_id: string | null;
  status: string;
  total_rounds: number;
  draw_seconds: number;
  difficulty: string;
  current_round: number;
  turn_index: number;
  drawer_id: string | null;
  masked_word: string | null;
  word_length: number | null;
  revealed_word: string | null;
  round_started_at: string | null;
  round_ends_at: string | null;
  turn_order?: string[] | null;
};

export type PlayerRow = {
  id: string;
  room_id: string;
  name: string;
  score: number;
  round_score: number;
  has_guessed: boolean;
  is_host: boolean;
  avatar: number;
  joined_at: string;
};

export async function getRoomByCode(code: string) {
  const { data } = await supabaseAdmin
    .from("rooms")
    .select("*")
    .eq("code", (code ?? "").toUpperCase())
    .maybeSingle();
  return (data as RoomRow | null) ?? null;
}

export async function listPlayers(roomId: string) {
  const { data } = await supabaseAdmin
    .from("players")
    .select("*")
    .eq("room_id", roomId)
    .order("joined_at", { ascending: true });
  return (data ?? []) as PlayerRow[];
}

export async function authPlayer(code: string, playerId: string, token: string) {
  const room = await getRoomByCode(code);
  if (!room) throw new Error("房间不存在");
  const { data: tok } = await supabaseAdmin
    .from("player_tokens")
    .select("token")
    .eq("player_id", playerId)
    .maybeSingle();
  if (!tok || tok.token !== token) throw new Error("身份校验失败");
  const { data: player } = await supabaseAdmin
    .from("players")
    .select("*")
    .eq("id", playerId)
    .eq("room_id", room.id)
    .maybeSingle();
  if (!player) throw new Error("你已不在这个房间");
  return { room, player: player as PlayerRow };
}

export async function say(
  roomId: string,
  round: number,
  kind: string,
  text: string | null,
  playerId?: string | null,
  playerName?: string | null,
) {
  await supabaseAdmin.from("guesses").insert({
    room_id: roomId,
    round,
    kind,
    text,
    player_id: playerId ?? null,
    player_name: playerName ?? null,
  });
}

async function pickChoices(difficulty: string) {
  let q = supabaseAdmin.from("words").select("word");
  if (difficulty && difficulty !== "全部") q = q.eq("difficulty", difficulty);
  const { data } = await q;
  const words = (data ?? []).map((w) => w.word as string);
  const picked: string[] = [];
  while (picked.length < 3 && words.length) {
    const i = Math.floor(Math.random() * words.length);
    picked.push(words.splice(i, 1)[0]);
  }
  return picked;
}

export async function endGame(room: RoomRow) {
  await supabaseAdmin
    .from("rooms")
    .update({
      status: "ended",
      drawer_id: null,
      masked_word: null,
      revealed_word: null,
      round_ends_at: null,
    })
    .eq("id", room.id);
  await supabaseAdmin
    .from("room_secrets")
    .update({ word: null, choices: [], drawer_id: null })
    .eq("room_id", room.id);
  await say(room.id, room.current_round, "system", "游戏结束，来看看最终排名！");
}

/**
 * Resolve the frozen drawing order for this game.
 * Players that joined mid-game are appended to the end of the order so that
 * everybody still draws exactly once per round; players that left are kept in
 * the array (so nobody else's slot shifts) but are skipped when their turn comes.
 */
async function resolveOrder(room: RoomRow, players: PlayerRow[]) {
  const stored = Array.isArray(room.turn_order) ? (room.turn_order as string[]) : [];
  const order = [...stored];
  for (const p of players) if (!order.includes(p.id)) order.push(p.id);
  if (order.length !== stored.length) {
    await supabaseAdmin.from("rooms").update({ turn_order: order }).eq("id", room.id);
  }
  return order;
}

/** Begin the turn at room.turn_index (drawer picks a word). */
export async function startTurn(room: RoomRow) {
  const players = await listPlayers(room.id);
  if (players.length < 2) {
    await supabaseAdmin.from("rooms").update({ status: "waiting" }).eq("id", room.id);
    return;
  }
  const order = await resolveOrder(room, players);
  const alive = new Map(players.map((p) => [p.id, p]));

  // Skip slots whose player has left, without shifting anybody else's turn.
  let index = Math.max(0, room.turn_index);
  let round = Math.floor(index / order.length) + 1;
  while (round <= room.total_rounds && !alive.has(order[index % order.length])) {
    index += 1;
    round = Math.floor(index / order.length) + 1;
  }
  if (round > room.total_rounds) {
    await endGame(room);
    return;
  }
  if (index !== room.turn_index) {
    await supabaseAdmin.from("rooms").update({ turn_index: index }).eq("id", room.id);
    room = { ...room, turn_index: index };
  }
  const drawer = alive.get(order[index % order.length])!;
  const choices = await pickChoices(room.difficulty);

  await supabaseAdmin
    .from("players")
    .update({ has_guessed: false, round_score: 0 })
    .eq("room_id", room.id);

  await supabaseAdmin.from("room_secrets").upsert({
    room_id: room.id,
    word: null,
    choices,
    drawer_id: drawer.id,
    updated_at: new Date().toISOString(),
  });

  await supabaseAdmin
    .from("rooms")
    .update({
      status: "choosing",
      current_round: round,
      drawer_id: drawer.id,
      masked_word: null,
      word_length: null,
      revealed_word: null,
      round_started_at: null,
      round_ends_at: new Date(Date.now() + CHOOSE_SECONDS * 1000).toISOString(),
    })
    .eq("id", room.id);

  await supabaseAdmin
    .from("strokes")
    .delete()
    .eq("room_id", room.id)
    .lt("turn_index", room.turn_index);
  await say(room.id, round, "system", `第 ${round} 回合 · ${drawer.name} 正在选词`);
}

export async function lockWord(room: RoomRow, word: string) {
  await supabaseAdmin
    .from("room_secrets")
    .update({ word, choices: [], updated_at: new Date().toISOString() })
    .eq("room_id", room.id);
  const now = Date.now();
  await supabaseAdmin
    .from("rooms")
    .update({
      status: "drawing",
      masked_word: maskWord(word, 0),
      word_length: [...word].length,
      round_started_at: new Date(now).toISOString(),
      round_ends_at: new Date(now + room.draw_seconds * 1000).toISOString(),
    })
    .eq("id", room.id);
}

export async function endTurn(room: RoomRow, word: string | null) {
  const players = await listPlayers(room.id);
  const correct = players.filter((p) => p.has_guessed && p.id !== room.drawer_id);
  const drawer = players.find((p) => p.id === room.drawer_id);
  if (drawer && correct.length > 0) {
    const bonus = 50 * correct.length;
    await supabaseAdmin
      .from("players")
      .update({ score: drawer.score + bonus, round_score: bonus })
      .eq("id", drawer.id);
  }
  await supabaseAdmin
    .from("rooms")
    .update({
      status: "turn_end",
      revealed_word: word,
      masked_word: word ? [...word].join(" ") : null,
      round_ends_at: new Date(Date.now() + TURN_END_SECONDS * 1000).toISOString(),
    })
    .eq("id", room.id);
  await say(room.id, room.current_round, "reveal", word ?? "（无）");
}

/** Drive the state machine forward. Safe to call repeatedly from any client. */
export async function advance(room: RoomRow) {
  const now = Date.now();
  const deadline = room.round_ends_at ? Date.parse(room.round_ends_at) : 0;

  if (room.status === "choosing") {
    if (now >= deadline) {
      const { data: secret } = await supabaseAdmin
        .from("room_secrets")
        .select("choices")
        .eq("room_id", room.id)
        .maybeSingle();
      const choices = (secret?.choices as string[] | null) ?? [];
      if (choices.length) await lockWord(room, choices[0]);
      else await endTurn(room, null);
    }
    return;
  }

  if (room.status === "drawing") {
    const { data: secret } = await supabaseAdmin
      .from("room_secrets")
      .select("word")
      .eq("room_id", room.id)
      .maybeSingle();
    const word = (secret?.word as string | null) ?? null;
    const players = await listPlayers(room.id);
    const guessers = players.filter((p) => p.id !== room.drawer_id);
    const allGuessed = guessers.length > 0 && guessers.every((p) => p.has_guessed);

    if (now >= deadline || allGuessed || !word) {
      await endTurn(room, word);
      return;
    }

    const started = room.round_started_at ? Date.parse(room.round_started_at) : now;
    const frac = (now - started) / 1000 / Math.max(room.draw_seconds, 1);
    const reveal = frac > 0.75 ? 2 : frac > 0.45 ? 1 : 0;
    const masked = maskWord(word, reveal);
    if (masked !== room.masked_word) {
      await supabaseAdmin.from("rooms").update({ masked_word: masked }).eq("id", room.id);
    }
    return;
  }

  if (room.status === "turn_end" && now >= deadline) {
    const nextIndex = room.turn_index + 1;
    await supabaseAdmin.from("rooms").update({ turn_index: nextIndex }).eq("id", room.id);
    await startTurn({ ...room, turn_index: nextIndex });
  }
}

export async function scoreGuess(room: RoomRow, player: PlayerRow, text: string) {
  const { data: secret } = await supabaseAdmin
    .from("room_secrets")
    .select("word")
    .eq("room_id", room.id)
    .maybeSingle();
  const word = (secret?.word as string | null) ?? null;
  const guess = normalizeGuess(text);

  if (room.status !== "drawing" || !word || player.id === room.drawer_id || player.has_guessed) {
    await say(room.id, room.current_round, "guess", text.slice(0, 40), player.id, player.name);
    return { correct: false, close: false };
  }

  if (guess === normalizeGuess(word)) {
    const deadline = room.round_ends_at ? Date.parse(room.round_ends_at) : Date.now();
    const remaining = Math.max(0, (deadline - Date.now()) / 1000);
    const points = 100 + Math.round((200 * remaining) / Math.max(room.draw_seconds, 1));
    await supabaseAdmin
      .from("players")
      .update({ has_guessed: true, score: player.score + points, round_score: points })
      .eq("id", player.id);
    await say(
      room.id,
      room.current_round,
      "correct",
      `${player.name} 猜对了！ +${points}`,
      player.id,
      player.name,
    );
    return { correct: true, close: false };
  }

  await say(room.id, room.current_round, "guess", text.slice(0, 40), player.id, player.name);

  const target = [...normalizeGuess(word)];
  const shared = [...new Set(guess)].filter((c) => target.includes(c)).length;
  const close = guess.length === target.length && shared >= Math.ceil(target.length / 2);
  if (close) {
    await say(room.id, room.current_round, "close", `${player.name} 很接近了！`, player.id, player.name);
  }
  return { correct: false, close };
}