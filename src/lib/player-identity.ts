export type Identity = { code: string; playerId: string; token: string };

const NAME_KEY = "hy.nickname";

function key(code: string) {
  return `hy.player.${code.toUpperCase()}`;
}

export function saveIdentity(id: Identity) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key(id.code), JSON.stringify(id));
}

export function loadIdentity(code: string): Identity | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key(code));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Identity;
    if (!parsed?.playerId || !parsed?.token) return null;
    return { ...parsed, code: code.toUpperCase() };
  } catch {
    return null;
  }
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