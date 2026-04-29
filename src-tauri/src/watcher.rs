use notify::{recommended_watcher, Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use crate::error::{AppError, Result};

pub struct FileWatcher {
    watcher: Option<RecommendedWatcher>,
    current_path: Arc<Mutex<Option<PathBuf>>>,
    suppress_until: Arc<Mutex<Option<Instant>>>,
}

impl FileWatcher {
    pub fn new() -> Self {
        Self {
            watcher: None,
            current_path: Arc::new(Mutex::new(None)),
            suppress_until: Arc::new(Mutex::new(None)),
        }
    }

    /// Watch a single file. On modify events, call `on_change(path)`.
    /// Any previously-watched path is dropped first.
    pub fn watch<F>(&mut self, path: &Path, on_change: F) -> Result<()>
    where
        F: Fn(PathBuf) + Send + 'static,
    {
        self.unwatch();

        let suppress_until = self.suppress_until.clone();
        let current_path = self.current_path.clone();
        let target = path.to_path_buf();

        let mut watcher = recommended_watcher(move |res: std::result::Result<Event, notify::Error>| {
            let Ok(event) = res else { return };
            if !matches!(event.kind, EventKind::Modify(_) | EventKind::Create(_)) {
                return;
            }
            if let Some(until) = *suppress_until.lock().unwrap() {
                if Instant::now() < until {
                    return;
                }
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

    /// Ignore events for `duration` from now. Call this immediately before
    /// writing the watched file: `notify` delivers FS events asynchronously
    /// on a background thread, so an instantaneous pause/resume around the
    /// write doesn't cover the event when it actually arrives.
    pub fn suppress_for(&self, duration: Duration) {
        *self.suppress_until.lock().unwrap() = Some(Instant::now() + duration);
    }
}

impl Default for FileWatcher {
    fn default() -> Self {
        Self::new()
    }
}
