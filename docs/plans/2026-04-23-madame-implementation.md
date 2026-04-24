# Madame Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a minimal, fast-starting, two-pane markdown editor/viewer with a raw textarea editor on the left and a GitHub-style rendered preview on the right, shipped as a single portable executable.

**Architecture:** Tauri 2.x desktop app. Rust backend owns file I/O, dialogs, config, state, and file watching; TypeScript frontend (no framework) owns the two-pane UI, markdown rendering, scroll sync, and keybindings. They talk via typed Tauri IPC commands and events.

**Tech Stack:** Tauri 2, Rust, TypeScript, Vite, Bun, markdown-it, highlight.js, github-markdown-css, notify (Rust file watcher), vitest (frontend tests), cargo test (backend tests).

**Reference:** See `docs/plans/2026-04-23-madame-design.md` for the full design spec.

---

## File Structure

### Rust backend (`src-tauri/`)

| File | Responsibility |
|---|---|
| `src-tauri/Cargo.toml` | Rust deps |
| `src-tauri/tauri.conf.json` | Window config, bundle settings, capabilities |
| `src-tauri/build.rs` | Tauri build script |
| `src-tauri/src/main.rs` | Entry, window setup, command registration |
| `src-tauri/src/error.rs` | `AppError` enum + `Result` alias |
| `src-tauri/src/config.rs` | `madame.yaml` load with defaults |
| `src-tauri/src/state.rs` | `state.json` load/save; recent-files list helpers |
| `src-tauri/src/watcher.rs` | `notify`-based file watcher wrapper |
| `src-tauri/src/commands.rs` | All Tauri IPC commands |
| `src-tauri/capabilities/default.json` | Tauri v2 capability config |

### Frontend (`src/`)

| File | Responsibility |
|---|---|
| `src/index.html` | Shell, pane containers, modal root |
| `src/main.ts` | Bootstrap + file-lifecycle orchestration (only file that imports all components) |
| `src/ipc.ts` | Typed wrappers over Tauri `invoke` + event listeners |
| `src/types.ts` | Shared TS types mirroring Rust DTOs |
| `src/editor.ts` | Textarea wrapper |
| `src/preview.ts` | markdown-it + highlight.js renderer |
| `src/splitter.ts` | Drag-to-resize divider |
| `src/scroll-sync.ts` | Bidirectional line-based scroll sync |
| `src/titlebar.ts` | Custom titlebar (filename, unsaved dot, window controls) |
| `src/recent.ts` | Ctrl+R quick-pick modal |
| `src/shortcuts.ts` | Keybinding registry |
| `src/toast.ts` | Tiny non-blocking notification helper |
| `src/styles/app.css` | Layout, titlebar, splitter, modal, toast |
| `src/styles/github.css` | Vendored `github-markdown-css` |

### Project root

| File | Responsibility |
|---|---|
| `package.json` | Frontend deps, scripts |
| `tsconfig.json` | TS config |
| `vite.config.ts` | Vite config |
| `vitest.config.ts` | Vitest config |
| `src/tests/` | Vitest tests (colocated under `src/tests/` to avoid shipping in bundle) |

---

## Task 1: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `src/index.html`, `src/main.ts` (stub)
- Create: `src-tauri/Cargo.toml`, `src-tauri/build.rs`, `src-tauri/tauri.conf.json`, `src-tauri/capabilities/default.json`, `src-tauri/src/main.rs` (stub)

- [ ] **Step 1: Initialize frontend package**

Create `package.json`:

```json
{
  "name": "madame",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "tauri": "tauri"
  },
  "dependencies": {
    "@tauri-apps/api": "^2.0.0",
    "@tauri-apps/plugin-dialog": "^2.0.0",
    "@tauri-apps/plugin-fs": "^2.0.0",
    "github-markdown-css": "^5.6.1",
    "highlight.js": "^11.10.0",
    "markdown-it": "^14.1.0",
    "markdown-it-anchor": "^9.2.0",
    "markdown-it-task-lists": "^2.1.1"
  },
  "devDependencies": {
    "@tauri-apps/cli": "^2.0.0",
    "@types/markdown-it": "^14.1.2",
    "jsdom": "^25.0.0",
    "typescript": "^5.6.0",
    "vite": "^5.4.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Create TypeScript config**

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "types": ["vite/client"],
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "useDefineForClassFields": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create Vite config**

Create `vite.config.ts`:

```ts
import { defineConfig } from "vite";

export default defineConfig({
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
  },
  envPrefix: ["VITE_", "TAURI_ENV_*"],
  build: {
    target: "esnext",
    minify: "esbuild",
    sourcemap: false,
  },
});
```

- [ ] **Step 4: Create Vitest config**

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["src/tests/**/*.test.ts"],
  },
});
```

- [ ] **Step 5: Create minimal index.html and stub main.ts**

Create `src/index.html`:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Madame</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/main.ts"></script>
  </body>
</html>
```

Create `src/main.ts`:

```ts
document.getElementById("app")!.textContent = "Madame starting...";
```

- [ ] **Step 6: Create Rust Cargo.toml**

Create `src-tauri/Cargo.toml`:

```toml
[package]
name = "madame"
version = "0.1.0"
description = "Minimal two-pane Markdown editor/viewer"
edition = "2021"

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-dialog = "2"
tauri-plugin-fs = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
serde_yaml = "0.9"
notify = "7"
thiserror = "1"
directories = "5"

[dev-dependencies]
tempfile = "3"
```

- [ ] **Step 7: Create build.rs and tauri.conf.json**

Create `src-tauri/build.rs`:

```rust
fn main() {
    tauri_build::build()
}
```

Create `src-tauri/tauri.conf.json`:

```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "Madame",
  "version": "0.1.0",
  "identifier": "com.madame.app",
  "build": {
    "beforeDevCommand": "bun run dev",
    "devUrl": "http://localhost:1420",
    "beforeBuildCommand": "bun run build",
    "frontendDist": "../dist"
  },
  "app": {
    "windows": [
      {
        "title": "Madame",
        "width": 1200,
        "height": 800,
        "decorations": false,
        "transparent": false,
        "fullscreen": false,
        "resizable": true
      }
    ],
    "security": {
      "csp": null
    }
  },
  "bundle": {
    "active": false,
    "targets": "all",
    "icon": ["icons/32x32.png", "icons/128x128.png", "icons/icon.ico", "icons/icon.icns"]
  }
}
```

- [ ] **Step 8: Create capabilities file**

Create `src-tauri/capabilities/default.json`:

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Default capabilities",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "core:window:default",
    "core:window:allow-start-dragging",
    "core:window:allow-minimize",
    "core:window:allow-maximize",
    "core:window:allow-toggle-maximize",
    "core:window:allow-close",
    "dialog:default",
    "fs:default"
  ]
}
```

- [ ] **Step 9: Create stub Rust main.rs**

Create `src-tauri/src/main.rs`:

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 10: Install and verify build**

Run:

```bash
cd C:/Users/Shane/projects/madame
bun install
```

Expected: dependencies install without errors.

Run:

```bash
bun run tauri dev
```

Expected: window opens showing "Madame starting...". Close with Ctrl+C.

- [ ] **Step 11: Commit**

```bash
git add package.json tsconfig.json vite.config.ts vitest.config.ts src/ src-tauri/ bun.lockb
git commit -m "chore: scaffold Tauri + Vite + Vitest project"
```

---

## Task 2: Rust error type

**Files:**
- Create: `src-tauri/src/error.rs`
- Modify: `src-tauri/src/main.rs`

- [ ] **Step 1: Create error module**

Create `src-tauri/src/error.rs`:

```rust
use serde::{Serialize, Serializer};
use thiserror::Error;

pub type Result<T> = std::result::Result<T, AppError>;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),

    #[error("YAML parse error: {0}")]
    Yaml(#[from] serde_yaml::Error),

    #[error("JSON parse error: {0}")]
    Json(#[from] serde_json::Error),

    #[error("File not found: {0}")]
    NotFound(String),

    #[error("Permission denied: {0}")]
    PermissionDenied(String),

    #[error("Dialog cancelled")]
    DialogCancelled,

    #[error("Watcher error: {0}")]
    Watcher(String),

    #[error("{0}")]
    Other(String),
}

impl Serialize for AppError {
    fn serialize<S: Serializer>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error> {
        serializer.serialize_str(self.to_string().as_ref())
    }
}
```

- [ ] **Step 2: Wire error module into main.rs**

Edit `src-tauri/src/main.rs` — replace entire file with:

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod error;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 3: Verify build**

Run:

```bash
cd C:/Users/Shane/projects/madame/src-tauri
cargo check
```

Expected: compiles cleanly. There will be a warning about unused `AppError` variants — ignore for now.

- [ ] **Step 4: Commit**

```bash
cd C:/Users/Shane/projects/madame
git add src-tauri/src/error.rs src-tauri/src/main.rs
git commit -m "feat(backend): add AppError enum"
```

---

## Task 3: Rust config module (TDD)

**Files:**
- Create: `src-tauri/src/config.rs`
- Modify: `src-tauri/src/main.rs`

- [ ] **Step 1: Write failing tests**

Create `src-tauri/src/config.rs`:

