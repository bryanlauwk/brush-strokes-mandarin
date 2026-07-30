export type Room = {
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

export type Player = {
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

export type ChatMessage = {
  id: number;
  round: number;
  player_id: string | null;
  player_name: string | null;
  text: string | null;
  kind: string;
  created_at: string;
};

export type Stroke = {
  id: string;
  kind: "line" | "fill" | "clear" | "undo";
  color?: string;
  size?: number;
  points?: [number, number][];
};

export const PALETTE = [
  "#1b1b1b",
  "#6b7280",
  "#ffffff",
  "#d7263d",
  "#f4772e",
  "#f7c948",
  "#3f9142",
  "#2f6fb3",
  "#7b4bc4",
  "#c2529b",
  "#8a5a2b",
  "#39c0c8",
];

export const BRUSH_SIZES = [4, 9, 18, 32];

export const AVATARS = ["🐼", "🐯", "🦊", "🐸", "🐧", "🐙", "🦉", "🐻"];