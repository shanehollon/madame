# Contributing

Madame is a Tauri 2 app — a TypeScript frontend (`src/`) talking to a Rust backend (`src-tauri/`). This doc covers everything you need to build it from source.

## Repo layout

| Path | What's there |
| --- | --- |
| `src/` | Vite TS frontend ([README](src/README.md)) |
| `src-tauri/` | Rust backend + Tauri config ([README](src-tauri/README.md)) |
| `nix/` | Flake-based dev shell + package definition |
| `scripts/` | One-off build helpers |
| `docs/` | Maintainer docs (e.g. [RELEASING.md](docs/RELEASING.md)) |
| `.github/workflows/` | CI + release pipelines |

## Toolchain

- [Rust](https://rustup.rs) (stable) with `cargo`.
- [Bun](https://bun.sh) for the frontend package manager and script runner.

## Prerequisites

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

**Linux (Nix)**
```bash
nix develop github:shanehollon/madame   # drops you in a Tauri-capable shell
```
Then `cd src-tauri && cargo tauri build` from inside the shell.

## Commands

Same on every platform:

```bash
bun install
bun run tauri dev       # dev with hot reload
bun run tauri build     # release build
bun run test            # frontend tests (vitest)
```

Build artifacts land under `src-tauri/target/release/` — see [src-tauri/README.md](src-tauri/README.md#build-artifacts) for the per-platform output table.

## Distribution

Madame is deliberately shipped as a single standalone binary — no installers. The raw executable (or on macOS, a single `.app` bundle) goes anywhere you want it, and config/state files sit next to it. Installer outputs (`.msi`, `.nsis`, `.dmg`, `.deb`, `.rpm`, `.appimage`) are disabled in `src-tauri/tauri.conf.json`.

## Going deeper

- Frontend internals: [src/README.md](src/README.md)
- Backend internals: [src-tauri/README.md](src-tauri/README.md)
- Cutting a release: [docs/RELEASING.md](docs/RELEASING.md)
