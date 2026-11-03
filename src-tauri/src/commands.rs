//! Tauri commands. The open store lives in the managed `AppState`.

use crate::categories::Category;
use crate::error::{AppError, Result};
use crate::images::{self, ClipboardImage};
use crate::settings::{self, Settings};
use crate::store::{SubTask, TodoItem, TodoStore};
use chrono::{DateTime, NaiveDate, Utc};
use serde::Serialize;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::State;

#[derive(Default)]
pub struct AppState {
    pub store: Mutex<Option<TodoStore>>,
    /// The error of the data directory from the command line, if any.
    pub startup_error: Mutex<Option<String>>,
}

impl AppState {
    /// Opens the store in a directory; creates the directory if necessary.
    pub fn open(&self, path: &Path) -> std::result::Result<PathBuf, String> {
        let dir = crate::cli::prepare_dir(path)?;
        let store = TodoStore::open(&dir).map_err(|e| e.to_string())?;
        *self.store.lock().unwrap() = Some(store);
        Ok(dir)
    }

    fn with<T>(&self, f: impl FnOnce(&TodoStore) -> Result<T>) -> Result<T> {
        let guard = self.store.lock().unwrap();
        let store = guard.as_ref().ok_or_else(|| AppError::Invalid("no data directory is open".into()))?;
        f(store)
    }
}

#[derive(Serialize)]
pub struct Startup {
    data_dir: Option<String>,
    error: Option<String>,
}

#[tauri::command]
pub fn startup(state: State<AppState>) -> Startup {
    let data_dir = state
        .store
        .lock()
        .unwrap()
        .as_ref()
        .map(|s| s.data_dir().to_string_lossy().into_owned());
    Startup { data_dir, error: state.startup_error.lock().unwrap().clone() }
}

#[tauri::command]
pub fn open_data_dir(state: State<AppState>, path: String) -> std::result::Result<String, String> {
    state.open(Path::new(&path)).map(|p| p.to_string_lossy().into_owned())
}

#[tauri::command]
pub fn load_items(state: State<AppState>) -> Result<Vec<TodoItem>> {
    state.with(|s| s.load())
}

/// Adds a todo, optionally with a category.
#[tauri::command]
pub fn add_item(state: State<AppState>, text: String, category: Option<String>) -> Result<TodoItem> {
    state.with(|s| {
        if let Some(c) = category.as_deref() {
            s.require_category(c)?;
        }
        let item = s.add(&text, "")?;
        if let Some(c) = category.as_deref().filter(|c| !c.trim().is_empty()) {
            s.set_category(&item.id, c)?;
        }
        Ok(s.get(&item.id)?.unwrap_or(item))
    })
}

#[tauri::command]
pub fn delete_item(state: State<AppState>, id: String) -> Result<bool> {
    state.with(|s| s.delete_item(&id))
}

#[tauri::command]
pub fn set_done(state: State<AppState>, id: String, done: bool) -> Result<bool> {
    state.with(|s| s.set_done(&id, done))
}

#[tauri::command]
pub fn update_text(state: State<AppState>, id: String, text: String) -> Result<bool> {
    state.with(|s| s.update_text(&id, &text))
}

#[tauri::command]
pub fn update_notes(state: State<AppState>, id: String, notes: String) -> Result<bool> {
    state.with(|s| s.update_notes(&id, &notes))
}

#[tauri::command]
pub fn set_category(state: State<AppState>, id: String, category: String) -> Result<bool> {
    state.with(|s| {
        s.require_category(&category)?;
        s.set_category(&id, &category)
    })
}

/// `due` is a date `YYYY-MM-DD`, or null to clear the due date.
#[tauri::command]
pub fn set_due(state: State<AppState>, id: String, due: Option<String>) -> Result<bool> {
    let due = due
        .map(|d| NaiveDate::parse_from_str(&d, "%Y-%m-%d"))
        .transpose()
        .map_err(|e| AppError::Invalid(format!("invalid date: {e}")))?;
    state.with(|s| s.set_due_at(&id, due))
}

/// `created` is an RFC 3339 time stamp.
#[tauri::command]
pub fn set_created(state: State<AppState>, id: String, created: String) -> Result<bool> {
    let created = DateTime::parse_from_rfc3339(&created)
        .map_err(|e| AppError::Invalid(format!("invalid time: {e}")))?
        .with_timezone(&Utc);
    state.with(|s| s.set_created_at(&id, created))
}

