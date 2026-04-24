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