```rust
use serde::{Deserialize, Serialize};
use std::path::Path;

use crate::error::Result;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(default)]
pub struct EditorConfig {
    pub tab_size: u32,
    pub tab_inserts_spaces: bool,
    pub word_wrap: bool,
    pub font_family: Option<String>,
    pub font_size: u32,
}

impl Default for EditorConfig {
    fn default() -> Self {
        Self {
            tab_size: 2,
            tab_inserts_spaces: true,
            word_wrap: true,
            font_family: None,
            font_size: 14,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(default)]
pub struct PreviewConfig {
    pub debounce_ms: u32,
    pub code_theme: String,
    pub scroll_sync: bool,
}

impl Default for PreviewConfig {
    fn default() -> Self {
        Self {
            debounce_ms: 100,
            code_theme: "github".to_string(),
            scroll_sync: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(default)]
pub struct UiConfig {
    pub theme: String,
    pub remember_window: bool,
}

impl Default for UiConfig {
    fn default() -> Self {
        Self {
            theme: "system".to_string(),
            remember_window: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(default)]
pub struct FilesConfig {
    pub recent_limit: u32,
    pub watch_external_changes: bool,
}

impl Default for FilesConfig {
    fn default() -> Self {
        Self {
            recent_limit: 10,
            watch_external_changes: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[serde(default)]
pub struct Config {
    pub editor: EditorConfig,
    pub preview: PreviewConfig,
    pub ui: UiConfig,
    pub files: FilesConfig,
}

pub fn load_or_default(path: &Path) -> Result<Config> {
    if !path.exists() {
        let cfg = Config::default();
        let yaml = serde_yaml::to_string(&cfg)?;
        std::fs::write(path, yaml)?;
        return Ok(cfg);
    }
    let content = std::fs::read_to_string(path)?;
    match serde_yaml::from_str::<Config>(&content) {
        Ok(cfg) => Ok(cfg),
        Err(_) => Ok(Config::default()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::NamedTempFile;

    #[test]
    fn defaults_when_file_missing() {
        let tmp = tempfile::tempdir().unwrap();
        let path = tmp.path().join("madame.yaml");
        assert!(!path.exists());
        let cfg = load_or_default(&path).unwrap();
        assert_eq!(cfg, Config::default());
        assert!(path.exists(), "config file should be created");
    }

    #[test]
    fn loads_valid_yaml() {
        let tmp = NamedTempFile::new().unwrap();
        std::fs::write(
            tmp.path(),
            "editor:\n  tab_size: 4\npreview:\n  debounce_ms: 200\n",
        )
        .unwrap();
        let cfg = load_or_default(tmp.path()).unwrap();
        assert_eq!(cfg.editor.tab_size, 4);
        assert_eq!(cfg.preview.debounce_ms, 200);
        assert_eq!(cfg.files.recent_limit, 10);
    }

    #[test]
    fn malformed_yaml_yields_defaults() {
        let tmp = NamedTempFile::new().unwrap();
        std::fs::write(tmp.path(), "not: [valid: yaml").unwrap();
        let cfg = load_or_default(tmp.path()).unwrap();
        assert_eq!(cfg, Config::default());
    }

    #[test]
    fn partial_yaml_fills_missing_with_defaults() {
        let tmp = NamedTempFile::new().unwrap();
        std::fs::write(tmp.path(), "editor:\n  font_size: 16\n").unwrap();
        let cfg = load_or_default(tmp.path()).unwrap();
        assert_eq!(cfg.editor.font_size, 16);
        assert_eq!(cfg.editor.tab_size, 2);
        assert_eq!(cfg.preview.debounce_ms, 100);
    }
}
```

- [ ] **Step 2: Register module and run tests**

Edit `src-tauri/src/main.rs` — add `mod config;` below `mod error;`:

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod config;
mod error;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

Run:

```bash
cd C:/Users/Shane/projects/madame/src-tauri
cargo test --lib config::
```

Expected: all four tests pass.

- [ ] **Step 3: Commit**

```bash
cd C:/Users/Shane/projects/madame
git add src-tauri/src/config.rs src-tauri/src/main.rs
git commit -m "feat(backend): config module with YAML load + defaults"
```

---

## Task 4: Rust state module (TDD)

**Files:**
- Create: `src-tauri/src/state.rs`
- Modify: `src-tauri/src/main.rs`

- [ ] **Step 1: Write state module with tests**

Create `src-tauri/src/state.rs`:

```rust
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

use crate::error::Result;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(default)]
pub struct WindowBounds {
    pub width: u32,
    pub height: u32,
    pub x: Option<i32>,
    pub y: Option<i32>,
    pub maximized: bool,
}

impl Default for WindowBounds {
    fn default() -> Self {
        Self {
            width: 1200,
            height: 800,
            x: None,
            y: None,
            maximized: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(default)]
pub struct AppState {
    pub window: WindowBounds,
    pub splitter_ratio: f64,
    pub view_mode: String, // "both" | "editor" | "preview"
    pub recent_files: Vec<PathBuf>,
    pub last_open_path: Option<PathBuf>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            window: WindowBounds::default(),
            splitter_ratio: 0.5,
            view_mode: "both".to_string(),
            recent_files: Vec::new(),
            last_open_path: None,
        }
    }
}

pub fn load_or_default(path: &Path) -> AppState {
    if !path.exists() {
        return AppState::default();
    }
    match std::fs::read_to_string(path).ok().and_then(|s| serde_json::from_str(&s).ok()) {
        Some(st) => st,
        None => AppState::default(),
    }
}

pub fn save(path: &Path, state: &AppState) -> Result<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let json = serde_json::to_string_pretty(state)?;
    std::fs::write(path, json)?;
    Ok(())
}

pub fn touch_recent(state: &mut AppState, path: PathBuf, limit: usize) {
    state.recent_files.retain(|p| p != &path);
    state.recent_files.insert(0, path);
    state.recent_files.truncate(limit);
}

pub fn remove_recent(state: &mut AppState, path: &Path) {
    state.recent_files.retain(|p| p != path);
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn default_when_missing() {
        let st = load_or_default(Path::new("C:/nonexistent/path/state.json"));
        assert_eq!(st, AppState::default());
    }

    #[test]
    fn save_and_reload_roundtrip() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("state.json");
        let mut st = AppState::default();
        st.splitter_ratio = 0.3;
        st.recent_files.push(PathBuf::from("C:/a.md"));
        save(&path, &st).unwrap();
        let loaded = load_or_default(&path);
        assert_eq!(loaded, st);
    }

    #[test]
    fn corrupt_file_yields_default() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("state.json");
        std::fs::write(&path, "{not json").unwrap();
        let st = load_or_default(&path);
        assert_eq!(st, AppState::default());
    }

    #[test]
    fn touch_recent_adds_and_dedupes_to_front() {
        let mut st = AppState::default();
        touch_recent(&mut st, PathBuf::from("a"), 10);
        touch_recent(&mut st, PathBuf::from("b"), 10);
        touch_recent(&mut st, PathBuf::from("a"), 10);
        assert_eq!(st.recent_files, vec![PathBuf::from("a"), PathBuf::from("b")]);
    }

    #[test]
    fn touch_recent_respects_limit() {
        let mut st = AppState::default();
        for i in 0..15 {
            touch_recent(&mut st, PathBuf::from(format!("file{i}")), 5);
        }
        assert_eq!(st.recent_files.len(), 5);
        assert_eq!(st.recent_files[0], PathBuf::from("file14"));
    }

    #[test]
    fn remove_recent_removes_matching() {
        let mut st = AppState::default();
        touch_recent(&mut st, PathBuf::from("a"), 10);
        touch_recent(&mut st, PathBuf::from("b"), 10);
        remove_recent(&mut st, Path::new("a"));
        assert_eq!(st.recent_files, vec![PathBuf::from("b")]);
    }
}
```

- [ ] **Step 2: Register module**

Edit `src-tauri/src/main.rs` — add `mod state;` after `mod error;`:

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod config;
mod error;
mod state;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 3: Run tests**

Run:

```bash
cd C:/Users/Shane/projects/madame/src-tauri
cargo test --lib state::
```

Expected: all six tests pass.

- [ ] **Step 4: Commit**

```bash
cd C:/Users/Shane/projects/madame
git add src-tauri/src/state.rs src-tauri/src/main.rs
git commit -m "feat(backend): state module with recent-files helpers"
```

---

## Task 5: Rust watcher module

**Files:**
- Create: `src-tauri/src/watcher.rs`
- Modify: `src-tauri/src/main.rs`

- [ ] **Step 1: Create watcher module**

Create `src-tauri/src/watcher.rs`:

