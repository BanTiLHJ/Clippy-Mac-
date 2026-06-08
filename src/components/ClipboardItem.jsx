import React, { memo } from "react";
import { useTranslation } from "../i18n";

const ClipboardItem = memo(function ClipboardItem({
  item,
  isSelected,
  onCopy,
  onPin,
  onDelete,
}) {
  const { t } = useTranslation();
  const timeStr = formatTime(item.timestamp, t);

  return (
    <div
      className={`clipboard-item ${isSelected ? "selected" : ""} ${
        item.pinned ? "pinned" : ""
      }`}
      onClick={onCopy}
      title={t("item.copy")}
    >
      {/* ── Type icon ── */}
      <div className="item-icon">
        {item.type === "image" && <ImageThumb content={item.content} />}
        {item.type === "text" && <TextIcon />}
        {item.type === "html" && <HtmlIcon />}
        {item.type === "file" && <FileIcon fileName={item.fileName} />}
      </div>

      {/* ── Preview ── */}
      <div className="item-body">
        <div className="item-preview">
          {item.type === "image"
            ? t("item.image")
            : item.type === "file"
            ? item.fileName || item.content
            : item.content}
        </div>
        <div className="item-meta">
          <span className="item-type">{item.type}</span>
          {item.type === "file" && item.fileSize != null && (
            <span className="file-size">{formatSize(item.fileSize)}</span>
          )}
          <span className="item-time">{timeStr}</span>
        </div>
      </div>

      {/* ── Actions ── */}
      <div className="item-actions">
        <button
          className={`action-btn pin-btn ${item.pinned ? "active" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            onPin();
          }}
          title={item.pinned ? t("item.unpin") : t("item.pin")}
        >
          📌
        </button>
        <button
          className="action-btn del-btn"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          title={t("item.delete")}
        >
          ×
        </button>
      </div>
    </div>
  );
});

// ── Sub-components ──────────────────────────────────────────────────

function ImageThumb({ content }) {
  return (
    <img
      className="thumb-img"
      src={content}
      alt="clipboard"
      draggable={false}
    />
  );
}

function TextIcon() {
  return (
    <svg
      className="type-icon"
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
    >
      <rect
        x="2"
        y="3"
        width="14"
        height="12"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <line
        x1="5"
        y1="6.5"
        x2="13"
        y2="6.5"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
      />
      <line
        x1="5"
        y1="9.5"
        x2="11"
        y2="9.5"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
      />
      <line
        x1="5"
        y1="12.5"
        x2="10"
        y2="12.5"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
      />
    </svg>
  );
}

function HtmlIcon() {
  return (
    <svg
      className="type-icon"
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
    >
      <rect
        x="2"
        y="3"
        width="14"
        height="12"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <text
        x="9"
        y="11.5"
        textAnchor="middle"
        fontSize="7"
        fontWeight="600"
        fill="currentColor"
      >
        {"¶"}
      </text>
    </svg>
  );
}

function FileIcon({ fileName }) {
  const ext = fileName?.split(".").pop()?.toLowerCase();
  const emoji = getFileEmoji(ext);
  return (
    <span style={{ fontSize: "16px", lineHeight: "32px" }}>{emoji}</span>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────

function formatTime(ts, t) {
  if (!ts) return "";
  const now = Date.now();
  const diff = now - ts;
  if (diff < 60_000) return t("time.now");
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} ${t("time.minAgo")}`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} ${t("time.hourAgo")}`;
  if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)} ${t("time.dayAgo")}`;
  return new Date(ts).toLocaleDateString();
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function getFileEmoji(ext) {
  const map = {
    pdf: "📕", doc: "📘", docx: "📘", xls: "📗", xlsx: "📗",
    ppt: "📙", pptx: "📙", txt: "📄", md: "📝", csv: "📊",
    zip: "🗜️", rar: "🗜️", gz: "🗜️", tar: "🗜️", "7z": "🗜️",
    png: "🖼️", jpg: "🖼️", jpeg: "🖼️", gif: "🖼️", webp: "🖼️", svg: "🖼️",
    mp3: "🎵", wav: "🎵", flac: "🎵", aac: "🎵", m4a: "🎵",
    mp4: "🎬", mov: "🎬", avi: "🎬", mkv: "🎬", webm: "🎬",
    js: "💛", jsx: "💛", ts: "💙", tsx: "💙", py: "🐍",
    html: "🌐", css: "🎨", json: "📋", xml: "📋",
    app: "📦", dmg: "💿", iso: "💿", exe: "⚙️",
    sh: "💻", bash: "💻", zsh: "💻", fish: "💻",
  };
  return map[ext] || "📄";
}

export default ClipboardItem;
