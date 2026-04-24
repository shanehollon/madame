# Madame — Design

**Date:** 2026-04-23
**Status:** Approved design, ready for implementation planning

## 1. Overview

Madame is a minimal, fast-starting, two-pane Markdown file viewer and editor. The left pane is a raw notepad-style editor; the right pane is a GitHub-style rendered preview. It ships as a single portable executable per platform.

**Primary goal:** a launch-instantly scratchpad for small iterative Markdown edits — the thing you reach for instead of firing up VS Code.

**Primary target:** Windows 11 for initial development. macOS is the next testing target. Cross-platform from day one via Tauri.

**License:** deferred.

## 2. Core Requirements

- **Two-pane layout**: editor left, preview right, resizable splitter (defaults to center).
- **Live preview** with ~100ms debounce; updates as you type.
- **Raw notepad editor**: plain textarea, monospace font, word wrap, no source-side syntax highlighting.
- **GitHub-style preview**: github-markdown-css, GFM features (tables, task lists, strikethrough, autolinks), syntax-highlighted code blocks.
- **Bidirectional scroll sync** (line-based) between editor and preview.
- **Single file at a time**; recent files list via Ctrl+R quick-pick modal.
- **Minimal chrome**: custom dark titlebar with filename + unsaved-dot; no toolbar, no status bar.
- **Keyboard-first**: Ctrl+O, Ctrl+S, Ctrl+Shift+S, Ctrl+R, Ctrl+E (toggle preview), Ctrl+Shift+E (toggle editor).
- **Drag-and-drop** a `.md` file onto the window to open it.
- **Unsaved-changes prompts** on open-over and on window close.
- **External change detection**: if the open file is modified on disk, reload (silently if clean, prompt if dirty).
- **Local image paths** resolved relative to the open file.
- **Follow OS light/dark theme.**
- **Portable executable** per platform; no installer required.

## 3. Technology Choices

| Concern | Choice | Why |
|---|---|---|
| App framework | Tauri 2.x | Small binary (~6-10MB), fast cold start (~100-300ms), system webview (no bundled Chromium), strong Windows/macOS support |
| Backend language | Rust | Required by Tauri; kept thin — file I/O, dialogs, watcher, config |
| Frontend language | TypeScript | Type safety for Tauri IPC; minimal overhead |
| Frontend build | Vite | Fast dev, tiny production bundle |
| Frontend framework | None (vanilla TS) | Two-pane UI doesn't justify a framework; keeps bundle under 100KB |
| Markdown parser | `markdown-it` + `markdown-it-task-lists` + `markdown-it-anchor` | Mature, fast, extensible, GFM-capable |
| Syntax highlighting | `highlight.js` | Smaller than shiki, sufficient for a viewer |
| Preview CSS | `github-markdown-css` | The real stylesheet GitHub uses |
| Editor widget | Native `<textarea>` | "Truly raw" matches the spec; zero editor-framework overhead |
| File watcher | `notify` crate | Standard Rust file watcher |
| Package manager | Bun | Fast installs; Tauri works fine with it |

**Rejected alternatives (for the record):**
- Wails (Go) — fine, but Rust/Tauri has better Windows webview polish and a larger plugin ecosystem.
- Bun + `webview-bun` — less mature cross-platform packaging; would add more risk than it saves.
- Electron — binary size and startup time violate the "fast, native feel" goal.
- CodeMirror/Monaco — overkill for a raw-textarea spec; large dependencies.

## 4. Architecture

### 4.1 Process model

Two sides, bridged by Tauri's typed IPC:

**Rust (backend) owns:**
- File reads/writes, open/save dialogs
- Drag-drop path events
- Window state (bounds, focus)
- `madame.yaml` config load (with default creation and malformed-input fallback)
- `state.json` runtime state load/persist
- File watcher for the currently open file

**TypeScript (frontend) owns:**
- Editor textarea and preview rendering
- Keyboard shortcut registry
- Splitter drag, scroll sync
- Recent-files modal UI
- Custom titlebar rendering + window control buttons
- Debounced render pipeline

**Tauri commands (IPC surface):**
- `open_file(path?: string) -> { content, path }` — opens dialog if no path given
- `save_file(path: string, content: string) -> void`
- `save_file_as(content: string) -> { path }`
- `read_config() -> Config`
- `read_state() -> State`
- `write_state(state: State) -> void`
- `get_recent_files() -> string[]`
- `remove_recent_file(path: string) -> void`
- `watch_file(path: string) -> void`
- `stop_watching() -> void`

**Tauri events (backend → frontend):**
- `file-changed-externally` — watcher fired
- `file-dropped` — drag-drop completed with a valid path
- `cli-open-path` — CLI-arg path to open on startup

### 4.2 Project structure

