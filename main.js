// ── Clippy — macOS Clipboard Manager ──────────────────────────────────
const {
  app,
  BrowserWindow,
  clipboard,
  globalShortcut,
  ipcMain,
  nativeImage,
  Tray,
  Menu,
  screen,
} = require("electron");
const path = require("path");
const fs = require("fs");

// ── Constants ────────────────────────────────────────────────────────
const HISTORY_FILE = path.join(app.getPath("userData"), "history.json");
const SETTINGS_FILE = path.join(app.getPath("userData"), "settings.json");
const MAX_ITEMS = 500;
const POLL_INTERVAL = 600; // ms between clipboard polls
const WINDOW_WIDTH = 380;
const WINDOW_HEIGHT = 520;

// ── State ─────────────────────────────────────────────────────────────
let win = null;
let tray = null;
let history = [];
let lastContent = null; // { text, html, image } — last clipboard snapshot
let pollTimer = null;
let isQuitting = false;
let skipNextPoll = false; // skip one poll after self-copy
let settings = { language: "system", theme: "system" };

// ── Settings Persistence ────────────────────────────────────────────
function loadSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const raw = fs.readFileSync(SETTINGS_FILE, "utf-8");
      const s = JSON.parse(raw);
      settings = { ...settings, ...s };
    }
  } catch (e) {
    console.error("Failed to load settings:", e.message);
  }
  return settings;
}

function saveSettings(partial) {
  settings = { ...settings, ...partial };
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), "utf-8");
  } catch (e) {
    console.error("Failed to save settings:", e.message);
  }
  // Broadcast to renderer
  if (win && !win.isDestroyed()) {
    win.webContents.send("settings-changed", settings);
  }
  return settings;
}

// ── History Persistence ───────────────────────────────────────────────
function loadHistory() {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      const raw = fs.readFileSync(HISTORY_FILE, "utf-8");
      history = JSON.parse(raw);
      if (!Array.isArray(history)) history = [];
      // Cap on load
      if (history.length > MAX_ITEMS) {
        history = history.slice(0, MAX_ITEMS);
      }
    }
  } catch (e) {
    console.error("Failed to load history:", e.message);
    history = [];
  }
}

function saveHistory() {
  try {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2), "utf-8");
  } catch (e) {
    console.error("Failed to save history:", e.message);
  }
}

// ── Add Item to History ───────────────────────────────────────────────
function addToHistory(item) {
  // Dedup: remove item with same content
  history = history.filter((h) => {
    if (h.type !== item.type) return true;
    if (h.type === "image") return h.imageData !== item.imageData;
    return h.content !== item.content;
  });

  // Prepend new item
  history.unshift(item);

  // Trim unpinned overflow
  const pinned = history.filter((i) => i.pinned);
  const unpinned = history.filter((i) => !i.pinned);
  if (unpinned.length > MAX_ITEMS) {
    unpinned.splice(MAX_ITEMS);
  }
  history = [...pinned, ...unpinned];
  // Sort: pinned first, then by timestamp desc
  history.sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return b.timestamp - a.timestamp;
  });

  saveHistory();
  return history;
}

// ── Clipboard Polling ─────────────────────────────────────────────────
function snapshotClipboard() {
  const snap = {};

  // Check image first (most fragile)
  const img = clipboard.readImage();
  if (!img.isEmpty()) {
    snap.image = img.toDataURL();
    snap.imageData = img.toPNG().toString("base64");
  }

  // Check HTML
  const html = clipboard.readHTML();
  if (html) {
    snap.html = html;
  }

  // Always check text
  const text = clipboard.readText();
  if (text) {
    snap.text = text;
  }

  return snap;
}

function snapshotsEqual(a, b) {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return (
    a.text === b.text &&
    a.html === b.html &&
    a.image === b.image
  );
}

function pollClipboard() {
  // Skip one poll after we wrote to clipboard ourselves
  if (skipNextPoll) {
    skipNextPoll = false;
    lastContent = snapshotClipboard();
    return;
  }

  const snap = snapshotClipboard();

  // Nothing to record
  if (!snap.text && !snap.html && !snap.image) {
    lastContent = snap;
    return;
  }

  // No change
  if (snapshotsEqual(snap, lastContent)) return;
  lastContent = snap;

  // Make history item
  const item = makeHistoryItem(snap);
  history = addToHistory(item);

  // Notify renderer
  if (win && !win.isDestroyed()) {
    win.webContents.send("clipboard-updated", history);
  }
}

