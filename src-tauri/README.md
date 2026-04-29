# src-tauri (Rust backend)

The Tauri 2 backend: app setup, command handlers, config/state persistence, and the file watcher.

## File map

```
src-tauri/
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

## Crate dependencies

- `tauri`, `tauri-build`, `tauri-plugin-dialog`, `tauri-plugin-fs`.
- `serde`, `serde_json`, `serde_yaml` — config/state serialization.
- `notify` — filesystem watcher.
- `tokio` — async runtime (used for CLI-arg emit timing).
- `thiserror` — error derives.

## Tauri config

- `tauri.conf.json` — app identifier, window defaults, bundle settings. Installer outputs (`.msi`, `.nsis`, `.dmg`, `.deb`, `.rpm`, `.appimage`) are deliberately disabled — Madame ships as a single standalone binary.
- `tauri.macos.conf.json` — macOS-only overrides that produce a native `.app` bundle with system traffic-light controls.
- `capabilities/` — Tauri ACL declaring which IPC commands and plugin APIs the frontend may call.

## Build artifacts

`bun run tauri build` (run from the repo root) lands its output under `src-tauri/target/release/`:

| Platform | File | Notes |
| --- | --- | --- |
| Windows | `madame.exe` | Drop into any folder; self-contained. |
| macOS   | `bundle/macos/Madame.app` | Drag anywhere (Applications, Desktop, etc.). The macOS-specific config in `tauri.macos.conf.json` produces the double-clickable bundle. |
| Linux   | `madame` | Standalone ELF. Make sure it's executable (`chmod +x`) after moving. |

On first run, `madame_config.yaml` and `editor_state.json` are created next to the binary (or inside `Madame.app/Contents/MacOS/` on macOS) — so every copy is its own independent instance.

> **Note:** because state lives next to the binary, don't put `madame.exe` in a write-protected location (e.g. `C:\Program Files\`). The first-run state write will fail with `Access is denied`.

For build prerequisites and commands, see [`../CONTRIBUTING.md`](../CONTRIBUTING.md).