```rust
use notify::{recommended_watcher, Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use crate::error::{AppError, Result};

pub struct FileWatcher {
    watcher: Option<RecommendedWatcher>,
    current_path: Arc<Mutex<Option<PathBuf>>>,
    paused: Arc<Mutex<bool>>,
}

impl FileWatcher {
    pub fn new() -> Self {
        Self {
            watcher: None,
            current_path: Arc::new(Mutex::new(None)),
            paused: Arc::new(Mutex::new(false)),
        }
    }

    /// Watch a single file. On modify events, call `on_change(path)`.
    /// Any previously-watched path is dropped first.
    pub fn watch<F>(&mut self, path: &Path, on_change: F) -> Result<()>
    where
        F: Fn(PathBuf) + Send + 'static,
    {
        self.unwatch();

        let paused = self.paused.clone();
        let current_path = self.current_path.clone();
        let target = path.to_path_buf();

        let mut watcher = recommended_watcher(move |res: std::result::Result<Event, notify::Error>| {
            let Ok(event) = res else { return };
            if !matches!(event.kind, EventKind::Modify(_) | EventKind::Create(_)) {
                return;
            }
            if *paused.lock().unwrap() {
                return;
            }
            let Some(watched) = current_path.lock().unwrap().clone() else { return };
            for p in &event.paths {
                if p == &watched {
                    on_change(watched.clone());
                    return;
                }
            }
        })
        .map_err(|e| AppError::Watcher(e.to_string()))?;

        let parent = target.parent().unwrap_or(Path::new("."));
        watcher
            .watch(parent, RecursiveMode::NonRecursive)
            .map_err(|e| AppError::Watcher(e.to_string()))?;

        *self.current_path.lock().unwrap() = Some(target);
        self.watcher = Some(watcher);
        Ok(())
    }

    pub fn unwatch(&mut self) {
        self.watcher = None;
        *self.current_path.lock().unwrap() = None;
    }

    pub fn pause(&self) {
        *self.paused.lock().unwrap() = true;
    }

    pub fn resume(&self) {
        *self.paused.lock().unwrap() = false;
    }
}

impl Default for FileWatcher {
    fn default() -> Self {
        Self::new()
    }
}
```

- [ ] **Step 2: Register module**

Edit `src-tauri/src/main.rs` — add `mod watcher;`:

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod config;
mod error;
mod state;
mod watcher;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 3: Verify compilation**

Run:

```bash
cd C:/Users/Shane/projects/madame/src-tauri
cargo check
```

Expected: clean compile. (Watcher is boundary/IO heavy — validated by smoke test later, not unit-tested.)

- [ ] **Step 4: Commit**

```bash
cd C:/Users/Shane/projects/madame
git add src-tauri/src/watcher.rs src-tauri/src/main.rs
git commit -m "feat(backend): file watcher wrapper with pause/resume"
```

---

## Task 6: Rust commands module

**Files:**
- Create: `src-tauri/src/commands.rs`
- Modify: `src-tauri/src/main.rs`

- [ ] **Step 1: Create commands module**

Create `src-tauri/src/commands.rs`:

```rust
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, State};

use crate::config::Config;
use crate::error::{AppError, Result};
use crate::state::{self, AppState};
use crate::watcher::FileWatcher;

pub struct AppCtx {
    pub config_path: PathBuf,
    pub state_path: PathBuf,
    pub config: Mutex<Config>,
    pub state: Mutex<AppState>,
    pub watcher: Mutex<FileWatcher>,
}

#[derive(serde::Serialize)]
pub struct OpenFileResult {
    pub path: String,
    pub content: String,
}

#[tauri::command]
pub fn read_config(ctx: State<AppCtx>) -> Config {
    ctx.config.lock().unwrap().clone()
}

#[tauri::command]
pub fn read_state(ctx: State<AppCtx>) -> AppState {
    ctx.state.lock().unwrap().clone()
}

#[tauri::command]
pub fn write_state(ctx: State<AppCtx>, new_state: AppState) -> Result<()> {
    *ctx.state.lock().unwrap() = new_state.clone();
    state::save(&ctx.state_path, &new_state)?;
    Ok(())
}

#[tauri::command]
pub fn get_recent_files(ctx: State<AppCtx>) -> Vec<String> {
    ctx.state
        .lock()
        .unwrap()
        .recent_files
        .iter()
        .filter(|p| p.exists())
        .map(|p| p.to_string_lossy().to_string())
        .collect()
}

#[tauri::command]
pub fn remove_recent_file(ctx: State<AppCtx>, path: String) -> Result<()> {
    let p = PathBuf::from(&path);
    let mut st = ctx.state.lock().unwrap();
    state::remove_recent(&mut st, &p);
    state::save(&ctx.state_path, &st)?;
    Ok(())
}

#[tauri::command]
pub fn open_file(app: AppHandle, ctx: State<AppCtx>, path: String) -> Result<OpenFileResult> {
    let p = PathBuf::from(&path);
    if !p.exists() {
        return Err(AppError::NotFound(path));
    }
    let content = std::fs::read_to_string(&p)?;

    let limit = ctx.config.lock().unwrap().files.recent_limit as usize;
    {
        let mut st = ctx.state.lock().unwrap();
        state::touch_recent(&mut st, p.clone(), limit);
        st.last_open_path = Some(p.clone());
        state::save(&ctx.state_path, &st)?;
    }

    let watch = ctx.config.lock().unwrap().files.watch_external_changes;
    if watch {
        let app_clone = app.clone();
        ctx.watcher
            .lock()
            .unwrap()
            .watch(&p, move |changed| {
                let _ = app_clone.emit("file-changed-externally", changed.to_string_lossy().to_string());
            })?;
    }

    Ok(OpenFileResult {
        path: p.to_string_lossy().to_string(),
        content,
    })
}

#[tauri::command]
pub fn save_file(ctx: State<AppCtx>, path: String, content: String) -> Result<()> {
    let p = PathBuf::from(&path);
    ctx.watcher.lock().unwrap().pause();
    let res = std::fs::write(&p, content).map_err(AppError::from);
    ctx.watcher.lock().unwrap().resume();
    res?;

    let limit = ctx.config.lock().unwrap().files.recent_limit as usize;
    let mut st = ctx.state.lock().unwrap();
    state::touch_recent(&mut st, p, limit);
    state::save(&ctx.state_path, &st)?;
    Ok(())
}

#[tauri::command]
pub fn stop_watching(ctx: State<AppCtx>) {
    ctx.watcher.lock().unwrap().unwatch();
}
```

Handlers are registered directly in `main.rs` using `tauri::generate_handler!`, so no helper function is needed here.

- [ ] **Step 2: Register commands in main.rs**

Edit `src-tauri/src/main.rs` — replace entire file:

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod config;
mod error;
mod state;
mod watcher;

