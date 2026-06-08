// ── Theme hook: reads theme from settings, listens to system changes ──
import { useState, useEffect, useCallback } from "react";

export function useTheme(initialTheme) {
  const [themeSetting, setThemeSetting] = useState(initialTheme || "system");

  // Compute the effective theme
  const [systemIsDark, setSystemIsDark] = useState(() =>
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e) => setSystemIsDark(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const resolvedTheme = themeSetting === "system"
    ? (systemIsDark ? "dark" : "light")
    : themeSetting;

  const setTheme = useCallback((newTheme) => {
    setThemeSetting(newTheme);
  }, []);

  // Apply data-theme attribute to root
  useEffect(() => {
    document.getElementById("root")?.setAttribute("data-theme", resolvedTheme);
  }, [resolvedTheme]);

  return { themeSetting, resolvedTheme, setTheme };
}
