import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const CHOOSE_SECONDS = 15;
export const TURN_END_SECONDS = 6;

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const LOCAL_CATEGORIES = new Set(["马来西亚", "本地吃喝", "本地地点", "本地生活", "节庆", "校园", "自然"]);

const DIFFICULTY_ALIASES: Record<string, "容易" | "普通" | "挑战" | "高手"> = {
  简单: "容易",
  中等: "普通",
  困难: "挑战",
  容易: "容易",
  普通: "普通",
  挑战: "挑战",
  高手: "高手",
};

type WordEntry = {
  word: string;
  category: string;
  difficulty: "容易" | "普通" | "挑战" | "高手";
};

const LOCAL_WORD_BANK: WordEntry[] = [
  ["椰浆饭", "本地吃喝", "容易"],
  ["拉茶", "本地吃喝", "容易"],
  ["咖椰", "本地吃喝", "容易"],
  ["加央角", "本地吃喝", "普通"],
  ["印度煎饼", "本地吃喝", "普通"],
  ["炒粿条", "本地吃喝", "普通"],
  ["福建面", "本地吃喝", "普通"],
  ["云吞面", "本地吃喝", "普通"],
  ["肉骨茶", "本地吃喝", "普通"],
  ["沙爹", "本地吃喝", "容易"],
  ["叻沙", "本地吃喝", "容易"],
  ["乌达", "本地吃喝", "容易"],
  ["娘惹糕", "本地吃喝", "普通"],
  ["煎蕊", "本地吃喝", "容易"],
  ["红豆冰", "本地吃喝", "普通"],
  ["白咖啡", "本地吃喝", "普通"],
  ["咸蛋鸡", "本地吃喝", "普通"],
  ["香蕉叶饭", "本地吃喝", "挑战"],
  ["甘榜鸡饭", "本地吃喝", "挑战"],
  ["海南鸡饭", "本地吃喝", "普通"],
  ["嘛嘛档", "本地生活", "容易"],
  ["茶室", "本地生活", "容易"],
  ["巴刹", "本地生活", "容易"],
  ["夜市", "本地生活", "容易"],
  ["早市", "本地生活", "容易"],
  ["组屋", "本地生活", "容易"],
  ["轻快铁", "本地生活", "普通"],
  ["捷运站", "本地生活", "普通"],
  ["收费站", "本地生活", "普通"],
  ["停车固本", "本地生活", "挑战"],
  ["添油站", "本地生活", "普通"],
  ["雨伞", "本地生活", "容易"],
  ["拖鞋", "本地生活", "容易"],
  ["榴莲手套", "本地生活", "挑战"],
  ["购物广场", "本地生活", "挑战"],
  ["双峰塔", "本地地点", "普通"],
  ["吉隆坡", "本地地点", "普通"],
  ["槟城", "本地地点", "容易"],
  ["怡保", "本地地点", "容易"],
  ["马六甲", "本地地点", "普通"],
  ["新山", "本地地点", "容易"],
  ["古晋", "本地地点", "容易"],
  ["亚庇", "本地地点", "容易"],
  ["云顶", "本地地点", "容易"],
  ["太平湖", "本地地点", "普通"],
  ["黑风洞", "本地地点", "普通"],
  ["独立广场", "本地地点", "挑战"],
  ["茨厂街", "本地地点", "普通"],
  ["姓周桥", "本地地点", "普通"],
  ["红屋", "本地地点", "容易"],
  ["丹绒亚路", "本地地点", "挑战"],
  ["神山", "自然", "容易"],
  ["热带雨林", "自然", "挑战"],
  ["红毛猩猩", "自然", "挑战"],
  ["长鼻猴", "自然", "普通"],
  ["犀鸟", "自然", "容易"],
  ["萤火虫", "自然", "普通"],
  ["燕窝", "自然", "容易"],
  ["油棕园", "自然", "普通"],
  ["椰子树", "自然", "普通"],
  ["稻田", "自然", "容易"],
  ["暴雨", "自然", "容易"],
  ["季候风", "自然", "普通"],
  ["开斋节", "节庆", "普通"],
  ["屠妖节", "节庆", "普通"],
  ["中秋节", "节庆", "普通"],
  ["新年饼", "节庆", "普通"],
  ["红包封", "节庆", "普通"],
  ["舞狮", "节庆", "容易"],
  ["灯笼", "节庆", "容易"],
  ["甘蔗", "节庆", "容易"],
  ["年柑", "节庆", "容易"],
  ["国庆日", "节庆", "普通"],
  ["校服", "校园", "容易"],
  ["食堂", "校园", "容易"],
  ["课室", "校园", "容易"],
  ["白板笔", "校园", "普通"],
  ["校车", "校园", "容易"],
  ["运动会", "校园", "普通"],
  ["华文课", "校园", "普通"],
  ["补习班", "校园", "普通"],
  ["作业簿", "校园", "普通"],
  ["科学实验", "校园", "挑战"],
  ["太阳眼镜", "日常", "挑战"],
  ["吹风机", "日常", "普通"],
  ["洗衣机", "日常", "普通"],
  ["遥控器", "日常", "普通"],
  ["电梯", "日常", "容易"],
  ["脚车", "日常", "容易"],
  ["摩托", "日常", "容易"],
  ["巴士站", "日常", "普通"],
  ["手机壳", "日常", "普通"],
  ["充电线", "日常", "普通"],
  ["雨衣", "日常", "容易"],
  ["行李箱", "日常", "普通"],
  ["理发店", "日常", "普通"],
  ["牙刷杯", "日常", "普通"],
  ["便利店", "日常", "普通"],
  ["电影院", "日常", "普通"],
  ["生日蛋糕", "日常", "挑战"],
  ["羽球拍", "运动", "普通"],
  ["足球门", "运动", "普通"],
  ["游泳池", "运动", "普通"],
  ["跆拳道", "运动", "挑战"],
  ["保龄球", "运动", "普通"],
  ["飞盘", "运动", "容易"],
  ["跳绳", "运动", "容易"],
  ["露营灯", "运动", "普通"],
  ["火锅店", "日常", "普通"],
  ["飞机跑道", "交通", "挑战"],
  ["渡轮", "交通", "容易"],
  ["电召车", "交通", "普通"],
  ["脚踏车道", "交通", "挑战"],
  ["交通圈", "交通", "普通"],
  ["红绿灯", "交通", "普通"],
  ["斑马线", "交通", "普通"],
  ["安全帽", "交通", "普通"],
  ["方向盘", "交通", "普通"],
  ["雨刷", "交通", "容易"],
  ["榴莲摊", "本地生活", "普通"],
  ["椰水档", "本地生活", "普通"],
  ["咖啡店老板", "本地生活", "高手"],
  ["夜市炸鸡摊", "本地生活", "高手"],
  ["巴刹鱼贩", "本地生活", "挑战"],
  ["茶室点单纸", "本地生活", "高手"],
  ["轻快铁月台", "本地生活", "高手"],
  ["雨后堵车", "本地生活", "挑战"],
  ["周末早茶", "本地生活", "挑战"],
].map(([word, category, difficulty]) => ({ word, category, difficulty })) as WordEntry[];

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
  return name.length ? name : "画画人";
}

