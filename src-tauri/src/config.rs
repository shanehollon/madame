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
    pub editor_position: String,
}

impl Default for UiConfig {
    fn default() -> Self {
        Self {
            theme: "system".to_string(),
            remember_window: true,
            editor_position: "right".to_string(),
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

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(default)]
pub struct KeybindingsConfig {
    pub open_file: String,
    pub save: String,
    pub save_as: String,
    pub recent_files: String,
    pub toggle_editor_only: String,
    pub toggle_preview_only: String,
}

impl Default for KeybindingsConfig {
    fn default() -> Self {
        Self {
            open_file: "ctrl+o".to_string(),
            save: "ctrl+s".to_string(),
            save_as: "ctrl+shift+s".to_string(),
            recent_files: "ctrl+r".to_string(),
            toggle_editor_only: "ctrl+e".to_string(),
            toggle_preview_only: "ctrl+shift+e".to_string(),
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
    pub keybindings: KeybindingsConfig,
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
