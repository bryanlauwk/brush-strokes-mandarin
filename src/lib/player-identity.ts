export type Identity = {
  code: string;
  playerId: string;
  token: string;
  clientId: string;
};

const NAME_KEY = "hy.nickname";
const AVATAR_KEY = "hy.avatarSvg";
const CLIENT_ID_KEY = "hy.clientId";

function key(code: string) {
  return `hy.player.${code.toUpperCase()}`;
}

export function saveIdentity(id: Identity) {
  if (typeof window === "undefined") return;
  const clientId = id.clientId || getOrCreateClientId();
  localStorage.setItem(CLIENT_ID_KEY, clientId);
  localStorage.setItem(key(id.code), JSON.stringify({ ...id, clientId }));
}

export function loadIdentity(code: string): Identity | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key(code));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Identity>;
    if (!parsed?.playerId || !parsed?.token) return null;
    const identity = {
      code: code.toUpperCase(),
      playerId: parsed.playerId,
      token: parsed.token,
      clientId: parsed.clientId || getOrCreateClientId(),
    };
    // Upgrade identities saved before clientId was introduced.
    localStorage.setItem(key(code), JSON.stringify(identity));
    return identity;
  } catch {
    return null;
  }
}

export function getOrCreateClientId() {
  if (typeof window === "undefined") return "";
  const stored = localStorage.getItem(CLIENT_ID_KEY);
  if (stored) return stored;
  const clientId = crypto.randomUUID();
  localStorage.setItem(CLIENT_ID_KEY, clientId);
  return clientId;
}

export function clearIdentity(code: string) {
  if (typeof window === "undefined") return;
  localStorage.removeItem(key(code));
}

export function saveNickname(name: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(NAME_KEY, name);
}

export function loadNickname() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(NAME_KEY) ?? "";
}

export function saveAvatarSvg(svg: string | null) {
  if (typeof window === "undefined") return;
  if (svg) localStorage.setItem(AVATAR_KEY, svg);
  else localStorage.removeItem(AVATAR_KEY);
}

export function loadAvatarSvg() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(AVATAR_KEY);
}