export function normalizeDifficulty(raw?: string | null) {
  if (!raw || raw === "全部") return "全部";
  return DIFFICULTY_ALIASES[raw] ?? "全部";
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
  if (!room) throw new Error("找不到这个号码");
  const { data: tok } = await supabaseAdmin
    .from("player_tokens")
    .select("token")
    .eq("player_id", playerId)
    .maybeSingle();
  if (!tok || tok.token !== token) throw new Error("身份验证失败");
  const { data: player } = await supabaseAdmin
    .from("players")
    .select("*")
    .eq("id", playerId)
    .eq("room_id", room.id)
    .maybeSingle();
  if (!player) throw new Error("你已经不在这局了");
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

function difficultyFromLength(word: string): WordEntry["difficulty"] {
  const len = [...word].length;
  if (len <= 2) return "容易";
  if (len <= 4) return "普通";
  if (len <= 6) return "挑战";
  return "高手";
}

function toWordEntry(row: { word?: string | null; category?: string | null; difficulty?: string | null }): WordEntry | null {
  const word = (row.word ?? "").trim();
  if (!word) return null;
  const mapped = normalizeDifficulty(row.difficulty);
  return {
    word,
    category: row.category || "日常",
    difficulty: mapped === "全部" ? difficultyFromLength(word) : mapped,
  };
}

function shuffle<T>(items: T[]) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function dedupeWords(words: WordEntry[]) {
  const seen = new Set<string>();
  return words.filter((entry) => {
    if (seen.has(entry.word)) return false;
    seen.add(entry.word);
    return true;
  });
}

async function pickChoices(difficulty: string) {
  const selectedDifficulty = normalizeDifficulty(difficulty);
  const { data } = await supabaseAdmin.from("words").select("word, category, difficulty");
  const dbWords = ((data ?? []) as { word?: string | null; category?: string | null; difficulty?: string | null }[])
    .map(toWordEntry)
    .filter((entry): entry is WordEntry => Boolean(entry));

  const pool = dedupeWords([...LOCAL_WORD_BANK, ...dbWords]).filter(
    (entry) => selectedDifficulty === "全部" || entry.difficulty === selectedDifficulty,
  );
  const picked: WordEntry[] = [];

  const takeFrom = (candidates: WordEntry[]) => {
    const options = shuffle(candidates.filter((entry) => !picked.some((p) => p.word === entry.word)));
    const choice = options[0];
    if (choice) picked.push(choice);
  };

  if (selectedDifficulty === "全部" && Math.random() < 0.65) {
    takeFrom(pool.filter((entry) => LOCAL_CATEGORIES.has(entry.category)));
  }
  if (Math.random() < 0.22) {
    takeFrom(pool.filter((entry) => entry.difficulty === "挑战" || entry.difficulty === "高手" || [...entry.word].length >= 4));
  }

  while (picked.length < 3) {
    const before = picked.length;
    takeFrom(pool);
    if (picked.length === before) break;
  }

  return picked.map((entry) => entry.word).slice(0, 3);
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
  await say(room.id, room.current_round, "system", "这一局结束，来看排名！");
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
  await say(room.id, round, "system", `第 ${round} 轮 · ${drawer.name} 正在选题`);
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
      `${player.name} 猜中了！ +${points}`,
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
    await say(room.id, room.current_round, "close", `${player.name} 很靠近了！`, player.id, player.name);
  }
  return { correct: false, close };
}
