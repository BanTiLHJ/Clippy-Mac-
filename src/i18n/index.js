// ── i18n: React Context + useTranslation hook ─────────────────────────
import React, { createContext, useContext, useState, useCallback, useMemo } from "react";
import en from "./en";
import zhCN from "./zh-CN";

const translations = { en, "zh-CN": zhCN };
const SUPPORTED = ["en", "zh-CN"];

const I18nContext = createContext(null);

// Resolve effective language from settings
export function resolveLang(langSetting) {
  if (langSetting && langSetting !== "system") return langSetting;
  const nav = navigator.language || "en";
  // zh, zh-CN, zh-TW, zh-HK → zh-CN
  if (nav.startsWith("zh")) return "zh-CN";
  if (SUPPORTED.includes(nav)) return nav;
  return "en";
}

export function I18nProvider({ initialLang, onLangChange, children }) {
  const [lang, setLangState] = useState(() => resolveLang(initialLang));

  const setLang = useCallback(
    (newLang) => {
      setLangState(newLang);
      if (onLangChange) onLangChange(newLang);
    },
    [onLangChange]
  );

  const value = useMemo(() => {
    const t = (key) => {
      const dict = translations[lang] || translations.en;
      return dict[key] ?? translations.en[key] ?? key;
    };
    return { lang, setLang, t };
  }, [lang, setLang]);

  return React.createElement(I18nContext.Provider, { value }, children);
}

export function useTranslation() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    // Fallback when no provider (shouldn't happen)
    const fallback = (key) => translations.en[key] ?? key;
    return { lang: "en", setLang: () => {}, t: fallback };
  }
  return ctx;
}

export { SUPPORTED };
