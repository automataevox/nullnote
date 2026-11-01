export type Theme = "light" | "dark";
const KEY = "nullnote-theme";

export function applyTheme(t: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", t === "dark");
  root.style.colorScheme = t;
}

export function storedTheme(): Theme | null {
  const v = localStorage.getItem(KEY);
  return v === "light" || v === "dark" ? v : null;
}

export function systemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function currentTheme(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export function setTheme(t: Theme) {
  localStorage.setItem(KEY, t);
  applyTheme(t);
}

export function toggleTheme(): Theme {
  const t: Theme = currentTheme() === "dark" ? "light" : "dark";
  setTheme(t);
  return t;
}

// Apply as early as possible (before React mounts) to avoid a flash.
if (typeof window !== "undefined") {
  applyTheme(storedTheme() ?? systemTheme());
}
