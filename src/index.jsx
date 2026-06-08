import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { I18nProvider, resolveLang } from "./i18n";
import "./App.css";

const { clippy } = window;

function Root() {
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    // Load settings from main process
    clippy.getSettings().then((s) => {
      setSettings(s || { language: "system", theme: "system" });
    });

    // Listen for settings changes
    clippy.onSettingsChanged((s) => {
      setSettings(s);
    });

    return () => clippy.removeSettingsListener?.();
  }, []);

  const handleLangChange = (newLang) => {
    if (newLang !== settings?.language) {
      const updated = { ...settings, language: newLang };
      setSettings(updated);
      clippy.saveSettings({ language: newLang });
    }
  };

  if (!settings) return null; // Wait for settings to load

  const lang = resolveLang(settings.language);

  return React.createElement(
    I18nProvider,
    { initialLang: settings.language, onLangChange: handleLangChange },
    React.createElement(App, { settings })
  );
}

const root = createRoot(document.getElementById("root"));
root.render(React.createElement(Root));
