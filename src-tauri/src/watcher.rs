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