use std::sync::Mutex;
use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            // Resolve config path next to the binary.
            let exe_dir = std::env::current_exe()
                .ok()
                .and_then(|p| p.parent().map(|p| p.to_path_buf()))
                .unwrap_or_else(|| std::path::PathBuf::from("."));
            let config_path = exe_dir.join("madame.yaml");

            // Resolve state path in OS app-data.
            let app_data = app
                .path()
                .app_data_dir()
                .unwrap_or_else(|_| exe_dir.clone());
            std::fs::create_dir_all(&app_data).ok();
            let state_path = app_data.join("state.json");

            let config = config::load_or_default(&config_path).unwrap_or_default();
            let app_state = state::load_or_default(&state_path);

            app.manage(commands::AppCtx {
                config_path,
                state_path,
                config: Mutex::new(config),
                state: Mutex::new(app_state),
                watcher: Mutex::new(watcher::FileWatcher::new()),
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::read_config,
            commands::read_state,
            commands::write_state,
            commands::get_recent_files,
            commands::remove_recent_file,
            commands::open_file,
            commands::save_file,
            commands::stop_watching,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 3: Verify build**

Run:

```bash
cd C:/Users/Shane/projects/madame/src-tauri
cargo check
```

Expected: clean compile.

- [ ] **Step 4: Smoke test the full app starts**

Run:

```bash
cd C:/Users/Shane/projects/madame
bun run tauri dev
```

Expected: window opens (possibly undecorated — fine), no crash. Close.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/commands.rs src-tauri/src/main.rs
git commit -m "feat(backend): IPC commands for file ops + state + config"
```

---

## Task 7: Frontend IPC wrapper + types

**Files:**
- Create: `src/types.ts`, `src/ipc.ts`

- [ ] **Step 1: Create shared types**

Create `src/types.ts`:

```ts
export interface EditorConfig {
  tab_size: number;
  tab_inserts_spaces: boolean;
  word_wrap: boolean;
  font_family: string | null;
  font_size: number;
}

export interface PreviewConfig {
  debounce_ms: number;
  code_theme: string;
  scroll_sync: boolean;
}

export interface UiConfig {
  theme: "system" | "light" | "dark";
  remember_window: boolean;
}

export interface FilesConfig {
  recent_limit: number;
  watch_external_changes: boolean;
}

export interface Config {
  editor: EditorConfig;
  preview: PreviewConfig;
  ui: UiConfig;
  files: FilesConfig;
}

export interface WindowBounds {
  width: number;
  height: number;
  x: number | null;
  y: number | null;
  maximized: boolean;
}

export type ViewMode = "both" | "editor" | "preview";

export interface AppState {
  window: WindowBounds;
  splitter_ratio: number;
  view_mode: ViewMode;
  recent_files: string[];
  last_open_path: string | null;
}

export interface OpenFileResult {
  path: string;
  content: string;
}
```

- [ ] **Step 2: Create IPC wrapper**

Create `src/ipc.ts`:

```ts
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { AppState, Config, OpenFileResult } from "./types";

export const ipc = {
  readConfig: () => invoke<Config>("read_config"),
  readState: () => invoke<AppState>("read_state"),
  writeState: (s: AppState) => invoke<void>("write_state", { newState: s }),
  getRecentFiles: () => invoke<string[]>("get_recent_files"),
  removeRecentFile: (path: string) => invoke<void>("remove_recent_file", { path }),
  openFile: (path: string) => invoke<OpenFileResult>("open_file", { path }),
  saveFile: (path: string, content: string) => invoke<void>("save_file", { path, content }),
  stopWatching: () => invoke<void>("stop_watching"),
};

export const events = {
  onFileChangedExternally: (cb: (path: string) => void): Promise<UnlistenFn> =>
    listen<string>("file-changed-externally", (e) => cb(e.payload)),
};
```

- [ ] **Step 3: Commit**

```bash
git add src/types.ts src/ipc.ts
git commit -m "feat(frontend): IPC wrapper and shared types"
```

---

## Task 8: HTML shell and base CSS

**Files:**
- Create: `src/styles/app.css`
- Modify: `src/index.html`, `src/main.ts`
- Copy: `src/styles/github.css` from `node_modules/github-markdown-css/github-markdown.css`

- [ ] **Step 1: Copy github-markdown-css**

Run:

```bash
cp C:/Users/Shane/projects/madame/node_modules/github-markdown-css/github-markdown.css C:/Users/Shane/projects/madame/src/styles/github.css
```

- [ ] **Step 2: Create app.css**

Create `src/styles/app.css`:

```css
:root {
  --titlebar-bg: #1f1f1f;
  --titlebar-fg: #ccc;
  --titlebar-fg-muted: #888;
  --border: #e0e0e0;
  --editor-bg: #ffffff;
  --editor-fg: #202020;
  --preview-bg: #ffffff;
  --splitter-bg: #e5e5e5;
  --splitter-hover: #b0b0b0;
  --modal-overlay: rgba(0, 0, 0, 0.4);
  --modal-bg: #ffffff;
  --modal-border: #d0d0d0;
  --toast-bg: #222;
  --toast-fg: #fff;
}

@media (prefers-color-scheme: dark) {
  :root {
    --border: #333;
    --editor-bg: #1e1e1e;
    --editor-fg: #e4e4e4;
    --preview-bg: #0d1117;
    --splitter-bg: #333;
    --splitter-hover: #555;
    --modal-bg: #2a2a2a;
    --modal-border: #444;
  }
}

* { box-sizing: border-box; }
html, body { margin: 0; height: 100%; overflow: hidden; }
body {
  font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  color: var(--editor-fg);
  background: var(--editor-bg);
}

#app {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.titlebar {
  height: 30px;
  background: var(--titlebar-bg);
  color: var(--titlebar-fg);
  display: flex;
  align-items: center;
  padding: 0 10px;
  font-size: 12px;
  user-select: none;
  flex: 0 0 auto;
}
.titlebar .filename { flex: 1; }
.titlebar .dot {
  display: inline-block;
  width: 6px; height: 6px;
  border-radius: 50%;
  background: #f0883e;
  margin-right: 6px;
  visibility: hidden;
}
.titlebar.dirty .dot { visibility: visible; }
.titlebar .window-controls { display: flex; gap: 0; }
.titlebar .window-controls button {
  background: transparent;
  border: none;
  color: var(--titlebar-fg);
  width: 40px;
  height: 30px;
  font-size: 14px;
  cursor: pointer;
}
.titlebar .window-controls button:hover { background: #333; }
.titlebar .window-controls button.close:hover { background: #e81123; color: #fff; }

.panes {
  flex: 1;
  display: flex;
  min-height: 0;
}

.pane {
  flex: 1;
  min-width: 0;
  overflow: auto;
  background: var(--editor-bg);
}

.pane.editor-pane {
  display: flex;
}
.pane.editor-pane textarea {
  flex: 1;
  border: none;
  outline: none;
  resize: none;
  padding: 12px;
  font-family: "Consolas", "Menlo", "Monaco", monospace;
  font-size: 14px;
  line-height: 1.5;
  color: var(--editor-fg);
  background: var(--editor-bg);
}
.pane.editor-pane textarea.wrap { white-space: pre-wrap; word-break: break-word; }
.pane.editor-pane textarea.nowrap { white-space: pre; overflow-x: auto; }

.pane.preview-pane {
  background: var(--preview-bg);
  padding: 20px 28px;
}
.pane.preview-pane .markdown-body {
  max-width: 900px;
  margin: 0 auto;
  background: transparent;
}

.pane.hidden { display: none; }

.splitter {
  flex: 0 0 4px;
  background: var(--splitter-bg);
  cursor: col-resize;
}
.splitter:hover, .splitter.dragging { background: var(--splitter-hover); }

.modal-overlay {
  position: fixed; inset: 0;
  background: var(--modal-overlay);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 80px;
  z-index: 100;
}
.modal {
  background: var(--modal-bg);
  border: 1px solid var(--modal-border);
  border-radius: 6px;
  width: 500px;
  max-width: 90vw;
  max-height: 70vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  color: var(--editor-fg);
}
.modal input {
  border: none;
  border-bottom: 1px solid var(--modal-border);
  padding: 10px 12px;
  outline: none;
  background: transparent;
  color: inherit;
  font-size: 14px;
}
.modal ul {
  list-style: none;
  margin: 0; padding: 0;
  overflow-y: auto;
}
.modal li {
  padding: 8px 12px;
  cursor: pointer;
  font-size: 13px;
  border-bottom: 1px solid rgba(0,0,0,0.04);
}
.modal li:hover, .modal li.active { background: rgba(128,128,128,0.15); }

.confirm-modal {
  padding: 16px;
  width: 420px;
}
.confirm-modal p { margin: 0 0 16px 0; }
.confirm-modal .buttons { display: flex; gap: 8px; justify-content: flex-end; }
.confirm-modal button {
  padding: 6px 14px;
  border: 1px solid var(--modal-border);
  background: transparent;
  color: inherit;
  border-radius: 4px;
  cursor: pointer;
}
.confirm-modal button.primary { background: #0969da; color: #fff; border-color: #0969da; }
.confirm-modal button.danger { background: #cf222e; color: #fff; border-color: #cf222e; }

.toast {
  position: fixed;
  bottom: 20px; right: 20px;
  background: var(--toast-bg);
  color: var(--toast-fg);
  padding: 10px 14px;
  border-radius: 6px;
  font-size: 13px;
  z-index: 200;
  box-shadow: 0 4px 12px rgba(0,0,0,0.3);
}
```

- [ ] **Step 3: Update index.html**

Replace `src/index.html`:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Madame</title>
    <link rel="stylesheet" href="/styles/github.css" />
    <link rel="stylesheet" href="/styles/app.css" />
  </head>
  <body>
    <div id="app">
      <div class="titlebar" id="titlebar" data-tauri-drag-region>
        <span class="dot"></span>
        <span class="filename" data-tauri-drag-region>Untitled</span>
        <div class="window-controls">
          <button id="btn-min" title="Minimize">&#xE921;</button>
          <button id="btn-max" title="Maximize">&#xE922;</button>
          <button id="btn-close" class="close" title="Close">&#xE8BB;</button>
        </div>
      </div>
      <div class="panes" id="panes">
        <div class="pane editor-pane" id="editor-pane">
          <textarea id="editor" spellcheck="false" class="wrap"></textarea>
        </div>
        <div class="splitter" id="splitter"></div>
        <div class="pane preview-pane" id="preview-pane">
          <div class="markdown-body" id="preview"></div>
        </div>
      </div>
    </div>
    <script type="module" src="/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 4: Replace main.ts stub with placeholder wiring**

Replace `src/main.ts`:

```ts
import "./styles/github.css";
import "./styles/app.css";

const editor = document.getElementById("editor") as HTMLTextAreaElement;
const preview = document.getElementById("preview")!;
editor.value = "# Madame\n\nType here to see preview.";
preview.textContent = "(preview will render here)";
```

- [ ] **Step 5: Smoke test**

Run:

```bash
bun run tauri dev
```

Expected: window opens with dark titlebar showing "Untitled", two-pane split with editor containing sample text and right pane showing placeholder text. Close.

- [ ] **Step 6: Commit**

```bash
git add src/index.html src/main.ts src/styles/app.css src/styles/github.css
git commit -m "feat(frontend): HTML shell, base CSS, titlebar + panes layout"
```

---

## Task 9: Editor component

**Files:**
- Create: `src/editor.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: Create editor module**

Create `src/editor.ts`:

```ts
export interface Editor {
  getText(): string;
  setText(text: string): void;
  onChange(cb: (text: string) => void): void;
  focus(): void;
  applyConfig(cfg: { tab_size: number; tab_inserts_spaces: boolean; word_wrap: boolean; font_family: string | null; font_size: number }): void;
  getElement(): HTMLTextAreaElement;
  getVisibleTopLine(): number;
  scrollToLine(line: number): void;
}

export function createEditor(el: HTMLTextAreaElement): Editor {
  let tabSize = 2;
  let tabInsertsSpaces = true;

  const listeners: Array<(t: string) => void> = [];

  el.addEventListener("input", () => {
    const t = el.value;
    for (const cb of listeners) cb(t);
  });

  el.addEventListener("keydown", (e) => {
    if (e.key === "Tab" && !e.ctrlKey && !e.altKey && !e.metaKey) {
      e.preventDefault();
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const insert = tabInsertsSpaces ? " ".repeat(tabSize) : "\t";
      el.value = el.value.slice(0, start) + insert + el.value.slice(end);
      el.selectionStart = el.selectionEnd = start + insert.length;
      el.dispatchEvent(new Event("input"));
    }
  });

  return {
    getText: () => el.value,
    setText: (t) => {
      el.value = t;
      // Fire input so listeners update.
      el.dispatchEvent(new Event("input"));
    },
    onChange: (cb) => { listeners.push(cb); },
    focus: () => el.focus(),
    applyConfig(cfg) {
      tabSize = cfg.tab_size;
      tabInsertsSpaces = cfg.tab_inserts_spaces;
      el.classList.toggle("wrap", cfg.word_wrap);
      el.classList.toggle("nowrap", !cfg.word_wrap);
      if (cfg.font_family) el.style.fontFamily = cfg.font_family;
      el.style.fontSize = `${cfg.font_size}px`;
    },
    getElement: () => el,
    getVisibleTopLine() {
      const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 20;
      return Math.floor(el.scrollTop / lineHeight);
    },
    scrollToLine(line) {
      const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 20;
      el.scrollTop = line * lineHeight;
    },
  };
}
```

- [ ] **Step 2: Update main.ts to use editor**

Replace `src/main.ts`:

```ts
import "./styles/github.css";
import "./styles/app.css";
import { createEditor } from "./editor";

const editorEl = document.getElementById("editor") as HTMLTextAreaElement;
const previewEl = document.getElementById("preview")!;

const editor = createEditor(editorEl);
editor.setText("# Madame\n\nType here to see preview.");
editor.onChange((text) => {
  previewEl.textContent = `(${text.length} chars)`;
});
editor.focus();
```

- [ ] **Step 3: Smoke test**

Run `bun run tauri dev`. Expected: window opens; typing in editor updates right pane with character count. Tab key inserts 2 spaces. Close.

- [ ] **Step 4: Commit**

```bash
git add src/editor.ts src/main.ts
git commit -m "feat(frontend): editor component with tab handling"
```

---

## Task 10: Preview component (TDD)

**Files:**
- Create: `src/preview.ts`, `src/tests/preview.test.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: Write failing tests**

Create `src/tests/preview.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { createPreview } from "../preview";

describe("preview", () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  it("renders headings", () => {
    const p = createPreview(container);
    p.render("# Hello");
    expect(container.querySelector("h1")?.textContent).toContain("Hello");
  });

  it("renders GFM task lists as checkboxes", () => {
    const p = createPreview(container);
    p.render("- [x] done\n- [ ] pending");
    const checkboxes = container.querySelectorAll('input[type="checkbox"]');
    expect(checkboxes.length).toBe(2);
    expect((checkboxes[0] as HTMLInputElement).checked).toBe(true);
    expect((checkboxes[1] as HTMLInputElement).checked).toBe(false);
  });

  it("renders tables", () => {
    const p = createPreview(container);
    p.render("| A | B |\n|---|---|\n| 1 | 2 |");
    expect(container.querySelector("table")).toBeTruthy();
    expect(container.querySelectorAll("td").length).toBe(2);
  });

  it("renders strikethrough", () => {
    const p = createPreview(container);
    p.render("~~gone~~");
    expect(container.querySelector("s, del")).toBeTruthy();
  });

  it("applies highlight.js class to code blocks with language", () => {
    const p = createPreview(container);
    p.render("```js\nconst x = 1;\n```");
    const code = container.querySelector("pre code");
    expect(code?.className).toMatch(/hljs|language-js/);
  });

  it("annotates block elements with data-source-line", () => {
    const p = createPreview(container);
    p.render("# Line 1\n\nPara line 3\n");
    const withLines = container.querySelectorAll("[data-source-line]");
    expect(withLines.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
bun run test
```

Expected: FAIL with "Cannot find module '../preview'".

- [ ] **Step 3: Implement preview**

Create `src/preview.ts`:

```ts
import MarkdownIt from "markdown-it";
import taskLists from "markdown-it-task-lists";
import anchor from "markdown-it-anchor";
import hljs from "highlight.js";

export interface Preview {
  render(md: string, baseDir?: string): void;
  getElement(): HTMLElement;
  getFirstVisibleSourceLine(): number;
  scrollToSourceLine(line: number): void;
}

function createMdInstance(): MarkdownIt {
  const md = new MarkdownIt({
    html: false,
    linkify: true,
    typographer: false,
    breaks: false,
    highlight(str, lang) {
      if (lang && hljs.getLanguage(lang)) {
        try {
          return `<pre><code class="hljs language-${lang}">${hljs.highlight(str, { language: lang, ignoreIllegals: true }).value}</code></pre>`;
        } catch {}
      }
      return `<pre><code class="hljs">${md.utils.escapeHtml(str)}</code></pre>`;
    },
  });
  md.use(taskLists, { enabled: true });
  md.use(anchor, {});

  // Attach data-source-line to top-level block tokens for scroll sync.
  const originalRender = md.renderer.renderToken.bind(md.renderer);
  md.renderer.renderToken = function (tokens, idx, options) {
    const token = tokens[idx];
    if (token.map && token.level === 0 && token.nesting !== -1) {
      token.attrSet("data-source-line", String(token.map[0]));
    }
    return originalRender(tokens, idx, options);
  };
  return md;
}

export function createPreview(el: HTMLElement): Preview {
  const md = createMdInstance();
  let baseDirCache: string | undefined;

  function resolveImagePaths() {
    if (!baseDirCache) return;
    const imgs = el.querySelectorAll("img");
    imgs.forEach((img) => {
      const src = img.getAttribute("src") ?? "";
      if (/^(https?:|data:|\/|[a-zA-Z]:[\\/])/.test(src)) return;
      const sep = baseDirCache!.endsWith("/") || baseDirCache!.endsWith("\\") ? "" : "/";
      img.setAttribute("src", `${baseDirCache}${sep}${src}`);
    });
  }

  return {
    render(text, baseDir) {
      baseDirCache = baseDir;
      try {
        el.innerHTML = md.render(text);
        resolveImagePaths();
      } catch (err) {
        el.innerHTML = `<pre class="render-error">${String(err)}</pre><pre>${text}</pre>`;
      }
    },
    getElement: () => el,
    getFirstVisibleSourceLine() {
      const scroller = el.parentElement ?? el;
      const top = scroller.scrollTop;
      const nodes = el.querySelectorAll<HTMLElement>("[data-source-line]");
      let best = 0;
      for (const n of Array.from(nodes)) {
        if (n.offsetTop > top + 10) break;
        best = Number(n.getAttribute("data-source-line") ?? "0");
      }
      return best;
    },
    scrollToSourceLine(line) {
      const scroller = el.parentElement ?? el;
      const nodes = el.querySelectorAll<HTMLElement>("[data-source-line]");
      let target: HTMLElement | null = null;
      for (const n of Array.from(nodes)) {
        const l = Number(n.getAttribute("data-source-line") ?? "0");
        if (l <= line) target = n;
        else break;
      }
      if (target) scroller.scrollTop = target.offsetTop;
    },
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
bun run test
```

Expected: all six preview tests pass.

- [ ] **Step 5: Wire preview into main.ts**

Replace `src/main.ts`:

```ts
import "./styles/github.css";
import "./styles/app.css";
import "highlight.js/styles/github.css";
import { createEditor } from "./editor";
import { createPreview } from "./preview";

const editorEl = document.getElementById("editor") as HTMLTextAreaElement;
const previewEl = document.getElementById("preview") as HTMLElement;

const editor = createEditor(editorEl);
const preview = createPreview(previewEl);

function update(text: string) {
  preview.render(text);
}

editor.onChange(update);
editor.setText(
  "# Madame\n\nHello **world** — type to see live preview.\n\n- [x] it works\n- [ ] scroll sync\n\n```js\nconst x = 1;\n```",
);
editor.focus();
```

- [ ] **Step 6: Smoke test**

Run `bun run tauri dev`. Expected: right pane shows rendered markdown with a bold "world", checkboxes, and syntax-highlighted code block. Typing updates the preview.

- [ ] **Step 7: Commit**

```bash
git add src/preview.ts src/tests/preview.test.ts src/main.ts
git commit -m "feat(frontend): markdown preview with GFM + highlight.js"
```

---

## Task 11: Splitter component

**Files:**
- Create: `src/splitter.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: Create splitter**

Create `src/splitter.ts`:

```ts
export interface Splitter {
  setRatio(r: number): void;
  getRatio(): number;
  onResize(cb: (ratio: number) => void): void;
}

export function createSplitter(params: {
  container: HTMLElement;
  left: HTMLElement;
  right: HTMLElement;
  handle: HTMLElement;
}): Splitter {
  const { container, left, right, handle } = params;
  let ratio = 0.5;
  const listeners: Array<(r: number) => void> = [];

  function apply() {
    // Only set flex basis when both panes are visible.
    const leftVisible = !left.classList.contains("hidden");
    const rightVisible = !right.classList.contains("hidden");
    if (leftVisible && rightVisible) {
      left.style.flex = `${ratio} 1 0`;
      right.style.flex = `${1 - ratio} 1 0`;
    } else {
      left.style.flex = "";
      right.style.flex = "";
    }
  }

  handle.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    handle.classList.add("dragging");
    handle.setPointerCapture(e.pointerId);
    const rect = container.getBoundingClientRect();

    const onMove = (ev: PointerEvent) => {
      const x = ev.clientX - rect.left;
      const r = Math.max(0.1, Math.min(0.9, x / rect.width));
      ratio = r;
      apply();
      for (const cb of listeners) cb(r);
    };
    const onUp = () => {
      handle.releasePointerCapture(e.pointerId);
      handle.classList.remove("dragging");
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
    };
    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
  });

  apply();

  return {
    setRatio(r) { ratio = r; apply(); },
    getRatio: () => ratio,
    onResize(cb) { listeners.push(cb); },
  };
}
```

- [ ] **Step 2: Wire splitter into main.ts**

Replace `src/main.ts`:

```ts
import "./styles/github.css";
import "./styles/app.css";
import "highlight.js/styles/github.css";
import { createEditor } from "./editor";
import { createPreview } from "./preview";
import { createSplitter } from "./splitter";

const editorEl = document.getElementById("editor") as HTMLTextAreaElement;
const previewEl = document.getElementById("preview") as HTMLElement;
const editor = createEditor(editorEl);
const preview = createPreview(previewEl);

const splitter = createSplitter({
  container: document.getElementById("panes")!,
  left: document.getElementById("editor-pane")!,
  right: document.getElementById("preview-pane")!,
  handle: document.getElementById("splitter")!,
});
splitter.setRatio(0.5);

editor.onChange((t) => preview.render(t));
editor.setText(
  "# Madame\n\nDrag the handle between panes to resize.\n\n```js\nconst x = 1;\n```",
);
editor.focus();
```

- [ ] **Step 3: Smoke test**

Run `bun run tauri dev`. Expected: draggable divider; panes resize smoothly; can't drag past 10%/90% extremes.

- [ ] **Step 4: Commit**

```bash
git add src/splitter.ts src/main.ts
git commit -m "feat(frontend): splitter with drag-to-resize"
```

---

## Task 12: Titlebar component

**Files:**
- Create: `src/titlebar.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: Create titlebar**

Create `src/titlebar.ts`:

```ts
import { getCurrentWindow } from "@tauri-apps/api/window";

export interface Titlebar {
  setFilename(name: string): void;
  setDirty(dirty: boolean): void;
}

export function createTitlebar(el: HTMLElement): Titlebar {
  const filenameEl = el.querySelector<HTMLElement>(".filename")!;
  const minBtn = el.querySelector<HTMLButtonElement>("#btn-min")!;
  const maxBtn = el.querySelector<HTMLButtonElement>("#btn-max")!;
  const closeBtn = el.querySelector<HTMLButtonElement>("#btn-close")!;
  const win = getCurrentWindow();

  minBtn.addEventListener("click", () => win.minimize());
  maxBtn.addEventListener("click", () => win.toggleMaximize());
  closeBtn.addEventListener("click", () => win.close());

  function basename(p: string): string {
    const parts = p.split(/[\\/]/);
    return parts[parts.length - 1] || p;
  }

  return {
    setFilename(name) {
      filenameEl.textContent = name === "" ? "Untitled" : basename(name);
      filenameEl.title = name;
    },
    setDirty(dirty) {
      el.classList.toggle("dirty", dirty);
    },
  };
}
```

- [ ] **Step 2: Wire titlebar into main.ts**

Replace `src/main.ts`:

```ts
import "./styles/github.css";
import "./styles/app.css";
import "highlight.js/styles/github.css";
import { createEditor } from "./editor";
import { createPreview } from "./preview";
import { createSplitter } from "./splitter";
import { createTitlebar } from "./titlebar";

const editor = createEditor(document.getElementById("editor") as HTMLTextAreaElement);
const preview = createPreview(document.getElementById("preview") as HTMLElement);
const titlebar = createTitlebar(document.getElementById("titlebar")!);

const splitter = createSplitter({
  container: document.getElementById("panes")!,
  left: document.getElementById("editor-pane")!,
  right: document.getElementById("preview-pane")!,
  handle: document.getElementById("splitter")!,
});
splitter.setRatio(0.5);

titlebar.setFilename("");
let dirty = false;
editor.onChange((t) => {
  preview.render(t);
  if (!dirty) { dirty = true; titlebar.setDirty(true); }
});
editor.setText("# Madame\n");
// Reset dirty after initial programmatic setText.
dirty = false;
titlebar.setDirty(false);
editor.focus();
```

- [ ] **Step 3: Smoke test**

Run `bun run tauri dev`. Expected: custom dark titlebar with "Untitled", three window buttons work (minimize/maximize/close). Typing turns on the orange dot.

- [ ] **Step 4: Commit**

```bash
git add src/titlebar.ts src/main.ts
git commit -m "feat(frontend): custom titlebar with window controls"
```

---

## Task 13: Shortcuts registry (TDD)

**Files:**
- Create: `src/shortcuts.ts`, `src/tests/shortcuts.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/tests/shortcuts.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { createShortcuts } from "../shortcuts";

function keydown(key: string, mods: { ctrl?: boolean; shift?: boolean; alt?: boolean } = {}) {
  return new KeyboardEvent("keydown", {
    key,
    ctrlKey: !!mods.ctrl,
    shiftKey: !!mods.shift,
    altKey: !!mods.alt,
    bubbles: true,
    cancelable: true,
  });
}

describe("shortcuts", () => {
  it("fires registered handler on Ctrl+O", () => {
    const s = createShortcuts(window);
    const handler = vi.fn();
    s.on("ctrl+o", handler);
    window.dispatchEvent(keydown("o", { ctrl: true }));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("does not fire handler when modifier mismatch", () => {
    const s = createShortcuts(window);
    const handler = vi.fn();
    s.on("ctrl+s", handler);
    window.dispatchEvent(keydown("s", {}));
    expect(handler).not.toHaveBeenCalled();
  });

  it("distinguishes ctrl+s from ctrl+shift+s", () => {
    const s = createShortcuts(window);
    const save = vi.fn();
    const saveAs = vi.fn();
    s.on("ctrl+s", save);
    s.on("ctrl+shift+s", saveAs);
    window.dispatchEvent(keydown("s", { ctrl: true, shift: true }));
    expect(save).not.toHaveBeenCalled();
    expect(saveAs).toHaveBeenCalledTimes(1);
  });

  it("normalizes key case", () => {
    const s = createShortcuts(window);
    const handler = vi.fn();
    s.on("ctrl+R", handler);
    window.dispatchEvent(keydown("r", { ctrl: true }));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("prevents default when a handler runs", () => {
    const s = createShortcuts(window);
    s.on("ctrl+e", () => {});
    const ev = keydown("e", { ctrl: true });
    window.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify fail**

Run:

```bash
bun run test
```

Expected: FAIL with "Cannot find module '../shortcuts'".

- [ ] **Step 3: Implement shortcuts**

Create `src/shortcuts.ts`:

```ts
type Handler = () => void;

export interface Shortcuts {
  on(combo: string, handler: Handler): void;
}

function normalizeCombo(combo: string): string {
  const parts = combo.toLowerCase().split("+").map((s) => s.trim());
  const mods: string[] = [];
  let key = "";
  for (const p of parts) {
    if (p === "ctrl" || p === "shift" || p === "alt" || p === "meta") mods.push(p);
    else key = p;
  }
  mods.sort();
  return `${mods.join("+")}|${key}`;
}

function eventCombo(e: KeyboardEvent): string {
  const mods: string[] = [];
  if (e.ctrlKey) mods.push("ctrl");
  if (e.shiftKey) mods.push("shift");
  if (e.altKey) mods.push("alt");
  if (e.metaKey) mods.push("meta");
  mods.sort();
  return `${mods.join("+")}|${e.key.toLowerCase()}`;
}

export function createShortcuts(target: Window | HTMLElement): Shortcuts {
  const handlers = new Map<string, Handler>();

  target.addEventListener("keydown", ((e: KeyboardEvent) => {
    const key = eventCombo(e);
    const h = handlers.get(key);
    if (h) {
      e.preventDefault();
      h();
    }
  }) as EventListener);

  return {
    on(combo, handler) {
      handlers.set(normalizeCombo(combo), handler);
    },
  };
}
```

- [ ] **Step 4: Run tests to verify pass**

Run:

```bash
bun run test
```

Expected: all five shortcut tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/shortcuts.ts src/tests/shortcuts.test.ts
git commit -m "feat(frontend): keybinding registry"
```

---

## Task 14: Toast helper and confirmation modal

**Files:**
- Create: `src/toast.ts`, `src/confirm.ts`

- [ ] **Step 1: Create toast**

Create `src/toast.ts`:

```ts
export function toast(message: string, durationMs = 3000): void {
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => {
    el.remove();
  }, durationMs);
}
```

- [ ] **Step 2: Create confirm modal**

Create `src/confirm.ts`:

```ts
export interface ConfirmButton {
  label: string;
  value: string;
  kind?: "primary" | "danger" | "default";
}

export function confirm(message: string, buttons: ConfirmButton[]): Promise<string | null> {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    const modal = document.createElement("div");
    modal.className = "modal confirm-modal";
    const p = document.createElement("p");
    p.textContent = message;
    const btnRow = document.createElement("div");
    btnRow.className = "buttons";

    function esc(e: KeyboardEvent) {
      if (e.key === "Escape") close(null);
    }

    function close(value: string | null) {
      document.removeEventListener("keydown", esc);
      overlay.remove();
      resolve(value);
    }

    for (const b of buttons) {
      const btn = document.createElement("button");
      btn.textContent = b.label;
      if (b.kind === "primary") btn.classList.add("primary");
      if (b.kind === "danger") btn.classList.add("danger");
      btn.addEventListener("click", () => close(b.value));
      btnRow.appendChild(btn);
    }

    overlay.addEventListener("click", (e) => { if (e.target === overlay) close(null); });
    document.addEventListener("keydown", esc);

    modal.appendChild(p);
    modal.appendChild(btnRow);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add src/toast.ts src/confirm.ts
git commit -m "feat(frontend): toast and confirm modal helpers"
```

---

## Task 15: Recent files modal

**Files:**
- Create: `src/recent.ts`

- [ ] **Step 1: Create recent modal**

Create `src/recent.ts`:

```ts
export function showRecentModal(files: string[]): Promise<string | null> {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    const modal = document.createElement("div");
    modal.className = "modal";
    const input = document.createElement("input");
    input.placeholder = files.length === 0 ? "No recent files" : "Filter recent files...";
    input.disabled = files.length === 0;
    const list = document.createElement("ul");

    let filtered = files.slice();
    let active = 0;

    function basename(p: string): string {
      const parts = p.split(/[\\/]/);
      return parts[parts.length - 1] || p;
    }

    function render() {
      list.innerHTML = "";
      filtered.forEach((path, i) => {
        const li = document.createElement("li");
        li.textContent = `${basename(path)}   —   ${path}`;
        if (i === active) li.classList.add("active");
        li.addEventListener("click", () => close(path));
        list.appendChild(li);
      });
    }

    function close(value: string | null) {
      overlay.remove();
      resolve(value);
    }

    input.addEventListener("input", () => {
      const q = input.value.toLowerCase();
      filtered = files.filter((p) => p.toLowerCase().includes(q));
      active = 0;
      render();
    });

    input.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") { e.preventDefault(); active = Math.min(active + 1, filtered.length - 1); render(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); active = Math.max(active - 1, 0); render(); }
      else if (e.key === "Enter") { e.preventDefault(); if (filtered[active]) close(filtered[active]); }
      else if (e.key === "Escape") { e.preventDefault(); close(null); }
    });

    overlay.addEventListener("click", (e) => { if (e.target === overlay) close(null); });

    modal.appendChild(input);
    modal.appendChild(list);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    render();
    input.focus();
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/recent.ts
git commit -m "feat(frontend): recent files quick-pick modal"
```

---

## Task 16: Scroll sync (TDD)

**Files:**
- Create: `src/scroll-sync.ts`, `src/tests/scroll-sync.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/tests/scroll-sync.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { createScrollSync } from "../scroll-sync";

function mockEditor() {
  let top = 0;
  const listeners: Array<() => void> = [];
  return {
    getVisibleTopLine: () => Math.floor(top / 20),
    scrollToLine: vi.fn((line: number) => { top = line * 20; }),
    getElement() {
      const el = document.createElement("div") as any;
      el.addEventListener = (_e: string, fn: () => void) => { if (_e === "scroll") listeners.push(fn); };
      return el;
    },
    fireScroll(newTop: number) { top = newTop; listeners.forEach((f) => f()); },
  };
}

function mockPreview() {
  let line = 0;
  const listeners: Array<() => void> = [];
  return {
    getFirstVisibleSourceLine: () => line,
    scrollToSourceLine: vi.fn((l: number) => { line = l; }),
    getElement() {
      const el = document.createElement("div") as any;
      el.parentElement = { addEventListener: (_e: string, fn: () => void) => { if (_e === "scroll") listeners.push(fn); } };
      return el;
    },
    fireScroll(newLine: number) { line = newLine; listeners.forEach((f) => f()); },
  };
}

describe("scroll-sync", () => {
  it("syncs editor scroll to preview", () => {
    const ed = mockEditor();
    const pv = mockPreview();
    createScrollSync(ed as any, pv as any);
    ed.fireScroll(200); // line 10
    expect(pv.scrollToSourceLine).toHaveBeenCalledWith(10);
  });

  it("syncs preview scroll to editor", () => {
    const ed = mockEditor();
    const pv = mockPreview();
    createScrollSync(ed as any, pv as any);
    pv.fireScroll(7);
    expect(ed.scrollToLine).toHaveBeenCalledWith(7);
  });

  it("suppresses feedback loop within 50ms window", async () => {
    const ed = mockEditor();
    const pv = mockPreview();
    createScrollSync(ed as any, pv as any);
    ed.fireScroll(200); // editor → preview (line 10)
    expect(pv.scrollToSourceLine).toHaveBeenCalledTimes(1);
    // Preview scroll event fires as a consequence — must not bounce back.
    pv.fireScroll(10);
    expect(ed.scrollToLine).not.toHaveBeenCalled();
  });

  it("can be disabled", () => {
    const ed = mockEditor();
    const pv = mockPreview();
    const sync = createScrollSync(ed as any, pv as any);
    sync.setEnabled(false);
    ed.fireScroll(200);
    expect(pv.scrollToSourceLine).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify fail**

Run `bun run test`. Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement scroll-sync**

Create `src/scroll-sync.ts`:

```ts
import type { Editor } from "./editor";
import type { Preview } from "./preview";

export interface ScrollSync {
  setEnabled(on: boolean): void;
}

export function createScrollSync(editor: Editor, preview: Preview): ScrollSync {
  let enabled = true;
  let suppressUntil = 0;

  const suppressMs = 50;
  const now = () => performance.now();

  editor.getElement().addEventListener("scroll", () => {
    if (!enabled) return;
    if (now() < suppressUntil) return;
    suppressUntil = now() + suppressMs;
    const line = editor.getVisibleTopLine();
    preview.scrollToSourceLine(line);
  });

  const previewScroller = preview.getElement().parentElement ?? preview.getElement();
  previewScroller.addEventListener("scroll", () => {
    if (!enabled) return;
    if (now() < suppressUntil) return;
    suppressUntil = now() + suppressMs;
    const line = preview.getFirstVisibleSourceLine();
    editor.scrollToLine(line);
  });

  return {
    setEnabled(on) { enabled = on; },
  };
}
```

- [ ] **Step 4: Run tests to verify pass**

Run `bun run test`. Expected: all four scroll-sync tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/scroll-sync.ts src/tests/scroll-sync.test.ts
git commit -m "feat(frontend): bidirectional scroll sync with feedback suppression"
```

---

## Task 17: Main orchestration — file lifecycle

**Files:**
- Modify: `src/main.ts`

- [ ] **Step 1: Replace main.ts with full orchestration**

Replace `src/main.ts`:

```ts
import "./styles/github.css";
import "./styles/app.css";
import "highlight.js/styles/github.css";

import { open as dialogOpen, save as dialogSave, message as dialogMessage } from "@tauri-apps/plugin-dialog";
import { getCurrentWindow } from "@tauri-apps/api/window";

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

// --- Element refs ---
const panesEl = document.getElementById("panes")!;
const editorPaneEl = document.getElementById("editor-pane")!;
const previewPaneEl = document.getElementById("preview-pane")!;
const splitterEl = document.getElementById("splitter")!;
const editor = createEditor(document.getElementById("editor") as HTMLTextAreaElement);
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
  config = await ipc.readConfig();
  appState = await ipc.readState();

  editor.applyConfig(config.editor);
  titlebar.setFilename("");

  // Splitter
  const splitter = createSplitter({
    container: panesEl,
    left: editorPaneEl,
    right: previewPaneEl,
    handle: splitterEl,
  });
  splitter.setRatio(appState.splitter_ratio || 0.5);
  splitter.onResize((r) => {
    appState.splitter_ratio = r;
    void ipc.writeState(appState);
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

  // Shortcuts
  shortcuts.on("ctrl+o", () => void openDialog());
  shortcuts.on("ctrl+s", () => void saveCurrent());
  shortcuts.on("ctrl+shift+s", () => void saveAs());
  shortcuts.on("ctrl+r", () => void showRecent());
  shortcuts.on("ctrl+e", () => applyViewMode(viewMode === "editor" ? "both" : "editor"));
  shortcuts.on("ctrl+shift+e", () => applyViewMode(viewMode === "preview" ? "both" : "preview"));

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

  // Close guard
  const appWin = getCurrentWindow();
  await appWin.onCloseRequested(async (e) => {
    const res = await promptUnsavedIfDirty();
    if (res === "cancel") e.preventDefault();
  });

  // Open last file if present.
  if (appState.last_open_path) {
    await openPath(appState.last_open_path);
  } else {
    editor.setText("# Madame\n\nWelcome. Ctrl+O to open a file.\n");
    setDirty(false);
  }
  editor.focus();
})();
```

- [ ] **Step 2: Smoke test — golden path**

Run `bun run tauri dev`. Manually verify:

- Ctrl+O opens file picker; selecting an `.md` file loads it, titlebar shows the name, preview renders.
- Typing turns on the dot; preview updates after ~100ms.
- Ctrl+S saves; dot clears.
- Ctrl+Shift+S prompts for new path and saves there.
- Ctrl+R opens recent-files modal; arrow keys + Enter select; Escape dismisses.
- Ctrl+E hides the editor pane (preview-only); Ctrl+E again restores. Ctrl+Shift+E toggles editor-only.
- Scroll sync: scroll long document — preview follows editor and vice versa.
- Drag splitter — position persists across restarts.
- Close with unsaved changes — prompt appears.
- External modify (edit the file in VS Code while open) — reload prompt / silent reload.

Fix any issues found; iterate until the golden path works.

- [ ] **Step 3: Commit**

```bash
git add src/main.ts
git commit -m "feat(frontend): wire up file lifecycle, shortcuts, scroll sync, view modes"
```

---

## Task 18: Drag-and-drop and CLI argument

**Files:**
- Modify: `src-tauri/src/main.rs`, `src/main.ts`, `src-tauri/tauri.conf.json`

- [ ] **Step 1: Emit CLI-arg path on startup from Rust**

Edit `src-tauri/src/main.rs` — inside the `setup` closure, after `app.manage(...)`, add:

```rust
            // Emit CLI-arg path to frontend after webview is ready.
            let args: Vec<String> = std::env::args().skip(1).collect();
            if let Some(arg_path) = args.into_iter().find(|a| !a.starts_with("--")) {
                let handle = app.handle().clone();
                tauri::async_runtime::spawn(async move {
                    // Give the frontend a moment to register its listener.
                    tokio::time::sleep(std::time::Duration::from_millis(300)).await;
                    let _ = handle.emit("cli-open-path", arg_path);
                });
            }
```

Also add `use tauri::Emitter;` near the top of `main.rs` (keep existing `use tauri::Manager;`).

Add `tokio = { version = "1", features = ["time"] }` to `src-tauri/Cargo.toml` `[dependencies]`.

- [ ] **Step 2: Listen for CLI-arg and drag-drop events in frontend**

Edit `src/ipc.ts` — add to the `events` object:

```ts
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
// ... existing code ...

export const events = {
  onFileChangedExternally: (cb: (path: string) => void): Promise<UnlistenFn> =>
    listen<string>("file-changed-externally", (e) => cb(e.payload)),

  onCliOpenPath: (cb: (path: string) => void): Promise<UnlistenFn> =>
    listen<string>("cli-open-path", (e) => cb(e.payload)),
};
```

- [ ] **Step 3: Enable window drag-drop in tauri.conf.json**

Edit `src-tauri/tauri.conf.json` — in the window object, add:

```json
"dragDropEnabled": true
```

Full windows entry:

```json
"windows": [
  {
    "title": "Madame",
    "width": 1200,
    "height": 800,
    "decorations": false,
    "transparent": false,
    "fullscreen": false,
    "resizable": true,
    "dragDropEnabled": true
  }
]
```

- [ ] **Step 4: Handle drag-drop and CLI-arg in main.ts**

Edit `src/main.ts` — in the boot IIFE, after the close-guard handler and before the "Open last file" block:

```ts
  // CLI-arg path
  await events.onCliOpenPath((p) => void openPath(p));

  // Drag-and-drop file to open (webview-level event in Tauri 2)
  const { getCurrentWebview } = await import("@tauri-apps/api/webview");
  await getCurrentWebview().onDragDropEvent(async (e) => {
    if (e.payload.type !== "drop") return;
    const paths = e.payload.paths;
    if (paths.length === 0) return;
    await openPath(paths[0]);
  });
```

- [ ] **Step 5: Smoke test**

1. CLI arg: run `bun run tauri dev -- -- C:/path/to/some.md` — file should open on launch.
   (Or run the release exe with a path arg.)
2. Drag and drop: drag an `.md` file from the file explorer onto the window — should open.
3. Drop non-text file — behavior: opens, shows content as text. If binary, content will be garbled but app won't crash. Acceptable for v1 — tighten later.

- [ ] **Step 6: Commit**

```bash
git add src-tauri/Cargo.toml src-tauri/src/main.rs src-tauri/tauri.conf.json src/ipc.ts src/main.ts
git commit -m "feat: CLI-arg opening and drag-drop support"
```

---

## Task 19: Window bounds persistence

**Files:**
- Modify: `src/main.ts`

- [ ] **Step 1: Restore window bounds on startup, persist on change**

Edit `src/main.ts` — inside the boot IIFE, after `config = await ipc.readConfig(); appState = await ipc.readState();`, add:

```ts
  // Restore window bounds if remembered
  if (config.ui.remember_window && appState.window) {
    const w = appState.window;
    const win = getCurrentWindow();
    const { LogicalSize, LogicalPosition } = await import("@tauri-apps/api/dpi");
    await win.setSize(new LogicalSize(w.width, w.height));
    if (w.x !== null && w.y !== null) {
      await win.setPosition(new LogicalPosition(w.x, w.y));
    }
    if (w.maximized) await win.maximize();
  }
```

And at the end of the boot IIFE, before the final line:

```ts
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
```

- [ ] **Step 2: Smoke test**

Run `bun run tauri dev`. Resize window, move it, close. Reopen — window should restore to same size/position. Maximize, close, reopen — should restore maximized.

- [ ] **Step 3: Commit**

```bash
git add src/main.ts
git commit -m "feat(frontend): persist and restore window bounds"
```

---

## Task 20: Production build and portable binary

**Files:**
- Modify: `src-tauri/tauri.conf.json`
- Create: `src-tauri/icons/*`

- [ ] **Step 1: Generate placeholder icons**

Create a simple placeholder PNG (a solid-color 1024x1024 square is fine for v1). On Windows, you can use Paint, or any image editor. Save as `src-tauri/icons/source.png`.

Then generate the set Tauri expects:

```bash
cd C:/Users/Shane/projects/madame
bun run tauri icon src-tauri/icons/source.png
```

Expected: creates `src-tauri/icons/32x32.png`, `128x128.png`, `icon.ico`, `icon.icns`, plus platform-specific iOS/Android assets (ignore).

- [ ] **Step 2: Enable bundling**

Edit `src-tauri/tauri.conf.json` — flip `bundle.active` to `true`:

```json
"bundle": {
  "active": true,
  "targets": "all",
  "icon": ["icons/32x32.png", "icons/128x128.png", "icons/icon.ico", "icons/icon.icns"]
}
```

- [ ] **Step 3: Verify raw binary output**

Run:

```bash
bun run tauri build
```

Expected: build completes; look under `src-tauri/target/release/` for `madame.exe`. The NSIS installer will also be at `src-tauri/target/release/bundle/nsis/`.

- [ ] **Step 4: Smoke test release binary**

Run the raw binary:

```bash
./src-tauri/target/release/madame.exe
```

Expected: window opens, behaves exactly like dev mode. Close.

Copy `madame.exe` to a different directory (e.g., `C:/tmp/madame-test/`). Run it from there. Expected: works standalone; creates `madame.yaml` next to itself on first launch.

- [ ] **Step 5: Confirm madame.yaml location**

After running from `C:/tmp/madame-test/`, verify `C:/tmp/madame-test/madame.yaml` exists and contains default values. Edit it (e.g., change `debounce_ms: 500`), relaunch, verify preview-update delay changed.

- [ ] **Step 6: Run full smoke checklist**

Execute the checklist from the design spec (section 10.3):

- [ ] Open via Ctrl+O
- [ ] Open via drag-drop
- [ ] Open via CLI arg: `./madame.exe path/to/file.md`
- [ ] Open via Ctrl+R recent
- [ ] Edit → preview updates
- [ ] Scroll sync both directions
- [ ] Save / Save As / unsaved-prompt on close
- [ ] External modify → reload prompt
- [ ] Splitter drag + persistence across restart
- [ ] Toggle editor-only (Ctrl+E) and preview-only (Ctrl+Shift+E)
- [ ] Config edits in `madame.yaml` take effect on next launch
- [ ] Large file (~5MB markdown) typing responsive

- [ ] **Step 7: Commit any fixes**

If any smoke test failed, fix inline and commit:

```bash
git add <fixed-files>
git commit -m "fix: <issue>"
```

If all passed, tag v0.1.0:

```bash
git tag v0.1.0
```

---

## Self-Review Checklist

Before handing off, verify:

- [ ] **Spec coverage** — every core requirement in `docs/plans/2026-04-23-madame-design.md` §2 is implemented.
  - [ ] Two-pane layout with splitter (Tasks 8, 11)
  - [ ] Live preview with configurable debounce (Tasks 10, 17)
  - [ ] Raw monospace textarea, word wrap, no source-side highlighting (Tasks 8, 9)
  - [ ] GitHub-style preview with GFM + highlight.js (Task 10)
  - [ ] Bidirectional scroll sync (Task 16)
  - [ ] Single file + recent files modal (Tasks 15, 17)
  - [ ] Minimal chrome: custom dark titlebar (Tasks 8, 12)
  - [ ] Ctrl+O / Ctrl+S / Ctrl+Shift+S / Ctrl+R / Ctrl+E / Ctrl+Shift+E (Task 17)
  - [ ] Drag-and-drop file to open (Task 18)
  - [ ] Unsaved-changes prompts (Task 17)
  - [ ] External change detection (Tasks 5, 6, 17)
  - [ ] Relative image paths (Task 10)
  - [ ] OS theme via `prefers-color-scheme` (Task 8)
  - [ ] Portable exe (Task 20)

- [ ] **madame.yaml / state.json split** — preferences next to binary, state in app-data (Tasks 3, 4, 6)
- [ ] **All Rust unit tests pass** — config, state
- [ ] **All frontend unit tests pass** — preview, shortcuts, scroll-sync
- [ ] **Manual smoke checklist passes** (Task 20 Step 4)
