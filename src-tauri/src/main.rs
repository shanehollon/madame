#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod config;
mod error;
mod state;
mod watcher;

use std::sync::Mutex;
use tauri::{Emitter, Manager};

fn main() {
    tauri::Builder::default()
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

            app.manage(commands::AppCtx {
                config_path,
                state_path,
                config: Mutex::new(config),
                state: Mutex::new(app_state),
                watcher: Mutex::new(watcher::FileWatcher::new()),
            });

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
