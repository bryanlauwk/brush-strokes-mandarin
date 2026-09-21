type CharacterSpec = {
  id: string;
  name: string;
  group: string;
  caption: string;
  bg: string;
  accent: string;
  body: string;
  face: string;
};

const INK = "#17171d";

const SPECS: CharacterSpec[] = [
  {
    id: "steady-lah",
    name: "稳啦",
    group: "午夜怪咖",
    caption: "不会画，气势先到。",
    bg: "#d8ff3e",
    accent: "#d8ff3e",
    body: '<path d="M27 77C17 56 31 26 49 32L55 19Q64 9 72 20L80 34C107 25 116 55 103 79L95 101Q82 112 64 101Q40 113 31 95Z" fill="#d8ff3e"/><path d="M45 34L42 22M85 35L89 23" stroke="#d8ff3e" stroke-width="7" stroke-linecap="round"/>',
    face: '<ellipse cx="47" cy="59" rx="9" ry="12"/><ellipse cx="82" cy="59" rx="9" ry="12"/><path d="M48 81Q65 93 81 79" fill="none" stroke-width="5" stroke-linecap="round"/>',
  },
  {
    id: "blur-blur",
    name: "懵一下",
    group: "午夜怪咖",
    caption: "答案在嘴边，真的。",
    bg: "#bda7f7",
    accent: "#bda7f7",
    body: '<path d="M25 81C19 62 29 28 51 31C63 13 89 28 93 44C119 50 114 85 97 94C83 113 68 103 57 108C35 111 24 99 25 81Z" fill="#bda7f7"/>',
    face: '<circle cx="48" cy="62" r="12" fill="#f5f5ef" stroke="none"/><circle cx="80" cy="56" r="12" fill="#f5f5ef" stroke="none"/><circle cx="50" cy="65" r="5"/><circle cx="77" cy="58" r="5"/><ellipse cx="67" cy="86" rx="7" ry="9"/>',
  },
  {
    id: "drama-star",
    name: "戏很多",
    group: "午夜怪咖",
    caption: "每一笔都是大场面。",
    bg: "#ff8568",
    accent: "#ff8568",
    body: '<path d="M64 14L80 43L113 39L99 68L114 96L80 96L62 119L46 94L15 93L28 64L16 37L46 42Z" fill="#ff8568"/>',
    face: '<path d="M40 55L53 59L41 65M84 54L73 59L84 65" fill="none" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><path d="M46 79Q63 74 82 79Q72 99 57 94Z"/><path d="M55 81H74" stroke="#f5f5ef" stroke-width="5"/>',
  },
  {
    id: "diam-diam",
    name: "静静赢",
    group: "午夜怪咖",
    caption: "话不多，分不少。",
    bg: "#9bdcff",
    accent: "#9bdcff",
    body: '<path d="M26 103V58C26 9 104 9 104 58V104L90 94L77 107L64 96L49 107L38 95Z" fill="#9bdcff"/>',
    face: '<rect x="43" y="54" width="10" height="18" rx="5"/><rect x="77" y="54" width="10" height="18" rx="5"/><path d="M58 85H71" fill="none" stroke-width="5" stroke-linecap="round"/>',
  },
  {
    id: "kopi-powered",
    name: "加杯先",
    group: "午夜怪咖",
    caption: "夜还早，再来一局。",
    bg: "#ffd786",
    accent: "#ffd786",
    body: '<path d="M31 32L49 43Q64 36 79 43L98 29L101 79Q102 108 66 111Q30 108 28 81Z" fill="#ffd786"/><path d="M30 64L12 48L17 88L32 82M99 64L115 49L112 89L99 82" fill="#ffd786"/>',
    face: '<path d="M40 65H55M76 65H91" stroke-width="5" stroke-linecap="round"/><path d="M54 86Q65 94 78 83" fill="none" stroke-width="5" stroke-linecap="round"/><path d="M62 39L58 27L68 26L64 15" fill="none" stroke="#ffd786" stroke-width="5" stroke-linecap="round"/>',
  },
  {
    id: "chaos-jelly",
    name: "乱来王",
    group: "午夜怪咖",
    caption: "画风很歪，快乐很正。",
    bg: "#f3a9d8",
    accent: "#f3a9d8",
    body: '<path d="M19 66C19 3 110 6 110 66L97 75L104 103L83 94L70 111L59 96L38 109L38 83L21 86L31 73Z" fill="#f3a9d8"/>',
    face: '<circle cx="46" cy="56" r="7"/><path d="M76 51L89 59L76 65" fill="none" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><path d="M52 77Q63 88 75 76" fill="none" stroke-width="5" stroke-linecap="round"/><path d="M65 83V95Q75 101 78 89L76 81" fill="#ff8568" stroke-width="3"/>',
  },
  {
    id: "sure-bo",
    name: "酱也行",
    group: "午夜怪咖",
    caption: "有点离谱，但猜对了。",
    bg: "#85dfba",
    accent: "#85dfba",
    body: '<path d="M25 93C3 64 37 21 54 39Q75 11 93 31Q110 42 97 61Q125 83 104 99Q86 117 71 100Q39 119 25 93Z" fill="#85dfba"/>',
    face: '<circle cx="46" cy="66" r="10" fill="#f5f5ef" stroke="none"/><circle cx="80" cy="61" r="10" fill="#f5f5ef" stroke="none"/><circle cx="50" cy="66" r="4"/><circle cx="84" cy="61" r="4"/><path d="M56 87L74 83" stroke-width="5" stroke-linecap="round"/>',
  },
  {
    id: "last-second",
    name: "最后一秒",
    group: "午夜怪咖",
    caption: "等下！我知道了！",
    bg: "#a8aaff",
    accent: "#a8aaff",
    body: '<path d="M68 11L29 63L48 71L28 112L99 69L80 58L105 23L72 37Z" fill="#a8aaff"/>',
    face: '<ellipse cx="57" cy="57" rx="5" ry="8"/><ellipse cx="76" cy="51" rx="5" ry="8"/><path d="M60 77L78 69" stroke-width="5" stroke-linecap="round"/>',
  },
];

export type CharacterAvatar = CharacterSpec & { svg: string };

export const CHARACTER_AVATARS: CharacterAvatar[] = SPECS.map((spec) => ({
  ...spec,
  svg: buildAvatar(spec),
}));

export function createDefaultAvatar(name: string) {
  return getCharacterForName(name).svg;
}

export function getCharacterForName(name: string) {
  const seed = hash(name || "夜猫子");
  return CHARACTER_AVATARS[seed % CHARACTER_AVATARS.length];
}

export function isPresetCharacterAvatar(svg: string | null | undefined) {
  return !!svg && CHARACTER_AVATARS.some((avatar) => avatar.svg === svg);
}

function buildAvatar(spec: CharacterSpec) {
  // Keep stored SVGs namespace-free: the profile validator rejects URL strings.
  // svgToDataUrl adds the namespace when these are rendered as image resources.
  return `<svg viewBox="0 0 128 128" role="img" aria-label="${spec.name}"><rect width="128" height="128" rx="36" fill="${INK}"/>${spec.body}<g fill="${INK}" stroke="${INK}">${spec.face}</g></svg>`;
}

function hash(input: string) {
  let out = 0;
  for (let i = 0; i < input.length; i++) out = (out * 31 + input.charCodeAt(i)) >>> 0;
  return out;
}