function makeHistoryItem(snap) {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  if (snap.image) {
    return {
      id,
      type: "image",
      content: snap.image, // data URL for renderer
      imageData: snap.imageData,
      pinned: false,
      timestamp: Date.now(),
    };
  }

  if (snap.html && snap.text) {
    return {
      id,
      type: "html",
      content: snap.text, // plain text preview
      htmlContent: snap.html, // full HTML for paste
      pinned: false,
      timestamp: Date.now(),
    };
  }

  return {
    id,
    type: "text",
    content: snap.text || "",
    pinned: false,
    timestamp: Date.now(),
  };
}

// ── Window Creation ───────────────────────────────────────────────────
function createWindow() {
  const { width: screenWidth } = screen.getPrimaryDisplay().workAreaSize;

  win = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    x: screenWidth - WINDOW_WIDTH - 20,
    y: 50,
    frame: false,
    transparent: true,
    resizable: true,
    skipTaskbar: true,
    alwaysOnTop: true,
    visibleOnAllWorkspaces: true,
    hasShadow: true,
    vibrancy: "under-window",
    visualEffectState: "active",
    backgroundColor: undefined,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  win.loadFile(path.join(__dirname, "dist", "index.html"));

  // Hide instead of close
  win.on("close", (e) => {
    if (!isQuitting) {
      e.preventDefault();
      win.hide();
    }
  });

  // Hide on blur (click outside)
  win.on("blur", () => {
    if (win && !win.isDestroyed()) {
      win.hide();
    }
  });
}

// ── Toggle Window ─────────────────────────────────────────────────────
function toggleWindow() {
  if (!win || win.isDestroyed()) {
    createWindow();
    return;
  }
  if (win.isVisible()) {
    win.hide();
  } else {
    // Reposition to cursor area
    const cursorPoint = screen.getCursorScreenPoint();
    const { width: sw } = screen.getPrimaryDisplay().workAreaSize;
    const wx = Math.min(cursorPoint.x, sw - WINDOW_WIDTH - 10);
    const wy = Math.max(cursorPoint.y - 30, 40);
    win.setPosition(Math.max(wx, 10), wy);
    win.show();
    win.focus();
  }
}

// ── Tray ───────────────────────────────────────────────────────────────
function createTray() {
  // 16x16 clipboard icon as a template image (monochrome for macOS menu bar)
  const iconPath = path.join(__dirname, "assets", "tray-icon.png");

  let icon;
  if (fs.existsSync(iconPath)) {
    icon = nativeImage.createFromPath(iconPath);
    icon = icon.resize({ width: 18, height: 18 });
  } else {
    // Fallback: create a simple clipboard icon programmatically
    icon = createTrayIcon();
  }
  icon.setTemplateImage(true);

  tray = new Tray(icon);
  tray.setToolTip("Clippy — Clipboard Manager");

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Show/Hide",
      accelerator: "Cmd+Shift+V",
      click: toggleWindow,
    },
    { type: "separator" },
    {
      label: "Clear Unpinned",
      click: () => {
        history = history.filter((i) => i.pinned);
        saveHistory();
        if (win && !win.isDestroyed()) {
          win.webContents.send("clipboard-updated", history);
        }
      },
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
  tray.on("click", toggleWindow);
}

// ── Fallback Tray Icon (programmatic 18x18 clipboard) ─────────────────
function createTrayIcon() {
  // Simple clipboard SVG rendered to PNG via nativeImage
  const size = 18;
  const canvas = Buffer.alloc(size * size * 4, 0); // RGBA, transparent

  // Draw a simple clipboard shape (filled rect with clip at top)
  function setPixel(x, y, r, g, b, a) {
    if (x < 0 || x >= size || y < 0 || y >= size) return;
    const idx = (y * size + x) * 4;
    canvas[idx] = r;
    canvas[idx + 1] = g;
    canvas[idx + 2] = b;
    canvas[idx + 3] = a;
  }

  // Border of clipboard body (rounded rect approximation)
  for (let y = 4; y < 17; y++) {
    for (let x = 2; x < 16; x++) {
      const onBorder =
        x === 2 || x === 15 || y === 4 || y === 16 ||
        (y === 5 && (x <= 2 || x >= 15)) ||
        (y === 16 && (x <= 2 || x >= 15));
      if (onBorder) {
        setPixel(x, y, 255, 255, 255, 255);
      }
    }
  }

  // Clip at top
  for (let x = 6; x < 12; x++) {
    setPixel(x, 1, 255, 255, 255, 255);
  }
  setPixel(5, 2, 255, 255, 255, 255);
  setPixel(12, 2, 255, 255, 255, 255);
  for (let x = 5; x < 13; x++) {
    setPixel(x, 3, 255, 255, 255, 255);
  }

  return nativeImage.createFromBuffer(canvas, {
    width: size,
    height: size,
  });
}

