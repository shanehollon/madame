use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, State};

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
