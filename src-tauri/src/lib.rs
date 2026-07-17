use chrono::Local;
use std::sync::Mutex;
use tauri::{Emitter, Manager};

mod config;
mod files;
mod process;
mod themes;
mod watcher;

use config::{ConfigManager, Storage};

fn collect_startup_files() -> (Vec<String>, bool, String) {
    let mut files = Vec::new();
    let mut skip_single_instance = false;
    let mut instance_id = String::from("main");

    for argument in std::env::args().skip(1) {
        if argument == "--no-single-instance" {
            skip_single_instance = true;
            instance_id = format!("instance_{}", Local::now().format("%Y%m%d_%H%M%S_%3f"));
            continue;
        }

        if let Ok(path) = std::fs::canonicalize(argument) {
            if path.is_file() {
                files.push(path.to_string_lossy().into_owned());
            }
        }
    }

    (files, skip_single_instance, instance_id)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let (startup_files, skip_single_instance, instance_id) = collect_startup_files();
    let mut builder = tauri::Builder::default();

    #[cfg(desktop)]
    if !skip_single_instance {
        builder = builder.plugin(tauri_plugin_single_instance::init(
            |app, arguments, _cwd| {
                let mut files_to_open = Vec::new();

                for argument in arguments.iter().skip(1) {
                    if argument == "--no-single-instance" {
                        continue;
                    }
                    if let Ok(path) = std::fs::canonicalize(argument) {
                        if path.is_file() {
                            files_to_open.push(path.to_string_lossy().into_owned());
                        }
                    }
                }

                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.set_focus();
                    let _ = window.emit("files-updated", files_to_open);
                }
            },
        ));
    }

    let app = builder
        .manage(Mutex::new(watcher::WatcherState::new()))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(Storage::with_instance_id(instance_id.clone()))
        .setup(move |app| {
            let handle = app.handle();
            ConfigManager::set_instance_id(handle, instance_id).map_err(std::io::Error::other)?;
            themes::ensure_default_theme_file(handle).map_err(std::io::Error::other)?;
            ConfigManager::load_config(handle).map_err(std::io::Error::other)?;

            for path in startup_files {
                ConfigManager::add_to_opened_files(handle, path).map_err(std::io::Error::other)?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            config::get_config,
            config::load_config,
            config::save_config,
            files::read_file,
            files::save_file,
            files::rename_file,
            files::delete_file,
            process::run_explorer,
            process::open_in_new_window,
            process::check_admin_privileges,
            process::relaunch_as_admin,
            watcher::watch_file,
            watcher::unwatch_file,
            themes::get_monaco_themes,
            themes::read_monaco_theme
        ]);

    app.run(tauri::generate_context!())
        .expect("error while running tauri application");
}