```
madame/
├── src-tauri/                  # Rust backend
│   ├── src/
│   │   ├── main.rs             # entry, window setup, command registration
│   │   ├── commands.rs         # open/save/dialog IPC commands
│   │   ├── config.rs           # madame.yaml load + defaults
│   │   ├── state.rs            # state.json load/save, recent-files list
│   │   └── watcher.rs          # file watcher wrapper
│   ├── tauri.conf.json
│   └── Cargo.toml
├── src/                        # frontend (TS)
│   ├── index.html
│   ├── main.ts                 # bootstrap + orchestration (only file that knows about all others)
│   ├── editor.ts               # textarea wrapper
│   ├── preview.ts              # markdown-it render + highlight
│   ├── splitter.ts             # drag-to-resize pane divider
│   ├── scroll-sync.ts          # line-based bidirectional sync
│   ├── titlebar.ts             # custom draggable titlebar
│   ├── recent.ts               # Ctrl+R quick-pick modal
│   ├── shortcuts.ts            # keybinding registry
│   └── styles/
│       ├── app.css             # layout, titlebar, splitter, modal
│       └── github.css          # vendored github-markdown-css
├── docs/plans/                 # design + implementation plans
├── package.json
└── bun.lockb
```

### 4.3 Component responsibilities

Each component has one clear purpose, a small public interface, and does not reach into its peers.

- **`editor.ts`** — owns the textarea. Public: `getText()`, `setText(s)`, `onChange(cb)`, `focus()`, `getVisibleLineRange()`. No knowledge of markdown or files.
- **`preview.ts`** — owns the preview container. Public: `render(md, baseDir?)`, `getVisibleAnchorLine()`, `scrollToLine(n)`. No knowledge of editor state or files.
- **`splitter.ts`** — drag handle between two panes. Public: `onResize(cb)`, `setRatio(r)`. Emits ratio changes; doesn't know what's in either pane.
- **`scroll-sync.ts`** — given `editor` and `preview` refs, maintains an approximate line→element map and syncs scroll position. Includes a short (~50ms) "sync-source" suppression window to prevent feedback loops. Can be disabled without touching other code.
- **`titlebar.ts`** — renders filename + unsaved-dot. Tauri is configured with `decorations: false`, so this component re-implements the drag region (via `data-tauri-drag-region`) and min/maximize/close buttons against Tauri's window API.
- **`recent.ts`** — Ctrl+R modal. Fetches list from backend, renders filter input + arrow-key list, resolves selection → invokes open.
- **`shortcuts.ts`** — single source of truth for keybindings. Registers all Ctrl+ shortcuts and dispatches to handlers registered by `main.ts`.
- **`main.ts`** — the only file that knows about all the others. Wires them together and orchestrates the file lifecycle.

Backend files mirror this discipline: `commands.rs`, `config.rs`, `state.rs`, `watcher.rs` each have one job.

## 5. Data Flow

### 5.1 File open

```
User action (Ctrl+O / drag-drop / Ctrl+R / CLI arg)
  → frontend: if dirty, prompt Save / Discard / Cancel
  → frontend → Rust: open_file(path?)
  → Rust: read file, update recent list, (re)start watcher, return {content, path}
  → frontend: editor.setText(content); preview.render(content, dirname(path));
              titlebar.setFilename(path); mark clean
```

### 5.2 Live preview

```
textarea 'input' → editor.onChange fires
  → main.ts marks dirty (titlebar dot on)
  → debounce 100ms → preview.render(text, baseDir)
  → scroll-sync recomputes line→element map
```

### 5.3 Save

```
Ctrl+S
  → if no path yet, route to save_file_as (dialog)
  → Rust: pause watcher → write file → resume watcher → update recent list
  → frontend: mark clean (titlebar dot off)
```

### 5.4 Scroll sync

```
editor scroll → compute top visible line
  → look up line→element in map
  → preview.scrollToLine(n)
preview scroll → reverse lookup → editor scroll
A 'sync-source' flag suppresses events on the opposite pane for ~50ms to avoid feedback loops.
```

### 5.5 External change

```
watcher (notify) fires on current file
  → Rust emits 'file-changed-externally'
  → frontend: if clean → silently reload
             if dirty → modal "File changed on disk. Reload (lose changes) / Keep yours"
```

### 5.6 Startup

```
Tauri launches
  → load madame.yaml next to binary (create defaults if missing, fall back + toast if malformed)
  → load state.json from OS app-data dir
  → restore window bounds, splitter ratio, view mode
  → if CLI arg path → queue 'cli-open-path' for frontend
  → webview boots → frontend requests config + state → renders shell
  → consume cli-open-path if present (invalid path surfaces via normal open-error toast), else empty editor
```

### 5.7 Shutdown

```
Window close requested
  → if dirty → modal Save / Discard / Cancel
  → persist state.json (bounds, splitter, view mode, recent list, last_open_path)
  → exit
```

## 6. Configuration

Two files on purpose: user-editable preferences vs runtime state.

### 6.1 `madame.yaml` (next to binary) — user preferences

```yaml
editor:
  tab_size: 2
  tab_inserts_spaces: true
  word_wrap: true
  font_family: null         # null = system default monospace
  font_size: 14

preview:
  debounce_ms: 100
  code_theme: github        # highlight.js theme name
  scroll_sync: true

ui:
  theme: system             # system | light | dark
  remember_window: true

files:
  recent_limit: 10
  watch_external_changes: true
```

