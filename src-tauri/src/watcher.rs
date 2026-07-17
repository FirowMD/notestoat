use notify::{Event, RecursiveMode, Watcher};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{Emitter, Manager};

pub struct WatcherState {
    watchers: HashMap<String, notify::RecommendedWatcher>,
}

impl WatcherState {
    pub fn new() -> Self {
        Self {
            watchers: HashMap::new(),
        }
    }
}

#[tauri::command]
pub fn watch_file(path: String, window: tauri::Window) -> Result<(), String> {
    let state = window.app_handle().state::<Mutex<WatcherState>>();
    let mut state = state.lock().map_err(|error| error.to_string())?;

    if state.watchers.contains_key(&path) {
        return Ok(());
    }

    let window_clone = window.clone();
    let mut watcher =
        notify::recommended_watcher(move |result: Result<Event, notify::Error>| match result {
            Ok(event) if matches!(event.kind, notify::EventKind::Modify(_)) => {
                if let Some(path) = event.paths.first() {
                    let _ = window_clone.emit("file-changed", path.to_string_lossy().as_ref());
                }
            }
            Ok(_) => {}
            Err(error) => eprintln!("Watch error: {error:?}"),
        })
        .map_err(|error| error.to_string())?;

    watcher
        .watch(&PathBuf::from(&path), RecursiveMode::NonRecursive)
        .map_err(|error| error.to_string())?;
    state.watchers.insert(path, watcher);
    Ok(())
}

#[tauri::command]
pub fn unwatch_file(path: String, window: tauri::Window) -> Result<(), String> {
    let state = window.app_handle().state::<Mutex<WatcherState>>();
    state
        .lock()
        .map_err(|error| error.to_string())?
        .watchers
        .remove(&path);
    Ok(())
}
