import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { DEFAULT_ROOM_THEME, normalizeRoomTheme, type RoomTheme } from "@/lib/game-themes";

export const CHOOSE_SECONDS = 15;
export const TURN_END_SECONDS = 6;
export const PRESENCE_STALE_MS = 8_000;
export const RECONNECT_GRACE_MS = 30_000;

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const LOCAL_CATEGORIES = new Set([
  "马来西亚",
  "本地吃喝",
  "本地地点",
  "本地生活",
  "节庆",
  "校园",
  "自然",
]);

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

type WordTuple = [string, string, WordEntry["difficulty"]];

type RoomSecretRow = {
  word?: string | null;
  choices?: unknown;
  used_words?: unknown;
};

function makeWordEntries(rows: WordTuple[]): WordEntry[] {
  return rows.map(([word, category, difficulty]) => ({
    word,
    category,
    difficulty,
  }));
}

const LOCAL_WORD_BANK = makeWordEntries([
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
]);

const THEME_WORD_BANKS: Record<Exclude<RoomTheme, "全部主题" | "马来西亚日常">, WordEntry[]> = {
  我爱槟城: makeWordEntries([
    ["乔治市", "我爱槟城", "普通"],
    ["姓周桥", "我爱槟城", "普通"],
    ["升旗山", "我爱槟城", "普通"],
    ["极乐寺", "我爱槟城", "普通"],
    ["槟城渡轮", "我爱槟城", "挑战"],
    ["壁画街", "我爱槟城", "普通"],
    ["光大", "我爱槟城", "容易"],
    ["海墘", "我爱槟城", "容易"],
    ["新关仔角", "我爱槟城", "挑战"],
    ["峇都丁宜", "我爱槟城", "挑战"],
    ["槟城大桥", "我爱槟城", "挑战"],
    ["亚依淡", "我爱槟城", "普通"],
    ["浮罗山背", "我爱槟城", "挑战"],
    ["槟城叻沙", "我爱槟城", "挑战"],
    ["炒粿条", "我爱槟城", "普通"],
    ["福建面", "我爱槟城", "普通"],
    ["煎蕊", "我爱槟城", "容易"],
    ["豆蔻汁", "我爱槟城", "普通"],
    ["白咖喱面", "我爱槟城", "挑战"],
    ["扁担饭", "我爱槟城", "普通"],
    ["娘惹糕", "我爱槟城", "普通"],
    ["咸鱼骨", "我爱槟城", "普通"],
    ["老厝", "我爱槟城", "容易"],
    ["骑楼", "我爱槟城", "容易"],
    ["五脚基", "我爱槟城", "普通"],
    ["三轮车", "我爱槟城", "普通"],
    ["街边壁画", "我爱槟城", "高手"],
    ["海边日落", "我爱槟城", "挑战"],
    ["庙会香炉", "我爱槟城", "高手"],
    ["古迹酒店", "我爱槟城", "挑战"],
    ["周末塞车", "我爱槟城", "挑战"],
    ["早市咖啡", "我爱槟城", "挑战"],
  ]),
  我爱马六甲: makeWordEntries([
    ["红屋", "我爱马六甲", "容易"],
    ["鸡场街", "我爱马六甲", "普通"],
    ["马六甲河", "我爱马六甲", "挑战"],
    ["圣保罗山", "我爱马六甲", "挑战"],
    ["荷兰广场", "我爱马六甲", "挑战"],
    ["海事博物馆", "我爱马六甲", "高手"],
    ["旋转塔", "我爱马六甲", "普通"],
    ["三轮花车", "我爱马六甲", "挑战"],
    ["娘惹屋", "我爱马六甲", "普通"],
    ["青云亭", "我爱马六甲", "普通"],
    ["峇峇娘惹", "我爱马六甲", "挑战"],
    ["娘惹餐", "我爱马六甲", "普通"],
    ["鸡饭粒", "我爱马六甲", "普通"],
    ["椰糖煎蕊", "我爱马六甲", "挑战"],
    ["沙爹朱律", "我爱马六甲", "挑战"],
    ["葡式蛋挞", "我爱马六甲", "挑战"],
    ["榴莲煎蕊", "我爱马六甲", "挑战"],
    ["古城鸡饭", "我爱马六甲", "挑战"],
    ["周末夜市", "我爱马六甲", "挑战"],
    ["河边咖啡", "我爱马六甲", "挑战"],
    ["古城墙", "我爱马六甲", "普通"],
    ["炮台", "我爱马六甲", "容易"],
    ["纪念品店", "我爱马六甲", "挑战"],
    ["木屐", "我爱马六甲", "容易"],
    ["花砖", "我爱马六甲", "容易"],
    ["老街招牌", "我爱马六甲", "挑战"],
    ["河上游船", "我爱马六甲", "挑战"],
    ["游客合照", "我爱马六甲", "挑战"],
    ["古董店", "我爱马六甲", "普通"],
    ["娘惹珠鞋", "我爱马六甲", "挑战"],
  ]),
  我爱TVB: makeWordEntries([
    ["茶餐厅", "我爱TVB", "普通"],
    ["奶茶", "我爱TVB", "容易"],
    ["菠萝包", "我爱TVB", "普通"],
    ["烧腊饭", "我爱TVB", "普通"],
    ["云吞面", "我爱TVB", "普通"],
    ["鱼蛋档", "我爱TVB", "普通"],
    ["警署", "我爱TVB", "容易"],
    ["法庭", "我爱TVB", "容易"],
    ["新闻直播", "我爱TVB", "挑战"],
    ["记者会", "我爱TVB", "普通"],
    ["鉴证科", "我爱TVB", "普通"],
    ["消防局", "我爱TVB", "普通"],
    ["医院病房", "我爱TVB", "挑战"],
    ["律师楼", "我爱TVB", "普通"],
    ["大家族", "我爱TVB", "普通"],
    ["豪门晚宴", "我爱TVB", "挑战"],
    ["天台谈心", "我爱TVB", "挑战"],
    ["电梯巧遇", "我爱TVB", "挑战"],
    ["失忆桥段", "我爱TVB", "挑战"],
    ["卧底身份", "我爱TVB", "挑战"],
    ["追车戏", "我爱TVB", "普通"],
    ["办公室恋情", "我爱TVB", "高手"],
    ["家族争产", "我爱TVB", "挑战"],
    ["经典对白", "我爱TVB", "挑战"],
    ["片尾曲", "我爱TVB", "普通"],
    ["港铁月台", "我爱TVB", "挑战"],
    ["庙街夜市", "我爱TVB", "挑战"],
    ["霓虹招牌", "我爱TVB", "挑战"],
    ["红色的士", "我爱TVB", "挑战"],
    ["茶餐厅伙计", "我爱TVB", "高手"],
    ["港剧反派", "我爱TVB", "挑战"],
    ["大结局", "我爱TVB", "普通"],
  ]),
  我爱吉隆坡: makeWordEntries([
    ["双峰塔", "我爱吉隆坡", "普通"],
    ["吉隆坡塔", "我爱吉隆坡", "挑战"],
    ["独立广场", "我爱吉隆坡", "挑战"],
    ["茨厂街", "我爱吉隆坡", "普通"],
    ["武吉免登", "我爱吉隆坡", "挑战"],
    ["阿罗街", "我爱吉隆坡", "普通"],
    ["中央艺术坊", "我爱吉隆坡", "高手"],
    ["城中城公园", "我爱吉隆坡", "高手"],
    ["国家清真寺", "我爱吉隆坡", "高手"],
    ["黑风洞", "我爱吉隆坡", "普通"],
    ["捷运站", "我爱吉隆坡", "普通"],
    ["轻快铁", "我爱吉隆坡", "普通"],
    ["单轨火车", "我爱吉隆坡", "挑战"],
    ["电召车", "我爱吉隆坡", "普通"],
    ["塞车长龙", "我爱吉隆坡", "挑战"],
    ["购物广场", "我爱吉隆坡", "挑战"],
    ["天桥走道", "我爱吉隆坡", "挑战"],
    ["夜景打卡", "我爱吉隆坡", "挑战"],
    ["上班人潮", "我爱吉隆坡", "挑战"],
    ["雨后堵车", "我爱吉隆坡", "挑战"],
  ]),
  我爱怡保: makeWordEntries([
    ["怡保白咖啡", "我爱怡保", "高手"],
    ["旧街场", "我爱怡保", "普通"],
    ["二奶巷", "我爱怡保", "普通"],
    ["鸡丝河粉", "我爱怡保", "挑战"],
    ["芽菜鸡", "我爱怡保", "普通"],
    ["盐焗鸡", "我爱怡保", "普通"],
    ["豆花水", "我爱怡保", "普通"],
    ["咖喱面", "我爱怡保", "普通"],
    ["点心楼", "我爱怡保", "普通"],
    ["三宝洞", "我爱怡保", "普通"],
    ["霹雳洞", "我爱怡保", "普通"],
    ["镜湖", "我爱怡保", "容易"],
    ["火车站", "我爱怡保", "普通"],
    ["老戏院", "我爱怡保", "普通"],
    ["壁画巷", "我爱怡保", "普通"],
    ["石灰岩山", "我爱怡保", "挑战"],
    ["温泉度假", "我爱怡保", "挑战"],
    ["早晨茶室", "我爱怡保", "挑战"],
    ["慢慢吃早餐", "我爱怡保", "高手"],
    ["旧街招牌", "我爱怡保", "挑战"],
  ]),
  校园回忆: makeWordEntries([
    ["校服", "校园回忆", "容易"],
    ["食堂", "校园回忆", "容易"],
    ["课室", "校园回忆", "容易"],
    ["礼堂", "校园回忆", "容易"],
    ["操场", "校园回忆", "容易"],
    ["校车", "校园回忆", "容易"],
    ["白板笔", "校园回忆", "普通"],
    ["作业簿", "校园回忆", "普通"],
    ["华文课", "校园回忆", "普通"],
    ["补习班", "校园回忆", "普通"],
    ["班长", "校园回忆", "容易"],
    ["巡察员", "校园回忆", "普通"],
    ["周会排队", "校园回忆", "挑战"],
    ["运动会", "校园回忆", "普通"],
    ["科学实验", "校园回忆", "挑战"],
    ["考试周", "校园回忆", "普通"],
    ["迟到罚站", "校园回忆", "挑战"],
    ["偷吃零食", "校园回忆", "挑战"],
    ["同桌借擦胶", "校园回忆", "高手"],
    ["放学铃声", "校园回忆", "挑战"],
  ]),
  嘛嘛档之夜: makeWordEntries([
    ["嘛嘛档", "嘛嘛档之夜", "容易"],
    ["拉茶", "嘛嘛档之夜", "容易"],
    ["印度煎饼", "嘛嘛档之夜", "普通"],
    ["甩饼", "嘛嘛档之夜", "容易"],
    ["炒面", "嘛嘛档之夜", "容易"],
    ["炒饭", "嘛嘛档之夜", "容易"],
    ["美禄冰", "嘛嘛档之夜", "普通"],
    ["半生熟蛋", "嘛嘛档之夜", "挑战"],
    ["咖椰面包", "嘛嘛档之夜", "挑战"],
    ["香蕉叶饭", "嘛嘛档之夜", "挑战"],
    ["沙爹", "嘛嘛档之夜", "容易"],
    ["烤鸡翅", "嘛嘛档之夜", "普通"],
    ["宵夜桌", "嘛嘛档之夜", "普通"],
    ["球赛直播", "嘛嘛档之夜", "挑战"],
    ["大银幕", "嘛嘛档之夜", "普通"],
    ["塑料椅", "嘛嘛档之夜", "普通"],
    ["点单纸", "嘛嘛档之夜", "普通"],
    ["打包袋", "嘛嘛档之夜", "普通"],
    ["朋友吹水", "嘛嘛档之夜", "挑战"],
    ["凌晨拉茶", "嘛嘛档之夜", "挑战"],
  ]),
  节庆大乱斗: makeWordEntries([
    ["红包封", "节庆大乱斗", "普通"],
    ["舞狮", "节庆大乱斗", "容易"],
    ["年柑", "节庆大乱斗", "容易"],
    ["团圆饭", "节庆大乱斗", "普通"],
    ["新年饼", "节庆大乱斗", "普通"],
    ["拜年", "节庆大乱斗", "容易"],
    ["开斋节", "节庆大乱斗", "普通"],
    ["青包", "节庆大乱斗", "容易"],
    ["椰浆饭", "节庆大乱斗", "容易"],
    ["屠妖节", "节庆大乱斗", "普通"],
    ["油灯", "节庆大乱斗", "容易"],
    ["彩米画", "节庆大乱斗", "普通"],
    ["中秋节", "节庆大乱斗", "普通"],
    ["灯笼", "节庆大乱斗", "容易"],
    ["月饼", "节庆大乱斗", "容易"],
    ["国庆日", "节庆大乱斗", "普通"],
    ["国旗", "节庆大乱斗", "容易"],
    ["倒数烟花", "节庆大乱斗", "挑战"],
    ["塞车回乡", "节庆大乱斗", "挑战"],
    ["开放门户", "节庆大乱斗", "挑战"],
  ]),
};