- Auto-created with defaults on first run.
- Malformed → fall back to defaults, toast with path, continue.
- Changes picked up on next start (no live reload in v1).

### 6.2 `state.json` (OS app-data dir) — runtime state

```json
{
  "window": { "width": 1200, "height": 800, "x": 100, "y": 100, "maximized": false },
  "splitter_ratio": 0.5,
  "view_mode": "both",
  "recent_files": ["C:/.../notes.md"],
  "last_open_path": "C:/.../notes.md"
}
```

- Missing/corrupt → silent reset to defaults.
- `recent_files` ordering: most-recently-opened first. On open, the path moves to index 0; list truncated to `files.recent_limit`.
- `view_mode` values: `both` (default), `editor` (preview hidden), `preview` (editor hidden).
- App-data locations: `%APPDATA%/madame/` on Windows, `~/Library/Application Support/madame/` on macOS, `~/.local/share/madame/` on Linux.

## 7. Error Handling

Rust boundaries return `Result<T, AppError>`. `AppError` is a single enum with variants: `Io`, `Parse`, `DialogCancelled`, `NotFound`, `PermissionDenied`.

| Situation | Response |
|---|---|
| `madame.yaml` missing | Create with defaults. Not an error. |
| `madame.yaml` malformed | Log, use defaults, toast "Config invalid — using defaults (path)". |
| `state.json` missing/corrupt | Silent reset. |
| Open file fails | Toast "Couldn't open: reason". Keep previous file. |
| Save fails | Modal "Save failed: reason. Retry / Save As / Cancel". Stay dirty. |
| Recent file gone | Remove from list; toast "File no longer exists". |
| Watcher error | Log, disable watcher this session, no UI noise. |
| Render throws | Show raw text in preview + small error banner. |

No defensive validation inside internal code. Validate at boundaries (file system, config parse, IPC) only.

## 8. Edge Cases

- **Large files (>5MB)** — still render; scroll-sync map recomputes on scroll rather than on every keystroke.
- **Non-`.md` extensions** — dialog filter includes `.md`, `.markdown`, `.mdown`, `.txt`, "All Files".
- **No file open yet** — relative images skipped (no base dir). Titlebar shows "Untitled". Save triggers Save As.
- **Two instances on same file** — out of scope for v1; last write wins. Document in README.
- **Drag-drop non-text / binary** — reject with toast.

## 9. Out of Scope for v1

Intentionally excluded; can be revisited later:

- Tabs, file-tree sidebar, split editors
- Markdown source syntax highlighting, autocomplete, spellcheck
- Export to HTML/PDF
- Find/replace (preview has browser Ctrl+F)
- Plugins or extensions
- Diff view on external change
- Auto-save
- Live config reload

## 10. Testing

### 10.1 Rust unit tests (`cargo test`)

- `config.rs`: parse valid YAML, apply defaults to missing keys, malformed input yields defaults + reportable error
- `state.rs`: round-trip JSON; recent-files add / dedupe / trim-to-limit / remove-missing
- I/O-heavy code (dialogs, filesystem) is thin and covered by smoke tests instead

### 10.2 Frontend unit tests (vitest)

- `preview.ts`: markdown input → expected HTML structure (GFM checkboxes, tables, code-block class names)
- `scroll-sync.ts`: line→element map correctness against a fixture doc; feedback-loop suppression
- `shortcuts.ts`: registry doesn't double-fire; modifier-order agnostic
- Trivial components (editor wrapper, titlebar, splitter) are visually verified, not unit-tested

### 10.3 Manual smoke checklist (before each release build)

- [ ] Open via Ctrl+O, drag-drop, CLI arg, Ctrl+R recent
- [ ] Edit → preview updates with expected debounce
- [ ] Scroll sync works both directions
- [ ] Save / Save As / unsaved-prompt on close
- [ ] External modify → reload prompt
- [ ] Splitter drag + persistence across restart
- [ ] Toggle editor-only (Ctrl+E) and preview-only (Ctrl+Shift+E)
- [ ] Config edits in `madame.yaml` take effect on next launch
- [ ] Large file (~5MB) typing remains responsive

## 11. Delivery

- **Dev:** `bun run tauri dev`
- **Release build:** `bun run tauri build` → `src-tauri/target/release/madame.exe` (Windows primary) and raw binaries on macOS/Linux when built there
- **Portable output:** `tauri.conf.json` configured to emit the raw `.exe` alongside any installer
- **Cross-platform builds:** `tauri build --target <triple>` when ready
- **CI:** out of scope for v1; local builds only

## 12. Performance Budget

- Cold start: ≤ 300 ms to first paint
- Keystroke → preview updated: ≤ 150 ms (100 ms debounce + render)
- 10 KB markdown render: ≤ 30 ms
- Binary size: ≤ 15 MB

## 13. Open Items (resolve before or during implementation)

- **License** — chose deferred; pick before first public release.
- **App icon** — not yet chosen; placeholder during dev.
- **macOS code signing / notarization** — will matter when distributing Mac builds; v1 dev is unsigned local builds.
