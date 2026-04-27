#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod config;
mod error;
mod state;
mod watcher;

use std::path::PathBuf;
use std::sync::Mutex;
use tauri::Manager;

#[cfg(any(target_os = "macos", target_os = "ios"))]
use tauri::Emitter;

fn main() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            // Portable: both madame.yaml and state.json live next to the binary,
            // so each copy of the exe is an independent, self-contained instance.
            let exe_dir = std::env::current_exe()
                .ok()
                .and_then(|p| p.parent().map(|p| p.to_path_buf()))
                .unwrap_or_else(|| std::path::PathBuf::from("."));
            let config_path = exe_dir.join("madame_config.yaml");
            let state_path = exe_dir.join("editor_state.json");

            let config = config::load_or_default(&config_path).unwrap_or_default();
            let app_state = state::load_or_default(&state_path);

            // On Windows/Linux, file associations launch the binary with the
            // path as argv. macOS delivers it via RunEvent::Opened instead.
            let argv_path: Option<PathBuf> = std::env::args()
                .skip(1)
                .find(|a| !a.starts_with("--"))
                .map(PathBuf::from);

            app.manage(commands::AppCtx {
                state_path,
                config: Mutex::new(config),
                state: Mutex::new(app_state),
                watcher: Mutex::new(watcher::FileWatcher::new()),
                open_queue: Mutex::new(commands::OpenQueue {
                    pending: argv_path.into_iter().collect(),
                    frontend_ready: false,
                }),
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
            commands::take_pending_open_paths,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|_app_handle, _event| {
        // macOS/iOS deliver file-association opens (initial launch and while
        // running) as RunEvent::Opened. If the frontend isn't ready yet, queue
        // the path; otherwise emit an event the registered listener will catch.
        #[cfg(any(target_os = "macos", target_os = "ios"))]
        if let tauri::RunEvent::Opened { urls } = _event {
            let ctx = _app_handle.state::<commands::AppCtx>();
            for url in &urls {
                let Ok(path) = url.to_file_path() else { continue };
                let mut q = ctx.open_queue.lock().unwrap();
                if q.frontend_ready {
                    drop(q);
                    let _ = _app_handle
                        .emit("cli-open-path", path.to_string_lossy().to_string());
                } else {
                    q.pending.push(path);
                }
            }
        }
    });
}
