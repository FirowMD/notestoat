use crate::config::ConfigManager;
use std::fs;
use std::path::Path;
use tauri::path::BaseDirectory;
use tauri::Manager;

const FIROW_THEME_BUNDLED: &str = include_str!("../../static/Firow.json");
const BUILT_IN_THEMES: [&str; 3] = ["vs", "vs-dark", "hc-black"];

fn is_valid_theme_name(theme_name: &str) -> bool {
    !theme_name.is_empty()
        && !theme_name.contains("..")
        && !theme_name.contains(|character| character == '/' || character == '\\')
        && Path::new(theme_name)
            .file_name()
            .and_then(|name| name.to_str())
            == Some(theme_name)
}

pub fn ensure_default_theme_file(app_handle: &tauri::AppHandle) -> Result<(), String> {
    let themes_dir = ConfigManager::get_notestoat_dir(app_handle)?.join("monaco-editor");
    fs::create_dir_all(&themes_dir).map_err(|error| error.to_string())?;

    let theme_path = themes_dir.join("Firow.json");
    if theme_path.exists() {
        return Ok(());
    }

    if let Ok(resource_path) = app_handle
        .path()
        .resolve("Firow.json", BaseDirectory::Resource)
    {
        if resource_path.exists() {
            fs::copy(resource_path, &theme_path).map_err(|error| error.to_string())?;
            return Ok(());
        }
    }

    fs::write(theme_path, FIROW_THEME_BUNDLED).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn get_monaco_themes(app_handle: tauri::AppHandle) -> Result<Vec<String>, String> {
    let themes_dir = ConfigManager::get_notestoat_dir(&app_handle)?.join("monaco-editor");
    fs::create_dir_all(&themes_dir).map_err(|error| error.to_string())?;

    let mut themes: Vec<String> = BUILT_IN_THEMES
        .iter()
        .map(|theme| (*theme).to_string())
        .collect();
    for entry in fs::read_dir(themes_dir).map_err(|error| error.to_string())? {
        let path = entry.map_err(|error| error.to_string())?.path();
        if path.extension().and_then(|extension| extension.to_str()) == Some("json") {
            if let Some(theme_name) = path.file_stem().and_then(|name| name.to_str()) {
                themes.push(theme_name.to_string());
            }
        }
    }

    themes.sort_unstable();
    themes.dedup();
    Ok(themes)
}

#[tauri::command]
pub fn read_monaco_theme(
    app_handle: tauri::AppHandle,
    theme_name: String,
) -> Result<String, String> {
    if BUILT_IN_THEMES.contains(&theme_name.as_str()) {
        return Ok(String::new());
    }
    if !is_valid_theme_name(&theme_name) {
        return Err("Invalid theme name".into());
    }

    let theme_path = ConfigManager::get_notestoat_dir(&app_handle)?
        .join("monaco-editor")
        .join(format!("{theme_name}.json"));
    if !theme_path.exists() {
        return Err(format!("Theme file not found: {theme_name}"));
    }
    fs::read_to_string(theme_path).map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::is_valid_theme_name;

    #[test]
    fn rejects_theme_path_traversal() {
        assert!(!is_valid_theme_name("../secret"));
        assert!(!is_valid_theme_name("folder/theme"));
        assert!(is_valid_theme_name("Birds of Paradise"));
    }
}
