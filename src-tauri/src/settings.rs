//! The settings of the app: a JSON file in the configuration directory of the
//! user, independent of the data directory.

use crate::error::{AppError, Result};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct Settings {
    /// The id of the font of the notes editor; `None` for the default font.
    #[serde(default)]
    pub notes_font: Option<String>,
    /// True to hide completed todos in the list; `None` for the default (true).
    #[serde(default)]
    pub hide_completed: Option<bool>,
    /// Keys that this version does not know. They stay in the file.
    #[serde(flatten)]
    pub other: serde_json::Map<String, serde_json::Value>,
}

const FILE_NAME: &str = "settings.json";

/// The directory of the settings file.
pub fn config_dir() -> PathBuf {
    dirs::config_dir().unwrap_or_else(|| PathBuf::from(".")).join("ich-habe-fertig")
}

impl Settings {
    /// Loads the settings. A missing or invalid file gives the defaults.
    pub fn load(dir: &Path) -> Self {
        std::fs::read_to_string(dir.join(FILE_NAME))
            .ok()
            .and_then(|raw| serde_json::from_str(&raw).ok())
            .unwrap_or_default()
    }

    /// Writes the settings to a temporary file, then renames it, so that the
    /// file is never half written.
    pub fn save(&self, dir: &Path) -> Result<()> {
        std::fs::create_dir_all(dir)?;
        let tmp = dir.join(format!("{FILE_NAME}.tmp"));
        let raw = serde_json::to_string_pretty(self).map_err(|e| AppError::Invalid(e.to_string()))?;
        std::fs::write(&tmp, raw)?;
        std::fs::rename(&tmp, dir.join(FILE_NAME))?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn missing_file_gives_defaults() {
        let d = tempdir().unwrap();
        assert_eq!(Settings::load(d.path()), Settings::default());
    }

    #[test]
    fn invalid_file_gives_defaults() {
        let d = tempdir().unwrap();
        std::fs::write(d.path().join(FILE_NAME), "{not json").unwrap();
        assert_eq!(Settings::load(d.path()), Settings::default());
    }

    #[test]
    fn round_trip_keeps_unknown_keys() {
        let d = tempdir().unwrap();
        std::fs::write(d.path().join(FILE_NAME), r#"{"notes_font":"inter","future":42}"#).unwrap();
        let mut s = Settings::load(d.path());
        assert_eq!(s.notes_font.as_deref(), Some("inter"));
        s.notes_font = Some("fira-code".into());
        s.save(&d.path().join("sub")).unwrap();
        let back = Settings::load(&d.path().join("sub"));
        assert_eq!(back.notes_font.as_deref(), Some("fira-code"));
        assert_eq!(back.other.get("future"), Some(&serde_json::json!(42)));
        assert_eq!(back.hide_completed, None);
    }
}
