type CharacterGroup = "圆脸漫画风" | "动漫风" | "超英风";

type CharacterSpec = {
  id: string;
  name: string;
  group: CharacterGroup;
  caption: string;
  skin: string;
  hair: string;
  shirt: string;
  bg: string;
  accent: string;
  hairStyle: "short" | "bob" | "long" | "spiky" | "waves";
  accessory?: "glasses" | "cap" | "mask" | "star" | "headband";
  smile?: "open" | "soft" | "grin";
};

const SPECS: CharacterSpec[] = [
  { id: "kopi-boy", name: "Kopi Boy", group: "圆脸漫画风", caption: "开朗男", skin: "#f4bd87", hair: "#201713", shirt: "#2b7cff", bg: "#64c7ff", accent: "#ffd45c", hairStyle: "short", smile: "open" },
  { id: "milo-girl", name: "Milo Girl", group: "圆脸漫画风", caption: "元气女", skin: "#f1b783", hair: "#2b1a13", shirt: "#1dbf85", bg: "#7ee0c3", accent: "#ff7a90", hairStyle: "long", smile: "open" },
  { id: "penang-kid", name: "槟城仔", group: "圆脸漫画风", caption: "街头男", skin: "#d99a6b", hair: "#181614", shirt: "#f36b35", bg: "#ffcc73", accent: "#1aa7a8", hairStyle: "spiky", accessory: "cap", smile: "grin" },
  { id: "melaka-mate", name: "马六甲妹", group: "圆脸漫画风", caption: "甜笑女", skin: "#e7a878", hair: "#5a321c", shirt: "#e6415f", bg: "#ffa0b2", accent: "#ffe58a", hairStyle: "bob", smile: "soft" },
  { id: "mamak-star", name: "Mamak Star", group: "圆脸漫画风", caption: "夜宵咖", skin: "#b97955", hair: "#151515", shirt: "#7b4bc4", bg: "#b29cff", accent: "#ffd45c", hairStyle: "short", accessory: "glasses", smile: "open" },
  { id: "school-ace", name: "School Ace", group: "动漫风", caption: "学园男", skin: "#f2bd8c", hair: "#111827", shirt: "#294edb", bg: "#9fc8ff", accent: "#ffffff", hairStyle: "spiky", accessory: "headband", smile: "grin" },
  { id: "anime-spark", name: "Anime Spark", group: "动漫风", caption: "闪亮女", skin: "#f6c39a", hair: "#3b2468", shirt: "#ff71a8", bg: "#ffd0ec", accent: "#ffe76b", hairStyle: "waves", accessory: "star", smile: "open" },
  { id: "neon-bro", name: "Neon Bro", group: "动漫风", caption: "酷酷男", skin: "#d49365", hair: "#0f172a", shirt: "#00a8a8", bg: "#83f0ff", accent: "#ffdd57", hairStyle: "short", accessory: "glasses", smile: "soft" },
  { id: "drama-queen", name: "Drama Queen", group: "动漫风", caption: "港剧情绪", skin: "#eab185", hair: "#6b351c", shirt: "#ef476f", bg: "#ffc47d", accent: "#0f9f95", hairStyle: "long", smile: "grin" },
  { id: "rainbow-pal", name: "Rainbow Pal", group: "动漫风", caption: "派对感", skin: "#c9855f", hair: "#1f2937", shirt: "#ffd166", bg: "#b8f56c", accent: "#ff6f91", hairStyle: "bob", smile: "open" },
  { id: "iron-kid", name: "Iron Kid", group: "超英风", caption: "装甲男", skin: "#e2a06f", hair: "#2b1b15", shirt: "#c51f2f", bg: "#ffb84d", accent: "#21b6d7", hairStyle: "short", accessory: "mask", smile: "grin" },
  { id: "web-girl", name: "Web Girl", group: "超英风", caption: "敏捷女", skin: "#f1b98c", hair: "#251511", shirt: "#1666d8", bg: "#8dc6ff", accent: "#ef3340", hairStyle: "long", accessory: "mask", smile: "open" },
  { id: "shield-bro", name: "Shield Bro", group: "超英风", caption: "队长感", skin: "#c7865e", hair: "#171717", shirt: "#2246a3", bg: "#a9c7ff", accent: "#ff4d4d", hairStyle: "spiky", accessory: "star", smile: "soft" },
  { id: "thunder-mate", name: "Thunder Mate", group: "超英风", caption: "雷电女", skin: "#e9ab78", hair: "#d8842d", shirt: "#30343f", bg: "#d6dcff", accent: "#ffd447", hairStyle: "waves", accessory: "headband", smile: "open" },
  { id: "panther-pal", name: "Panther Pal", group: "超英风", caption: "神秘男", skin: "#8f5a3d", hair: "#050505", shirt: "#2d2142", bg: "#bda7ff", accent: "#72f2d4", hairStyle: "short", accessory: "mask", smile: "soft" },
];

