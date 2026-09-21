const SOUND_KEY = "arcade.sound";
export const SOUND_CHANGE_EVENT = "arcade-sound-change";
let sessionPreference: boolean | undefined;

export function isSoundEnabled() {
  if (typeof window === "undefined") return true;
  if (sessionPreference !== undefined) return sessionPreference;
  try {
    return localStorage.getItem(SOUND_KEY) !== "off";
  } catch {
    return true;
  }
}

export function setSoundEnabled(enabled: boolean) {
  sessionPreference = enabled;
  try {
    localStorage.setItem(SOUND_KEY, enabled ? "on" : "off");
  } catch {
    /* Preference stays usable for this page. */
  }
  window.dispatchEvent(new CustomEvent(SOUND_CHANGE_EVENT, { detail: enabled }));
}
