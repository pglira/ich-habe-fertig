mod cli;
mod commands;
mod error;
mod images;
mod protocol;
mod settings;
mod store;

use commands::AppState;
use std::path::Path;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let args: Vec<String> = std::env::args().collect();
    let state = AppState::default();
    // Without a data directory argument, the frontend asks for a directory.
    if let Some(dir) = cli::data_dir_arg(&args) {
        if let Err(e) = state.open(Path::new(dir)) {
            *state.startup_error.lock().unwrap() = Some(e);
        }
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .register_uri_scheme_protocol(protocol::SCHEME, protocol::handle)
        .manage(state)
        .invoke_handler(tauri::generate_handler![
            commands::startup,
            commands::open_data_dir,
            commands::load_items,
            commands::add_item,
            commands::delete_item,
            commands::set_done,
            commands::update_text,
            commands::update_notes,
            commands::set_category,
            commands::set_due,
            commands::set_created,
            commands::add_subtask,
            commands::set_subtask_done,
            commands::update_subtask_text,
            commands::delete_subtask,
            commands::remove_image,
            commands::paste_image,
            commands::import_images,
            commands::open_image,
            commands::load_settings,
            commands::save_settings,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