#[tauri::command]
pub fn add_subtask(state: State<AppState>, id: String, text: String) -> Result<Option<SubTask>> {
    state.with(|s| s.add_subtask(&id, &text))
}

#[tauri::command]
pub fn set_subtask_done(state: State<AppState>, id: String, sub_id: String, done: bool) -> Result<bool> {
    state.with(|s| s.set_subtask_done(&id, &sub_id, done))
}

#[tauri::command]
pub fn update_subtask_text(state: State<AppState>, id: String, sub_id: String, text: String) -> Result<bool> {
    state.with(|s| s.update_subtask_text(&id, &sub_id, &text))
}

#[tauri::command]
pub fn delete_subtask(state: State<AppState>, id: String, sub_id: String) -> Result<bool> {
    state.with(|s| s.delete_subtask(&id, &sub_id))
}

#[tauri::command]
pub fn remove_image(state: State<AppState>, id: String, rel: String) -> Result<bool> {
    state.with(|s| s.remove_image(&id, &rel))
}

/// Attaches the image of the clipboard to an item. Returns the number of
/// attached images.
#[tauri::command]
pub fn paste_image(state: State<AppState>, id: String) -> Result<usize> {
    let content = images::read_clipboard()?;
    state.with(|s| match content {
        ClipboardImage::Png(bytes) => images::save_bytes(s, &id, &bytes, "png").map(|_| 1),
        ClipboardImage::Files(files) => import_all(s, &id, &files),
    })
}

/// Attaches image files to an item. Skips files that are not images. Returns
/// the number of attached images.
#[tauri::command]
pub fn import_images(state: State<AppState>, id: String, paths: Vec<String>) -> Result<usize> {
    let files: Vec<PathBuf> = paths.into_iter().map(PathBuf::from).collect();
    state.with(|s| import_all(s, &id, &files))
}

fn import_all(s: &TodoStore, id: &str, files: &[PathBuf]) -> Result<usize> {
    let mut n = 0;
    for f in files {
        if images::import_file(s, id, f)?.is_some() {
            n += 1;
        }
    }
    Ok(n)
}

/// Opens an image in the external viewer `cheder`.
#[tauri::command]
pub fn open_image(state: State<AppState>, rel: String) -> Result<()> {
    let abs = state.with(|s| s.resolve(&rel).ok_or_else(|| AppError::Invalid(format!("invalid path: {rel}"))))?;
    if !abs.is_file() {
        return Err(AppError::Invalid(format!("Image file not found: {}", abs.display())));
    }
    let mut child = std::process::Command::new("cheder")
        .arg(&abs)
        .spawn()
        .map_err(|e| AppError::Invalid(format!("Could not launch 'cheder': {e}")))?;
    // Reap the process when it exits.
    std::thread::spawn(move || {
        let _ = child.wait();
    });
    Ok(())
}

#[tauri::command]
pub fn load_settings() -> Settings {
    Settings::load(&settings::config_dir())
}

#[tauri::command]
pub fn save_settings(settings: Settings) -> Result<()> {
    settings.save(&settings::config_dir())
}

#[tauri::command]
pub fn list_categories(state: State<AppState>) -> Result<Vec<Category>> {
    state.with(|s| s.categories())
}

#[tauri::command]
pub fn add_category(state: State<AppState>, name: String) -> Result<bool> {
    state.with(|s| s.add_category(&name))
}

#[tauri::command]
pub fn rename_category(state: State<AppState>, old: String, new: String) -> Result<usize> {
    state.with(|s| s.rename_category(&old, &new))
}

#[tauri::command]
pub fn delete_category(state: State<AppState>, name: String) -> Result<usize> {
    state.with(|s| s.delete_category(&name))
}

#[tauri::command]
pub fn set_category_archived(state: State<AppState>, name: String, archived: bool) -> Result<()> {
    state.with(|s| s.set_category_archived(&name, archived))
}

/// `color` is `#rrggbb`, or null for the automatic color.
#[tauri::command]
pub fn set_category_color(state: State<AppState>, name: String, color: Option<String>) -> Result<()> {
    state.with(|s| s.set_category_color(&name, color.as_deref()))
}