// ── IPC Handlers ──────────────────────────────────────────────────────
function setupIPC() {
  // ── Settings ──
  ipcMain.handle("get-settings", () => settings);

  ipcMain.handle("save-settings", (_event, partial) => {
    return saveSettings(partial);
  });

  // ── File drop ──
  ipcMain.handle("add-file-items", (_event, files) => {
    if (!Array.isArray(files)) return history;

    for (const f of files) {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const ext = f.name.includes(".") ? f.name.split(".").pop().toLowerCase() : "";

      // Image files → add as image type
      const imageExts = ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "ico", "tiff"];
      if (imageExts.includes(ext)) {
        try {
          const buf = fs.readFileSync(f.path);
          const b64 = buf.toString("base64");
          const extMap = { jpg: "jpeg", svg: "svg+xml" };
          const mime = extMap[ext] || ext;
          const dataUrl = `data:image/${mime};base64,${b64}`;
          history = addToHistory({
            id,
            type: "image",
            content: dataUrl,
            imageData: b64,
            pinned: false,
            timestamp: Date.now(),
          });
        } catch (e) {
          console.error("Failed to read image file:", e.message);
          // Fall back to file type
          history = addToHistory({
            id, type: "file", content: f.path, fileName: f.name,
            fileSize: f.size || 0, pinned: false, timestamp: Date.now(),
          });
        }
      } else {
        // Other files → file type
        history = addToHistory({
          id,
          type: "file",
          content: f.path,
          fileName: f.name,
          fileSize: f.size || 0,
          pinned: false,
          timestamp: Date.now(),
        });
      }
    }

    saveHistory();
    if (win && !win.isDestroyed()) {
      win.webContents.send("clipboard-updated", history);
    }
    return history;
  });

  // ── History ──
  ipcMain.handle("get-history", () => history);

  ipcMain.handle("copy-to-clipboard", (_event, item) => {
    if (!item) return;
    skipNextPoll = true; // don't re-capture our own write
    if (item.type === "image" && item.imageData) {
      const img = nativeImage.createFromBuffer(
        Buffer.from(item.imageData, "base64")
      );
      clipboard.writeImage(img);
    } else if (item.type === "html" && item.htmlContent) {
      clipboard.write({
        text: item.content || "",
        html: item.htmlContent,
      });
    } else {
      clipboard.writeText(item.content || "");
    }
    // Move to top
    history = history.filter((h) => h.id !== item.id);
    const updated = { ...item, timestamp: Date.now() };
    history.unshift(updated);
    saveHistory();
    return history;
  });

  ipcMain.handle("toggle-pin", (_event, id) => {
    const item = history.find((h) => h.id === id);
    if (item) {
      item.pinned = !item.pinned;
      // Re-sort
      history.sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return b.timestamp - a.timestamp;
      });
      saveHistory();
    }
    return history;
  });

  ipcMain.handle("delete-item", (_event, id) => {
    history = history.filter((h) => h.id !== id);
    saveHistory();
    return history;
  });

  ipcMain.handle("clear-unpinned", () => {
    history = history.filter((i) => i.pinned);
    saveHistory();
    return history;
  });
}

// ── App Lifecycle ─────────────────────────────────────────────────────

// Single instance — show existing window if launched again
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    toggleWindow();
  });

  app.whenReady().then(() => {
    // Hide dock icon — we're a tray app
    if (app.dock) app.dock.hide();

    loadHistory();
    loadSettings();
    setupIPC();
    createWindow();
    createTray();

    // Global shortcut to toggle window
    globalShortcut.register("Cmd+Shift+V", toggleWindow);

    // Start clipboard polling
    lastContent = snapshotClipboard();
    pollTimer = setInterval(pollClipboard, POLL_INTERVAL);

    // macOS: re-create window on dock click
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      } else {
        toggleWindow();
      }
    });
  });
}

app.on("window-all-closed", () => {
  // Don't quit on macOS — app stays in tray
});

app.on("before-quit", () => {
  isQuitting = true;
  if (pollTimer) clearInterval(pollTimer);
  globalShortcut.unregisterAll();
});

app.on("will-quit", () => {
  if (pollTimer) clearInterval(pollTimer);
});
