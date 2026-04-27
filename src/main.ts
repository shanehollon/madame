import "./styles/github.css";
import "./styles/app.css";
import githubLightCss from "highlight.js/styles/github.css?inline";
import githubDarkCss from "highlight.js/styles/github-dark.css?inline";

// Inject both highlight.js themes with media queries so the browser swaps
// them automatically when the system color scheme changes.
function injectThemedStyle(css: string, media: string): void {
  const el = document.createElement("style");
  el.media = media;
  el.textContent = css;
  document.head.appendChild(el);
}
injectThemedStyle(githubLightCss, "(prefers-color-scheme: light)");
injectThemedStyle(githubDarkCss, "(prefers-color-scheme: dark)");

import { open as dialogOpen, save as dialogSave, message as dialogMessage } from "@tauri-apps/plugin-dialog";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { homeDir } from "@tauri-apps/api/path";

import { createEditor } from "./editor";
import { createPreview } from "./preview";
import { createSplitter } from "./splitter";
import { createTitlebar } from "./titlebar";
import { createShortcuts } from "./shortcuts";
import { createScrollSync } from "./scroll-sync";
import { showRecentModal } from "./recent";
import { confirm } from "./confirm";
import { toast } from "./toast";
import { ipc, events } from "./ipc";
import type { AppState, Config, ViewMode } from "./types";

// --- Platform tag (drives per-OS titlebar styling) ---
const ua = navigator.userAgent;
document.body.dataset.platform = ua.includes("Mac") ? "macos" : ua.includes("Linux") ? "linux" : "windows";

// --- Element refs ---
const panesEl = document.getElementById("panes")!;
const editorPaneEl = document.getElementById("editor-pane")!;
const previewPaneEl = document.getElementById("preview-pane")!;
const splitterEl = document.getElementById("splitter")!;
const editor = createEditor(
  document.getElementById("editor") as HTMLTextAreaElement,
  document.getElementById("editor-highlight") as HTMLElement,
);
const preview = createPreview(document.getElementById("preview") as HTMLElement);
const titlebar = createTitlebar(document.getElementById("titlebar")!);
const shortcuts = createShortcuts(window);

// --- App state ---
let config: Config;
let appState: AppState;
let currentPath: string | null = null;
let dirty = false;
let debounceTimer: number | undefined;
let viewMode: ViewMode = "both";

// --- Helpers ---
function dirnameOf(p: string): string {
  const i = Math.max(p.lastIndexOf("/"), p.lastIndexOf("\\"));
  return i >= 0 ? p.slice(0, i) : "";
}

function setDirty(v: boolean) {
  dirty = v;
  titlebar.setDirty(v);
}

function applyViewMode(mode: ViewMode) {
  viewMode = mode;
  editorPaneEl.classList.toggle("hidden", mode === "preview");
  previewPaneEl.classList.toggle("hidden", mode === "editor");
  splitterEl.style.display = mode === "both" ? "" : "none";
  appState.view_mode = mode;
  void ipc.writeState(appState);
}

function scheduleRender(text: string) {
  clearTimeout(debounceTimer);
  debounceTimer = window.setTimeout(() => {
    const base = currentPath ? dirnameOf(currentPath) : undefined;
    preview.render(text, base);
  }, config.preview.debounce_ms);
}

async function promptUnsavedIfDirty(): Promise<"proceed" | "cancel"> {
  if (!dirty) return "proceed";
  const choice = await confirm("You have unsaved changes.", [
    { label: "Save", value: "save", kind: "primary" },
    { label: "Discard", value: "discard", kind: "danger" },
    { label: "Cancel", value: "cancel" },
  ]);
  if (choice === "save") { await saveCurrent(); return dirty ? "cancel" : "proceed"; }
  if (choice === "discard") return "proceed";
  return "cancel";
}

