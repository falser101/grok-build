export const THEME_KEY = "grok-web.theme";

export type ThemePref = "auto" | "dark" | "light";
export type ThemeResolved = "dark" | "light";

export function loadThemePref(store: Storage): ThemePref {
  const v = store.getItem(THEME_KEY);
  return v === "dark" || v === "light" ? v : "auto";
}

export function persistThemePref(pref: ThemePref, store: Storage): void {
  store.setItem(THEME_KEY, pref);
}

export function systemPrefersLight(media?: MediaQueryList | { matches: boolean }): boolean {
  if (media) return media.matches;
  if (typeof matchMedia !== "function") return false;
  return matchMedia("(prefers-color-scheme: light)").matches;
}

export function resolveTheme(pref: ThemePref, light = systemPrefersLight()): ThemeResolved {
  if (pref === "light") return "light";
  if (pref === "dark") return "dark";
  return light ? "light" : "dark";
}

export function applyTheme(
  pref: ThemePref,
  root: { dataset: DOMStringMap; style: { colorScheme: string } } = document.documentElement,
  light = systemPrefersLight(),
): ThemeResolved {
  const resolved = resolveTheme(pref, light);
  root.dataset.theme = resolved;
  root.style.colorScheme = resolved;
  return resolved;
}