export type CharacterAvatar = CharacterSpec & { svg: string };

export const CHARACTER_AVATARS: CharacterAvatar[] = SPECS.map((spec) => ({ ...spec, svg: buildAvatar(spec) }));

export function createDefaultAvatar(name: string) {
  return getCharacterForName(name).svg;
}

export function getCharacterForName(name: string) {
  const seed = hash(name || "画画人");
  return CHARACTER_AVATARS[seed % CHARACTER_AVATARS.length];
}

export function isPresetCharacterAvatar(svg: string | null | undefined) {
  if (!svg) return false;
  return CHARACTER_AVATARS.some((avatar) => avatar.svg === svg);
}

function buildAvatar(spec: CharacterSpec) {
  const hair = hairPath(spec.hairStyle);
  const mouth = mouthPath(spec.smile ?? "open");
  const accessory = accessorySvg(spec);
  return `<svg viewBox="0 0 128 128" role="img" aria-label="${spec.name}"><rect width="128" height="128" rx="64" fill="#161616"/><circle cx="64" cy="64" r="60" fill="${spec.bg}"/><path d="M12 33c16-13 35-13 52 0M76 28c15-10 31-8 43 5M8 92c16-8 33-7 49 2" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" opacity=".7"/><path d="M64 8v18M40 18l8 15M90 18l-8 15" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".55"/><path d="M28 126c4-27 18-41 36-41s32 14 36 41" fill="${spec.shirt}" stroke="#161616" stroke-width="4"/><path d="M37 112c13 8 41 8 54 0" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".7"/><circle cx="31" cy="69" r="10" fill="${spec.skin}" stroke="#161616" stroke-width="4"/><circle cx="97" cy="69" r="10" fill="${spec.skin}" stroke="#161616" stroke-width="4"/><circle cx="64" cy="64" r="37" fill="${spec.skin}" stroke="#161616" stroke-width="4"/><path d="${hair.base}" fill="${spec.hair}" stroke="#161616" stroke-width="4" stroke-linejoin="round"/><path d="${hair.lines}" fill="none" stroke="#fff7d6" stroke-width="2" stroke-linecap="round" opacity=".55"/>${accessory}<ellipse cx="49" cy="68" rx="5" ry="8" fill="#101010"/><ellipse cx="79" cy="68" rx="5" ry="8" fill="#101010"/><circle cx="47" cy="64" r="2" fill="#fff"/><circle cx="77" cy="64" r="2" fill="#fff"/><path d="M38 80h11M79 80h11" stroke="#ef7f90" stroke-width="5" stroke-linecap="round" opacity=".55"/><circle cx="57" cy="77" r="1.4" fill="#9f5c40"/><circle cx="71" cy="77" r="1.4" fill="#9f5c40"/>${mouth}<path d="M18 100c10-7 20-3 21 10M19 97l-8-15M26 95l-1-18M32 98l7-14" fill="none" stroke="#161616" stroke-width="4" stroke-linecap="round"/><circle cx="100" cy="104" r="12" fill="${spec.accent}" stroke="#161616" stroke-width="4"/><path d="M94 104h12M100 98v12" stroke="#fff" stroke-width="3" stroke-linecap="round"/></svg>`;
}