function themeWords() {
  return Object.values(THEME_WORD_BANKS).flat();
}

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
  room_theme?: string | null;
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
  client_id: string | null;
  connection_status: "connected" | "disconnected";
  disconnected_at: string | null;
  last_seen: string;
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
    .eq("connection_status", "connected")
    .order("joined_at", { ascending: true });
  return (data ?? []) as PlayerRow[];
}

export async function listRetainedPlayers(roomId: string) {
  const { data } = await supabaseAdmin
    .from("players")
    .select("*")
    .eq("room_id", roomId)
    .order("joined_at", { ascending: true });
  return (data ?? []) as PlayerRow[];
}

/**
 * Convert missed heartbeats into an explicit disconnected state, retain that
 * row for a reconnect grace period, then purge it. Only connected rows are
 * returned to callers, so ghosts cannot affect counts, turns, or readiness.
 */
export async function reconcileRoomPresence(room: RoomRow) {
  const now = Date.now();
  const staleBefore = new Date(now - PRESENCE_STALE_MS).toISOString();
  const expiredBefore = new Date(now - RECONNECT_GRACE_MS).toISOString();
  const expiredHeartbeatBefore = new Date(
    now - PRESENCE_STALE_MS - RECONNECT_GRACE_MS,
  ).toISOString();

  // Presence is request-driven, so a room with nobody left may not run this
  // function at the moment the final heartbeat becomes stale. Purge those
  // rows from their last heartbeat instead of incorrectly starting a fresh
  // grace period days later when somebody finally opens the room again.
  await supabaseAdmin
    .from("players")
    .delete()
    .eq("room_id", room.id)
    .eq("connection_status", "connected")
    .lt("last_seen", expiredHeartbeatBefore);

  await supabaseAdmin
    .from("players")
    .update({
      connection_status: "disconnected",
      disconnected_at: new Date(now).toISOString(),
    })
    .eq("room_id", room.id)
    .eq("connection_status", "connected")
    .lt("last_seen", staleBefore);

  await supabaseAdmin
    .from("players")
    .delete()
    .eq("room_id", room.id)
    .eq("connection_status", "disconnected")
    .lt("disconnected_at", expiredBefore);

  const active = await listPlayers(room.id);
  if (active.some((player) => player.id === room.host_id)) return { room, players: active };

  // A disconnected host must not stall the clock for everybody else.
  const nextHost = active[0] ?? null;
  await supabaseAdmin.from("players").update({ is_host: false }).eq("room_id", room.id);
  if (nextHost) {
    await supabaseAdmin.from("players").update({ is_host: true }).eq("id", nextHost.id);
  }
  await supabaseAdmin
    .from("rooms")
    .update({ host_id: nextHost?.id ?? null })
    .eq("id", room.id);

  return {
    room: { ...room, host_id: nextHost?.id ?? null },
    players: nextHost
      ? active.map((player) => ({
          ...player,
          is_host: player.id === nextHost.id,
        }))
      : active,
  };
}

