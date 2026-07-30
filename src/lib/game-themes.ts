export const ROOM_THEMES = ["全部主题", "马来西亚日常", "我爱槟城", "我爱马六甲", "我爱TVB"] as const;

export type RoomTheme = (typeof ROOM_THEMES)[number];

export const DEFAULT_ROOM_THEME: RoomTheme = "全部主题";

export const ROOM_THEME_OPTIONS: { value: RoomTheme; label: string; description: string }[] = [
  { value: "全部主题", label: "全部主题", description: "本地、日常、地点、娱乐混着来。" },
  { value: "马来西亚日常", label: "马来西亚日常", description: "茶室、夜市、节庆、交通和生活感。" },
  { value: "我爱槟城", label: "我爱槟城", description: "街区、小吃、古迹和海边记忆。" },
  { value: "我爱马六甲", label: "我爱马六甲", description: "古城、娘惹、河边和周末人潮。" },
  { value: "我爱TVB", label: "我爱TVB", description: "港剧名场面、职业、对白感和年代回忆。" },
];

export function normalizeRoomTheme(raw?: string | null): RoomTheme {
  return ROOM_THEMES.includes(raw as RoomTheme) ? (raw as RoomTheme) : DEFAULT_ROOM_THEME;
}