function hairPath(style: CharacterSpec["hairStyle"]) {
  if (style === "long") return { base: "M20 62c1-34 24-55 52-48 24 6 37 26 35 56-10-17-29-24-51-19-16 3-26 8-36 11Z", lines: "M35 42c13 9 30 11 51 5M52 28c-8 12-18 21-31 27M76 28c5 10 15 19 30 27" };
  if (style === "bob") return { base: "M23 60c3-31 27-50 56-43 23 5 35 25 29 51-13-11-30-16-50-14-14 1-25 4-35 6Z", lines: "M32 45c20-1 36-8 52-20M85 38c9 8 15 18 20 30M52 31c-5 12-16 21-30 28" };
  if (style === "spiky") return { base: "M22 56l9-23 12 9 8-19 11 16 15-22 5 24 20-12-1 31c-15-12-35-17-57-12-10 2-17 5-22 8Z", lines: "M35 43c12 7 28 8 48 1M49 31c-5 10-14 18-26 24M77 29c5 9 14 16 27 22" };
  if (style === "waves") return { base: "M18 61c5-35 34-54 61-43 20 8 30 28 25 52-11-15-30-22-52-17-16 3-25 7-34 8Z", lines: "M31 47c10-10 21-11 33-4M63 39c13-9 25-8 38 4M46 28c-7 11-16 20-26 28" };
  return { base: "M24 56c3-30 27-48 56-41 23 5 35 23 32 48-14-12-33-17-54-13-14 3-25 5-34 6Z", lines: "M34 41c12 12 30 16 51 9M50 32c-7 13-18 22-31 27M73 31c4 9 13 17 29 24" };
}

function mouthPath(smile: NonNullable<CharacterSpec["smile"]>) {
  if (smile === "soft") return "<path d=\"M54 84c6 7 15 7 20 0\" fill=\"none\" stroke=\"#161616\" stroke-width=\"4\" stroke-linecap=\"round\"/>";
  if (smile === "grin") return "<path d=\"M52 84c4 9 20 9 24 0\" fill=\"#fff\" stroke=\"#161616\" stroke-width=\"4\" stroke-linejoin=\"round\"/>";
  return "<path d=\"M53 84c4 10 18 10 22 0\" fill=\"#d9362e\" stroke=\"#161616\" stroke-width=\"4\" stroke-linejoin=\"round\"/><path d=\"M59 91c4 2 8 2 12 0\" fill=\"none\" stroke=\"#fff\" stroke-width=\"2\" stroke-linecap=\"round\" opacity=\".8\"/>";
}

function accessorySvg(spec: CharacterSpec) {
  if (spec.accessory === "glasses") return "<path d=\"M40 66h17M71 66h17M57 66h14\" fill=\"none\" stroke=\"#161616\" stroke-width=\"3\" stroke-linecap=\"round\"/><circle cx=\"49\" cy=\"66\" r=\"10\" fill=\"none\" stroke=\"#161616\" stroke-width=\"3\"/><circle cx=\"79\" cy=\"66\" r=\"10\" fill=\"none\" stroke=\"#161616\" stroke-width=\"3\"/>";
  if (spec.accessory === "cap") return `<path d="M30 38c14-14 43-18 66-4l-3 16c-20-7-40-7-61 0Z" fill="${spec.accent}" stroke="#161616" stroke-width="4"/><path d="M83 47c14-3 25 0 31 8" fill="none" stroke="#161616" stroke-width="4" stroke-linecap="round"/>`;
  if (spec.accessory === "mask") return `<path d="M36 61c12-8 45-8 56 0v14c-15-5-40-5-56 0Z" fill="${spec.accent}" stroke="#161616" stroke-width="3" opacity=".95"/>`;
  if (spec.accessory === "star") return `<path d="M64 34l4 8 9 1-7 6 2 9-8-5-8 5 2-9-7-6 9-1Z" fill="${spec.accent}" stroke="#161616" stroke-width="3"/>`;
  if (spec.accessory === "headband") return `<path d="M29 51c18-9 46-12 72 0" fill="none" stroke="${spec.accent}" stroke-width="7" stroke-linecap="round"/><path d="M91 49l13-7M93 53l15 2" stroke="#161616" stroke-width="3" stroke-linecap="round"/>`;
  return "";
}

function hash(input: string) {
  let out = 0;
  for (let i = 0; i < input.length; i++) out = (out * 31 + input.charCodeAt(i)) >>> 0;
  return out;
}