async function openPath(path: string) {
  if ((await promptUnsavedIfDirty()) === "cancel") return;
  try {
    const res = await ipc.openFile(path);
    currentPath = res.path;
    editor.setText(res.content);
    preview.render(res.content, dirnameOf(res.path));
    titlebar.setFilename(res.path);
    setDirty(false);
    appState.last_open_path = res.path;
    appState.recent_files = await ipc.getRecentFiles();
    void ipc.writeState(appState);
  } catch (e) {
    toast(`Couldn't open: ${String(e)}`);
  }
}

async function openDialog() {
  const picked = await dialogOpen({
    multiple: false,
    filters: [
      { name: "Markdown", extensions: ["md", "markdown", "mdown"] },
      { name: "Text", extensions: ["txt"] },
      { name: "All Files", extensions: ["*"] },
    ],
  });
  if (typeof picked === "string") await openPath(picked);
}

async function saveCurrent() {
  const content = editor.getText();
  if (!currentPath) { await saveAs(); return; }
  try {
    await ipc.saveFile(currentPath, content);
    setDirty(false);
  } catch (e) {
    await dialogMessage(`Save failed: ${String(e)}`, { title: "Save Error", kind: "error" });
  }
}

async function saveAs() {
  const picked = await dialogSave({
    filters: [{ name: "Markdown", extensions: ["md"] }],
    defaultPath: currentPath ?? "untitled.md",
  });
  if (!picked) return;
  try {
    await ipc.saveFile(picked, editor.getText());
    currentPath = picked;
    titlebar.setFilename(picked);
    setDirty(false);
  } catch (e) {
    await dialogMessage(`Save failed: ${String(e)}`, { title: "Save Error", kind: "error" });
  }
}

async function showRecent() {
  const files = await ipc.getRecentFiles();
  const picked = await showRecentModal(files);
  if (picked) await openPath(picked);
}

// --- Boot ---
(async () => {
  try {
    await boot();
  } catch (err) {
    console.error("[madame] boot failed:", err);
    toast(`Startup error: ${String(err)}`, 10000);
  }
})();