export async function authPlayer(
  code: string,
  playerId: string,
  token: string,
  clientId?: string | null,
) {
  const initialRoom = await getRoomByCode(code);
  const _unusedAuthMarker = initialRoom;
  const room = initialRoom;
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

  const now = new Date().toISOString();
  if (clientId && !player.client_id) {
    // Best-effort upgrade for identities created before persistent client IDs.
    await supabaseAdmin
      .from("players")
      .update({ client_id: clientId })
      .eq("id", playerId)
      .is("client_id", null);
  }
  const { data: connectedPlayer } = await supabaseAdmin
    .from("players")
    .update({
      last_seen: now,
      connection_status: "connected",
      disconnected_at: null,
    })
    .eq("id", playerId)
    .select("*")
    .single();

  const presence = await reconcileRoomPresence(room);
  return {
    room: presence.room,
    player: (connectedPlayer ?? player) as PlayerRow,
  };
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

function toWordEntry(row: {
  word?: string | null;
  category?: string | null;
  difficulty?: string | null;
}): WordEntry | null {
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

function normalizeWordArray(raw: unknown) {
  return Array.isArray(raw)
    ? raw.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean)
    : [];
}

function isMissingColumn(error: { code?: string; message?: string } | null, column: string) {
  const text = `${error?.code ?? ""} ${error?.message ?? ""}`.toLowerCase();
  return (
    text.includes(column.toLowerCase()) ||
    text.includes("could not find") ||
    text.includes("schema cache")
  );
}

async function getRoomSecret(roomId: string, includeUsedWords: boolean) {
  const columns = includeUsedWords ? "word, choices, used_words" : "word, choices";
  const result = await supabaseAdmin
    .from("room_secrets")
    .select(columns)
    .eq("room_id", roomId)
    .maybeSingle();
  if (result.error && includeUsedWords && isMissingColumn(result.error, "used_words")) {
    return getRoomSecret(roomId, false);
  }
  return {
    secret: (result.data as RoomSecretRow | null) ?? null,
    supportsUsedWords: includeUsedWords && !result.error,
  };
}

async function getUsedWords(roomId: string, resetHistory: boolean) {
  const { secret, supportsUsedWords } = await getRoomSecret(roomId, true);
  const usedWords = new Set<string>();

  if (!resetHistory) {
    for (const word of normalizeWordArray(secret?.used_words)) usedWords.add(word);
    for (const word of normalizeWordArray(secret?.choices)) usedWords.add(word);
    if (secret?.word?.trim()) usedWords.add(secret.word.trim());

    const { data } = await supabaseAdmin
      .from("guesses")
      .select("text")
      .eq("room_id", roomId)
      .eq("kind", "reveal");
    for (const row of (data ?? []) as { text?: string | null }[]) {
      const word = (row.text ?? "").trim();
      if (word && word !== "（无）") usedWords.add(word);
    }
  }

  return { usedWords, supportsUsedWords };
}

async function saveTurnChoices(
  roomId: string,
  payload: Record<string, unknown>,
  supportsUsedWords: boolean,
) {
  const saved = await supabaseAdmin.from("room_secrets").upsert(payload as never);
  if (!saved.error || !supportsUsedWords || !isMissingColumn(saved.error, "used_words"))
    return saved;

  const { used_words: _usedWords, ...fallbackPayload } = payload;
  return supabaseAdmin.from("room_secrets").upsert(fallbackPayload as never);
}

function entryMatchesTheme(entry: WordEntry, theme: RoomTheme) {
  if (theme === "全部主题") return true;
  if (theme === "马来西亚日常")
    return LOCAL_CATEGORIES.has(entry.category) || entry.category.startsWith("本地");
  const keyword = theme.replace("我爱", "");
  return (
    entry.category === theme || entry.category.includes(keyword) || entry.word.includes(keyword)
  );
}

function themedWords(localWords: WordEntry[], dbWords: WordEntry[], theme: RoomTheme) {
  const localPool =
    theme === "全部主题"
      ? localWords
      : localWords.filter((entry) => entryMatchesTheme(entry, theme));
  const dbPool = dbWords.filter((entry) => entryMatchesTheme(entry, theme));
  return dedupeWords([...localPool, ...dbPool]);
}

async function pickChoices(
  difficulty: string,
  excludedWords: Set<string>,
  roomTheme?: string | null,
) {
  const selectedDifficulty = normalizeDifficulty(difficulty);
  const selectedTheme = normalizeRoomTheme(roomTheme ?? DEFAULT_ROOM_THEME);
  const { data } = await supabaseAdmin.from("words").select("word, category, difficulty");
  const dbWords = (
    (data ?? []) as {
      word?: string | null;
      category?: string | null;
      difficulty?: string | null;
    }[]
  )
    .map(toWordEntry)
    .filter((entry): entry is WordEntry => Boolean(entry));

  const allLocalWords = dedupeWords([...LOCAL_WORD_BANK, ...themeWords()]);
  const basePool = themedWords(allLocalWords, dbWords, selectedTheme).filter(
    (entry) => !excludedWords.has(entry.word),
  );
  const difficultyPool = basePool.filter(
    (entry) => selectedDifficulty === "全部" || entry.difficulty === selectedDifficulty,
  );
  const pool =
    difficultyPool.length >= 3 || selectedDifficulty === "全部" ? difficultyPool : basePool;
  const picked: WordEntry[] = [];

  const takeFrom = (candidates: WordEntry[]) => {
    const options = shuffle(
      candidates.filter((entry) => !picked.some((p) => p.word === entry.word)),
    );
    const choice = options[0];
    if (choice) picked.push(choice);
  };

  if (selectedDifficulty === "全部" && selectedTheme === "全部主题" && Math.random() < 0.55) {
    takeFrom(pool.filter((entry) => LOCAL_CATEGORIES.has(entry.category)));
  }
  if (selectedDifficulty === "全部" && Math.random() < 0.28) {
    takeFrom(
      pool.filter(
        (entry) =>
          entry.difficulty === "挑战" || entry.difficulty === "高手" || [...entry.word].length >= 4,
      ),
    );
  }
  if (selectedTheme !== "全部主题" && Math.random() < 0.35) {
    takeFrom(pool.filter((entry) => [...entry.word].length >= 4));
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
  const resetHistory = room.current_round === 0 && index === 0;
  const { usedWords, supportsUsedWords } = await getUsedWords(room.id, resetHistory);
  const selectedTheme = normalizeRoomTheme(room.room_theme);
  const choices = await pickChoices(room.difficulty, usedWords, selectedTheme);
  if (choices.length === 0) {
    await endGame({ ...room, current_round: round });
    await say(room.id, round, "system", "题库这一局已经出完了，没有重复题，先看排名。");
    return;
  }

  await supabaseAdmin
    .from("players")
    .update({ has_guessed: false, round_score: 0 })
    .eq("room_id", room.id);

  // Claim the turn atomically BEFORE writing the choices. Several clients tick
  // the state machine at the same time, so without this compare-and-set two
  // callers could each generate a different set of choices for the same turn
  // and players would see the selection change under them.
  const { data: claimedTurn } = await supabaseAdmin
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
    .eq("id", room.id)
    .eq("turn_index", index)
    .neq("status", "choosing")
    .neq("status", "drawing")
    .select("id")
    .maybeSingle();
  if (!claimedTurn) return;

  const nextUsedWords = Array.from(new Set([...usedWords, ...choices]));
  await saveTurnChoices(
    room.id,
    {
      room_id: room.id,
      word: null,
      choices,
      drawer_id: drawer.id,
      updated_at: new Date().toISOString(),
      ...(supportsUsedWords ? { used_words: nextUsedWords } : {}),
    },
    supportsUsedWords,
  );

  await supabaseAdmin
    .from("strokes")
    .delete()
    .eq("room_id", room.id)
    .lt("turn_index", room.turn_index);
  await say(
    room.id,
    round,
    "system",
    `第 ${round} 轮 · ${drawer.name} 正在选题${selectedTheme === "全部主题" ? "" : ` · ${selectedTheme}`}`,
  );
}

export async function lockWord(room: RoomRow, requestedWord: string) {
  if (!room.drawer_id) return null;

  // Claim the secret row first. The `word is null` predicate is a compare-and-
  //-set: a click and the timeout fallback may race, but only one can win and
  // the loser can no longer overwrite the selected word.
  const { data: claimed } = await supabaseAdmin
    .from("room_secrets")
    .update({
      word: requestedWord,
      choices: [],
      updated_at: new Date().toISOString(),
    })
    .eq("room_id", room.id)
    .eq("drawer_id", room.drawer_id)
    .is("word", null)
    .select("word")
    .maybeSingle();

  let word = (claimed?.word as string | null) ?? null;
  if (!word) {
    const { data: existing } = await supabaseAdmin
      .from("room_secrets")
      .select("word")
      .eq("room_id", room.id)
      .maybeSingle();
    word = (existing?.word as string | null) ?? null;
  }
  if (!word) return null;

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
    .eq("id", room.id)
    .eq("status", "choosing")
    .eq("turn_index", room.turn_index)
    .eq("drawer_id", room.drawer_id);

  return word;
}

export async function endTurn(room: RoomRow, word: string | null) {
  // Compare-and-set first: only the caller that actually moves the room out of
  // choosing/drawing may score the turn, otherwise concurrent ticks would pay
  // the drawer bonus twice and post duplicate reveals.
  const { data: claimed } = await supabaseAdmin
    .from("rooms")
    .update({
      status: "turn_end",
      revealed_word: word,
      masked_word: word ? [...word].join(" ") : null,
      round_ends_at: new Date(Date.now() + TURN_END_SECONDS * 1000).toISOString(),
    })
    .eq("id", room.id)
    .eq("turn_index", room.turn_index)
    .in("status", ["choosing", "drawing"])
    .select("id")
    .maybeSingle();
  if (!claimed) return;

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
  await say(room.id, room.current_round, "reveal", word ?? "（无）");
}

/** Drive the state machine forward. Safe to call repeatedly from any client. */
export async function advance(room: RoomRow) {
  const now = Date.now();
  const deadline = room.round_ends_at ? Date.parse(room.round_ends_at) : 0;

  if (room.status === "choosing") {
    const { data: secret } = await supabaseAdmin
      .from("room_secrets")
      .select("word, choices")
      .eq("room_id", room.id)
      .maybeSingle();
    const lockedWord = (secret?.word as string | null) ?? null;
    // Recover the second half of a successful claim if its caller disappeared
    // between updating the secret row and moving the room to drawing.
    if (lockedWord) {
      await lockWord(room, lockedWord);
      return;
    }
    if (now >= deadline) {
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
    // Only one caller may bump the turn, otherwise two simultaneous ticks would
    // skip a player's slot.
    const { data: bumped } = await supabaseAdmin
      .from("rooms")
      .update({ turn_index: nextIndex })
      .eq("id", room.id)
      .eq("turn_index", room.turn_index)
      .eq("status", "turn_end")
      .select("id")
      .maybeSingle();
    if (!bumped) return;
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
      .update({
        has_guessed: true,
        score: player.score + points,
        round_score: points,
      })
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
    await say(
      room.id,
      room.current_round,
      "close",
      `${player.name} 很靠近了！`,
      player.id,
      player.name,
    );
  }
  return { correct: false, close };
}
