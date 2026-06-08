import React, { useState, useEffect, useCallback, useRef } from "react";
import ClipboardItem from "./components/ClipboardItem";
import { useTranslation } from "./i18n";
import { useTheme } from "./useTheme";

const { clippy } = window;

export default function App({ settings }) {
  const { t, setLang } = useTranslation();
  const { themeSetting, resolvedTheme, setTheme } = useTheme(settings?.theme);

  const [history, setHistory] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [dragOver, setDragOver] = useState(false);
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const [showLangMenu, setShowLangMenu] = useState(false);
  const searchRef = useRef(null);
  const listRef = useRef(null);

  // Load history on mount
  useEffect(() => {
    clippy.getHistory().then((items) => {
      setHistory(items || []);
    });

    clippy.onClipboardUpdated((items) => {
      setHistory(items || []);
    });

    setTimeout(() => searchRef.current?.focus(), 100);

    return () => clippy.removeClipboardListener?.();
  }, []);

  // Filter by search text
  const filtered = search.trim()
    ? history.filter((item) => {
        if (item.type === "text" || item.type === "html") {
          return (item.content || "").toLowerCase().includes(search.toLowerCase());
        }
        if (item.type === "file") {
          return (item.fileName || item.content || "").toLowerCase().includes(search.toLowerCase());
        }
        return item.type.includes(search.toLowerCase());
      })
    : history;

  // Handlers
  const handleCopy = useCallback(async (item) => {
    await clippy.copyToClipboard(item);
  }, []);

  const handlePin = useCallback(async (id) => {
    const updated = await clippy.togglePin(id);
    setHistory(updated || []);
  }, []);

  const handleDelete = useCallback(async (id) => {
    const updated = await clippy.deleteItem(id);
    setHistory(updated || []);
  }, []);

  const handleClearUnpinned = useCallback(async () => {
    const updated = await clippy.clearUnpinned();
    setHistory(updated || []);
  }, []);

  // Drag & drop
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback(async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    const fileData = files.map((f) => ({
      path: f.path,
      name: f.name,
      size: f.size,
    }));

    const updated = await clippy.addFileItems(fileData);
    setHistory(updated || []);
  }, []);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, -1));
      } else if (e.key === "Enter" && selectedIndex >= 0) {
        e.preventDefault();
        const item = filtered[selectedIndex];
        if (item) {
          handleCopy(item);
          setSelectedIndex(-1);
        }
      } else if (e.key === "Escape") {
        setSearch("");
        setSelectedIndex(-1);
        setShowThemeMenu(false);
        setShowLangMenu(false);
        searchRef.current?.blur();
      }
    },
    [filtered, selectedIndex, handleCopy]
  );

  // Scroll selected item into view
  useEffect(() => {
    if (selectedIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll(".clipboard-item");
      if (items[selectedIndex]) {
        items[selectedIndex].scrollIntoView({ block: "nearest" });
      }
    }
  }, [selectedIndex]);

  // Theme handler
  const handleThemeChange = useCallback(
    (newTheme) => {
      setTheme(newTheme);
      clippy.saveSettings({ theme: newTheme });
      setShowThemeMenu(false);
    },
    [setTheme]
  );

  // Close menus on click outside
  useEffect(() => {
    if (!showThemeMenu && !showLangMenu) return;
    const handler = () => {
      setShowThemeMenu(false);
      setShowLangMenu(false);
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [showThemeMenu, showLangMenu]);

  const pinnedCount = history.filter((i) => i.pinned).length;
  const unpinnedCount = history.length - pinnedCount;

  return (
    <div
      className={`app ${dragOver ? "drag-over" : ""}`}
      onKeyDown={handleKeyDown}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* ── Drag Overlay ── */}
      <div className="drag-overlay">
        <span>{t("drag.overlay")}</span>
      </div>

      {/* ── Header ── */}
      <header className="header">
        <input
          ref={searchRef}
          className="search-input"
          type="text"
          placeholder={t("search.placeholder")}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setSelectedIndex(-1);
          }}
        />
        {unpinnedCount > 0 && (
          <button
            className="clear-btn"
            onClick={handleClearUnpinned}
            title={t("clear.title")}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M2 4h10M5 4V2.5a.5.5 0 01.5-.5h3a.5.5 0 01.5.5V4M11 4v7.5a.5.5 0 01-.5.5h-7a.5.5 0 01-.5-.5V4"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}
      </header>

      {/* ── List ── */}
      <div className="list" ref={listRef}>
        {filtered.length === 0 && (
          <div className="empty-state">
            {search ? t("empty.noMatch") : t("empty.noItems")}
          </div>
        )}

        {filtered.map((item, index) => (
          <ClipboardItem
            key={item.id}
            item={item}
            isSelected={index === selectedIndex}
            onCopy={() => handleCopy(item)}
            onPin={() => handlePin(item.id)}
            onDelete={() => handleDelete(item.id)}
          />
        ))}
      </div>

      {/* ── Footer ── */}
      <footer className="footer">
        <div className="footer-left">
          {/* Theme toggle */}
          <div style={{ position: "relative" }}>
            <button
              className={`settings-btn ${themeSetting !== "system" ? "active" : ""}`}
              title={`${t("theme.auto")}: ${t("theme.auto")} | ${t("theme.light")} | ${t("theme.dark")}`}
              onClick={(e) => {
                e.stopPropagation();
                setShowThemeMenu(!showThemeMenu);
                setShowLangMenu(false);
              }}
            >
              {resolvedTheme === "dark" ? "🌙" : "☀️"}
            </button>
            {showThemeMenu && (
              <div className="settings-dropdown">
                {["system", "light", "dark"].map((opt) => (
                  <button
                    key={opt}
                    className={themeSetting === opt ? "selected" : ""}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleThemeChange(opt);
                    }}
                  >
                    {t(`theme.${opt}`)}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Language toggle */}
          <div style={{ position: "relative" }}>
            <button
              className="settings-btn"
              title="Language"
              onClick={(e) => {
                e.stopPropagation();
                setShowLangMenu(!showLangMenu);
                setShowThemeMenu(false);
              }}
            >
              🌐
            </button>
            {showLangMenu && (
              <div className="settings-dropdown">
                {[
                  { value: "system", label: t("lang.auto") },
                  { value: "en", label: "English" },
                  { value: "zh-CN", label: "简体中文" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    className={settings?.language === opt.value ? "selected" : ""}
                    onClick={(e) => {
                      e.stopPropagation();
                      setLang(opt.value);
                      clippy.saveSettings({ language: opt.value });
                      setShowLangMenu(false);
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <span className="footer-span footer-text">
          {history.length} {t("footer.items")}
          {pinnedCount > 0 && ` · ${pinnedCount} ${t("footer.pinned")}`}
        </span>

        <span className="footer-right">
          <span className="footer-hint">{t("footer.hint")}</span>
        </span>
      </footer>
    </div>
  );
}