async function boot() {
  config = await ipc.readConfig();
  appState = await ipc.readState();

  // Restore window bounds if remembered (non-fatal if it fails)
  if (config.ui.remember_window && appState.window) {
    try {
      const w = appState.window;
      const win = getCurrentWindow();
      const { LogicalSize, LogicalPosition } = await import("@tauri-apps/api/dpi");
      await win.setSize(new LogicalSize(w.width, w.height));
      if (w.x !== null && w.y !== null) {
        await win.setPosition(new LogicalPosition(w.x, w.y));
      }
      if (w.maximized) await win.maximize();
    } catch (err) {
      console.warn("[madame] window bounds restore failed:", err);
    }
  }

  editor.applyConfig(config.editor);
  try {
    titlebar.setHomeDir(await homeDir());
  } catch (err) {
    console.warn("[madame] could not resolve home dir:", err);
  }
  titlebar.setFilename("");

  // Pane order (editor on left or right based on config)
  const editorOnRight = config.ui.editor_position !== "left";
  if (editorOnRight) {
    panesEl.append(previewPaneEl, splitterEl, editorPaneEl);
  }

  // Splitter — ratio is always the left-side pane's fraction
  const splitter = createSplitter({
    container: panesEl,
    left: editorOnRight ? previewPaneEl : editorPaneEl,
    right: editorOnRight ? editorPaneEl : previewPaneEl,
    handle: splitterEl,
  });
  splitter.setRatio(appState.splitter_ratio || 0.5);
  let splitterPersistTimer: number | undefined;
  splitter.onResize((r) => {
    appState.splitter_ratio = r;
    clearTimeout(splitterPersistTimer);
    splitterPersistTimer = window.setTimeout(() => void ipc.writeState(appState), 150);
  });

  // Live preview
  editor.onChange((t) => {
    if (!dirty) setDirty(true);
    scheduleRender(t);
  });

  // Scroll sync
  const sync = createScrollSync(editor, preview);
  sync.setEnabled(config.preview.scroll_sync);

  // View mode from saved state
  applyViewMode(appState.view_mode);

  // Shortcuts (combos read from config.keybindings so users can rebind)
  const kb = config.keybindings;
  shortcuts.on(kb.open_file, () => void openDialog());
  shortcuts.on(kb.save, () => void saveCurrent());
  shortcuts.on(kb.save_as, () => void saveAs());
  shortcuts.on(kb.recent_files, () => void showRecent());
  shortcuts.on(kb.toggle_editor_only, () => applyViewMode(viewMode === "editor" ? "both" : "editor"));
  shortcuts.on(kb.toggle_preview_only, () => applyViewMode(viewMode === "preview" ? "both" : "preview"));

  // External change
  await events.onFileChangedExternally(async (path) => {
    if (!currentPath || path !== currentPath) return;
    if (!dirty) {
      const res = await ipc.openFile(currentPath);
      editor.setText(res.content);
      preview.render(res.content, dirnameOf(res.path));
      setDirty(false);
      return;
    }
    const choice = await confirm("File changed on disk. Reload?", [
      { label: "Reload", value: "reload", kind: "primary" },
      { label: "Keep yours", value: "keep" },
    ]);
    if (choice === "reload") {
      const res = await ipc.openFile(currentPath);
      editor.setText(res.content);
      preview.render(res.content, dirnameOf(res.path));
      setDirty(false);
    }
  });

  // Close guard — always preventDefault and take explicit control,
  // then destroy() when we want the window to actually close.
  const appWin = getCurrentWindow();
  await appWin.onCloseRequested(async (e) => {
    e.preventDefault();
    if (!dirty) {
      await appWin.destroy();
      return;
    }
    const choice = await promptUnsavedIfDirty();
    if (choice === "proceed") await appWin.destroy();
    // else: user cancelled — window stays open
  });

  // OS-launched file (argv on Windows/Linux, Apple Event on macOS) and any
  // file-open requests that arrive while running. Register the listener BEFORE
  // draining the pending queue so we don't miss requests that arrive in between.
  await events.onCliOpenPath((p) => void openPath(p));

  // Drag-and-drop file to open (webview-level event in Tauri 2)
  const { getCurrentWebview } = await import("@tauri-apps/api/webview");
  await getCurrentWebview().onDragDropEvent(async (e) => {
    if (e.payload.type !== "drop") return;
    const paths = e.payload.paths;
    if (paths.length === 0) return;
    await openPath(paths[0]);
  });

  // Drain any open requests that arrived before the listener was registered
  // (e.g. argv path on launch) and flip the backend into event-emit mode.
  const pending = await ipc.takePendingOpenPaths();
  const launchPath = pending.length > 0 ? pending[pending.length - 1] : null;

  if (launchPath) {
    await openPath(launchPath);
  } else if (appState.last_open_path) {
    await openPath(appState.last_open_path);
  } else {
    editor.setText("# Madame\n\nWelcome. Ctrl+O to open a file.\n");
    setDirty(false);
  }
  editor.focus();

  // Persist window bounds on resize/move
  const appWin2 = getCurrentWindow();
  let persistTimer: number | undefined;
  const persistBounds = async () => {
    clearTimeout(persistTimer);
    persistTimer = window.setTimeout(async () => {
      const size = await appWin2.innerSize();
      const pos = await appWin2.outerPosition();
      const maximized = await appWin2.isMaximized();
      const scale = await appWin2.scaleFactor();
      appState.window = {
        width: Math.round(size.width / scale),
        height: Math.round(size.height / scale),
        x: Math.round(pos.x / scale),
        y: Math.round(pos.y / scale),
        maximized,
      };
      void ipc.writeState(appState);
    }, 300);
  };
  await appWin2.onResized(persistBounds);
  await appWin2.onMoved(persistBounds);
}
