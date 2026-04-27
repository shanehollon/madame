# Madame

<img src="src/public/madame_logo.png" alt="Madame" width="80" />

A minimal two-pane Markdown editor/viewer. Left (or right) is a plain textarea; the other side is a live-rendered preview with syntax-highlighted code and scroll sync. Built as a Tauri 2 desktop app with a TypeScript/Vite frontend and a small Rust backend.

## Features

- Side-by-side editor and live preview with configurable sides (YAML).
- Scroll sync with proportional interpolation between block anchors plus cursor-aware tracking — as you type, the block you're editing stays visible in the preview.
- Syntax highlighting via highlight.js, GitHub-style rendering, task lists, header anchors.
- Open/save via native dialogs, drag-and-drop, CLI arg, and an MRU "recent files" picker.
- External file-change detection — prompts to reload if the file changes on disk.
- Custom titlebar with window controls and the app logo.
- Portable: config (`madame_config.yaml`) and state (`editor_state.json`) live next to the binary, so each copy of `madame.exe` is a self-contained instance.
- Persistent window size/position, splitter ratio, and view mode.

## File structure

```
madame/
├── README.md
├── .gitignore
├── package.json              # frontend deps + scripts (bun)
├── bun.lock
├── tsconfig.json
├── vite.config.ts
├── vitest.config.ts
├── docs/
│   └── plans/                # design + implementation plans
├── src/                      # Vite root — TS frontend
│   ├── index.html
│   ├── main.ts               # boot + orchestration
│   ├── editor.ts             # textarea wrapper (line math, cursor tracking)
│   ├── preview.ts            # markdown-it renderer + source-line anchors
│   ├── scroll-sync.ts        # editor↔preview sync (interpolated + cursor-aware)
│   ├── splitter.ts           # draggable column splitter
│   ├── titlebar.ts           # custom titlebar + window controls
│   ├── shortcuts.ts          # keybinding registry
│   ├── recent.ts             # recent-files modal
│   ├── confirm.ts            # confirm dialog
│   ├── toast.ts              # toast helper
│   ├── ipc.ts                # typed wrapper over Tauri invoke/events
│   ├── types.ts              # shared TS types (mirror Rust structs)
│   ├── public/
│   │   └── madame_logo.png   # app logo (source for icons + titlebar asset)
│   ├── styles/
│   │   ├── app.css
│   │   └── github.css        # github-markdown-css
│   └── tests/                # vitest specs
└── src-tauri/                # Rust backend
    ├── Cargo.toml
    ├── Cargo.lock
    ├── build.rs
    ├── tauri.conf.json       # app identifier, window, bundle config
    ├── tauri.macos.conf.json # macOS overrides (native traffic lights, .app bundle)
    ├── capabilities/         # Tauri ACL
    ├── icons/                # generated icon set (Win/macOS/iOS/Android)
    └── src/
        ├── main.rs           # app setup, CLI arg handling
        ├── commands.rs       # #[tauri::command] handlers
        ├── config.rs         # madame_config.yaml schema + loader
        ├── state.rs          # editor_state.json schema + loader
        ├── watcher.rs        # notify-based file watcher
        └── error.rs          # AppError
```

## Dependencies

**Frontend (bun/npm):**
- `@tauri-apps/api`, `@tauri-apps/plugin-dialog`, `@tauri-apps/plugin-fs` — Tauri 2 JS bindings.
- `markdown-it`, `markdown-it-anchor`, `markdown-it-task-lists` — Markdown rendering.
- `highlight.js` — code highlighting.
- `github-markdown-css` — preview styling.
- Build/test: `vite`, `vitest`, `typescript`, `jsdom`.

**Backend (Rust crates):**
- `tauri`, `tauri-build`, `tauri-plugin-dialog`, `tauri-plugin-fs`.
- `serde`, `serde_json`, `serde_yaml` — config/state serialization.
- `notify` — filesystem watcher.
- `tokio` — async runtime (used for CLI-arg emit timing).
- `thiserror` — error derives.

**Toolchain (all platforms):**
- [Rust](https://rustup.rs) (stable) with `cargo`.
- [Bun](https://bun.sh) for the frontend package manager and script runner.

Madame is deliberately shipped as a single standalone binary — no installers. The raw executable (or on macOS, a single `.app` bundle) goes anywhere you want it, and config/state files sit next to it. Installer outputs (`.msi`, `.nsis`, `.dmg`, `.deb`, `.rpm`, `.appimage`) are disabled in `src-tauri/tauri.conf.json`.

## Build

### Prerequisites

**Windows**
- Microsoft C++ Build Tools — install via the Visual Studio Installer with the "Desktop development with C++" workload (provides the MSVC linker).
- WebView2 Runtime — preinstalled on Windows 11; on Windows 10 install from Microsoft.

**macOS**
- Xcode Command Line Tools: `xcode-select --install`.

**Linux (Debian/Ubuntu)**
```bash
sudo apt update
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file \
  libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev pkg-config
```
Other distros: see [Tauri 2 Linux prerequisites](https://tauri.app/start/prerequisites/#linux).

### Commands

Same on every platform:

```bash
bun install
bun run tauri dev       # dev with hot reload
bun run tauri build     # release build
bun run test            # frontend tests (vitest)
```

### Artifacts

Output lands under `src-tauri/target/release/`:

| Platform | File | Notes |
| --- | --- | --- |
| Windows | `madame.exe` | Drop into any folder; self-contained. |
| macOS   | `bundle/macos/Madame.app` | Drag anywhere (Applications, Desktop, etc.). macOS-specific config in `src-tauri/tauri.macos.conf.json` turns this on so you still get a double-clickable bundle. |
| Linux   | `madame` | Standalone ELF. Make sure it's executable (`chmod +x`) after moving. |

On first run, `madame_config.yaml` and `editor_state.json` are created next to the binary (or inside `Madame.app/Contents/MacOS/` on macOS) — so every copy is its own independent instance.

> **Note:** because state lives next to the binary, don't put `madame.exe` in a write-protected location (e.g. `C:\Program Files\`). The state write will fail with `Access is denied` and file-open will surface that error. Drop it under `%LOCALAPPDATA%`, your home directory, or any user-writable folder.

### Regenerate app icons

Two source images live under `src/public/`:

- `madame_logo.png` — transparent silhouette + M; used in-app for the titlebar (rendered inverted on the dark titlebar).
- `madame_icon.png` — rounded-square white background with the logo composited on top; used as the source for all platform icons (Windows `.ico`, macOS `.icns`, Linux `.png`). Matches the macOS dock icon convention.

If you change either, regenerate the icon set:

```bash
bun run tauri icon src/public/madame_icon.png
```

This refreshes everything under `src-tauri/icons/`. Tauri also emits Android/iOS and Microsoft Store assets — delete those if you don't ship to those platforms (we don't):

```bash
rm -rf src-tauri/icons/android src-tauri/icons/ios
rm -f src-tauri/icons/Square*Logo.png src-tauri/icons/StoreLogo.png
```

## Configuration

First run creates `madame_config.yaml` next to the binary. Notable keys:

- `ui.editor_position` — `"left"` or `"right"` (default: `right`).
- `preview.debounce_ms` — live-preview render debounce.
- `preview.scroll_sync` — toggle scroll sync.
- `editor.word_wrap`, `editor.tab_size`, `editor.tab_inserts_spaces`, `editor.font_size`, `editor.font_family`.
- `keybindings.*` — rebindable shortcuts (open, save, save_as, recent_files, toggle_editor_only, toggle_preview_only).

## Keyboard shortcuts (defaults)

| Shortcut         | Action                      |
| ---------------- | --------------------------- |
| `Ctrl+O`         | Open file                   |
| `Ctrl+S`         | Save                        |
| `Ctrl+Shift+S`   | Save As                     |
| `Ctrl+R`         | Recent files                |
| `Ctrl+E`         | Toggle editor-only view     |
| `Ctrl+Shift+E`   | Toggle preview-only view    |
